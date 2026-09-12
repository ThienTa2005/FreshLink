package vn.freshlink.claims;

import java.time.*;
import java.util.*;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import vn.freshlink.common.Sql;
import vn.freshlink.common.api.ApiResponse;
import vn.freshlink.identity.Actor;

@RestController
@RequestMapping("/api/claims")
public class ClaimDossierController {
    private final JdbcTemplate jdbc;
    private final Sql sql;

    public ClaimDossierController(JdbcTemplate jdbc, Sql sql) {
        this.jdbc = jdbc;
        this.sql = sql;
    }

    @GetMapping("/inbox")
    public ApiResponse<?> inbox(
        @AuthenticationPrincipal Actor actor,
        @RequestParam(required=false) String status,
        @RequestParam(required=false) String department,
        @RequestParam(required=false) Long assignedTo,
        @RequestParam(required=false) Boolean slaOverdue
    ) {
        actor.requireRole("CUSTOMER_SUPPORT", "SYSTEM_ADMIN");
        StringBuilder query = new StringBuilder("""
            SELECT c.*, o.order_code, org.organization_name AS restaurant_name,
                   u.full_name AS assignee_name, sub.full_name AS submitter_name
            FROM complaints c
            JOIN customer_orders o ON o.order_id = c.order_id
            JOIN organizations org ON org.organization_id = c.restaurant_id
            LEFT JOIN users u ON u.user_id = c.assigned_to
            LEFT JOIN users sub ON sub.user_id = c.submitted_by
            WHERE 1=1
            """);
        List<Object> args = new ArrayList<>();

        if (status != null && !status.isBlank()) {
            query.append(" AND c.status = ?");
            args.add(status);
        }
        if (department != null && !department.isBlank()) {
            query.append(" AND c.assigned_department = ?");
            args.add(department);
        }
        if (assignedTo != null) {
            query.append(" AND c.assigned_to = ?");
            args.add(assignedTo);
        }
        if (Boolean.TRUE.equals(slaOverdue)) {
            query.append(" AND ( (c.first_responded_at IS NULL AND c.first_response_due_at < UTC_TIMESTAMP(3)) OR (c.status NOT IN ('RESOLVED','CLOSED') AND c.resolution_due_at < UTC_TIMESTAMP(3)) )");
        }

        query.append(" ORDER BY c.complaint_id DESC LIMIT 200");
        return ApiResponse.success(jdbc.queryForList(query.toString(), args.toArray()), "Hộp thư khiếu nại CSKH");
    }

    @GetMapping("/{id}/dossier")
    public ApiResponse<?> dossier(@AuthenticationPrincipal Actor actor, @PathVariable long id) {
        var complaints = jdbc.queryForList("SELECT * FROM complaints WHERE complaint_id=?", id);
        if (complaints.isEmpty()) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy khiếu nại");

        var claim = complaints.get(0);
        long restOrg = ((Number) claim.get("restaurant_id")).longValue();
        boolean isInternal = actor.hasRole("CUSTOMER_SUPPORT", "SYSTEM_ADMIN", "OPERATIONS_COORDINATOR", "QUALITY_INSPECTOR", "ACCOUNTANT");
        if (!isInternal) {
            actor.requireOrganization(restOrg, "RESTAURANT_MANAGER", "RESTAURANT_RECEIVER");
        }

        long orderId = ((Number) claim.get("order_id")).longValue();
        var order = jdbc.queryForMap("SELECT * FROM customer_orders WHERE order_id=?", orderId);
        var items = jdbc.queryForList("""
            SELECT ci.*, s.sku_name, s.base_unit, b.batch_code, b.accepted_quantity, b.rejected_quantity
            FROM complaint_items ci
            JOIN order_items oi ON oi.order_item_id = ci.order_item_id
            JOIN product_skus s ON s.sku_id = oi.sku_id
            LEFT JOIN batches b ON b.batch_id = ci.batch_id
            WHERE ci.complaint_id = ?
            """, id);

        var deliveryStops = jdbc.queryForList("""
            SELECT s.*, t.trip_code, u.full_name AS driver_name
            FROM trip_stops s
            JOIN delivery_trips t ON t.trip_id = s.trip_id
            LEFT JOIN users u ON u.user_id = t.driver_user_id
            WHERE s.order_id = ?
            ORDER BY s.trip_stop_id
            """, orderId);

        var notes = jdbc.queryForList("""
            SELECT n.*, u.full_name AS author_name
            FROM complaint_notes n
            JOIN users u ON u.user_id = n.author_user_id
            WHERE n.complaint_id = ? AND (? = TRUE OR n.is_internal = FALSE)
            ORDER BY n.note_id ASC
            """, id, isInternal);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("complaint", claim);
        result.put("order", order);
        result.put("items", items);
        result.put("deliveryStops", deliveryStops);
        result.put("notes", notes);
        result.put("isInternalViewer", isInternal);

        return ApiResponse.success(result, "Hồ sơ vụ việc 360 độ");
    }

    public record NoteRequest(@NotBlank @Size(max=2000) String content, Boolean isInternal) {}

    @PostMapping("/{id}/notes")
    @Transactional
    public ApiResponse<?> addNote(
        @AuthenticationPrincipal Actor actor,
        @PathVariable long id,
        @Valid @RequestBody NoteRequest r
    ) {
        var claim = jdbc.queryForList("SELECT * FROM complaints WHERE complaint_id=? FOR UPDATE", id);
        if (claim.isEmpty()) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy khiếu nại");

        long restOrg = ((Number) claim.get(0).get("restaurant_id")).longValue();
        boolean isSupport = actor.hasRole("CUSTOMER_SUPPORT", "SYSTEM_ADMIN");
        if (!isSupport) {
            actor.requireOrganization(restOrg, "RESTAURANT_MANAGER", "RESTAURANT_RECEIVER");
        }

        boolean internalFlag = isSupport && Boolean.TRUE.equals(r.isInternal());

        long noteId = sql.insert("""
            INSERT INTO complaint_notes(complaint_id, author_user_id, content, is_internal)
            VALUES (?, ?, ?, ?)
            """, id, actor.userId(), r.content(), internalFlag);

        // If CSKH sends a response to partner, record first response time if not yet set
        if (isSupport && !internalFlag && claim.get(0).get("first_responded_at") == null) {
            jdbc.update("UPDATE complaints SET first_responded_at = UTC_TIMESTAMP(3) WHERE complaint_id=?", id);
        }

        return ApiResponse.success(noteId, internalFlag ? "Đã lưu ghi chú nội bộ" : "Đã gửi phản hồi tới đối tác");
    }

    public record DelegateRequest(
        @NotBlank @Pattern(regexp="CSKH|QC|COORDINATOR|ACCOUNTANT") String department,
        Long assigneeId,
        @NotBlank @Size(max=500) String note
    ) {}

    @PostMapping("/{id}/delegate")
    @Transactional
    public ApiResponse<?> delegate(
        @AuthenticationPrincipal Actor actor,
        @PathVariable long id,
        @Valid @RequestBody DelegateRequest r
    ) {
        actor.requireRole("CUSTOMER_SUPPORT", "SYSTEM_ADMIN");
        var claim = jdbc.queryForList("SELECT * FROM complaints WHERE complaint_id=? FOR UPDATE", id);
        if (claim.isEmpty()) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy khiếu nại");

        Long assignee = r.assigneeId() == null ? actor.userId() : r.assigneeId();
        jdbc.update("UPDATE complaints SET assigned_department=?, assigned_to=? WHERE complaint_id=?",
            r.department(), assignee, id);

        sql.insert("""
            INSERT INTO complaint_notes(complaint_id, author_user_id, content, is_internal)
            VALUES (?, ?, CONCAT('[CHUYỂN VIỆC SANG ', ?, ']: ', ?), TRUE)
            """, id, actor.userId(), r.department(), r.note());

        return ApiResponse.success(id, "Đã chuyển việc sang bộ phận " + r.department());
    }

    public record CloseRequest(@NotBlank @Size(max=500) String reason) {}

    @PostMapping("/{id}/close")
    @Transactional
    public ApiResponse<?> close(
        @AuthenticationPrincipal Actor actor,
        @PathVariable long id,
        @Valid @RequestBody CloseRequest r
    ) {
        actor.requireRole("CUSTOMER_SUPPORT", "SYSTEM_ADMIN");
        var claim = jdbc.queryForList("SELECT * FROM complaints WHERE complaint_id=? FOR UPDATE", id);
        if (claim.isEmpty()) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy khiếu nại");

        jdbc.update("""
            UPDATE complaints
            SET status='CLOSED', closed_at=UTC_TIMESTAMP(3), final_resolution=COALESCE(final_resolution, ?)
            WHERE complaint_id=?
            """, r.reason(), id);

        sql.insert("""
            INSERT INTO complaint_notes(complaint_id, author_user_id, content, is_internal)
            VALUES (?, ?, CONCAT('[ĐÓNG HỒ SƠ]: ', ?), FALSE)
            """, id, actor.userId(), r.reason());

        return ApiResponse.success(id, "Đã đóng hồ sơ khiếu nại");
    }
}
