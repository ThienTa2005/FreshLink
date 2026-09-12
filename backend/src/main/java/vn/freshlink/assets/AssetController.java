package vn.freshlink.assets;

import java.util.*;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import vn.freshlink.identity.Actor;
import vn.freshlink.common.Sql;
import vn.freshlink.common.api.ApiResponse;

@RestController @RequestMapping("/api/assets")
public class AssetController {
    private final JdbcTemplate jdbc; private final Sql sql;
    public AssetController(JdbcTemplate jdbc,Sql sql) {this.jdbc=jdbc;this.sql=sql;}
    public record Create(@NotBlank @Size(max=40) String code) {}
    @PostMapping public ApiResponse<?> create(@AuthenticationPrincipal Actor a,@Valid @RequestBody Create r) {
        a.requireRole("OPERATIONS_COORDINATOR");return ApiResponse.success(sql.insert("INSERT INTO returnable_assets(asset_code,asset_type_id) SELECT ?,asset_type_id FROM returnable_asset_types WHERE asset_type_code='PP_CRATE'",r.code()),"Đã tạo thùng");
    }
    @GetMapping public ApiResponse<?> list(@AuthenticationPrincipal Actor a,@RequestParam(required=false) Long restaurantId) {
        if(restaurantId!=null) {a.requireOrganization(restaurantId,"RESTAURANT_MANAGER","RESTAURANT_RECEIVER");return ApiResponse.success(jdbc.queryForList("SELECT asset_id,asset_code,status,condition_status FROM returnable_assets WHERE current_organization_id=?",restaurantId),"Thùng đang giữ");}
        if(a.hasRole("DRIVER")) {
            return ApiResponse.success(jdbc.queryForList("SELECT a.*,o.organization_name FROM returnable_assets a LEFT JOIN organizations o ON o.organization_id=a.current_organization_id WHERE a.driver_user_id=? OR a.status IN ('AVAILABLE','ON_VEHICLE','AT_RESTAURANT','RETURNED_DIRTY') ORDER BY a.asset_id DESC LIMIT 200",a.userId()),"Thùng luân chuyển");
        }
        a.requireRole("OPERATIONS_COORDINATOR","ASSET_MANAGER","SYSTEM_ADMIN");
        return ApiResponse.success(jdbc.queryForList("SELECT a.*,o.organization_name,u.full_name AS driver_name FROM returnable_assets a LEFT JOIN organizations o ON o.organization_id=a.current_organization_id LEFT JOIN users u ON u.user_id=a.driver_user_id ORDER BY a.asset_id DESC LIMIT 200"),"Thùng luân chuyển");
    }
    public record Move(@NotBlank String action,Long stopId,Long driverId,@NotBlank @Size(max=500) String note) {
        public Move(String action, Long stopId, String note) {
            this(action, stopId, null, note);
        }
    }
    @PostMapping("/{id}/move") @Transactional public ApiResponse<?> move(@AuthenticationPrincipal Actor a,@PathVariable long id,@Valid @RequestBody Move r) {
        var asset=jdbc.queryForMap("SELECT * FROM returnable_assets WHERE asset_id=? FOR UPDATE",id);
        String from=(String)asset.get("status"),next,movement;Long targetOrg=null;Long targetDriver=null;
        if(Set.of("ISSUE","ISSUE_TO_VEHICLE","DELIVER","COLLECT").contains(r.action())) {
            if(r.stopId()==null) throw new IllegalArgumentException("Cần chọn điểm giao");
            var stop=jdbc.queryForMap("SELECT o.restaurant_id,t.driver_user_id,t.status FROM trip_stops s JOIN customer_orders o ON o.order_id=s.order_id JOIN delivery_trips t ON t.trip_id=s.trip_id WHERE s.trip_stop_id=?",r.stopId());
            Long stopDriver=((Number)stop.get("driver_user_id")).longValue();
            if(!a.hasRole("SYSTEM_ADMIN")&&!a.hasRole("OPERATIONS_COORDINATOR")) {a.requireRole("DRIVER");if(stopDriver.longValue()!=a.userId()) throw new org.springframework.security.access.AccessDeniedException("Điểm giao không thuộc chuyến của bạn");}
            targetOrg=((Number)stop.get("restaurant_id")).longValue();
            if(r.action().equals("ISSUE")||r.action().equals("ISSUE_TO_VEHICLE")) {
                if(!Set.of("AVAILABLE","CLEANED").contains(from)) throw new IllegalArgumentException("Thùng chưa sẵn sàng hoặc chưa vệ sinh");
                next="ON_VEHICLE";movement="ISSUED_FOR_DELIVERY";targetOrg=null;targetDriver=stopDriver;
            } else if(r.action().equals("DELIVER")) {
                if(!Set.of("ON_VEHICLE","IN_TRANSIT").contains(from)) throw new IllegalArgumentException("Thùng chưa được cấp lên xe để giao");
                next="AT_RESTAURANT";movement="DELIVERED_TO_RESTAURANT";targetDriver=null;
            } else {
                if(!from.equals("AT_RESTAURANT")||asset.get("current_organization_id")==null||targetOrg.longValue()!=((Number)asset.get("current_organization_id")).longValue()) throw new IllegalArgumentException("Thùng không ở nhà hàng này");
                next="RETURNED_DIRTY";movement="COLLECTED_FROM_RESTAURANT";targetOrg=null;targetDriver=stopDriver;
            }
        } else if(Set.of("CLEAN","CHECK").contains(r.action())) {
            a.requireRole("OPERATIONS_COORDINATOR","ASSET_MANAGER","SYSTEM_ADMIN");
            if(!Set.of("RETURNED_DIRTY","AVAILABLE").contains(from)) throw new IllegalArgumentException("Thao tác vệ sinh/kiểm tra không hợp lệ");
            next="AVAILABLE";movement="CLEANED";targetOrg=null;targetDriver=null;
            jdbc.update("INSERT INTO cleaning_records(asset_id,cleaning_method,result,performed_by,note) VALUES (?,'FOOD_SAFE_SANITIZER','PASS',?,?)",id,a.userId(),r.note());
        } else if(Set.of("REPORT_LOST","REPORT_DAMAGED").contains(r.action())) {
            boolean lost=r.action().equals("REPORT_LOST");
            next=lost?"LOST":"DAMAGED";movement=r.action();
            jdbc.update("UPDATE returnable_assets SET condition_status=? WHERE asset_id=?",lost?"UNUSABLE":"MAJOR_DAMAGE",id);
        } else {
            throw new IllegalArgumentException("Hành động thùng không hợp lệ");
        }
        jdbc.update("UPDATE returnable_assets SET status=?,current_organization_id=?,driver_user_id=? WHERE asset_id=?",next,targetOrg,targetDriver,id);
        jdbc.update("INSERT INTO asset_movements(asset_id,trip_stop_id,movement_type,from_organization_id,to_organization_id,recorded_by,note) VALUES (?,?,?,?,?,?,?)",id,r.stopId(),movement,asset.get("current_organization_id"),targetOrg,a.userId(),r.note());
        return ApiResponse.success(null,"Đã cập nhật thùng");
    }
}

