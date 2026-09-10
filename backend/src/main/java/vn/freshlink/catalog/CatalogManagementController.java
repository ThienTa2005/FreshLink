package vn.freshlink.catalog;

import java.math.BigDecimal;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import vn.freshlink.common.Sql;
import vn.freshlink.common.api.ApiResponse;
import vn.freshlink.identity.Actor;

@RestController
@RequestMapping("/api/operations")
public class CatalogManagementController {
    private final JdbcTemplate jdbc;
    private final Sql sql;
    public CatalogManagementController(JdbcTemplate jdbc, Sql sql) { this.jdbc=jdbc; this.sql=sql; }
    public record Category(@NotBlank @Size(max=30) String code, @NotBlank @Size(max=100) String name,
                           @Size(max=500) String description, @NotNull Boolean active) {}
    public record Product(@NotNull @Positive Long categoryId, @NotBlank @Size(max=40) String code,
                          @NotBlank @Size(max=150) String name, @Size(max=1000) String description,
                          @Size(max=255) String storageNote, @Min(1) @Max(65535) Integer shelfLifeHours,
                          @NotNull Boolean active) {}
    public record NewSku(@NotNull @Positive Long productId, @NotBlank @Size(max=50) String code,
                         @NotBlank @Size(max=180) String name,
                         @NotBlank @Pattern(regexp="KG|GRAM|PACK|BAG|BOX|BUNCH|CRATE") String unit,
                         @NotNull @DecimalMin("0.001") @Digits(integer=9,fraction=3) BigDecimal packSize,
                         @NotBlank @Size(max=200) String packDescription,
                         @NotNull @DecimalMin("0.001") @Digits(integer=9,fraction=3) BigDecimal minimum,
                         @NotNull @DecimalMin("0.001") @Digits(integer=9,fraction=3) BigDecimal step) {}
    // Unit, pack size and product identity are immutable; changing them would reinterpret historical orders.
    public record SkuUpdate(@NotBlank @Size(max=180) String name, @NotBlank @Size(max=200) String packDescription,
                            @NotNull @DecimalMin("0.001") @Digits(integer=9,fraction=3) BigDecimal minimum,
                            @NotNull @DecimalMin("0.001") @Digits(integer=9,fraction=3) BigDecimal step,
                            @NotNull Boolean active) {}
    private void authorize(Actor actor) { actor.requireRole("OPERATIONS_COORDINATOR"); }
    @GetMapping("/categories")
    public ApiResponse<?> categories(@AuthenticationPrincipal Actor actor) {
        authorize(actor);
        return ApiResponse.success(jdbc.queryForList("SELECT * FROM product_categories ORDER BY category_id"), "Nhóm sản phẩm");
    }
    @PostMapping("/categories")
    public ApiResponse<?> createCategory(@AuthenticationPrincipal Actor actor, @Valid @RequestBody Category r) {
        authorize(actor);
        return ApiResponse.success(sql.insert("INSERT INTO product_categories(category_code,category_name,description,active) VALUES (?,?,?,?)",
            r.code(),r.name(),r.description(),r.active()), "Đã tạo nhóm");
    }
    @PutMapping("/categories/{id}") @Transactional
    public ApiResponse<?> updateCategory(@AuthenticationPrincipal Actor actor, @PathVariable long id, @Valid @RequestBody Category r) {
        authorize(actor);
        jdbc.queryForMap("SELECT category_id FROM product_categories WHERE category_id=? FOR UPDATE",id);
        jdbc.update("UPDATE product_categories SET category_code=?,category_name=?,description=?,active=? WHERE category_id=?",
            r.code(),r.name(),r.description(),r.active(),id);
        return ApiResponse.success(null,"Đã cập nhật nhóm");
    }
    @DeleteMapping("/categories/{id}") @Transactional
    public ApiResponse<?> archiveCategory(@AuthenticationPrincipal Actor actor, @PathVariable long id) {
        authorize(actor);
        jdbc.queryForMap("SELECT category_id FROM product_categories WHERE category_id=? FOR UPDATE",id);
        jdbc.update("UPDATE product_categories SET active=FALSE WHERE category_id=?",id);
        return ApiResponse.success(null,"Đã ngừng sử dụng nhóm; giữ nguyên dữ liệu liên quan");
    }
    @GetMapping("/products")
    public ApiResponse<?> products(@AuthenticationPrincipal Actor actor) {
        authorize(actor);
        return ApiResponse.success(jdbc.queryForList("SELECT p.*,c.category_name FROM products p JOIN product_categories c ON c.category_id=p.category_id ORDER BY p.product_id DESC"),"Sản phẩm");
    }
    @PostMapping("/products") @Transactional
    public ApiResponse<?> createProduct(@AuthenticationPrincipal Actor actor, @Valid @RequestBody Product r) {
        authorize(actor);
        jdbc.queryForMap("SELECT category_id FROM product_categories WHERE category_id=?",r.categoryId());
        return ApiResponse.success(sql.insert("""
            INSERT INTO products(category_id,product_code,product_name,description,storage_temperature_note,shelf_life_hours,active)
            VALUES (?,?,?,?,?,?,?)
            """,r.categoryId(),r.code(),r.name(),r.description(),r.storageNote(),r.shelfLifeHours(),r.active()),"Đã tạo sản phẩm");
    }
    @PutMapping("/products/{id}") @Transactional
    public ApiResponse<?> updateProduct(@AuthenticationPrincipal Actor actor, @PathVariable long id, @Valid @RequestBody Product r) {
        authorize(actor);
        jdbc.queryForMap("SELECT product_id FROM products WHERE product_id=? FOR UPDATE",id);
        jdbc.queryForMap("SELECT category_id FROM product_categories WHERE category_id=?",r.categoryId());
        jdbc.update("""
            UPDATE products SET category_id=?,product_code=?,product_name=?,description=?,storage_temperature_note=?,shelf_life_hours=?,active=?
            WHERE product_id=?
            """,r.categoryId(),r.code(),r.name(),r.description(),r.storageNote(),r.shelfLifeHours(),r.active(),id);
        return ApiResponse.success(null,"Đã cập nhật sản phẩm");
    }
    @DeleteMapping("/products/{id}") @Transactional
    public ApiResponse<?> archiveProduct(@AuthenticationPrincipal Actor actor, @PathVariable long id) {
        authorize(actor);
        jdbc.queryForMap("SELECT product_id FROM products WHERE product_id=? FOR UPDATE",id);
        jdbc.update("UPDATE products SET active=FALSE WHERE product_id=?",id);
        return ApiResponse.success(null,"Đã ngừng bán sản phẩm; giữ nguyên lịch sử");
    }
    @GetMapping("/catalog")
    public ApiResponse<?> skus(@AuthenticationPrincipal Actor actor) {
        authorize(actor);
        return ApiResponse.success(jdbc.queryForList("""
            SELECT s.*,p.product_name,p.active AS product_active,c.category_id,c.category_name,c.active AS category_active
            FROM product_skus s JOIN products p ON p.product_id=s.product_id
            JOIN product_categories c ON c.category_id=p.category_id ORDER BY s.sku_id DESC
            """),"Danh mục quản lý gồm cả SKU ngừng bán");
    }
    @PostMapping("/skus") @Transactional
    public ApiResponse<?> createSku(@AuthenticationPrincipal Actor actor, @Valid @RequestBody NewSku r) {
        authorize(actor);
        jdbc.queryForMap("SELECT product_id FROM products WHERE product_id=?",r.productId());
        return ApiResponse.success(sql.insert("""
            INSERT INTO product_skus(product_id,sku_code,sku_name,base_unit,pack_size,pack_description,minimum_order_quantity,quantity_step)
            VALUES (?,?,?,?,?,?,?,?)
            """,r.productId(),r.code(),r.name(),r.unit(),r.packSize(),r.packDescription(),r.minimum(),r.step()),"Đã tạo SKU");
    }
    @PutMapping("/skus/{id}") @Transactional
    public ApiResponse<?> updateSku(@AuthenticationPrincipal Actor actor, @PathVariable long id, @Valid @RequestBody SkuUpdate r) {
        authorize(actor);
        jdbc.queryForMap("SELECT sku_id FROM product_skus WHERE sku_id=? FOR UPDATE",id);
        jdbc.update("UPDATE product_skus SET sku_name=?,pack_description=?,minimum_order_quantity=?,quantity_step=?,active=? WHERE sku_id=?",
            r.name(),r.packDescription(),r.minimum(),r.step(),r.active(),id);
        return ApiResponse.success(null,"Đã cập nhật SKU");
    }
    @DeleteMapping("/skus/{id}") @Transactional
    public ApiResponse<?> archiveSku(@AuthenticationPrincipal Actor actor, @PathVariable long id) {
        authorize(actor);
        jdbc.queryForMap("SELECT sku_id FROM product_skus WHERE sku_id=? FOR UPDATE",id);
        jdbc.update("UPDATE product_skus SET active=FALSE WHERE sku_id=?",id);
        return ApiResponse.success(null,"Đã ngừng bán SKU; giữ nguyên lịch sử");
    }
    @GetMapping("/prices")
    public ApiResponse<?> prices(@AuthenticationPrincipal Actor actor, @RequestParam long skuId) {
        authorize(actor);
        return ApiResponse.success(jdbc.queryForList("SELECT * FROM sku_prices WHERE sku_id=? ORDER BY valid_from DESC,sku_price_id DESC",skuId),"Lịch sử giá");
    }
}
