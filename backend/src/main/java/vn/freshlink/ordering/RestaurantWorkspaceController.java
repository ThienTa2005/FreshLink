package vn.freshlink.ordering;

import java.time.*;
import java.util.*;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import vn.freshlink.identity.Actor;
import vn.freshlink.common.api.ApiResponse;
import com.fasterxml.jackson.databind.ObjectMapper;

@RestController @RequestMapping("/api")
public class RestaurantWorkspaceController {
    private final JdbcTemplate jdbc; private final ObjectMapper json;
    @Value("${app.order.cutoff:17:00}") private LocalTime cutoff;
    public RestaurantWorkspaceController(JdbcTemplate jdbc,ObjectMapper json){this.jdbc=jdbc;this.json=json;}
    @GetMapping("/public/order-window") public ApiResponse<?> window(){
        var now=ZonedDateTime.now(ZoneId.of("Asia/Ho_Chi_Minh"));
        return ApiResponse.success(Map.of("earliestDate",now.toLocalDate().plusDays(now.toLocalTime().isBefore(cutoff)?1:2),"cutoff",cutoff.toString(),"timeZone","Asia/Ho_Chi_Minh"),"Lịch đặt hàng");
    }
    @GetMapping("/restaurants/{org}/policy") public ApiResponse<?> policy(@AuthenticationPrincipal Actor a,@PathVariable long org){
        a.requireOrganization(org,"RESTAURANT_MANAGER","RESTAURANT_PURCHASER","RESTAURANT_RECEIVER");
        return ApiResponse.success(jdbc.queryForMap("SELECT approval_required FROM restaurant_profiles WHERE restaurant_id=?",org),"Chính sách nhà hàng");
    }
    public record Policy(boolean approvalRequired){}
    @PutMapping("/restaurants/{org}/policy") @Transactional public ApiResponse<?> policy(@AuthenticationPrincipal Actor a,@PathVariable long org,@RequestBody Policy p){
        a.requireOrganization(org,"RESTAURANT_MANAGER");jdbc.update("UPDATE restaurant_profiles SET approval_required=? WHERE restaurant_id=?",p.approvalRequired(),org);
        jdbc.update("INSERT INTO audit_logs(actor_user_id,organization_id,action_code,entity_type,entity_id,new_data) VALUES (?,?,'ORDER_POLICY','ORGANIZATION',?,JSON_OBJECT('approvalRequired',?))",a.userId(),org,org,p.approvalRequired());
        return ApiResponse.success(null,"Đã lưu chính sách; áp dụng cho đơn mới");
    }
    public record Saved(@NotBlank @Size(max=150) String name,@Pattern(regexp="TEMPLATE|CART|FAVORITES") @NotNull String kind,@NotNull Map<String,Object> payload){}
    @GetMapping("/restaurants/{org}/saved-orders") public ApiResponse<?> saved(@AuthenticationPrincipal Actor a,@PathVariable long org) throws Exception {
        a.requireOrganization(org,"RESTAURANT_MANAGER","RESTAURANT_PURCHASER");
        var rows=jdbc.queryForList("SELECT * FROM restaurant_saved_orders WHERE restaurant_id=? AND user_id=? ORDER BY updated_at DESC",org,a.userId());
        for(var row:rows)row.put("payload",json.readValue(row.get("payload").toString(),Map.class));
        return ApiResponse.success(rows,"Giỏ và mẫu đơn đã lưu");
    }
    @PostMapping("/restaurants/{org}/saved-orders") public ApiResponse<?> save(@AuthenticationPrincipal Actor a,@PathVariable long org,@Valid @RequestBody Saved r) throws Exception {
        a.requireOrganization(org,"RESTAURANT_MANAGER","RESTAURANT_PURCHASER");String payload=json.writeValueAsString(r.payload());if(payload.length()>64000)throw new IllegalArgumentException("Mẫu đơn quá lớn");
        jdbc.update("INSERT INTO restaurant_saved_orders(restaurant_id,user_id,name,kind,payload) VALUES (?,?,?,?,?) ON DUPLICATE KEY UPDATE payload=VALUES(payload)",org,a.userId(),r.name(),r.kind(),payload);return ApiResponse.success(null,"Đã lưu");
    }
    @DeleteMapping("/restaurants/{org}/saved-orders/{id}") public ApiResponse<?> delete(@AuthenticationPrincipal Actor a,@PathVariable long org,@PathVariable long id){a.requireOrganization(org,"RESTAURANT_MANAGER","RESTAURANT_PURCHASER");jdbc.update("DELETE FROM restaurant_saved_orders WHERE saved_order_id=? AND restaurant_id=? AND user_id=?",id,org,a.userId());return ApiResponse.success(null,"Đã xóa mẫu");}
}
