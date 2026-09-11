package vn.freshlink.identity;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.Instant;
import java.sql.Timestamp;
import java.util.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class IdentityService {
    private final AccountRepository accounts;
    private final JdbcTemplate jdbc;
    private final PasswordEncoder passwords;
    private final String dummyHash;
    public IdentityService(AccountRepository accounts, JdbcTemplate jdbc, PasswordEncoder passwords) {
        this.accounts = accounts; this.jdbc = jdbc; this.passwords = passwords;
        this.dummyHash = passwords.encode(UUID.randomUUID().toString());
    }
    public record LoginResult(String token, Instant expiresAt, Actor user) {}

    @Transactional(noRollbackFor=BadCredentialsException.class)
    public LoginResult login(String email, String password) {
        Account account = accounts.findByEmail(email.trim().toLowerCase(Locale.ROOT)).orElse(null);
        if(account!=null && jdbc.queryForObject("SELECT COUNT(*) FROM users WHERE user_id=? AND locked_until>UTC_TIMESTAMP(3)",Integer.class,account.id)>0)
            throw new BadCredentialsException("Tài khoản tạm khóa. Vui lòng thử lại sau 15 phút");
        boolean matches = passwords.matches(password, account == null ? dummyHash : account.passwordHash);
        if (!matches || account == null || account.status!=Account.Status.ACTIVE) {
            if(account!=null) jdbc.update("UPDATE users SET failed_login_count=failed_login_count+1,locked_until=IF(failed_login_count>=5,DATE_ADD(UTC_TIMESTAMP(3),INTERVAL 15 MINUTE),NULL) WHERE user_id=?",account.id);
            throw new BadCredentialsException("Email, mật khẩu không đúng hoặc tài khoản chưa được duyệt");
        }
        jdbc.update("UPDATE users SET failed_login_count=0,locked_until=NULL,last_login_at=UTC_TIMESTAMP(3) WHERE user_id=?",account.id);
        Actor actor = actor(account);
        if (actor.memberships().isEmpty()) throw new BadCredentialsException("Tài khoản chưa có quyền hoạt động");
        byte[] bytes = new byte[32]; new SecureRandom().nextBytes(bytes);
        String token = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
        Instant expires = Instant.now().plusSeconds(8 * 3600);
        jdbc.update("DELETE FROM api_tokens WHERE expires_at < ?", Timestamp.from(Instant.now()));
        jdbc.update("INSERT INTO api_tokens(token_hash,user_id,expires_at) VALUES (?,?,?)", hash(token), account.id, Timestamp.from(expires));
        return new LoginResult(token, expires, actor);
    }
    public Optional<Actor> authenticate(String token) {
        if (token.length() != 43) return Optional.empty();
        List<Long> ids = jdbc.queryForList("SELECT user_id FROM api_tokens WHERE token_hash=? AND expires_at>?", Long.class, hash(token), Timestamp.from(Instant.now()));
        if (ids.isEmpty()) return Optional.empty();
        return accounts.findById(ids.get(0)).filter(a -> a.status==Account.Status.ACTIVE).map(this::actor)
            .filter(a -> !a.memberships().isEmpty());
    }
    public void logout(String token) { jdbc.update("DELETE FROM api_tokens WHERE token_hash=?", hash(token)); }
    public Actor actor(Account account) {
        var rows = jdbc.queryForList("""
            SELECT m.member_id,o.organization_id,o.organization_name,o.organization_type,r.role_code
            FROM organization_members m JOIN organizations o ON o.organization_id=m.organization_id
            LEFT JOIN member_roles mr ON mr.member_id=m.member_id
            LEFT JOIN roles r ON r.role_id=mr.role_id
            WHERE m.user_id=? AND m.status='ACTIVE' AND o.status='ACTIVE'
            ORDER BY m.member_id,r.role_code
            """, account.id);
        var grouped = new LinkedHashMap<Long, Actor.Membership>();
        for (var row : rows) {
            long memberId = ((Number) row.get("member_id")).longValue();
            var membership = grouped.computeIfAbsent(memberId, ignored -> new Actor.Membership(
                ((Number) row.get("organization_id")).longValue(),
                (String) row.get("organization_name"),
                (String) row.get("organization_type"),
                new ArrayList<>()));
            if (row.get("role_code") != null) membership.roles().add((String) row.get("role_code"));
        }
        var memberships = grouped.values().stream()
            .map(m -> new Actor.Membership(m.organizationId(), m.organizationName(), m.organizationType(), List.copyOf(m.roles())))
            .toList();
        return new Actor(account.id, account.email, account.fullName, memberships);
    }
    public static String hash(String value) {
        try { return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8))); }
        catch (java.security.NoSuchAlgorithmException e) { throw new IllegalStateException(e); }
    }
}
