package vn.freshlink.catalog;

import java.math.BigDecimal;
import java.time.*;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import vn.freshlink.identity.Actor;
import vn.freshlink.common.api.ApiResponse;

@RestController @RequestMapping("/api")
public class CatalogController {
    private final JdbcTemplate jdbc;
    public CatalogController(JdbcTemplate jdbc) {this.jdbc=jdbc;}
    @GetMapping("/public/catalog") public ApiResponse<?> catalog(@RequestParam LocalDate date) {
        return ApiResponse.success(jdbc.queryForList("""
            SELECT s.sku_id,s.product_id,s.sku_code,s.sku_name,s.base_unit,s.pack_size,s.pack_description,s.minimum_order_quantity,s.quantity_step,c.category_id,
              p.description,c.category_name,
              (SELECT pr.selling_unit_price FROM sku_prices pr WHERE pr.sku_id=s.sku_id AND pr.district IS NULL
                AND pr.valid_from<=? AND (pr.valid_to IS NULL OR pr.valid_to>?) ORDER BY pr.valid_from DESC,pr.sku_price_id DESC LIMIT 1) AS price,
              (SELECT COALESCE(SUM(o.available_quantity-o.reserved_quantity),0) FROM supplier_sku_offers o
                JOIN organizations org ON org.organization_id=o.supplier_id
                WHERE o.sku_id=s.sku_id AND o.available_date=? AND org.status='ACTIVE' AND o.status IN ('AVAILABLE','PARTIALLY_RESERVED')) AS available_quantity
            FROM product_skus s JOIN products p ON p.product_id=s.product_id JOIN product_categories c ON c.category_id=p.category_id
            WHERE s.active=TRUE AND p.active=TRUE AND c.active=TRUE ORDER BY s.sku_id
            """,java.sql.Timestamp.from(date.atStartOfDay(ZoneId.of("Asia/Ho_Chi_Minh")).toInstant()),java.sql.Timestamp.from(date.atStartOfDay(ZoneId.of("Asia/Ho_Chi_Minh")).toInstant()),date),"Danh mục theo ngày giao");
    }
    public record Price(@NotNull Long skuId,@NotNull @DecimalMin("0") @Digits(integer=13,fraction=2) BigDecimal price,@NotNull LocalDate date) {}
    @PostMapping("/operations/prices") public ApiResponse<?> price(@AuthenticationPrincipal Actor actor,@Valid @RequestBody Price p) {
        actor.requireRole("OPERATIONS_COORDINATOR");
        jdbc.update("INSERT INTO sku_prices(sku_id,selling_unit_price,valid_from,created_by) VALUES (?,?,?,?)",p.skuId(),p.price(),java.sql.Timestamp.from(p.date().atStartOfDay(ZoneId.of("Asia/Ho_Chi_Minh")).toInstant()),actor.userId());
        return ApiResponse.success(null,"Đã lưu giá; đơn cũ giữ nguyên giá đã chốt");
    }
}
