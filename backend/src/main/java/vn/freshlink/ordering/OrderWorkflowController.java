package vn.freshlink.ordering;

import java.math.*;
import java.time.*;
import java.util.*;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import vn.freshlink.common.Sql;
import vn.freshlink.common.api.ApiResponse;
import vn.freshlink.identity.Actor;

@RestController @RequestMapping("/api/orders")
public class OrderWorkflowController {
    private final JdbcTemplate jdbc; private final Sql sql;
    @Value("${app.order.cutoff:17:00}") private LocalTime cutoff;
    public OrderWorkflowController(JdbcTemplate jdbc,Sql sql){this.jdbc=jdbc;this.sql=sql;}
    public record Item(@NotNull Long skuId,@NotNull @DecimalMin("0.001") @Digits(integer=9,fraction=3) BigDecimal quantity){}
    public record Update(@NotNull Long addressId,@NotNull LocalDate date,@NotNull LocalTime startTime,@NotNull LocalTime endTime,@Size(max=1000) String note,@NotEmpty @Size(max=100) List<@Valid Item> items){}
    public record Reason(@NotBlank @Size(max=500) String reason){}
    public record Decision(boolean approved,@Size(max=500) String reason){}

    private void cutoff(LocalDate date){if(!ZonedDateTime.now(ZoneId.of("Asia/Ho_Chi_Minh")).isBefore(date.minusDays(1).atTime(cutoff).atZone(ZoneId.of("Asia/Ho_Chi_Minh")))) throw new ResponseStatusException(HttpStatus.CONFLICT,"Đã qua giờ chốt đơn");}
    private Map<String,Object> lock(long id){var rows=jdbc.queryForList("SELECT * FROM customer_orders WHERE order_id=? FOR UPDATE",id);if(rows.isEmpty())throw new ResponseStatusException(HttpStatus.NOT_FOUND,"Không tìm thấy đơn");return rows.get(0);}
    private void audit(Actor a,String action,long id,String note){jdbc.update("INSERT INTO audit_logs(actor_user_id,action_code,entity_type,entity_id,new_data) VALUES (?,?,'ORDER',?,JSON_OBJECT('note',?))",a.userId(),action,id,note);}

    @PutMapping("/{id}") @Transactional public ApiResponse<?> update(@AuthenticationPrincipal Actor a,@PathVariable long id,@Valid @RequestBody Update r){
        var o=lock(id);long org=((Number)o.get("restaurant_id")).longValue();a.requireOrganization(org,"RESTAURANT_MANAGER","RESTAURANT_PURCHASER");cutoff(LocalDate.parse(o.get("delivery_date").toString()));cutoff(r.date());
        if(!Set.of("DRAFT","CONFIRMED").contains(o.get("order_status")))throw new ResponseStatusException(HttpStatus.CONFLICT,"Chỉ sửa đơn nháp hoặc đơn chưa giữ nguồn");
        if(!r.endTime().isAfter(r.startTime()))throw new IllegalArgumentException("Khung nhận hàng không hợp lệ");
        if(jdbc.queryForObject("SELECT COUNT(*) FROM addresses WHERE address_id=? AND organization_id=? AND active=TRUE AND address_type='DELIVERY'",Integer.class,r.addressId(),org)!=1)throw new IllegalArgumentException("Địa chỉ giao không hợp lệ");
        if(jdbc.queryForObject("SELECT COUNT(*) FROM supply_request_item_orders x JOIN order_items i ON i.order_item_id=x.order_item_id WHERE i.order_id=?",Integer.class,id)>0)throw new ResponseStatusException(HttpStatus.CONFLICT,"Đơn đã giữ nguồn cung và không thể sửa");
        jdbc.update("UPDATE weekly_plan_items SET converted_order_item_id=NULL WHERE converted_order_item_id IN (SELECT order_item_id FROM order_items WHERE order_id=?)",id);jdbc.update("DELETE FROM order_items WHERE order_id=?",id);
        Set<Long> seen=new HashSet<>();BigDecimal subtotal=BigDecimal.ZERO;var at=java.sql.Timestamp.from(r.date().atStartOfDay(ZoneId.of("Asia/Ho_Chi_Minh")).toInstant());
        for(var item:r.items()){
            if(!seen.add(item.skuId()))throw new IllegalArgumentException("Mỗi SKU chỉ xuất hiện một lần");
            var sku=jdbc.queryForList("SELECT minimum_order_quantity,quantity_step FROM product_skus WHERE sku_id=? AND active=TRUE",item.skuId());if(sku.isEmpty())throw new IllegalArgumentException("SKU không hoạt động");
            BigDecimal min=(BigDecimal)sku.get(0).get("minimum_order_quantity"),step=(BigDecimal)sku.get(0).get("quantity_step");if(item.quantity().compareTo(min)<0||item.quantity().subtract(min).remainder(step).signum()!=0)throw new IllegalArgumentException("Số lượng không đúng quy cách");
            var prices=jdbc.queryForList("SELECT selling_unit_price FROM sku_prices WHERE sku_id=? AND district IS NULL AND valid_from<=? AND (valid_to IS NULL OR valid_to>?) ORDER BY valid_from DESC,sku_price_id DESC LIMIT 1",BigDecimal.class,item.skuId(),at,at);if(prices.isEmpty())throw new ResponseStatusException(HttpStatus.CONFLICT,"SKU chưa có giá cho ngày giao");
            BigDecimal total=prices.get(0).multiply(item.quantity()).setScale(2,RoundingMode.HALF_UP);sql.insert("INSERT INTO order_items(order_id,sku_id,requested_quantity,confirmed_quantity,unit_price,line_total_amount,item_status) VALUES (?,?,?,?,?,?,'CONFIRMED')",id,item.skuId(),item.quantity(),item.quantity(),prices.get(0),total);subtotal=subtotal.add(total);
        }
        jdbc.update("UPDATE customer_orders SET delivery_address_id=?,delivery_date=?,receiving_start_time=?,receiving_end_time=?,note=?,subtotal_amount=?,total_amount=? WHERE order_id=?",r.addressId(),r.date(),r.startTime(),r.endTime(),r.note(),subtotal,subtotal,id);audit(a,"UPDATE_ORDER",id,"updated before cutoff");return ApiResponse.success(id,"Đã cập nhật đơn");
    }
    @PostMapping({"/{id}/submit", "/{id}/submit-approval"}) @Transactional
    public ApiResponse<?> submit(@AuthenticationPrincipal Actor a,@PathVariable long id) {
        var o=lock(id); a.requireOrganization(((Number)o.get("restaurant_id")).longValue(),"RESTAURANT_MANAGER","RESTAURANT_PURCHASER");
        cutoff(LocalDate.parse(o.get("delivery_date").toString()));
        if(!"DRAFT".equals(o.get("order_status"))) throw new ResponseStatusException(HttpStatus.CONFLICT,"Chỉ gửi đơn nháp");
        boolean pending=Boolean.TRUE.equals(o.get("approval_required"));
        String state=pending?"SUBMITTED":"CONFIRMED";
        jdbc.update("UPDATE customer_orders SET order_status=?,approval_status=?,submitted_at=UTC_TIMESTAMP(3),confirmed_at=IF(?='CONFIRMED',UTC_TIMESTAMP(3),NULL),rejection_reason=NULL WHERE order_id=?",state,pending?"PENDING":"NOT_REQUIRED",state,id);
        jdbc.update("INSERT INTO order_status_history(order_id,old_status,new_status,changed_by) VALUES (?,'DRAFT',?,?)",id,state,a.userId());
        audit(a,"SUBMIT_ORDER",id,state); return ApiResponse.success(id,pending?"Đã gửi quản lý duyệt":"Đã xác nhận đơn");
    }
    @PostMapping("/{id}/approve") @Transactional
    public ApiResponse<?> approve(@AuthenticationPrincipal Actor a,@PathVariable long id,@Valid @RequestBody Decision r) {
        var o=lock(id); a.requireOrganization(((Number)o.get("restaurant_id")).longValue(),"RESTAURANT_MANAGER");
        cutoff(LocalDate.parse(o.get("delivery_date").toString()));
        if(!"PENDING".equals(o.get("approval_status"))||!"SUBMITTED".equals(o.get("order_status"))) throw new ResponseStatusException(HttpStatus.CONFLICT,"Đơn không chờ duyệt");
        if(!r.approved()&&(r.reason()==null||r.reason().isBlank())) throw new IllegalArgumentException("Cần lý do từ chối");
        String state=r.approved()?"CONFIRMED":"DRAFT";
        jdbc.update("UPDATE customer_orders SET order_status=?,approval_status=?,approved_by=?,approved_at=UTC_TIMESTAMP(3),rejection_reason=?,confirmed_at=IF(?='CONFIRMED',UTC_TIMESTAMP(3),NULL) WHERE order_id=?",state,r.approved()?"APPROVED":"REJECTED",a.userId(),r.reason(),state,id);
        jdbc.update("INSERT INTO order_status_history(order_id,old_status,new_status,reason,changed_by) VALUES (?,'SUBMITTED',?,?,?)",id,state,r.reason(),a.userId());
        audit(a,"DECIDE_ORDER",id,r.reason()); return ApiResponse.success(id,r.approved()?"Đã duyệt đơn":"Đã trả về nháp để chỉnh sửa");
    }
    @PostMapping("/{id}/cancel") @Transactional
    public ApiResponse<?> cancel(@AuthenticationPrincipal Actor a,@PathVariable long id,@Valid @RequestBody Reason r) {
        var o=lock(id);a.requireOrganization(((Number)o.get("restaurant_id")).longValue(),"RESTAURANT_MANAGER","RESTAURANT_PURCHASER");
        cutoff(LocalDate.parse(o.get("delivery_date").toString()));
        if(!Set.of("DRAFT","SUBMITTED","CONFIRMED","SOURCING").contains(o.get("order_status"))) throw new ResponseStatusException(HttpStatus.CONFLICT,"Đơn không thể hủy");
        var requests=jdbc.queryForList("SELECT s.* FROM supply_request_items s JOIN supply_request_item_orders x ON x.supply_request_item_id=s.supply_request_item_id JOIN order_items i ON i.order_item_id=x.order_item_id WHERE i.order_id=? AND s.status NOT IN ('CANCELLED','REJECTED') FOR UPDATE",id);
        for(var request:requests) {
            if(jdbc.queryForObject("SELECT COUNT(*) FROM batches WHERE supply_request_item_id=? AND batch_status<>'CLOSED'",Integer.class,request.get("supply_request_item_id"))>0)
                throw new ResponseStatusException(HttpStatus.CONFLICT,"NCC đã chuẩn bị lô; liên hệ điều phối xử lý trước khi hủy");
            BigDecimal reserved="PENDING".equals(request.get("status"))?(BigDecimal)request.get("requested_quantity"):(BigDecimal)request.get("accepted_quantity");
            jdbc.update("UPDATE supplier_sku_offers SET reserved_quantity=GREATEST(0,reserved_quantity-?),status='AVAILABLE' WHERE supplier_offer_id=?",reserved,request.get("supplier_offer_id"));
            jdbc.update("UPDATE supply_request_items SET status='CANCELLED' WHERE supply_request_item_id=?",request.get("supply_request_item_id"));
            jdbc.update("UPDATE supply_requests SET status='CANCELLED',cancellation_reason=?,cancelled_at=UTC_TIMESTAMP(3) WHERE supply_request_id=?",r.reason(),request.get("supply_request_id"));
        }
        var xs=jdbc.queryForList("SELECT ba.* FROM batch_allocations ba JOIN order_items i ON i.order_item_id=ba.order_item_id WHERE i.order_id=? AND ba.allocation_status='RESERVED' FOR UPDATE",id);
        for(var x:xs) {
            jdbc.update("UPDATE batches SET allocated_quantity=allocated_quantity-? WHERE batch_id=?",x.get("allocated_quantity"),x.get("batch_id"));
            jdbc.update("UPDATE batch_allocations SET allocation_status='CANCELLED' WHERE batch_allocation_id=?",x.get("batch_allocation_id"));
        }
        jdbc.update("UPDATE weekly_plan_items SET converted_order_item_id=NULL WHERE converted_order_item_id IN (SELECT order_item_id FROM order_items WHERE order_id=?)",id);
        jdbc.update("UPDATE customer_orders SET order_status='CANCELLED',cancelled_at=UTC_TIMESTAMP(3),cancellation_reason=? WHERE order_id=?",r.reason(),id);
        jdbc.update("UPDATE order_items SET item_status='CANCELLED' WHERE order_id=?",id);
        audit(a,"CANCEL_ORDER",id,r.reason());return ApiResponse.success(id,"Đã hủy đơn và giải phóng nguồn");
    }
}
