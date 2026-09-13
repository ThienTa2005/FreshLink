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
    private final vn.freshlink.common.Sql sql;
    public CatalogController(JdbcTemplate jdbc, vn.freshlink.common.Sql sql) {this.jdbc=jdbc;this.sql=sql;}
    @GetMapping("/public/catalog") public ApiResponse<?> catalog(@RequestParam LocalDate date) {
        return ApiResponse.success(jdbc.queryForList("""
            SELECT s.sku_id,s.product_id,s.sku_code,s.sku_name,s.base_unit,s.pack_size,s.pack_description,s.minimum_order_quantity,s.quantity_step,c.category_id,
              p.description,p.image_url,p.storage_temperature_note,p.shelf_life_hours,p.supplier_id,c.category_name,
              supp_org.organization_name AS supplier_name,
              COALESCE(sp.supplier_score, 92.5) AS supplier_score,
              COALESCE(sp.tier_rank, 'DIAMOND_AAA') AS tier_rank,
              ((SELECT COUNT(*) FROM supplier_documents sd WHERE sd.supplier_id=p.supplier_id AND sd.document_type='VIETGAP' AND sd.verification_status='APPROVED') > 0) AS has_vietgap,
              (SELECT pr.selling_unit_price FROM sku_prices pr WHERE pr.sku_id=s.sku_id AND pr.district IS NULL
                AND pr.valid_from<=? AND (pr.valid_to IS NULL OR pr.valid_to>?) ORDER BY pr.valid_from DESC,pr.sku_price_id DESC LIMIT 1) AS price,
              (SELECT COALESCE(SUM(o.available_quantity-o.reserved_quantity),0) FROM supplier_sku_offers o
                JOIN organizations org ON org.organization_id=o.supplier_id
                WHERE o.sku_id=s.sku_id AND o.available_date=? AND org.status='ACTIVE' AND o.status IN ('AVAILABLE','PARTIALLY_RESERVED')) AS available_quantity
            FROM product_skus s
            JOIN products p ON p.product_id=s.product_id
            JOIN product_categories c ON c.category_id=p.category_id
            LEFT JOIN organizations supp_org ON supp_org.organization_id=p.supplier_id
            LEFT JOIN supplier_profiles sp ON sp.supplier_id=p.supplier_id
            WHERE s.active=TRUE AND p.active=TRUE AND c.active=TRUE ORDER BY s.sku_id
            """,java.sql.Timestamp.from(date.atStartOfDay(ZoneId.of("Asia/Ho_Chi_Minh")).toInstant()),java.sql.Timestamp.from(date.atStartOfDay(ZoneId.of("Asia/Ho_Chi_Minh")).toInstant()),date),"Danh mục theo ngày giao");
    }
    public record Price(@NotNull Long skuId,@NotNull @DecimalMin("0") @Digits(integer=13,fraction=2) BigDecimal price,@NotNull LocalDate date) {}
    @PostMapping("/operations/prices") public ApiResponse<?> price(@AuthenticationPrincipal Actor actor,@Valid @RequestBody Price p) {
        actor.requireRole("OPERATIONS_COORDINATOR");
        jdbc.update("INSERT INTO sku_prices(sku_id,selling_unit_price,valid_from,created_by) VALUES (?,?,?,?)",p.skuId(),p.price(),java.sql.Timestamp.from(p.date().atStartOfDay(ZoneId.of("Asia/Ho_Chi_Minh")).toInstant()),actor.userId());
        return ApiResponse.success(null,"Đã lưu giá; đơn cũ giữ nguyên giá đã chốt");
    }
    @GetMapping("/public/categories") public ApiResponse<?> categories() {return ApiResponse.success(jdbc.queryForList("SELECT category_id,category_name FROM product_categories WHERE active=TRUE"),"Nhóm sản phẩm");}
    public record Sku(@NotNull Long categoryId,@NotBlank @Size(max=40) String productCode,@NotBlank @Size(max=150) String name,
        @NotBlank @Size(max=50) String skuCode,@NotBlank @Size(max=200) String packDescription,
        @NotBlank @Pattern(regexp="KG|GRAM|PACK|BAG|BOX|BUNCH|CRATE") String unit,
        @NotNull @DecimalMin("0.001") @Digits(integer=9,fraction=3) BigDecimal packSize,
        @NotNull @DecimalMin("0.001") @Digits(integer=9,fraction=3) BigDecimal minimum,
        @NotNull @DecimalMin("0.001") @Digits(integer=9,fraction=3) BigDecimal step) {}
    @PostMapping("/operations/catalog") @org.springframework.transaction.annotation.Transactional public ApiResponse<?> create(@AuthenticationPrincipal Actor a,@Valid @RequestBody Sku r) {
        a.requireRole("OPERATIONS_COORDINATOR");
        long product=sql.insert("INSERT INTO products(category_id,product_code,product_name) VALUES (?,?,?)",r.categoryId(),r.productCode(),r.name());
        return ApiResponse.success(sql.insert("INSERT INTO product_skus(product_id,sku_code,sku_name,base_unit,pack_size,pack_description,minimum_order_quantity,quantity_step) VALUES (?,?,?,?,?,?,?,?)",product,r.skuCode(),r.name(),r.unit(),r.packSize(),r.packDescription(),r.minimum(),r.step()),"Đã tạo sản phẩm và SKU");
    }

    public record SupplierProductRequest(
        Long supplierId,
        @NotNull Long categoryId,
        @NotBlank @Size(max=40) String productCode,
        @NotBlank @Size(max=150) String name,
        String description,
        String imageUrl,
        Long imageFileId,
        String storageTemperatureNote,
        Integer shelfLifeHours,
        @NotBlank @Pattern(regexp="KG|GRAM|PACK|BAG|BOX|BUNCH|CRATE") String unit,
        @NotNull @DecimalMin("0.001") @Digits(integer=9,fraction=3) BigDecimal packSize,
        String packDescription,
        @NotNull @DecimalMin("0.001") @Digits(integer=9,fraction=3) BigDecimal minimum,
        @NotNull @DecimalMin("0.001") @Digits(integer=9,fraction=3) BigDecimal step
    ) {}

    @GetMapping("/supplier/products")
    public ApiResponse<?> supplierProducts(@RequestParam(required=false) Long supplierId) {
        if (supplierId != null) {
            return ApiResponse.success(jdbc.queryForList("""
                SELECT p.product_id,p.category_id,c.category_name,p.product_code,p.product_name,
                       p.description,p.image_url,p.storage_temperature_note,p.shelf_life_hours,
                       p.active,p.supplier_id,s.sku_id,s.sku_code,s.sku_name,s.base_unit,
                       s.pack_size,s.pack_description,s.minimum_order_quantity,s.quantity_step
                FROM products p
                JOIN product_categories c ON c.category_id=p.category_id
                LEFT JOIN product_skus s ON s.product_id=p.product_id
                WHERE p.supplier_id=? AND p.active=TRUE
                ORDER BY p.product_id DESC
                """, supplierId), "Danh sách nông sản nhà cung cấp");
        }
        return ApiResponse.success(jdbc.queryForList("""
            SELECT p.product_id,p.category_id,c.category_name,p.product_code,p.product_name,
                   p.description,p.image_url,p.storage_temperature_note,p.shelf_life_hours,
                   p.active,p.supplier_id,s.sku_id,s.sku_code,s.sku_name,s.base_unit,
                   s.pack_size,s.pack_description,s.minimum_order_quantity,s.quantity_step
            FROM products p
            JOIN product_categories c ON c.category_id=p.category_id
            LEFT JOIN product_skus s ON s.product_id=p.product_id
            WHERE p.active=TRUE
            ORDER BY p.product_id DESC
            """), "Tất cả sản phẩm");
    }

    @PostMapping("/supplier/products") @org.springframework.transaction.annotation.Transactional
    public ApiResponse<?> createSupplierProduct(@AuthenticationPrincipal Actor a, @Valid @RequestBody SupplierProductRequest r) {
        Long orgId = r.supplierId();
        if (orgId != null) {
            a.requireOrganization(orgId, "SUPPLIER_MANAGER", "SUPPLIER_STAFF");
        } else {
            a.requireRole("OPERATIONS_COORDINATOR", "SUPPLIER_MANAGER");
        }
        long product = sql.insert("""
            INSERT INTO products(category_id,supplier_id,product_code,product_name,description,image_url,image_file_id,storage_temperature_note,shelf_life_hours)
            VALUES (?,?,?,?,?,?,?,?,?)
            """, r.categoryId(), orgId, r.productCode(), r.name(), r.description(), r.imageUrl(), r.imageFileId(),
            r.storageTemperatureNote() != null ? r.storageTemperatureNote() : "+2°C ~ +6°C",
            r.shelfLifeHours() != null ? r.shelfLifeHours() : 72);
        long sku = sql.insert("""
            INSERT INTO product_skus(product_id,sku_code,sku_name,base_unit,pack_size,pack_description,minimum_order_quantity,quantity_step)
            VALUES (?,?,?,?,?,?,?,?)
            """, product, r.productCode() + "-SKU", r.name(), r.unit(), r.packSize(),
            r.packDescription() != null && !r.packDescription().isBlank() ? r.packDescription() : (r.packSize() + " " + r.unit()),
            r.minimum(), r.step());
        return ApiResponse.success(java.util.Map.of("productId", product, "skuId", sku), "Đã tạo nông sản và SKU thành công");
    }

    @PutMapping("/supplier/products/{id}") @org.springframework.transaction.annotation.Transactional
    public ApiResponse<?> updateSupplierProduct(@AuthenticationPrincipal Actor a, @PathVariable long id, @Valid @RequestBody SupplierProductRequest r) {
        Long orgId = r.supplierId();
        if (orgId != null) {
            a.requireOrganization(orgId, "SUPPLIER_MANAGER", "SUPPLIER_STAFF");
        } else {
            a.requireRole("OPERATIONS_COORDINATOR", "SUPPLIER_MANAGER");
        }
        jdbc.update("""
            UPDATE products SET category_id=?, product_name=?, description=?, image_url=?, image_file_id=?,
              storage_temperature_note=?, shelf_life_hours=?
            WHERE product_id=?
            """, r.categoryId(), r.name(), r.description(), r.imageUrl(), r.imageFileId(),
            r.storageTemperatureNote(), r.shelfLifeHours(), id);
        jdbc.update("""
            UPDATE product_skus SET sku_name=?, base_unit=?, pack_size=?, pack_description=?,
              minimum_order_quantity=?, quantity_step=?
            WHERE product_id=?
            """, r.name(), r.unit(), r.packSize(),
            r.packDescription() != null && !r.packDescription().isBlank() ? r.packDescription() : (r.packSize() + " " + r.unit()),
            r.minimum(), r.step(), id);
        return ApiResponse.success(id, "Đã cập nhật thông tin và hình ảnh nông sản");
    }
}
