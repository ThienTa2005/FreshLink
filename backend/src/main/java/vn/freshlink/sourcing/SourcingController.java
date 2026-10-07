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
        return ApiResponse.success(jdbc.queryForList("SELECT r.request_code,r.required_date,r.required_arrival_time,i.*,s.sku_name,ad.address_name,ad.address_line,GREATEST(0,i.accepted_quantity-(SELECT COALESCE(SUM(b.declared_quantity),0) FROM batches b WHERE b.supply_request_item_id=i.supply_request_item_id AND b.batch_status<>'CLOSED')) remaining_quantity FROM supply_requests r JOIN supply_request_items i ON i.supply_request_id=r.supply_request_id JOIN product_skus s ON s.sku_id=i.sku_id JOIN addresses ad ON ad.address_id=r.delivery_to_address_id WHERE r.supplier_id=? ORDER BY r.required_date DESC LIMIT 200",supplierId),"Yêu cầu cung ứng");
    }
    public record Response(@NotNull @DecimalMin("0") @Digits(integer=9,fraction=3) BigDecimal quantity) {}
    @PostMapping("/supplier/requests/{id}/respond") public ApiResponse<?> respond(@AuthenticationPrincipal Actor a,@PathVariable long id,@Valid @RequestBody Response r) {service.respond(a,id,r.quantity());return ApiResponse.success(null,"Đã phản hồi");}
    @PostMapping("/operations/supply-requests") public ApiResponse<?> request(@AuthenticationPrincipal Actor a,@Valid @RequestBody SourcingService.Request r,@RequestHeader("Idempotency-Key") String key) {return ApiResponse.success(service.request(a,r,key),"Đã gửi yêu cầu cung ứng");}
    @GetMapping("/operations/demand") public ApiResponse<?> demand(@AuthenticationPrincipal Actor a,@RequestParam LocalDate date) {
        a.requireRole("OPERATIONS_COORDINATOR");
        return ApiResponse.success(jdbc.queryForList("""
            SELECT i.order_item_id,o.order_id,o.order_code,i.sku_id,s.sku_name,i.confirmed_quantity,
              (SELECT COALESCE(SUM(x.planned_quantity),0) FROM supply_request_item_orders x JOIN supply_request_items si ON si.supply_request_item_id=x.supply_request_item_id WHERE x.order_item_id=i.order_item_id AND si.status NOT IN ('REJECTED','CANCELLED')) AS sourced_quantity,
              (SELECT COALESCE(SUM(a.allocated_quantity),0) FROM batch_allocations a WHERE a.order_item_id=i.order_item_id AND a.allocation_status NOT IN ('CANCELLED','RELEASED')) allocated_quantity
            FROM order_items i JOIN customer_orders o ON o.order_id=i.order_id JOIN product_skus s ON s.sku_id=i.sku_id
            WHERE o.delivery_date=? AND o.order_status IN ('CONFIRMED','SOURCING') ORDER BY i.sku_id,o.order_id
            """,date),"Nhu cầu theo ngày");
    }
    @GetMapping("/operations/offers") public ApiResponse<?> offers(@AuthenticationPrincipal Actor a,@RequestParam LocalDate date) {
        a.requireRole("OPERATIONS_COORDINATOR");
        return ApiResponse.success(jdbc.queryForList("""
            SELECT f.*, o.organization_name, s.sku_name,
              COALESCE(sp.supplier_score, 92.5) AS trust_score,
              COALESCE(sp.tier_rank, 'GOLD_AA') AS tier_rank,
              COALESCE(sp.on_time_rate, 98.0) AS on_time_rate,
              CASE WHEN (SELECT COUNT(*) FROM supplier_documents sd WHERE sd.supplier_id=f.supplier_id AND sd.document_type='VIETGAP' AND sd.verification_status='APPROVED') > 0 THEN TRUE ELSE FALSE END AS has_vietgap,
              CASE WHEN COALESCE(sp.supplier_score, 0) > 95 THEN 1000 ELSE 1500 END AS fee_per_kg,
              (SELECT ROUND(SUM(b.accepted_quantity)/NULLIF(SUM(b.received_quantity),0)*100,1) FROM batches b WHERE b.supplier_id=f.supplier_id AND b.received_at IS NOT NULL) quality_rate,
              ROUND(
                (COALESCE(sp.supplier_score, 90.0) * 0.4) +
                (COALESCE(sp.on_time_rate, 95.0) * 0.3) +
                (COALESCE((SELECT ROUND(SUM(b.accepted_quantity)/NULLIF(SUM(b.received_quantity),0)*100,1) FROM batches b WHERE b.supplier_id=f.supplier_id AND b.received_at IS NOT NULL), 95.0) * 0.3),
                1
              ) AS allocation_priority_score
            FROM supplier_sku_offers f
            JOIN organizations o ON o.organization_id=f.supplier_id
            JOIN product_skus s ON s.sku_id=f.sku_id
            LEFT JOIN supplier_profiles sp ON sp.supplier_id=f.supplier_id
            WHERE f.available_date=? AND o.status='ACTIVE' AND f.status IN ('AVAILABLE','PARTIALLY_RESERVED')
            ORDER BY allocation_priority_score DESC, f.supplier_unit_price ASC
        """,date),"Nguồn cung ưu tiên theo Coop Trust Score & Phí HTX");
    }

    @GetMapping("/operations/surplus-batches")
    public ApiResponse<?> surplusBatches(@AuthenticationPrincipal Actor a) {
        a.requireRole("OPERATIONS_COORDINATOR", "QUALITY_INSPECTOR", "SYSTEM_ADMIN");
        return ApiResponse.success(jdbc.queryForList("""
            SELECT b.batch_id, b.batch_code, b.sku_id, s.sku_name, b.supplier_id, o.organization_name AS supplier_name,
              b.accepted_quantity, b.allocated_quantity,
              (b.accepted_quantity - b.allocated_quantity) AS surplus_quantity,
              b.created_at, b.received_at,
              TIMESTAMPDIFF(MINUTE, b.created_at, UTC_TIMESTAMP(3)) AS dwell_minutes,
              p.shelf_life_hours,
              COALESCE(p.discount_percent, 25) AS suggested_discount_percent
            FROM batches b
            JOIN product_skus s ON s.sku_id = b.sku_id
            JOIN products p ON p.product_id = s.product_id
            JOIN organizations o ON o.organization_id = b.supplier_id
            WHERE b.batch_status IN ('ACCEPTED', 'PARTIALLY_ACCEPTED')
              AND (b.accepted_quantity - b.allocated_quantity) > 0.001
            ORDER BY b.batch_id DESC
        """), "Hàng dư thương mại tại trạm Gate");
    }

    public record SurplusReallocateReq(
        @NotNull Long batchId,
        @NotNull Long targetOrderItemId,
        @NotNull @DecimalMin("0.001") BigDecimal quantity,
        String note
    ) {}

    @PostMapping("/operations/surplus-reallocate")
    @org.springframework.transaction.annotation.Transactional
    public ApiResponse<?> reallocateSurplus(@AuthenticationPrincipal Actor a, @Valid @RequestBody SurplusReallocateReq r) {
        a.requireRole("OPERATIONS_COORDINATOR");
        var batch = jdbc.queryForMap("SELECT * FROM batches WHERE batch_id = ? FOR UPDATE", r.batchId());
        BigDecimal available = ((BigDecimal) batch.get("accepted_quantity")).subtract((BigDecimal) batch.get("allocated_quantity"));
        if (r.quantity().compareTo(available) > 0) {
            throw new IllegalArgumentException("Vượt lượng dư khả dụng của lô");
        }
        var item = jdbc.queryForMap("SELECT * FROM order_items WHERE order_item_id = ? FOR UPDATE", r.targetOrderItemId());
        if (!item.get("sku_id").equals(batch.get("sku_id"))) {
            throw new IllegalArgumentException("Lô dư và dòng đơn mục tiêu không cùng SKU");
        }
        jdbc.update("INSERT INTO batch_allocations(batch_id, order_item_id, allocated_quantity, allocated_by) VALUES (?, ?, ?, ?)",
            r.batchId(), r.targetOrderItemId(), r.quantity(), a.userId());
        jdbc.update("UPDATE batches SET allocated_quantity = allocated_quantity + ? WHERE batch_id = ?",
            r.quantity(), r.batchId());
        return ApiResponse.success(null, "Tái phân bổ hàng dư thành công");
    }
}
