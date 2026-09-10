package vn.freshlink.identity;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import vn.freshlink.common.Sql;
import vn.freshlink.common.api.ApiResponse;

@RestController @RequestMapping("/api")
public class ProfileController {
    private final JdbcTemplate jdbc; private final Sql sql;
    public ProfileController(JdbcTemplate jdbc,Sql sql) {this.jdbc=jdbc;this.sql=sql;}
    public record Address(@NotNull Long organizationId,@NotBlank @Size(max=100) String name,@NotBlank @Size(max=300) String address,
        @NotBlank @Size(max=100) String district,@NotBlank @Size(max=100) String city,@NotBlank @Size(max=150) String contactName,
        @NotBlank @Size(max=20) String phone,@NotBlank String type) {}
    @GetMapping("/addresses") public ApiResponse<?> addresses(@AuthenticationPrincipal Actor a,@RequestParam long organizationId) {
        if (!a.hasRole("OPERATIONS_COORDINATOR")) a.requireOrganization(organizationId,"RESTAURANT_MANAGER","RESTAURANT_PURCHASER","RESTAURANT_RECEIVER","SUPPLIER_MANAGER","SUPPLIER_STAFF");
        return ApiResponse.success(jdbc.queryForList("SELECT * FROM addresses WHERE organization_id=? AND active=TRUE",organizationId),"Địa chỉ");
    }
    @PostMapping("/addresses") public ApiResponse<?> address(@AuthenticationPrincipal Actor a,@Valid @RequestBody Address r) {
        a.requireOrganization(r.organizationId(),"RESTAURANT_MANAGER","SUPPLIER_MANAGER","OPERATIONS_COORDINATOR");
        if (!java.util.Set.of("DELIVERY","FARM","CROSS_DOCK").contains(r.type())) throw new IllegalArgumentException("Loại địa chỉ không hợp lệ");
        if (r.type().equals("CROSS_DOCK")) a.requireRole("OPERATIONS_COORDINATOR");
        return ApiResponse.success(sql.insert("INSERT INTO addresses(organization_id,address_name,address_line,district,city,contact_name,contact_phone,address_type) VALUES (?,?,?,?,?,?,?,?)",r.organizationId(),r.name(),r.address(),r.district(),r.city(),r.contactName(),r.phone(),r.type()),"Đã thêm địa chỉ");
    }
    @GetMapping("/operations/lookup") public ApiResponse<?> lookup(@AuthenticationPrincipal Actor a) {
        a.requireRole("OPERATIONS_COORDINATOR","QUALITY_INSPECTOR","ACCOUNTANT","CUSTOMER_SUPPORT");
        return ApiResponse.success(java.util.Map.of(
            "organizations",jdbc.queryForList("SELECT organization_id,organization_name,organization_type FROM organizations WHERE status='ACTIVE'"),
            "addresses",jdbc.queryForList("SELECT address_id,address_name,address_line,organization_id,address_type FROM addresses WHERE active=TRUE"),
            "drivers",jdbc.queryForList("SELECT DISTINCT u.user_id,u.full_name FROM users u JOIN organization_members m ON m.user_id=u.user_id JOIN member_roles mr ON mr.member_id=m.member_id JOIN roles r ON r.role_id=mr.role_id WHERE r.role_code='DRIVER' AND u.status='ACTIVE' AND m.status='ACTIVE'")),"Dữ liệu điều phối");
    }
}
