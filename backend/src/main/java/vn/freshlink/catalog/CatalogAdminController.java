package vn.freshlink.catalog;

import java.math.BigDecimal;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import vn.freshlink.identity.Actor;
import vn.freshlink.common.Sql;
import vn.freshlink.common.api.ApiResponse;

@RestController @RequestMapping("/api")
public class CatalogAdminController {
    private final JdbcTemplate jdbc;private final Sql sql;
    public CatalogAdminController(JdbcTemplate jdbc,Sql sql) {this.jdbc=jdbc;this.sql=sql;}
    @GetMapping("/public/categories") public ApiResponse<?> categories() {return ApiResponse.success(jdbc.queryForList("SELECT category_id,category_name FROM product_categories WHERE active=TRUE"),"Nhóm sản phẩm");}
    public record Sku(@NotNull Long categoryId,@NotBlank @Size(max=40) String productCode,@NotBlank @Size(max=150) String name,
        @NotBlank @Size(max=50) String skuCode,@NotBlank @Size(max=200) String packDescription,
        @NotBlank @Pattern(regexp="KG|GRAM|PACK|BAG|BOX|BUNCH|CRATE") String unit,
        @NotNull @DecimalMin("0.001") @Digits(integer=9,fraction=3) BigDecimal packSize,
        @NotNull @DecimalMin("0.001") @Digits(integer=9,fraction=3) BigDecimal minimum,
        @NotNull @DecimalMin("0.001") @Digits(integer=9,fraction=3) BigDecimal step) {}
    @PostMapping("/operations/catalog") @Transactional public ApiResponse<?> create(@AuthenticationPrincipal Actor a,@Valid @RequestBody Sku r) {
        a.requireRole("OPERATIONS_COORDINATOR");
        long product=sql.insert("INSERT INTO products(category_id,product_code,product_name) VALUES (?,?,?)",r.categoryId(),r.productCode(),r.name());
        return ApiResponse.success(sql.insert("INSERT INTO product_skus(product_id,sku_code,sku_name,base_unit,pack_size,pack_description,minimum_order_quantity,quantity_step) VALUES (?,?,?,?,?,?,?,?)",product,r.skuCode(),r.name(),r.unit(),r.packSize(),r.packDescription(),r.minimum(),r.step()),"Đã tạo sản phẩm và SKU");
    }
}
