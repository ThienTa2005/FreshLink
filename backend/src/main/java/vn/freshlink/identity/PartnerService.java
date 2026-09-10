package vn.freshlink.identity;

import java.util.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;
import vn.freshlink.common.Sql;

@Service
public class PartnerService {
    private final JdbcTemplate jdbc;
    private final Sql sql;
    private final PasswordEncoder passwords;
    public PartnerService(JdbcTemplate jdbc, Sql sql, PasswordEncoder passwords) { this.jdbc=jdbc; this.sql=sql; this.passwords=passwords; }
    @Transactional
    public long register(String email, String password, String fullName, String organizationName, String type) {
        if (!Set.of("RESTAURANT", "SUPPLIER").contains(type)) throw new IllegalArgumentException("Chỉ đăng ký nhà hàng hoặc nhà cung cấp");
        if (password.getBytes(java.nio.charset.StandardCharsets.UTF_8).length > 72) throw new IllegalArgumentException("Mật khẩu tối đa 72 byte UTF-8");
        long userId = sql.insert("INSERT INTO users(email,password_hash,full_name,status) VALUES (?,?,?,'PENDING')", email.trim().toLowerCase(Locale.ROOT), passwords.encode(password), fullName);
        long orgId = sql.insert("INSERT INTO organizations(organization_code,organization_name,organization_type,status) VALUES (?,?,?,'PENDING')", "ORG-"+UUID.randomUUID().toString().substring(0,20), organizationName, type);
        long memberId = sql.insert("INSERT INTO organization_members(organization_id,user_id,status,is_primary) VALUES (?,?,'INVITED',TRUE)", orgId,userId);
        String role = type.equals("RESTAURANT") ? "RESTAURANT_MANAGER" : "SUPPLIER_MANAGER";
        jdbc.update("INSERT INTO member_roles(member_id,role_id) SELECT ?,role_id FROM roles WHERE role_code=?",memberId,role);
        if (type.equals("RESTAURANT")) jdbc.update("INSERT INTO restaurant_profiles(restaurant_id,restaurant_type) VALUES (?,'OTHER')",orgId);
        else jdbc.update("INSERT INTO supplier_profiles(supplier_id,supplier_type) VALUES (?,'FARM')",orgId);
        return orgId;
    }
    public List<Map<String,Object>> pending(Actor actor) {
        actor.requireRole("SYSTEM_ADMIN");
        return jdbc.queryForList("SELECT organization_id,organization_name,organization_type,created_at FROM organizations WHERE status='PENDING' ORDER BY created_at");
    }
    @Transactional public void approve(Actor actor,long id) {
        actor.requireRole("SYSTEM_ADMIN");
        if (jdbc.update("UPDATE organizations SET status='ACTIVE' WHERE organization_id=? AND status='PENDING' AND organization_type IN ('RESTAURANT','SUPPLIER')",id)!=1)
            throw new ResponseStatusException(HttpStatus.CONFLICT,"Hồ sơ không ở trạng thái chờ duyệt");
        jdbc.update("UPDATE users u JOIN organization_members m ON m.user_id=u.user_id SET u.status='ACTIVE' WHERE m.organization_id=? AND u.status='PENDING'",id);
        jdbc.update("UPDATE organization_members SET status='ACTIVE',joined_at=UTC_TIMESTAMP(3) WHERE organization_id=? AND status='INVITED'",id);
    }
}
