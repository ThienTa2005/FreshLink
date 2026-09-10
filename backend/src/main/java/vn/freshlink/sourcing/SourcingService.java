package vn.freshlink.sourcing;

import java.math.BigDecimal;
import java.time.*;
import java.util.*;
import jakarta.validation.constraints.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vn.freshlink.identity.Actor;
import vn.freshlink.common.*;

@Service
public class SourcingService {
    private final JdbcTemplate jdbc; private final Sql sql; private final Idempotency dedup;
    public SourcingService(JdbcTemplate jdbc,Sql sql,Idempotency dedup) {this.jdbc=jdbc;this.sql=sql;this.dedup=dedup;}
    public record Offer(@NotNull Long supplierId,@NotNull Long skuId,@NotNull LocalDate date,
        @NotNull @DecimalMin("0.001") @Digits(integer=9,fraction=3) BigDecimal quantity,
        @NotNull @DecimalMin("0") @Digits(integer=13,fraction=2) BigDecimal price) {}
    @Transactional public long offer(Actor actor,Offer o) {
        actor.requireOrganization(o.supplierId(),"SUPPLIER_MANAGER","SUPPLIER_STAFF");
        if(o.date().isBefore(LocalDate.now(ZoneId.of("Asia/Ho_Chi_Minh")))) throw new IllegalArgumentException("Ngày cung ứng không được ở quá khứ");
        if(jdbc.queryForObject("SELECT COUNT(*) FROM product_skus s JOIN products p ON p.product_id=s.product_id JOIN product_categories c ON c.category_id=p.category_id WHERE s.sku_id=? AND s.active=TRUE AND p.active=TRUE AND c.active=TRUE",Integer.class,o.skuId())!=1)
            throw new IllegalArgumentException("SKU hoặc nhóm sản phẩm không hoạt động");
        return sql.insert("INSERT INTO supplier_sku_offers(supplier_id,sku_id,available_date,available_quantity,supplier_unit_price,status) VALUES (?,?,?,?,?,'AVAILABLE')",o.supplierId(),o.skuId(),o.date(),o.quantity(),o.price());
    }
    public record Request(@NotNull Long offerId,@NotNull Long orderItemId,@NotNull Long crossDockId,
        @NotNull LocalTime arrivalTime,@NotNull @DecimalMin("0.001") @Digits(integer=9,fraction=3) BigDecimal quantity,
        @NotNull @DecimalMin("0") @DecimalMax("100") @Digits(integer=3,fraction=2) BigDecimal commissionRate) {}
    @Transactional public long request(Actor actor,Request r,String key) {
        actor.requireRole("OPERATIONS_COORDINATOR");
        return dedup.execute(actor.userId(),key,"SUPPLY_REQUEST",r.toString(),()->{
            var item=jdbc.queryForMap("SELECT i.*,o.delivery_date,o.order_status FROM order_items i JOIN customer_orders o ON o.order_id=i.order_id WHERE i.order_item_id=? FOR UPDATE",r.orderItemId());
            var offer=jdbc.queryForMap("SELECT * FROM supplier_sku_offers WHERE supplier_offer_id=? FOR UPDATE",r.offerId());
            if(jdbc.queryForObject("SELECT COUNT(*) FROM organizations WHERE organization_id=? AND status='ACTIVE'",Integer.class,offer.get("supplier_id"))!=1) throw new IllegalArgumentException("Nhà cung cấp không hoạt động");
            if (!item.get("sku_id").equals(offer.get("sku_id")) || !item.get("delivery_date").toString().equals(offer.get("available_date").toString())) throw new IllegalArgumentException("Nguồn cung phải cùng SKU và ngày giao");
            if (!Set.of("CONFIRMED","SOURCING").contains(item.get("order_status"))) throw new IllegalArgumentException("Đơn không còn ở bước phân nguồn");
            if (!Set.of("AVAILABLE","PARTIALLY_RESERVED").contains(offer.get("status"))) throw new IllegalArgumentException("Nguồn cung không khả dụng");
            if (jdbc.queryForObject("SELECT COUNT(*) FROM addresses WHERE address_id=? AND address_type='CROSS_DOCK' AND active=TRUE",Integer.class,r.crossDockId())!=1) throw new IllegalArgumentException("Điểm tập kết không hợp lệ");
            BigDecimal remaining=((BigDecimal)offer.get("available_quantity")).subtract((BigDecimal)offer.get("reserved_quantity"));
            if(r.quantity().compareTo(remaining)>0) throw new IllegalArgumentException("Vượt năng lực còn lại của nguồn");
            BigDecimal planned=jdbc.queryForObject("SELECT COALESCE(SUM(x.planned_quantity),0) FROM supply_request_item_orders x JOIN supply_request_items i ON i.supply_request_item_id=x.supply_request_item_id WHERE x.order_item_id=? AND i.status NOT IN ('REJECTED','CANCELLED')",BigDecimal.class,r.orderItemId());
            if(planned.add(r.quantity()).compareTo((BigDecimal)item.get("confirmed_quantity"))>0) throw new IllegalArgumentException("Vượt lượng đơn cần phân nguồn");
            long id=sql.insert("INSERT INTO supply_requests(request_code,supplier_id,delivery_to_address_id,required_date,required_arrival_time,status,sent_at,created_by) VALUES (?,?,?,?,?,'SENT',UTC_TIMESTAMP(3),?)","SR-"+UUID.randomUUID().toString().substring(0,24),offer.get("supplier_id"),r.crossDockId(),offer.get("available_date"),r.arrivalTime(),actor.userId());
            long line=sql.insert("INSERT INTO supply_request_items(supply_request_id,sku_id,supplier_offer_id,requested_quantity,supplier_unit_price,commission_rate) VALUES (?,?,?,?,?,?)",id,offer.get("sku_id"),r.offerId(),r.quantity(),offer.get("supplier_unit_price"),r.commissionRate());
            jdbc.update("INSERT INTO supply_request_item_orders(supply_request_item_id,order_item_id,planned_quantity) VALUES (?,?,?)",line,r.orderItemId(),r.quantity());
            jdbc.update("UPDATE supplier_sku_offers SET status=IF(reserved_quantity+?=available_quantity,'FULLY_RESERVED','PARTIALLY_RESERVED'),reserved_quantity=reserved_quantity+? WHERE supplier_offer_id=?",r.quantity(),r.quantity(),r.offerId());
            jdbc.update("UPDATE customer_orders SET order_status='SOURCING' WHERE order_id=?",item.get("order_id"));
            return id;
        });
    }
    @Transactional public void respond(Actor actor,long id,BigDecimal quantity) {
        var row=jdbc.queryForMap("SELECT i.*,r.supplier_id FROM supply_request_items i JOIN supply_requests r ON r.supply_request_id=i.supply_request_id WHERE i.supply_request_item_id=? FOR UPDATE",id);
        actor.requireOrganization(((Number)row.get("supplier_id")).longValue(),"SUPPLIER_MANAGER","SUPPLIER_STAFF");
        if(!row.get("status").equals("PENDING")) throw new IllegalArgumentException("Yêu cầu đã được phản hồi");
        BigDecimal requested=(BigDecimal)row.get("requested_quantity");
        if(quantity.signum()<0 || quantity.compareTo(requested)>0) throw new IllegalArgumentException("Lượng xác nhận không hợp lệ");
        String status=quantity.signum()==0?"REJECTED":quantity.compareTo(requested)==0?"ACCEPTED":"PARTIALLY_ACCEPTED";
        jdbc.update("UPDATE supply_request_items SET accepted_quantity=?,status=? WHERE supply_request_item_id=?",quantity,status,id);
        jdbc.update("UPDATE supply_requests SET status=?,responded_at=UTC_TIMESTAMP(3) WHERE supply_request_id=?",status,row.get("supply_request_id"));
        BigDecimal released=requested.subtract(quantity);
        jdbc.update("UPDATE supplier_sku_offers SET reserved_quantity=reserved_quantity-?,status=IF(reserved_quantity=0,'AVAILABLE',IF(reserved_quantity=available_quantity,'FULLY_RESERVED','PARTIALLY_RESERVED')) WHERE supplier_offer_id=?",released,row.get("supplier_offer_id"));
        if(quantity.signum()>0) jdbc.update("UPDATE supply_request_item_orders SET planned_quantity=? WHERE supply_request_item_id=?",quantity,id);
    }
}
