package vn.freshlink.identity;

import java.util.List;
import org.springframework.security.access.AccessDeniedException;

public record Actor(long userId, String email, String fullName, List<Membership> memberships) {
    public record Membership(long organizationId, String organizationName, String organizationType, List<String> roles) {}
    public boolean hasRole(String... roles) {
        for (String role : roles) {
            if (memberships.stream().anyMatch(m -> m.roles().contains(role))) return true;
        }
        return false;
    }
    public boolean belongsTo(long organizationId) {
        return memberships.stream().anyMatch(m -> m.organizationId() == organizationId);
    }
    public void requireRole(String... roles) {
        if (hasRole("SYSTEM_ADMIN")) return;
        for (String role : roles) if (hasRole(role)) return;
        throw new AccessDeniedException("Bạn không có quyền thực hiện thao tác này");
    }
    public void requireOrganization(long organizationId, String... roles) {
        if (hasRole("SYSTEM_ADMIN")) return;
        for (Membership m : memberships) {
            if (m.organizationId() == organizationId) {
                for (String role : roles) if (m.roles().contains(role)) return;
            }
        }
        throw new AccessDeniedException("Không có quyền truy cập dữ liệu tổ chức này");
    }
}
