package vn.freshlink.identity;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;
import vn.freshlink.common.api.ApiResponse;

@RestController
@RequestMapping("/api/admin/partners")
public class PartnerManagementController {
    private final JdbcTemplate jdbc;
    public PartnerManagementController(JdbcTemplate jdbc) { this.jdbc = jdbc; }
    public record Transition(@NotBlank @Pattern(regexp="REJECTED|SUSPENDED|ACTIVE") String status,
                             @NotBlank @Size(max=1000) String reason) {}
    @GetMapping
    public ApiResponse<?> list(@AuthenticationPrincipal Actor actor) {
        actor.requireRole("SYSTEM_ADMIN");
        return ApiResponse.success(jdbc.queryForList("""
            SELECT organization_id,organization_code,organization_name,organization_type,email,phone,status,created_at
            FROM organizations WHERE organization_type IN ('RESTAURANT','SUPPLIER') ORDER BY organization_id DESC
            """), "Danh sách đối tác");
    }
    @GetMapping("/{id}")
    public ApiResponse<?> detail(@AuthenticationPrincipal Actor actor, @PathVariable long id) {
        actor.requireRole("SYSTEM_ADMIN");
        var partner = jdbc.queryForMap("SELECT * FROM organizations WHERE organization_id=? AND organization_type IN ('RESTAURANT','SUPPLIER')", id);
        partner.put("members", jdbc.queryForList("""
            SELECT u.user_id,u.email,u.full_name,m.status,m.is_primary FROM users u
            JOIN organization_members m ON m.user_id=u.user_id WHERE m.organization_id=?
            """, id));
        return ApiResponse.success(partner, "Chi tiết đối tác");
    }
    @PatchMapping("/{id}/status")
    @Transactional
    public ApiResponse<?> status(@AuthenticationPrincipal Actor actor, @PathVariable long id,
                                @Valid @RequestBody Transition request) {
        actor.requireRole("SYSTEM_ADMIN");
        String previous = jdbc.queryForObject("""
            SELECT status FROM organizations WHERE organization_id=?
            AND organization_type IN ('RESTAURANT','SUPPLIER') FOR UPDATE
            """, String.class, id);
        boolean allowed = ("PENDING".equals(previous) && "REJECTED".equals(request.status()))
            || ("ACTIVE".equals(previous) && "SUSPENDED".equals(request.status()))
            || ("SUSPENDED".equals(previous) && "ACTIVE".equals(request.status()));
        if (!allowed) throw new ResponseStatusException(HttpStatus.CONFLICT,
            "Chuyển trạng thái không hợp lệ. Hồ sơ chờ duyệt phải dùng chức năng duyệt riêng");
        jdbc.update("UPDATE organizations SET status=? WHERE organization_id=?", request.status(), id);
        jdbc.update("""
            DELETE t FROM api_tokens t JOIN organization_members m ON m.user_id=t.user_id WHERE m.organization_id=?
            """, id);
        jdbc.update("""
            INSERT INTO audit_logs(actor_user_id,organization_id,action_code,entity_type,entity_id,old_data,new_data)
            VALUES (?,?,'PARTNER_STATUS','ORGANIZATION',?,JSON_OBJECT('status',?),JSON_OBJECT('status',?,'reason',?))
            """, actor.userId(), id, id, previous, request.status(), request.reason());
        return ApiResponse.success(null, "Đã cập nhật trạng thái đối tác");
    }
}
