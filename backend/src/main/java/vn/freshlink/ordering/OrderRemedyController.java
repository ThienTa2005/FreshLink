package vn.freshlink.ordering;

import java.math.*;
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
@RequestMapping("/api")
public class OrderRemedyController {
    private final JdbcTemplate jdbc;
    private final Sql sql;

    public OrderRemedyController(JdbcTemplate jdbc, Sql sql) {
        this.jdbc = jdbc;
        this.sql = sql;
    }

    public record RemedyProposal(
        @NotNull Long orderItemId,
        @NotBlank @Pattern(regexp="SHORTAGE_REDUCTION|SUBSTITUTION|REDELIVERY|CANCEL_LINE") String remedyType,
        @NotNull @DecimalMin("0.001") @Digits(integer=9,fraction=3) BigDecimal affectedQuantity,
        Long substituteSkuId,
        @DecimalMin("0.001") @Digits(integer=9,fraction=3) BigDecimal substituteQuantity,
        @NotNull @Digits(integer=13,fraction=2) BigDecimal priceDifference,
        @NotNull @Min(5) @Max(1440) Integer deadlineMinutes
    ) {}

    public record RemedyDecision(
        @NotBlank @Pattern(regexp="ACCEPT|REJECT") String decision,
        @Size(max=500) String reason
    ) {}

    @PostMapping("/orders/{id}/remedies")
    @Transactional
    public ApiResponse<?> propose(
        @AuthenticationPrincipal Actor actor,
        @PathVariable long id,
        @Valid @RequestBody RemedyProposal r
    ) {
        actor.requireRole("OPERATIONS_COORDINATOR", "SYSTEM_ADMIN");
        var order = jdbc.queryForList("SELECT * FROM customer_orders WHERE order_id=? FOR UPDATE", id);
        if (order.isEmpty()) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy đơn");

        var item = jdbc.queryForList("SELECT * FROM order_items WHERE order_item_id=? AND order_id=? FOR UPDATE", r.orderItemId(), id);
        if (item.isEmpty()) throw new IllegalArgumentException("Dòng hàng không thuộc đơn này");

        if (r.substituteSkuId() != null) {
            if (jdbc.queryForObject("SELECT COUNT(*) FROM product_skus WHERE sku_id=? AND active=TRUE", Integer.class, r.substituteSkuId()) != 1) {
                throw new IllegalArgumentException("SKU thay thế không hoạt động hoặc không tồn tại");
            }
            if (r.substituteQuantity() == null || r.substituteQuantity().signum() <= 0) {
                throw new IllegalArgumentException("Cần số lượng hàng thay thế");
            }
        }

        int version = jdbc.queryForObject("SELECT COALESCE(MAX(version), 0) + 1 FROM order_remedies WHERE order_id=?", Integer.class, id);
        Instant deadline = Instant.now().plus(Duration.ofMinutes(r.deadlineMinutes()));

        long remedyId = sql.insert("""
            INSERT INTO order_remedies(
                order_id, order_item_id, version, remedy_type, affected_quantity,
                substitute_sku_id, substitute_quantity, price_difference,
                deadline_at, status, proposed_by
            ) VALUES (?,?,?,?,?,?,?,?,?, 'PENDING', ?)
            """,
            id, r.orderItemId(), version, r.remedyType(), r.affectedQuantity(),
            r.substituteSkuId(), r.substituteQuantity(), r.priceDifference(),
            java.sql.Timestamp.from(deadline), actor.userId()
        );

        jdbc.update("""
            INSERT INTO audit_logs(actor_user_id, organization_id, action_code, entity_type, entity_id, new_data)
            VALUES (?, ?, 'PROPOSE_REMEDY', 'ORDER_REMEDY', ?, JSON_OBJECT('version', ?, 'type', ?, 'affectedQty', ?))
            """,
            actor.userId(), order.get(0).get("restaurant_id"), remedyId, version, r.remedyType(), r.affectedQuantity()
        );

        // Notify restaurant managers
        jdbc.update("""
            INSERT INTO notifications(user_id, notification_type, title, message, related_entity_type, related_entity_id)
            SELECT DISTINCT m.user_id, 'ORDER_REMEDY_PROPOSED', 'Phương án ngoại lệ mới cho đơn',
                   CONCAT('Đơn hàng có phương án xử lý thiếu/đổi hàng cần phản hồi trước ', ?), 'ORDER', ?
            FROM organization_members m
            JOIN member_roles mr ON mr.member_id=m.member_id
            JOIN roles ro ON ro.role_id=mr.role_id
            WHERE m.organization_id=? AND m.status='ACTIVE' AND ro.role_code IN ('RESTAURANT_MANAGER', 'RESTAURANT_PURCHASER')
            """,
            deadline.toString(), id, order.get(0).get("restaurant_id")
        );

        return ApiResponse.success(remedyId, "Đã gửi phương án ngoại lệ tới nhà hàng");
    }

    @GetMapping("/orders/{id}/remedies")
    public ApiResponse<?> list(@AuthenticationPrincipal Actor actor, @PathVariable long id) {
        var order = jdbc.queryForList("SELECT * FROM customer_orders WHERE order_id=?", id);
        if (order.isEmpty()) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy đơn");

        long restOrg = ((Number) order.get(0).get("restaurant_id")).longValue();
        if (!actor.hasRole("OPERATIONS_COORDINATOR", "SYSTEM_ADMIN", "CUSTOMER_SUPPORT")) {
            actor.requireOrganization(restOrg, "RESTAURANT_MANAGER", "RESTAURANT_PURCHASER", "RESTAURANT_RECEIVER");
        }

        // Auto-expire overdue pending remedies
        jdbc.update("UPDATE order_remedies SET status='EXPIRED' WHERE order_id=? AND status='PENDING' AND deadline_at < UTC_TIMESTAMP(3)", id);

        var list = jdbc.queryForList("""
            SELECT r.*, s.sku_name AS affected_sku_name, sub.sku_name AS substitute_sku_name,
                   u.full_name AS proposer_name, d.full_name AS decider_name
            FROM order_remedies r
            JOIN order_items i ON i.order_item_id = r.order_item_id
            JOIN product_skus s ON s.sku_id = i.sku_id
            LEFT JOIN product_skus sub ON sub.sku_id = r.substitute_sku_id
            LEFT JOIN users u ON u.user_id = r.proposed_by
            LEFT JOIN users d ON d.user_id = r.decided_by
            WHERE r.order_id = ?
            ORDER BY r.remedy_id DESC
            """, id);

        return ApiResponse.success(list, "Danh sách phương án ngoại lệ");
    }

    @PostMapping("/orders/remedies/{id}/respond")
    @Transactional
    public ApiResponse<?> respond(
        @AuthenticationPrincipal Actor actor,
        @PathVariable long id,
        @Valid @RequestBody RemedyDecision r
    ) {
        var remedy = jdbc.queryForList("SELECT * FROM order_remedies WHERE remedy_id=? FOR UPDATE", id);
        if (remedy.isEmpty()) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy phương án");

        var rem = remedy.get(0);
        long orderId = ((Number) rem.get("order_id")).longValue();
        var order = jdbc.queryForMap("SELECT * FROM customer_orders WHERE order_id=? FOR UPDATE", orderId);
        long restOrg = ((Number) order.get("restaurant_id")).longValue();
        actor.requireOrganization(restOrg, "RESTAURANT_MANAGER");

        if (!"PENDING".equals(rem.get("status"))) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Phương án không ở trạng thái chờ phản hồi");
        }

        Boolean isOverdue = jdbc.queryForObject("SELECT deadline_at < UTC_TIMESTAMP(3) FROM order_remedies WHERE remedy_id=?", Boolean.class, id);
        if (Boolean.TRUE.equals(isOverdue)) {
            jdbc.update("UPDATE order_remedies SET status='EXPIRED' WHERE remedy_id=?", id);
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Phương án đã quá hạn phản hồi và được chuyển về điều phối");
        }

        if ("REJECT".equals(r.decision())) {
            if (r.reason() == null || r.reason().isBlank()) {
                throw new IllegalArgumentException("Cần lý do khi từ chối phương án ngoại lệ");
            }
            jdbc.update("""
                UPDATE order_remedies
                SET status='REJECTED', decided_by=?, decided_at=UTC_TIMESTAMP(3), rejection_reason=?
                WHERE remedy_id=?
                """, actor.userId(), r.reason(), id);

            jdbc.update("""
                INSERT INTO audit_logs(actor_user_id, organization_id, action_code, entity_type, entity_id, new_data)
                VALUES (?, ?, 'REJECT_REMEDY', 'ORDER_REMEDY', ?, JSON_OBJECT('reason', ?))
                """, actor.userId(), restOrg, id, r.reason());

            return ApiResponse.success(id, "Đã từ chối phương án; trả về điều phối xử lý");
        }

        // ACCEPT workflow
        String type = (String) rem.get("remedy_type");
        long itemId = ((Number) rem.get("order_item_id")).longValue();
        var item = jdbc.queryForMap("SELECT * FROM order_items WHERE order_item_id=? FOR UPDATE", itemId);
        BigDecimal currentConfirmed = (BigDecimal) item.get("confirmed_quantity");
        BigDecimal affectedQty = (BigDecimal) rem.get("affected_quantity");

        if ("SHORTAGE_REDUCTION".equals(type)) {
            BigDecimal newConfirmed = currentConfirmed.subtract(affectedQty).max(BigDecimal.ZERO);
            BigDecimal unitPrice = (BigDecimal) item.get("unit_price");
            BigDecimal newLineTotal = unitPrice.multiply(newConfirmed).setScale(2, RoundingMode.HALF_UP);
            jdbc.update("UPDATE order_items SET confirmed_quantity=?, line_total_amount=? WHERE order_item_id=?",
                newConfirmed, newLineTotal, itemId);
        } else if ("CANCEL_LINE".equals(type)) {
            jdbc.update("UPDATE order_items SET confirmed_quantity=0, line_total_amount=0, item_status='CANCELLED' WHERE order_item_id=?", itemId);
        } else if ("SUBSTITUTION".equals(type)) {
            Long subSku = rem.get("substitute_sku_id") == null ? null : ((Number) rem.get("substitute_sku_id")).longValue();
            BigDecimal subQty = (BigDecimal) rem.get("substitute_quantity");
            jdbc.update("UPDATE order_items SET substitution_note=CONCAT('Đổi sang SKU #', ?, ' x ', ?) WHERE order_item_id=?",
                subSku, subQty, itemId);
        }

        // Recompute order totals
        BigDecimal newSubtotal = jdbc.queryForObject("SELECT COALESCE(SUM(line_total_amount), 0) FROM order_items WHERE order_id=?", BigDecimal.class, orderId);
        BigDecimal priceDiff = (BigDecimal) rem.get("price_difference");
        BigDecimal totalAmount = newSubtotal.add(priceDiff).max(BigDecimal.ZERO);
        jdbc.update("UPDATE customer_orders SET subtotal_amount=?, total_amount=?, adjustment_amount=adjustment_amount+? WHERE order_id=?",
            newSubtotal, totalAmount, priceDiff, orderId);

        jdbc.update("""
            UPDATE order_remedies
            SET status='ACCEPTED', decided_by=?, decided_at=UTC_TIMESTAMP(3)
            WHERE remedy_id=?
            """, actor.userId(), id);

        jdbc.update("""
            INSERT INTO audit_logs(actor_user_id, organization_id, action_code, entity_type, entity_id, new_data)
            VALUES (?, ?, 'ACCEPT_REMEDY', 'ORDER_REMEDY', ?, JSON_OBJECT('type', ?, 'priceDiff', ?))
            """, actor.userId(), restOrg, id, type, priceDiff);

        return ApiResponse.success(id, "Đã chấp thuận phương án ngoại lệ; đơn hàng đã được cập nhật");
    }
}
