package vn.freshlink.system;

import java.math.BigDecimal;
import java.time.*;
import java.util.*;
import jakarta.validation.constraints.*;
import org.springframework.http.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import vn.freshlink.common.Sql;
import vn.freshlink.common.api.ApiResponse;
import vn.freshlink.identity.Actor;

@RestController @RequestMapping("/api")
public class OperationalExtensionController {
    private final JdbcTemplate jdbc; private final Sql sql;
    public OperationalExtensionController(JdbcTemplate jdbc,Sql sql){this.jdbc=jdbc;this.sql=sql;}

    @GetMapping("/search") public ApiResponse<?> search(@AuthenticationPrincipal Actor a,@RequestParam @Size(min=2,max=80) String q){
        String term="%"+q.strip().replace("\\","\\\\").replace("%","\\%").replace("_","\\_")+"%";var out=new ArrayList<Map<String,Object>>();
        if(a.hasRole("SYSTEM_ADMIN")||a.hasRole("OPERATIONS_COORDINATOR")||a.hasRole("ACCOUNTANT")||a.hasRole("CUSTOMER_SUPPORT")){
            out.addAll(jdbc.queryForList("SELECT 'ORDER' type,order_id id,order_code code,CONCAT('Đơn ',order_code) title,order_status status FROM customer_orders WHERE order_code LIKE ? ESCAPE '\\\\' ORDER BY order_id DESC LIMIT 8",term));
            out.addAll(jdbc.queryForList("SELECT 'BATCH' type,batch_id id,batch_code code,CONCAT('Lô ',batch_code) title,batch_status status FROM batches WHERE batch_code LIKE ? ESCAPE '\\\\' ORDER BY batch_id DESC LIMIT 8",term));
            out.addAll(jdbc.queryForList("SELECT 'TRIP' type,trip_id id,trip_code code,CONCAT('Chuyến ',trip_code) title,status FROM delivery_trips WHERE trip_code LIKE ? ESCAPE '\\\\' ORDER BY trip_id DESC LIMIT 8",term));
            out.addAll(jdbc.queryForList("SELECT 'ORGANIZATION' type,organization_id id,organization_code code,organization_name title,status FROM organizations WHERE organization_name LIKE ? ESCAPE '\\\\' OR organization_code LIKE ? ESCAPE '\\\\' ORDER BY organization_id DESC LIMIT 8",term,term));
        } else for(var m:a.memberships()){
            if("RESTAURANT".equals(m.organizationType())) out.addAll(jdbc.queryForList("SELECT 'ORDER' type,order_id id,order_code code,CONCAT('Đơn ',order_code) title,order_status status FROM customer_orders WHERE restaurant_id=? AND order_code LIKE ? ESCAPE '\\\\' ORDER BY order_id DESC LIMIT 8",m.organizationId(),term));
            if("SUPPLIER".equals(m.organizationType())) out.addAll(jdbc.queryForList("SELECT 'BATCH' type,batch_id id,batch_code code,CONCAT('Lô ',batch_code) title,batch_status status FROM batches WHERE supplier_id=? AND batch_code LIKE ? ESCAPE '\\\\' ORDER BY batch_id DESC LIMIT 8",m.organizationId(),term));
        }
        return ApiResponse.success(out.stream().limit(25).toList(),"Kết quả tìm kiếm");
    }

    public record ViewRequest(@NotBlank @Size(max=60) String viewKey,@NotBlank @Size(max=100) String name,@NotNull Map<String,Object> filters,boolean isDefault){}
    @GetMapping("/saved-views") public ApiResponse<?> views(@AuthenticationPrincipal Actor a,@RequestParam @Size(max=60) String viewKey){return ApiResponse.success(jdbc.queryForList("SELECT saved_view_id,view_key,name,filters,is_default,updated_at FROM saved_views WHERE user_id=? AND view_key=? ORDER BY is_default DESC,name",a.userId(),viewKey),"Bộ lọc đã lưu");}
    @PostMapping("/saved-views") @Transactional public ApiResponse<?> saveView(@AuthenticationPrincipal Actor a,@jakarta.validation.Valid @RequestBody ViewRequest r) throws Exception {if(r.isDefault())jdbc.update("UPDATE saved_views SET is_default=FALSE WHERE user_id=? AND view_key=?",a.userId(),r.viewKey());String json=new com.fasterxml.jackson.databind.ObjectMapper().writeValueAsString(r.filters());long id=sql.insert("INSERT INTO saved_views(user_id,view_key,name,filters,is_default) VALUES (?,?,?,?,?)",a.userId(),r.viewKey(),r.name(),json,r.isDefault());return ApiResponse.success(id,"Đã lưu bộ lọc");}
    @DeleteMapping("/saved-views/{id}") public ApiResponse<?> deleteView(@AuthenticationPrincipal Actor a,@PathVariable long id){if(jdbc.update("DELETE FROM saved_views WHERE saved_view_id=? AND user_id=?",id,a.userId())!=1)throw new ResponseStatusException(HttpStatus.NOT_FOUND,"Không tìm thấy bộ lọc");return ApiResponse.success(id,"Đã xóa bộ lọc");}

    @GetMapping("/delivery-failure-reasons") public ApiResponse<?> reasons(@AuthenticationPrincipal Actor a){return ApiResponse.success(jdbc.queryForList("SELECT reason_code,label,description FROM delivery_failure_reasons WHERE active=TRUE ORDER BY display_order"),"Lý do giao thất bại");}

    @GetMapping("/trips/{id}/manifest") public ResponseEntity<String> manifest(@AuthenticationPrincipal Actor a,@PathVariable long id){
        var trip=jdbc.queryForMap("SELECT * FROM delivery_trips WHERE trip_id=?",id);if(((Number)trip.get("driver_user_id")).longValue()!=a.userId()&&!a.hasRole("OPERATIONS_COORDINATOR")&&!a.hasRole("SYSTEM_ADMIN"))throw new org.springframework.security.access.AccessDeniedException("Không có quyền xem manifest");
        var rows=jdbc.queryForList("SELECT t.trip_code,s.stop_sequence,o.order_code,ad.address_name,ad.address_line,ad.district,p.sku_name,di.loaded_quantity FROM delivery_trips t JOIN trip_stops s ON s.trip_id=t.trip_id JOIN customer_orders o ON o.order_id=s.order_id JOIN addresses ad ON ad.address_id=s.delivery_address_id JOIN delivery_items di ON di.trip_stop_id=s.trip_stop_id JOIN order_items oi ON oi.order_item_id=di.order_item_id JOIN product_skus p ON p.sku_id=oi.sku_id WHERE t.trip_id=? ORDER BY s.stop_sequence,di.delivery_item_id",id);
        StringBuilder csv=new StringBuilder("trip_code,stop_sequence,order_code,address_name,address_line,district,sku_name,loaded_quantity\n");for(var r:rows){for(String k:List.of("trip_code","stop_sequence","order_code","address_name","address_line","district","sku_name","loaded_quantity")){String v=String.valueOf(r.get(k)).replace("\"","\"\"");csv.append('"').append(v).append("\",");}csv.setLength(csv.length()-1);csv.append('\n');}
        return ResponseEntity.ok().contentType(new MediaType("text","csv",java.nio.charset.StandardCharsets.UTF_8)).header(HttpHeaders.CONTENT_DISPOSITION,"attachment; filename=manifest-"+trip.get("trip_code")+".csv").body("\uFEFF"+csv);
    }

    public record Telemetry(@NotNull @DecimalMin("-90") @DecimalMax("90") BigDecimal latitude,@NotNull @DecimalMin("-180") @DecimalMax("180") BigDecimal longitude,@DecimalMin("-50") @DecimalMax("80") BigDecimal temperatureC){}
    @PostMapping("/trips/{id}/telemetry") @Transactional public ApiResponse<?> telemetry(@AuthenticationPrincipal Actor a,@PathVariable long id,@jakarta.validation.Valid @RequestBody Telemetry r){var t=jdbc.queryForMap("SELECT driver_user_id,status FROM delivery_trips WHERE trip_id=? FOR UPDATE",id);if(((Number)t.get("driver_user_id")).longValue()!=a.userId())throw new org.springframework.security.access.AccessDeniedException("Không phải tài xế của chuyến");if(!"IN_PROGRESS".equals(t.get("status")))throw new ResponseStatusException(HttpStatus.CONFLICT,"Chuyến chưa chạy");long row=sql.insert("INSERT INTO trip_telemetry(trip_id,driver_user_id,latitude,longitude,temperature_c) VALUES (?,?,?,?,?)",id,a.userId(),r.latitude(),r.longitude(),r.temperatureC());jdbc.update("UPDATE trip_stops SET last_latitude=?,last_longitude=?,location_updated_at=UTC_TIMESTAMP(3) WHERE trip_id=? AND status IN ('PENDING','ARRIVED')",r.latitude(),r.longitude(),id);return ApiResponse.success(row,"Đã ghi nhận hành trình");}
    @GetMapping("/trips/{id}/telemetry/latest") public ApiResponse<?> latestTelemetry(@AuthenticationPrincipal Actor a,@PathVariable long id){a.requireRole("OPERATIONS_COORDINATOR","DRIVER");var t=jdbc.queryForMap("SELECT driver_user_id FROM delivery_trips WHERE trip_id=?",id);if(a.hasRole("DRIVER")&&!a.hasRole("OPERATIONS_COORDINATOR")&&((Number)t.get("driver_user_id")).longValue()!=a.userId())throw new org.springframework.security.access.AccessDeniedException("Không phải tài xế của chuyến");var rows=jdbc.queryForList("SELECT latitude,longitude,temperature_c,recorded_at FROM trip_telemetry WHERE trip_id=? ORDER BY recorded_at DESC LIMIT 1",id);return ApiResponse.success(rows.isEmpty()?null:rows.get(0),"Vị trí mới nhất");}

    @GetMapping("/admin/system-check") public ApiResponse<?> systemCheck(@AuthenticationPrincipal Actor a){a.requireRole("SYSTEM_ADMIN");var data=new LinkedHashMap<String,Object>();try{data.put("database",Map.of("status","UP","time",jdbc.queryForObject("SELECT UTC_TIMESTAMP(3)",String.class)));}catch(Exception e){data.put("database",Map.of("status","DOWN"));}data.put("media",Map.of("status",System.getenv("CLOUDINARY_URL")==null?"NOT_CONFIGURED":"CONFIGURED"));data.put("email",Map.of("status",System.getenv("SMTP_HOST")==null?"OUTBOX_ONLY":"CONFIGURED"));data.put("maps",Map.of("status",System.getenv("MAPS_API_KEY") == null?"HEURISTIC_ONLY":"CONFIGURED"));return ApiResponse.success(data,"Kiểm tra hệ thống");}

    @GetMapping("/analytics/series") public ApiResponse<?> series(@AuthenticationPrincipal Actor a,@RequestParam LocalDate from,@RequestParam LocalDate to){a.requireRole("SYSTEM_ADMIN","OPERATIONS_COORDINATOR","QUALITY_INSPECTOR","CUSTOMER_SUPPORT","ACCOUNTANT");if(to.isBefore(from)||java.time.temporal.ChronoUnit.DAYS.between(from,to)>366)throw new IllegalArgumentException("Khoảng thời gian không hợp lệ");var result=new LinkedHashMap<String,Object>();result.put("orders",jdbc.queryForList("SELECT delivery_date date,COUNT(*) total,SUM(order_status='DELIVERED') delivered,SUM(order_status='CANCELLED') cancelled FROM customer_orders WHERE delivery_date BETWEEN ? AND ? GROUP BY delivery_date ORDER BY delivery_date",from,to));result.put("quality",jdbc.queryForList("SELECT DATE(inspected_at) date,COUNT(*) inspected,SUM(final_result IN ('PASS','PARTIAL_PASS')) passed FROM batch_inspections WHERE DATE(inspected_at) BETWEEN ? AND ? GROUP BY DATE(inspected_at) ORDER BY date",from,to));result.put("claims",jdbc.queryForList("SELECT DATE(submitted_at) date,COUNT(*) opened,SUM(status IN ('RESOLVED','CLOSED')) completed FROM complaints WHERE DATE(submitted_at) BETWEEN ? AND ? GROUP BY DATE(submitted_at) ORDER BY date",from,to));return ApiResponse.success(result,"Chuỗi dữ liệu KPI");}
}
