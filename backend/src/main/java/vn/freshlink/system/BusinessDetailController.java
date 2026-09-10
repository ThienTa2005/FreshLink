package vn.freshlink.system;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import vn.freshlink.identity.Actor;
import vn.freshlink.common.api.ApiResponse;

/** Read models for detail screens. Authorization happens before fetching nested records. */
@RestController
@RequestMapping("/api")
public class BusinessDetailController {
    private final JdbcTemplate jdbc;
    public BusinessDetailController(JdbcTemplate jdbc) { this.jdbc=jdbc; }
    @GetMapping("/batches/{id}")
    public ApiResponse<?> batch(@AuthenticationPrincipal Actor actor,@PathVariable long id) {
        var batch=jdbc.queryForMap("""
            SELECT b.*,s.sku_name,s.base_unit,o.organization_name AS supplier_name FROM batches b
            JOIN product_skus s ON s.sku_id=b.sku_id JOIN organizations o ON o.organization_id=b.supplier_id
            WHERE b.batch_id=?
            """,id);
        boolean internal=actor.hasRole("SYSTEM_ADMIN") || actor.hasRole("OPERATIONS_COORDINATOR") || actor.hasRole("QUALITY_INSPECTOR");
        if(!internal) actor.requireOrganization(((Number)batch.get("supplier_id")).longValue(),"SUPPLIER_MANAGER","SUPPLIER_STAFF");
        var inspections=jdbc.queryForList("SELECT * FROM batch_inspections WHERE batch_id=? ORDER BY inspection_round",id);
        for(var inspection:inspections) inspection.put("items",jdbc.queryForList("SELECT * FROM inspection_items WHERE inspection_id=?",inspection.get("inspection_id")));
        batch.put("inspections",inspections);
        if(internal) batch.put("allocations",jdbc.queryForList("""
            SELECT a.*,o.order_id,o.order_code,s.sku_name FROM batch_allocations a
            JOIN order_items i ON i.order_item_id=a.order_item_id JOIN customer_orders o ON o.order_id=i.order_id
            JOIN product_skus s ON s.sku_id=i.sku_id WHERE a.batch_id=? ORDER BY a.batch_allocation_id
            """,id));
        return ApiResponse.success(batch,"Chi tiết lô hàng");
    }
    @GetMapping("/supplier/requests/{id}")
    public ApiResponse<?> request(@AuthenticationPrincipal Actor actor,@PathVariable long id) {
        var request=jdbc.queryForMap("SELECT * FROM supply_requests WHERE supply_request_id=?",id);
        if(!actor.hasRole("OPERATIONS_COORDINATOR"))
            actor.requireOrganization(((Number)request.get("supplier_id")).longValue(),"SUPPLIER_MANAGER","SUPPLIER_STAFF");
        request.put("items",jdbc.queryForList("""
            SELECT i.*,s.sku_name,s.base_unit FROM supply_request_items i JOIN product_skus s ON s.sku_id=i.sku_id
            WHERE i.supply_request_id=? ORDER BY i.supply_request_item_id
            """,id));
        request.put("delivery_address",jdbc.queryForMap("SELECT address_id,address_name,address_line,district,city,contact_name,contact_phone FROM addresses WHERE address_id=?",request.get("delivery_to_address_id")));
        return ApiResponse.success(request,"Chi tiết yêu cầu cung ứng");
    }
    @GetMapping("/claims/{id}")
    public ApiResponse<?> claim(@AuthenticationPrincipal Actor actor,@PathVariable long id) {
        var claim=jdbc.queryForMap("SELECT * FROM complaints WHERE complaint_id=?",id);
        if(!actor.hasRole("CUSTOMER_SUPPORT"))
            actor.requireOrganization(((Number)claim.get("restaurant_id")).longValue(),"RESTAURANT_MANAGER","RESTAURANT_RECEIVER");
        claim.put("items",jdbc.queryForList("""
            SELECT ci.*,s.sku_name,s.base_unit,b.batch_code FROM complaint_items ci
            JOIN order_items i ON i.order_item_id=ci.order_item_id JOIN product_skus s ON s.sku_id=i.sku_id
            LEFT JOIN batches b ON b.batch_id=ci.batch_id WHERE ci.complaint_id=?
            """,id));
        return ApiResponse.success(claim,"Chi tiết khiếu nại");
    }
    @GetMapping("/assets/{id}/history")
    public ApiResponse<?> assetHistory(@AuthenticationPrincipal Actor actor,@PathVariable long id) {
        actor.requireRole("OPERATIONS_COORDINATOR");
        jdbc.queryForMap("SELECT asset_id FROM returnable_assets WHERE asset_id=?",id);
        return ApiResponse.success(jdbc.queryForList("SELECT * FROM asset_movements WHERE asset_id=? ORDER BY movement_id DESC",id),"Lịch sử thùng");
    }
}
