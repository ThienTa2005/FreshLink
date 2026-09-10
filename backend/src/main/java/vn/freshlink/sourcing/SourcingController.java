package vn.freshlink.sourcing;

import java.math.BigDecimal;
import java.time.LocalDate;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import vn.freshlink.identity.Actor;
import vn.freshlink.common.api.ApiResponse;

@RestController @RequestMapping("/api")
public class SourcingController {
    private final SourcingService service; private final JdbcTemplate jdbc;
    public SourcingController(SourcingService service,JdbcTemplate jdbc) {this.service=service;this.jdbc=jdbc;}
    @PostMapping("/supplier/offers") public ApiResponse<?> offer(@AuthenticationPrincipal Actor a,@Valid @RequestBody SourcingService.Offer r) {return ApiResponse.success(service.offer(a,r),"Đã khai báo năng lực");}
    @GetMapping("/supplier/requests") public ApiResponse<?> requests(@AuthenticationPrincipal Actor a,@RequestParam long supplierId) {
        a.requireOrganization(supplierId,"SUPPLIER_MANAGER","SUPPLIER_STAFF");
        return ApiResponse.success(jdbc.queryForList("SELECT r.request_code,r.required_date,r.required_arrival_time,i.*,s.sku_name FROM supply_requests r JOIN supply_request_items i ON i.supply_request_id=r.supply_request_id JOIN product_skus s ON s.sku_id=i.sku_id WHERE r.supplier_id=? ORDER BY r.required_date DESC LIMIT 200",supplierId),"Yêu cầu cung ứng");
    }
    public record Response(@NotNull @DecimalMin("0") @Digits(integer=9,fraction=3) BigDecimal quantity) {}
    @PostMapping("/supplier/requests/{id}/respond") public ApiResponse<?> respond(@AuthenticationPrincipal Actor a,@PathVariable long id,@Valid @RequestBody Response r) {service.respond(a,id,r.quantity());return ApiResponse.success(null,"Đã phản hồi");}
    @PostMapping("/operations/supply-requests") public ApiResponse<?> request(@AuthenticationPrincipal Actor a,@Valid @RequestBody SourcingService.Request r,@RequestHeader("Idempotency-Key") String key) {return ApiResponse.success(service.request(a,r,key),"Đã gửi yêu cầu cung ứng");}
    @GetMapping("/operations/demand") public ApiResponse<?> demand(@AuthenticationPrincipal Actor a,@RequestParam LocalDate date) {
        a.requireRole("OPERATIONS_COORDINATOR");
        return ApiResponse.success(jdbc.queryForList("""
            SELECT i.order_item_id,o.order_code,i.sku_id,s.sku_name,i.confirmed_quantity,
              (SELECT COALESCE(SUM(x.planned_quantity),0) FROM supply_request_item_orders x JOIN supply_request_items si ON si.supply_request_item_id=x.supply_request_item_id WHERE x.order_item_id=i.order_item_id AND si.status NOT IN ('REJECTED','CANCELLED')) AS sourced_quantity
            FROM order_items i JOIN customer_orders o ON o.order_id=i.order_id JOIN product_skus s ON s.sku_id=i.sku_id
            WHERE o.delivery_date=? AND o.order_status IN ('CONFIRMED','SOURCING') ORDER BY i.sku_id,o.order_id
            """,date),"Nhu cầu theo ngày");
    }
    @GetMapping("/operations/offers") public ApiResponse<?> offers(@AuthenticationPrincipal Actor a,@RequestParam LocalDate date) {
        a.requireRole("OPERATIONS_COORDINATOR");
        return ApiResponse.success(jdbc.queryForList("SELECT f.*,o.organization_name,s.sku_name FROM supplier_sku_offers f JOIN organizations o ON o.organization_id=f.supplier_id JOIN product_skus s ON s.sku_id=f.sku_id WHERE f.available_date=? AND o.status='ACTIVE' AND f.status IN ('AVAILABLE','PARTIALLY_RESERVED')",date),"Nguồn cung");
    }
}
