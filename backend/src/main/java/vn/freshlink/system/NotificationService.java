package vn.freshlink.system;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class NotificationService {

    private final JdbcTemplate jdbc;

    public NotificationService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /**
     * Send notification with deduplication: skip if user has an unread notification with identical
     * type and entity created within the last 15 minutes.
     */
    @Transactional
    public boolean send(long userId, String type, String title, String message, String entityType, Long entityId) {
        Integer unreadSame = jdbc.queryForObject(
            "SELECT COUNT(*) FROM notifications " +
            "WHERE user_id = ? AND notification_type = ? " +
            "  AND ((related_entity_type = ? AND related_entity_id = ?) OR (related_entity_type IS NULL AND ? IS NULL)) " +
            "  AND read_at IS NULL " +
            "  AND created_at >= DATE_SUB(UTC_TIMESTAMP(3), INTERVAL 15 MINUTE)",
            Integer.class, userId, type, entityType, entityId, entityType
        );
        if (unreadSame != null && unreadSame > 0) {
            return false; // Deduplicated
        }

        jdbc.update(
            "INSERT INTO notifications(user_id, notification_type, title, message, related_entity_type, related_entity_id) " +
            "VALUES (?, ?, ?, ?, ?, ?)",
            userId, type, title, message, entityType, entityId
        );
        return true;
    }

    @Transactional
    public int sendToRoles(List<String> roleCodes, Long organizationId, String type, String title, String message, String entityType, Long entityId) {
        if (roleCodes == null || roleCodes.isEmpty()) return 0;
        String inSql = String.join("','", roleCodes);
        String sql = "SELECT DISTINCT m.user_id FROM organization_members m " +
                     "JOIN member_roles mr ON mr.member_id = m.member_id " +
                     "JOIN roles r ON r.role_id = mr.role_id " +
                     "WHERE m.status = 'ACTIVE' AND r.role_code IN ('" + inSql + "') " +
                     (organizationId != null ? "AND m.organization_id = " + organizationId : "");
        List<Long> userIds = jdbc.queryForList(sql, Long.class);
        int sent = 0;
        for (Long uid : userIds) {
            if (send(uid, type, title, message, entityType, entityId)) {
                sent++;
            }
        }
        return sent;
    }
}
