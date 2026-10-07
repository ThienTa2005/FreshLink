package vn.freshlink.quality;

import java.math.BigDecimal;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import vn.freshlink.identity.Actor;
import vn.freshlink.common.api.ApiResponse;

@RestController @RequestMapping("/api")
public class QualityController {
    private final QualityService quality; private final JdbcTemplate jdbc;
    public QualityController(QualityService quality,JdbcTemplate jdbc) {this.quality=quality;this.jdbc=jdbc;}
    @PostMapping("/batches") public ApiResponse<?> create(@AuthenticationPrincipal Actor a,@Valid @RequestBody QualityService.Batch r,@RequestHeader("Idempotency-Key") String key) {return ApiResponse.success(quality.create(a,r,key),"Đã tạo lô");}
    @GetMapping("/batches") public ApiResponse<?> list(@AuthenticationPrincipal Actor a,@RequestParam(required=false) Long supplierId) {
        if(supplierId==null) {
            a.requireRole("QUALITY_INSPECTOR","OPERATIONS_COORDINATOR");
            return ApiResponse.success(jdbc.queryForList("""
                SELECT b.*, s.sku_name, o.organization_name,
                  TIMESTAMPDIFF(MINUTE, b.created_at, UTC_TIMESTAMP(3)) AS dwell_minutes,
                  CASE WHEN TIMESTAMPDIFF(MINUTE, b.created_at, UTC_TIMESTAMP(3)) > 180 AND b.batch_status NOT IN ('CLOSED', 'REJECTED') THEN TRUE ELSE FALSE END AS dwell_exceeded,
                  CASE WHEN DATE(CONVERT_TZ(b.created_at, '+00:00', '+07:00')) < CURRENT_DATE() AND b.batch_status NOT IN ('CLOSED', 'REJECTED') THEN TRUE ELSE FALSE END AS is_overnight
                FROM batches b
                JOIN product_skus s ON s.sku_id=b.sku_id
                JOIN organizations o ON o.organization_id=b.supplier_id
                ORDER BY b.batch_id DESC LIMIT 200
            """),"Lô hàng");
        }
        a.requireOrganization(supplierId,"SUPPLIER_MANAGER","SUPPLIER_STAFF");
        return ApiResponse.success(jdbc.queryForList("""
            SELECT b.*, s.sku_name,
              TIMESTAMPDIFF(MINUTE, b.created_at, UTC_TIMESTAMP(3)) AS dwell_minutes,
              CASE WHEN TIMESTAMPDIFF(MINUTE, b.created_at, UTC_TIMESTAMP(3)) > 180 AND b.batch_status NOT IN ('CLOSED', 'REJECTED') THEN TRUE ELSE FALSE END AS dwell_exceeded,
              CASE WHEN DATE(CONVERT_TZ(b.created_at, '+00:00', '+07:00')) < CURRENT_DATE() AND b.batch_status NOT IN ('CLOSED', 'REJECTED') THEN TRUE ELSE FALSE END AS is_overnight
            FROM batches b
            JOIN product_skus s ON s.sku_id=b.sku_id
            WHERE b.supplier_id=? ORDER BY b.batch_id DESC LIMIT 200
        """,supplierId),"Lô hàng của đơn vị");
    }

    public record AiVisualCheckReq(Long batchId, Long evidenceFileId, String imageUrl, String skuName, BigDecimal declaredQuantity) {}

    @PostMapping("/batches/{id}/ai-visual-check")
    public ApiResponse<?> aiVisualCheckBatch(@AuthenticationPrincipal Actor a, @PathVariable long id, @RequestBody(required = false) AiVisualCheckReq r) {
        Long evId = r != null ? r.evidenceFileId() : null;
        String imgUrl = r != null ? r.imageUrl() : null;
        return ApiResponse.success(quality.aiVisualCheck(a, id, evId, imgUrl, null, null), "Kết quả AI quét ngoại quan");
    }

    @PostMapping("/batches/ai-visual-check")
    public ApiResponse<?> aiVisualCheckGeneral(@AuthenticationPrincipal Actor a, @RequestBody AiVisualCheckReq r) {
        return ApiResponse.success(quality.aiVisualCheck(a, r.batchId(), r.evidenceFileId(), r.imageUrl(), r.skuName(), r.declaredQuantity()), "Kết quả AI quét ngoại quan");
    }

    @GetMapping("/batches/gate-kpi")
    public ApiResponse<?> gateKpi(@AuthenticationPrincipal Actor a) {
        a.requireRole("QUALITY_INSPECTOR", "OPERATIONS_COORDINATOR", "SYSTEM_ADMIN");
        var list = jdbc.queryForList("""
            SELECT
              COUNT(*) AS total_active,
              SUM(CASE WHEN TIMESTAMPDIFF(MINUTE, created_at, UTC_TIMESTAMP(3)) <= 180 THEN 1 ELSE 0 END) AS within_sla,
              SUM(CASE WHEN TIMESTAMPDIFF(MINUTE, created_at, UTC_TIMESTAMP(3)) > 180 THEN 1 ELSE 0 END) AS dwell_exceeded,
              SUM(CASE WHEN DATE(CONVERT_TZ(created_at, '+00:00', '+07:00')) < CURRENT_DATE() THEN 1 ELSE 0 END) AS overnight_count,
              COALESCE(AVG(TIMESTAMPDIFF(MINUTE, created_at, UTC_TIMESTAMP(3))), 0) AS avg_dwell_minutes
            FROM batches
            WHERE batch_status NOT IN ('CLOSED', 'REJECTED')
        """);
        return ApiResponse.success(!list.isEmpty() ? list.get(0) : java.util.Map.of(), "KPI kiểm soát thời gian lưu trạm Gate");
    }

    @PostMapping("/batches/{id}/inspect") public ApiResponse<?> inspect(@AuthenticationPrincipal Actor a,@PathVariable long id,@Valid @RequestBody QualityService.Inspection r,@RequestHeader("Idempotency-Key") String key) {return ApiResponse.success(quality.inspect(a,id,r,key),"Đã lưu kiểm nhận");}
    @PostMapping("/allocations") public ApiResponse<?> allocate(@AuthenticationPrincipal Actor a,@Valid @RequestBody QualityService.Allocation r,@RequestHeader("Idempotency-Key") String key) {return ApiResponse.success(quality.allocate(a,r,key),"Đã chia hàng");}
}
