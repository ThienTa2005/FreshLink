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
public class BillingController {
    private final JdbcTemplate jdbc;private final Sql sql;private final Idempotency dedup;
    public BillingController(JdbcTemplate jdbc,Sql sql,Idempotency dedup) {this.jdbc=jdbc;this.sql=sql;this.dedup=dedup;}
    @GetMapping("/orders") public ApiResponse<?> orders(@AuthenticationPrincipal Actor a,@RequestParam(required=false) Long restaurantId) {
        String query="SELECT o.order_id,o.order_code,o.restaurant_id,o.total_amount,o.payment_status,COALESCE((SELECT SUM(CASE p.payment_type WHEN 'REFUND' THEN -p.amount ELSE p.amount END) FROM payments p WHERE p.order_id=o.order_id AND p.status='CONFIRMED'),0) AS paid FROM customer_orders o";
        if(restaurantId!=null) {a.requireOrganization(restaurantId,"RESTAURANT_MANAGER");return ApiResponse.success(jdbc.queryForList(query+" WHERE o.restaurant_id=? ORDER BY o.order_id DESC LIMIT 200",restaurantId),"Đối soát nhà hàng");}
        a.requireRole("ACCOUNTANT");return ApiResponse.success(jdbc.queryForList(query+" ORDER BY o.order_id DESC LIMIT 200"),"Khoản phải thu");
    }
    public record Payment(@NotNull Long orderId,@NotNull @DecimalMin("0.01") @Digits(integer=13,fraction=2) BigDecimal amount,@NotBlank @Pattern(regexp="CASH|BANK_TRANSFER") String method,@NotBlank @Size(max=150) String reference) {}
    @PostMapping("/payments") @Transactional public ApiResponse<?> pay(@AuthenticationPrincipal Actor a,@Valid @RequestBody Payment r,@RequestHeader("Idempotency-Key") String key) {
        a.requireRole("ACCOUNTANT");long id=dedup.execute(a.userId(),key,"PAYMENT",r.toString(),()->{
            var order=jdbc.queryForMap("SELECT * FROM customer_orders WHERE order_id=? FOR UPDATE",r.orderId());
            BigDecimal paid=jdbc.queryForObject("SELECT COALESCE(SUM(CASE payment_type WHEN 'REFUND' THEN -amount ELSE amount END),0) FROM payments WHERE order_id=? AND status='CONFIRMED'",BigDecimal.class,r.orderId());
            BigDecimal total=(BigDecimal)order.get("total_amount");
            if(paid.add(r.amount()).compareTo(total)>0) throw new IllegalArgumentException("Khoản thu vượt số còn phải trả");
            long payment=sql.insert("INSERT INTO payments(payment_code,order_id,restaurant_id,payment_type,method,amount,status,external_reference,paid_at,confirmed_by,confirmed_at) VALUES (?,?,?,'CUSTOMER_PAYMENT',?,?,'CONFIRMED',?,UTC_TIMESTAMP(3),?,UTC_TIMESTAMP(3))","PAY-"+UUID.randomUUID(),r.orderId(),order.get("restaurant_id"),r.method(),r.amount(),r.reference(),a.userId());
            jdbc.update("UPDATE customer_orders SET payment_status=? WHERE order_id=?",paid.add(r.amount()).compareTo(total)==0?"PAID":"PARTIALLY_PAID",r.orderId());return payment;
        });return ApiResponse.success(id,"Đã ghi nhận thanh toán thủ công");
    }
    @GetMapping("/suppliers") public ApiResponse<?> suppliers(@AuthenticationPrincipal Actor a,@RequestParam(required=false) Long supplierId) {
        String query="SELECT b.batch_id,b.batch_code,b.supplier_id,b.accepted_quantity,i.supplier_unit_price,i.commission_rate,ROUND(b.accepted_quantity*i.supplier_unit_price*(1-i.commission_rate/100),2) AS payable FROM batches b JOIN supply_request_items i ON i.supply_request_item_id=b.supply_request_item_id WHERE b.accepted_quantity>0";
        if(supplierId!=null) {a.requireOrganization(supplierId,"SUPPLIER_MANAGER");return ApiResponse.success(jdbc.queryForList(query+" AND b.supplier_id=? ORDER BY b.batch_id DESC LIMIT 200",supplierId),"Giá trị hàng đạt để đối soát");}
        a.requireRole("ACCOUNTANT");return ApiResponse.success(jdbc.queryForList(query+" ORDER BY b.batch_id DESC LIMIT 200"),"Giá trị hàng đạt để đối soát");
    }
}
