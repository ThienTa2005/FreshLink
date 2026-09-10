package vn.freshlink.sourcing;

import java.math.BigDecimal;
import java.time.*;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
import vn.freshlink.identity.Actor;
import vn.freshlink.common.api.ApiResponse;

@RestController
@RequestMapping("/api/supplier/offers")
public class OfferManagementController {
    private final JdbcTemplate jdbc;
    public OfferManagementController(JdbcTemplate jdbc) { this.jdbc=jdbc; }
    public record Update(@NotNull @DecimalMin("0.001") @Digits(integer=9,fraction=3) BigDecimal quantity,
                         @NotNull @DecimalMin("0") @Digits(integer=13,fraction=2) BigDecimal price) {}
    @GetMapping
    public ApiResponse<?> list(@AuthenticationPrincipal Actor actor,@RequestParam long supplierId,
                              @RequestParam(required=false) LocalDate date) {
        actor.requireOrganization(supplierId,"SUPPLIER_MANAGER","SUPPLIER_STAFF");
        return ApiResponse.success(jdbc.queryForList("""
            SELECT f.*,s.sku_name,s.base_unit FROM supplier_sku_offers f JOIN product_skus s ON s.sku_id=f.sku_id
            WHERE f.supplier_id=? AND (? IS NULL OR f.available_date=?) ORDER BY f.available_date DESC,f.supplier_offer_id DESC
            """,supplierId,date,date),"Nguồn cung của đơn vị");
    }
    private java.util.Map<String,Object> locked(Actor actor,long id) {
        var row=jdbc.queryForMap("SELECT * FROM supplier_sku_offers WHERE supplier_offer_id=? FOR UPDATE",id);
        actor.requireOrganization(((Number)row.get("supplier_id")).longValue(),"SUPPLIER_MANAGER","SUPPLIER_STAFF");
        return row;
    }
    @PutMapping("/{id}") @Transactional
    public ApiResponse<?> update(@AuthenticationPrincipal Actor actor,@PathVariable long id,@Valid @RequestBody Update request) {
        var row=locked(actor,id);
        BigDecimal reserved=(BigDecimal)row.get("reserved_quantity");
        if("CLOSED".equals(row.get("status")) || LocalDate.parse(row.get("available_date").toString()).isBefore(LocalDate.now(ZoneId.of("Asia/Ho_Chi_Minh"))))
            throw new ResponseStatusException(HttpStatus.CONFLICT,"Nguồn cung đã đóng hoặc đã qua ngày cung ứng");
        if(request.quantity().compareTo(reserved)<0) throw new ResponseStatusException(HttpStatus.CONFLICT,"Không giảm dưới lượng đã giữ chỗ");
        if(reserved.signum()>0 && request.price().compareTo((BigDecimal)row.get("supplier_unit_price"))!=0)
            throw new ResponseStatusException(HttpStatus.CONFLICT,"Không đổi giá nguồn đã giữ chỗ");
        String status=reserved.signum()==0?"AVAILABLE":reserved.compareTo(request.quantity())==0?"FULLY_RESERVED":"PARTIALLY_RESERVED";
        jdbc.update("UPDATE supplier_sku_offers SET available_quantity=?,supplier_unit_price=?,status=? WHERE supplier_offer_id=?",
            request.quantity(),request.price(),status,id);
        return ApiResponse.success(null,"Đã cập nhật nguồn cung");
    }
    @DeleteMapping("/{id}") @Transactional
    public ApiResponse<?> close(@AuthenticationPrincipal Actor actor,@PathVariable long id) {
        var row=locked(actor,id);
        if(((BigDecimal)row.get("reserved_quantity")).signum()>0)
            throw new ResponseStatusException(HttpStatus.CONFLICT,"Nguồn đang giữ chỗ cho yêu cầu cung ứng, không thể đóng");
        jdbc.update("UPDATE supplier_sku_offers SET status='CLOSED' WHERE supplier_offer_id=?",id);
        return ApiResponse.success(null,"Đã đóng nguồn cung");
    }
}
