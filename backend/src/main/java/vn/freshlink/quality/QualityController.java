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
        if(supplierId==null) { a.requireRole("QUALITY_INSPECTOR","OPERATIONS_COORDINATOR"); return ApiResponse.success(jdbc.queryForList("SELECT b.*,s.sku_name,o.organization_name FROM batches b JOIN product_skus s ON s.sku_id=b.sku_id JOIN organizations o ON o.organization_id=b.supplier_id ORDER BY b.batch_id DESC LIMIT 200"),"Lô hàng"); }
        a.requireOrganization(supplierId,"SUPPLIER_MANAGER","SUPPLIER_STAFF");
        return ApiResponse.success(jdbc.queryForList("SELECT b.*,s.sku_name FROM batches b JOIN product_skus s ON s.sku_id=b.sku_id WHERE b.supplier_id=? ORDER BY b.batch_id DESC LIMIT 200",supplierId),"Lô hàng của đơn vị");
    }

    @PostMapping("/batches/{id}/inspect") public ApiResponse<?> inspect(@AuthenticationPrincipal Actor a,@PathVariable long id,@Valid @RequestBody QualityService.Inspection r,@RequestHeader("Idempotency-Key") String key) {return ApiResponse.success(quality.inspect(a,id,r,key),"Đã lưu kiểm nhận");}
    @PostMapping("/allocations") public ApiResponse<?> allocate(@AuthenticationPrincipal Actor a,@Valid @RequestBody QualityService.Allocation r,@RequestHeader("Idempotency-Key") String key) {return ApiResponse.success(quality.allocate(a,r,key),"Đã chia hàng");}
}
