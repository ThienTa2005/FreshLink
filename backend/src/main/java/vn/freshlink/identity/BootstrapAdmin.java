package vn.freshlink.identity;

import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import vn.freshlink.common.Sql;

@Component
@org.springframework.core.annotation.Order(0)
@ConditionalOnProperty(name="app.bootstrap.enabled",havingValue="true")
public class BootstrapAdmin implements ApplicationRunner {
    private final JdbcTemplate jdbc; private final Sql sql; private final PasswordEncoder passwords;
    @Value("${app.bootstrap.email}") private String email;
    @Value("${app.bootstrap.password}") private String password;
    public BootstrapAdmin(JdbcTemplate jdbc,Sql sql,PasswordEncoder passwords) {this.jdbc=jdbc;this.sql=sql;this.passwords=passwords;}
    @Override @Transactional public void run(ApplicationArguments args) {
        if (password.length()<12 || password.getBytes(java.nio.charset.StandardCharsets.UTF_8).length>72) throw new IllegalArgumentException("Bootstrap password must be 12 characters or more and at most 72 UTF-8 bytes");
        if (jdbc.queryForObject("SELECT COUNT(*) FROM member_roles mr JOIN roles r ON r.role_id=mr.role_id WHERE r.role_code='SYSTEM_ADMIN'",Integer.class)>0) return;
        long user=sql.insert("INSERT INTO users(email,password_hash,full_name,status) VALUES (?,?,?,'ACTIVE')",email.trim().toLowerCase(java.util.Locale.ROOT),passwords.encode(password),"Quản trị FreshLink");
        long org=sql.insert("INSERT INTO organizations(organization_code,organization_name,organization_type,status) VALUES ('FRESHLINK','FreshLink','FRESHLINK','ACTIVE')");
        long member=sql.insert("INSERT INTO organization_members(user_id,organization_id,status,is_primary) VALUES (?,?,'ACTIVE',TRUE)",user,org);
        jdbc.update("INSERT INTO member_roles(member_id,role_id) SELECT ?,role_id FROM roles WHERE role_code='SYSTEM_ADMIN'",member);
    }
}
