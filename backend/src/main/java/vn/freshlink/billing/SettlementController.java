package vn.freshlink.billing;

import java.math.*;
import java.util.*;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import vn.freshlink.identity.Actor;
import vn.freshlink.common.*;
import vn.freshlink.common.api.ApiResponse;

@RestController @RequestMapping("/api/billing")
public class SettlementController {
    private final JdbcTemplate jdbc;private final Sql sql;private final Idempotency dedup;
    public SettlementController(JdbcTemplate jdbc,Sql sql,Idempotency dedup) {this.jdbc=jdbc;this.sql=sql;this.dedup=dedup;}
    public record Settlement(@NotNull Long batchId,@NotNull @Digits(integer=13,fraction=2) BigDecimal adjustment,@NotBlank @Size(max=500) String note) {}
    @PostMapping("/settlements") @Transactional public ApiResponse<?> create(@AuthenticationPrincipal Actor a,@Valid @RequestBody Settlement r,@RequestHeader("Idempotency-Key") String key) {
        a.requireRole("ACCOUNTANT");return ApiResponse.success(dedup.execute(a.userId(),key,"SETTLEMENT",r.toString(),()->{
            var batch=jdbc.queryForMap("SELECT b.*,i.supplier_unit_price,i.commission_rate FROM batches b JOIN supply_request_items i ON i.supply_request_item_id=b.supply_request_item_id WHERE b.batch_id=? FOR UPDATE",r.batchId());
            BigDecimal quantity=(BigDecimal)batch.get("accepted_quantity");
            if(quantity.signum()<=0) throw new IllegalArgumentException("Lô chưa có lượng đạt để đối soát");
            BigDecimal gross=quantity.multiply((BigDecimal)batch.get("supplier_unit_price")).setScale(2,RoundingMode.HALF_UP);
            BigDecimal commission=gross.multiply((BigDecimal)batch.get("commission_rate")).divide(new BigDecimal("100"),2,RoundingMode.HALF_UP);
            BigDecimal net=gross.subtract(commission).add(r.adjustment());
            if(net.signum()<0) throw new IllegalArgumentException("Giá trị đối soát không được âm");
            long id=sql.insert("INSERT INTO supplier_settlements(settlement_code,supplier_id,period_start,period_end,gross_goods_amount,commission_amount,adjustment_amount,payable_amount,status,created_by) VALUES (?,?,UTC_DATE(),UTC_DATE(),?,?,?,?,'CONFIRMED',?)","ST-"+UUID.randomUUID(),batch.get("supplier_id"),gross,commission,r.adjustment(),net,a.userId());
            jdbc.update("INSERT INTO settlement_items(settlement_id,batch_id,delivered_quantity,supplier_unit_price,gross_amount,commission_rate,commission_amount,adjustment_amount,net_amount,note) VALUES (?,?,?,?,?,?,?,?,?,?)",id,r.batchId(),quantity,batch.get("supplier_unit_price"),gross,batch.get("commission_rate"),commission,r.adjustment(),net,r.note());
            jdbc.update("INSERT INTO audit_logs(actor_user_id,action_code,entity_type,entity_id,new_data) VALUES (?,'CONFIRM_SETTLEMENT','SETTLEMENT',?,JSON_OBJECT('reason',?,'adjustment',?))",a.userId(),id,r.note(),r.adjustment());return id;
        }),"Đã chốt đối soát theo lượng đạt tại Gate");
    }
    @GetMapping("/settlements") public ApiResponse<?> list(@AuthenticationPrincipal Actor a,@RequestParam(required=false) Long supplierId) {
        if(supplierId!=null) {a.requireOrganization(supplierId,"SUPPLIER_MANAGER");return ApiResponse.success(jdbc.queryForList("SELECT * FROM supplier_settlements WHERE supplier_id=? ORDER BY settlement_id DESC LIMIT 200",supplierId),"Đối soát và chi trả");}
        a.requireRole("ACCOUNTANT");return ApiResponse.success(jdbc.queryForList("SELECT * FROM supplier_settlements ORDER BY settlement_id DESC LIMIT 200"),"Đối soát và chi trả");
    }
    public record Pay(@NotBlank @Size(max=150) String reference) {}
    @PostMapping("/settlements/{id}/pay") @Transactional public ApiResponse<?> pay(@AuthenticationPrincipal Actor a,@PathVariable long id,@Valid @RequestBody Pay r,@RequestHeader("Idempotency-Key") String key) {
        a.requireRole("ACCOUNTANT");return ApiResponse.success(dedup.execute(a.userId(),key,"PAY_SETTLEMENT_"+id,r.toString(),()->{
            if(jdbc.update("UPDATE supplier_settlements SET status='PAID',paid_at=UTC_TIMESTAMP(3),external_reference=? WHERE settlement_id=? AND status='CONFIRMED'",r.reference(),id)!=1) throw new IllegalArgumentException("Đối soát không ở trạng thái chờ chi trả");return id;
        }),"Đã ghi nhận chi trả");
    }
    public record Adjustment(@NotNull @Digits(integer=13,fraction=2) BigDecimal amount,@NotBlank @Size(max=500) String reason) {}
    @PostMapping("/orders/{id}/adjust") @Transactional public ApiResponse<?> adjust(@AuthenticationPrincipal Actor a,@PathVariable long id,@Valid @RequestBody Adjustment r,@RequestHeader("Idempotency-Key") String key) {
        a.requireRole("ACCOUNTANT");return ApiResponse.success(dedup.execute(a.userId(),key,"ADJUST_ORDER_"+id,r.toString(),()->{
            var order=jdbc.queryForMap("SELECT * FROM customer_orders WHERE order_id=? FOR UPDATE",id);
            BigDecimal total=((BigDecimal)order.get("total_amount")).add(r.amount());
            BigDecimal paid=jdbc.queryForObject("SELECT COALESCE(SUM(CASE payment_type WHEN 'REFUND' THEN -amount ELSE amount END),0) FROM payments WHERE order_id=? AND status='CONFIRMED'",BigDecimal.class,id);
            if(total.signum()<0 || total.compareTo(paid)<0) throw new IllegalArgumentException("Tổng mới không được âm hoặc thấp hơn số đã thu; ghi nhận hoàn tiền trước nếu cần");
            jdbc.update("UPDATE customer_orders SET adjustment_amount=adjustment_amount+?,total_amount=?,payment_status=? WHERE order_id=?",r.amount(),total,total.compareTo(paid)==0?"PAID":paid.signum()>0?"PARTIALLY_PAID":"UNPAID",id);
            jdbc.update("INSERT INTO audit_logs(actor_user_id,action_code,entity_type,entity_id,old_data,new_data) VALUES (?,'ADJUST_ORDER','ORDER',?,JSON_OBJECT('total',?),JSON_OBJECT('total',?,'reason',?))",a.userId(),id,order.get("total_amount"),total,r.reason());return id;
        }),"Đã ghi nhận điều chỉnh có lý do");
    }
    public record Refund(@NotNull @DecimalMin("0.01") @Digits(integer=13,fraction=2) BigDecimal amount,@NotBlank @Size(max=150) String reference,@NotBlank @Size(max=500) String reason) {}
    @PostMapping("/orders/{id}/refund") @Transactional public ApiResponse<?> refund(@AuthenticationPrincipal Actor a,@PathVariable long id,@Valid @RequestBody Refund r,@RequestHeader("Idempotency-Key") String key) {
        a.requireRole("ACCOUNTANT");return ApiResponse.success(dedup.execute(a.userId(),key,"REFUND_"+id,r.toString(),()->{
            var order=jdbc.queryForMap("SELECT * FROM customer_orders WHERE order_id=? FOR UPDATE",id);
            BigDecimal paid=jdbc.queryForObject("SELECT COALESCE(SUM(CASE payment_type WHEN 'REFUND' THEN -amount ELSE amount END),0) FROM payments WHERE order_id=? AND status='CONFIRMED'",BigDecimal.class,id);
            if(r.amount().compareTo(paid)>0) throw new IllegalArgumentException("Không hoàn vượt số đã thu");
            long payment=sql.insert("INSERT INTO payments(payment_code,order_id,restaurant_id,payment_type,method,amount,status,external_reference,paid_at,confirmed_by,confirmed_at,note) VALUES (?,?,?,'REFUND','BANK_TRANSFER',?,'CONFIRMED',?,UTC_TIMESTAMP(3),?,UTC_TIMESTAMP(3),?)","REF-"+UUID.randomUUID(),id,order.get("restaurant_id"),r.amount(),r.reference(),a.userId(),r.reason());
            jdbc.update("UPDATE customer_orders SET payment_status=? WHERE order_id=?",paid.compareTo(r.amount())==0?"REFUNDED":"PARTIALLY_PAID",id);return payment;
        }),"Đã ghi nhận hoàn tiền thủ công");
    }
}
