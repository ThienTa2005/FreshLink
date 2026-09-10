package vn.freshlink.ordering;

import java.math.BigDecimal;
import java.time.*;
import java.util.*;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import vn.freshlink.common.*;
import vn.freshlink.identity.Actor;

@Service
public class OrderingService {
    private final JdbcTemplate jdbc; private final Sql sql; private final Idempotency dedup;
    @Value("${app.order.cutoff:17:00}") private LocalTime cutoff;
    public OrderingService(JdbcTemplate jdbc,Sql sql,Idempotency dedup) {this.jdbc=jdbc;this.sql=sql;this.dedup=dedup;}
    public record Line(@NotNull Long skuId,@NotNull @DecimalMin("0.001") @Digits(integer=9,fraction=3) BigDecimal quantity) {}
    public record Create(@NotNull Long restaurantId,@NotNull Long addressId,@NotNull LocalDate date,
        @NotNull LocalTime startTime,@NotNull LocalTime endTime,@Size(max=1000) String note,
        @NotEmpty @Size(max=100) List<@NotNull @Valid Line> items,Long weeklyPlanId) {
        public Create(Long restaurantId,Long addressId,LocalDate date,LocalTime startTime,LocalTime endTime,String note,List<Line> items) {this(restaurantId,addressId,date,startTime,endTime,note,items,null);}
    }
    @Transactional public long create(Actor actor,Create request,String key) {
        actor.requireOrganization(request.restaurantId(),"RESTAURANT_MANAGER","RESTAURANT_PURCHASER");
        return dedup.execute(actor.userId(),key,"CREATE_ORDER",request.toString(),()->createOnce(actor,request));
    }
    private long createOnce(Actor actor,Create r) {
        if(r.weeklyPlanId()!=null) {
            var plan=jdbc.queryForMap("SELECT * FROM weekly_demand_plans WHERE weekly_plan_id=? FOR UPDATE",r.weeklyPlanId());
            if(((Number)plan.get("restaurant_id")).longValue()!=r.restaurantId()) throw new org.springframework.security.access.AccessDeniedException("Kế hoạch không thuộc nhà hàng");
            var lines=jdbc.queryForList("SELECT * FROM weekly_plan_items WHERE weekly_plan_id=? AND demand_date=?",r.weeklyPlanId(),r.date());
            if(lines.size()!=r.items().size() || lines.stream().anyMatch(line->line.get("converted_order_item_id")!=null)) throw new IllegalArgumentException("Ngày kế hoạch đã chốt hoặc không khớp các dòng đặt hàng");
            for(var line:lines) if(r.items().stream().noneMatch(i->i.skuId().longValue()==((Number)line.get("sku_id")).longValue() && i.quantity().compareTo((BigDecimal)line.get("planned_quantity"))==0)) throw new IllegalArgumentException("Số lượng đặt không khớp kế hoạch ngày");
        }
        if (!r.endTime().isAfter(r.startTime())) throw new IllegalArgumentException("Khung nhận hàng không hợp lệ");
        if (!ZonedDateTime.now(ZoneId.of("Asia/Ho_Chi_Minh")).isBefore(r.date().minusDays(1).atTime(cutoff).atZone(ZoneId.of("Asia/Ho_Chi_Minh"))))
            throw new ResponseStatusException(HttpStatus.CONFLICT,"Đã qua giờ chốt đơn cho ngày giao này");
        if (jdbc.queryForObject("SELECT COUNT(*) FROM addresses a JOIN organizations o ON o.organization_id=a.organization_id WHERE a.address_id=? AND a.organization_id=? AND a.active=TRUE AND a.address_type='DELIVERY' AND o.status='ACTIVE'",Integer.class,r.addressId(),r.restaurantId())!=1)
            throw new IllegalArgumentException("Địa chỉ giao không thuộc nhà hàng hoặc không hoạt động");
        Set<Long> seen=new HashSet<>();
        long id=sql.insert("INSERT INTO customer_orders(order_code,restaurant_id,delivery_address_id,delivery_date,receiving_start_time,receiving_end_time,order_status,created_by,note,submitted_at,confirmed_at) VALUES (?,?,?,?,?,?,'CONFIRMED',?,?,UTC_TIMESTAMP(3),UTC_TIMESTAMP(3))", "FL-"+UUID.randomUUID().toString().substring(0,24),r.restaurantId(),r.addressId(),r.date(),r.startTime(),r.endTime(),actor.userId(),r.note());
        BigDecimal subtotal=BigDecimal.ZERO;
        for (Line line:r.items()) {
            if (!seen.add(line.skuId())) throw new IllegalArgumentException("Mỗi SKU chỉ xuất hiện một lần");
            var sku=jdbc.queryForList("SELECT minimum_order_quantity,quantity_step FROM product_skus WHERE sku_id=? AND active=TRUE",line.skuId());
            if (sku.isEmpty()) throw new IllegalArgumentException("SKU không hoạt động");
            BigDecimal minimum=(BigDecimal)sku.get(0).get("minimum_order_quantity"), step=(BigDecimal)sku.get(0).get("quantity_step");
            if (line.quantity().compareTo(minimum)<0 || line.quantity().subtract(minimum).remainder(step).signum()!=0) throw new IllegalArgumentException("Số lượng không đúng mức tối thiểu hoặc bước tăng");
            var date=java.sql.Timestamp.from(r.date().atStartOfDay(ZoneId.of("Asia/Ho_Chi_Minh")).toInstant());
            var prices=jdbc.queryForList("SELECT selling_unit_price FROM sku_prices WHERE sku_id=? AND district IS NULL AND valid_from<=? AND (valid_to IS NULL OR valid_to>?) ORDER BY valid_from DESC,sku_price_id DESC LIMIT 1",BigDecimal.class,line.skuId(),date,date);
            if (prices.isEmpty()) throw new ResponseStatusException(HttpStatus.CONFLICT,"SKU chưa có giá cho ngày giao");
            BigDecimal total=prices.get(0).multiply(line.quantity()).setScale(2,java.math.RoundingMode.HALF_UP);
            sql.insert("INSERT INTO order_items(order_id,sku_id,requested_quantity,confirmed_quantity,unit_price,line_total_amount,item_status) VALUES (?,?,?,?,?,?,'CONFIRMED')",id,line.skuId(),line.quantity(),line.quantity(),prices.get(0),total);
            subtotal=subtotal.add(total);
        }
        jdbc.update("UPDATE customer_orders SET subtotal_amount=?,total_amount=? WHERE order_id=?",subtotal,subtotal,id);
        if(r.weeklyPlanId()!=null) {
            jdbc.update("UPDATE customer_orders SET weekly_plan_id=? WHERE order_id=?",r.weeklyPlanId(),id);
            jdbc.update("UPDATE weekly_plan_items p JOIN order_items i ON i.sku_id=p.sku_id AND i.order_id=? SET p.converted_order_item_id=i.order_item_id WHERE p.weekly_plan_id=? AND p.demand_date=?",id,r.weeklyPlanId(),r.date());
        }
        jdbc.update("INSERT INTO order_status_history(order_id,new_status,changed_by,reason) VALUES (?,'CONFIRMED',?,'Nhà hàng xác nhận đơn ngày')",id,actor.userId());
        return id;
    }
    public List<Map<String,Object>> list(Actor actor,long restaurantId) {
        actor.requireOrganization(restaurantId,"RESTAURANT_MANAGER","RESTAURANT_PURCHASER","RESTAURANT_RECEIVER");
        return jdbc.queryForList("SELECT order_id,order_code,delivery_date,order_status,payment_status,total_amount FROM customer_orders WHERE restaurant_id=? ORDER BY delivery_date DESC,order_id DESC LIMIT 200",restaurantId);
    }
    public Map<String,Object> detail(Actor actor,long id) {
        var rows=jdbc.queryForList("SELECT * FROM customer_orders WHERE order_id=?",id);
        if(rows.isEmpty()) throw new ResponseStatusException(HttpStatus.NOT_FOUND,"Không tìm thấy đơn");
        var order=rows.get(0);
        if (!actor.hasRole("OPERATIONS_COORDINATOR") && !actor.hasRole("CUSTOMER_SUPPORT") && !actor.hasRole("ACCOUNTANT"))
            actor.requireOrganization(((Number)order.get("restaurant_id")).longValue(),"RESTAURANT_MANAGER","RESTAURANT_PURCHASER","RESTAURANT_RECEIVER");
        order.put("items",jdbc.queryForList("SELECT i.*,s.sku_name,s.base_unit FROM order_items i JOIN product_skus s ON s.sku_id=i.sku_id WHERE i.order_id=?",id));
        order.put("allocations",jdbc.queryForList("SELECT a.order_item_id,a.allocated_quantity,b.batch_code,b.batch_id FROM batch_allocations a JOIN batches b ON b.batch_id=a.batch_id JOIN order_items i ON i.order_item_id=a.order_item_id WHERE i.order_id=?",id));
        var stops=jdbc.queryForList("SELECT trip_stop_id,status,restaurant_confirmed_at FROM trip_stops WHERE order_id=? ORDER BY trip_stop_id",id);
        for(var stop:stops) stop.put("items",jdbc.queryForList("SELECT d.*,s.sku_name FROM delivery_items d JOIN order_items i ON i.order_item_id=d.order_item_id JOIN product_skus s ON s.sku_id=i.sku_id WHERE d.trip_stop_id=?",stop.get("trip_stop_id")));
        order.put("stops",stops);
        return order;
    }
}
