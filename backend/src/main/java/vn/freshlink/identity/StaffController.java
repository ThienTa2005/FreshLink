package vn.freshlink.identity;

import java.util.*;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import vn.freshlink.common.Sql;
import vn.freshlink.common.api.ApiResponse;

@RestController @RequestMapping("/api/admin/staff")
public class StaffController {
    private final JdbcTemplate jdbc;private final Sql sql;private final PasswordEncoder passwords;
    public StaffController(JdbcTemplate jdbc,Sql sql,PasswordEncoder passwords) {this.jdbc=jdbc;this.sql=sql;this.passwords=passwords;}
    public record Staff(@NotBlank @Email @Size(max=150) String email,@NotBlank @Size(min=12,max=72) String password,
        @NotBlank @Size(max=150) String fullName,@NotEmpty List<String> roles) {}
    @PostMapping @Transactional public ApiResponse<?> create(@AuthenticationPrincipal Actor a,@Valid @RequestBody Staff r) {
        a.requireRole("SYSTEM_ADMIN");
        Set<String> allowed=Set.of("OPERATIONS_COORDINATOR","QUALITY_INSPECTOR","ACCOUNTANT","CUSTOMER_SUPPORT","DRIVER");
        if(!allowed.containsAll(r.roles()) || new HashSet<>(r.roles()).size()!=r.roles().size()) throw new IllegalArgumentException("Quyền nhân viên không hợp lệ");
        if(r.password().getBytes(java.nio.charset.StandardCharsets.UTF_8).length>72) throw new IllegalArgumentException("Mật khẩu tối đa 72 byte UTF-8");
        long org=a.memberships().stream().filter(m->m.roles().contains("SYSTEM_ADMIN")).findFirst().orElseThrow().organizationId();
        long user=sql.insert("INSERT INTO users(email,password_hash,full_name,status) VALUES (?,?,?,'ACTIVE')",r.email().trim().toLowerCase(Locale.ROOT),passwords.encode(r.password()),r.fullName());
        long member=sql.insert("INSERT INTO organization_members(user_id,organization_id,status) VALUES (?,?,'ACTIVE')",user,org);
        for(String role:r.roles()) jdbc.update("INSERT INTO member_roles(member_id,role_id,assigned_by) SELECT ?,role_id,? FROM roles WHERE role_code=?",member,a.userId(),role);
        return ApiResponse.success(user,"Đã tạo tài khoản nhân viên");
    }
}
