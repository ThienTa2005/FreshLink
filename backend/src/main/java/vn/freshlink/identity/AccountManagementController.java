package vn.freshlink.identity;

import java.nio.charset.StandardCharsets;
import java.util.*;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;
import vn.freshlink.common.api.ApiResponse;

@RestController
@RequestMapping("/api")
public class AccountManagementController {
    private final JdbcTemplate jdbc;
    private final PasswordEncoder passwords;
    public AccountManagementController(JdbcTemplate jdbc, PasswordEncoder passwords) {
        this.jdbc = jdbc;
        this.passwords = passwords;
    }
    public record Profile(@NotBlank @Size(max=150) String fullName, @Size(max=20) String phone) {}
    public record Password(@NotBlank @Size(max=72) String currentPassword,
                           @NotBlank @Size(min=12,max=72) String newPassword) {}
    public record StaffUpdate(@NotBlank @Size(max=150) String fullName,
                              @NotBlank @Pattern(regexp="ACTIVE|DISABLED") String status,
                              @NotEmpty List<@NotBlank String> roles) {}
    private static final Set<String> STAFF_ROLES = Set.of("OPERATIONS_COORDINATOR", "QUALITY_INSPECTOR",
        "ACCOUNTANT", "CUSTOMER_SUPPORT", "DRIVER");

    @PatchMapping("/auth/profile")
    @Transactional
    public ApiResponse<?> profile(@AuthenticationPrincipal Actor actor, @Valid @RequestBody Profile request) {
        jdbc.update("UPDATE users SET full_name=?,phone=? WHERE user_id=?", request.fullName().trim(),
            request.phone()==null || request.phone().isBlank() ? null : request.phone().trim(), actor.userId());
        return ApiResponse.success(null, "Đã cập nhật hồ sơ");
    }

    @PostMapping("/auth/change-password")
    @Transactional
    public ApiResponse<?> password(@AuthenticationPrincipal Actor actor, @Valid @RequestBody Password request) {
        if (request.newPassword().getBytes(StandardCharsets.UTF_8).length > 72
            || request.currentPassword().getBytes(StandardCharsets.UTF_8).length > 72)
            throw new IllegalArgumentException("Mật khẩu tối đa 72 byte UTF-8");
        String hash = jdbc.queryForObject("SELECT password_hash FROM users WHERE user_id=? FOR UPDATE", String.class, actor.userId());
        if (!passwords.matches(request.currentPassword(), hash))
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Mật khẩu hiện tại không đúng");
        if (passwords.matches(request.newPassword(), hash)) throw new IllegalArgumentException("Mật khẩu mới phải khác mật khẩu hiện tại");
        jdbc.update("UPDATE users SET password_hash=?,failed_login_count=0,locked_until=NULL WHERE user_id=?",
            passwords.encode(request.newPassword()), actor.userId());
        jdbc.update("DELETE FROM api_tokens WHERE user_id=?", actor.userId());
        return ApiResponse.success(null, "Đã đổi mật khẩu và đăng xuất tất cả phiên. Vui lòng đăng nhập lại");
    }

    private long adminOrganization(Actor actor) {
        actor.requireRole("SYSTEM_ADMIN");
        return actor.memberships().stream().filter(m -> m.roles().contains("SYSTEM_ADMIN"))
            .findFirst().orElseThrow().organizationId();
    }

    @GetMapping("/admin/staff")
    public ApiResponse<?> staff(@AuthenticationPrincipal Actor actor) {
        long organization = adminOrganization(actor);
        var rows = jdbc.queryForList("""
            SELECT u.user_id,u.email,u.full_name,u.phone,u.status,u.created_at,m.member_id
            FROM users u JOIN organization_members m ON m.user_id=u.user_id
            WHERE m.organization_id=? ORDER BY u.user_id DESC
            """, organization);
        for (var row : rows) row.put("roles", jdbc.queryForList("""
            SELECT r.role_code FROM member_roles mr JOIN roles r ON r.role_id=mr.role_id
            WHERE mr.member_id=? ORDER BY r.role_code
            """, String.class, row.get("member_id")));
        return ApiResponse.success(rows, "Danh sách nhân viên");
    }

    @PutMapping("/admin/staff/{id}")
    @Transactional
    public ApiResponse<?> updateStaff(@AuthenticationPrincipal Actor actor, @PathVariable long id,
                                     @Valid @RequestBody StaffUpdate request) {
        long organization = adminOrganization(actor);
        if (!STAFF_ROLES.containsAll(request.roles()) || new HashSet<>(request.roles()).size()!=request.roles().size())
            throw new IllegalArgumentException("Quyền nhân viên không hợp lệ");
        jdbc.queryForMap("SELECT user_id FROM users WHERE user_id=? FOR UPDATE", id);
        long member = jdbc.queryForObject("SELECT member_id FROM organization_members WHERE user_id=? AND organization_id=? FOR UPDATE",
            Long.class, id, organization);
        if (id == actor.userId() || jdbc.queryForObject("""
            SELECT COUNT(*) FROM member_roles mr JOIN roles r ON r.role_id=mr.role_id
            JOIN organization_members m ON m.member_id=mr.member_id WHERE m.user_id=? AND r.role_code='SYSTEM_ADMIN'
            """, Integer.class, id)>0)
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Không thay đổi quản trị viên qua chức năng nhân viên");
        // User status is global: do not disable an account shared with another organization.
        if (jdbc.queryForObject("SELECT COUNT(*) FROM organization_members WHERE user_id=? AND organization_id<>?",
            Integer.class, id, organization)>0)
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Tài khoản thuộc nhiều tổ chức, không thể thay đổi tại đây");
        jdbc.update("UPDATE users SET full_name=?,status=? WHERE user_id=?", request.fullName().trim(), request.status(), id);
        jdbc.update("UPDATE organization_members SET status=? WHERE member_id=?", request.status(), member);
        jdbc.update("DELETE FROM member_roles WHERE member_id=?", member);
        for (String role : request.roles()) jdbc.update("""
            INSERT INTO member_roles(member_id,role_id,assigned_by)
            SELECT ?,role_id,? FROM roles WHERE role_code=?
            """, member, actor.userId(), role);
        jdbc.update("DELETE FROM api_tokens WHERE user_id=?", id);
        return ApiResponse.success(null, "Đã cập nhật nhân viên và thu hồi phiên đăng nhập");
    }
}
