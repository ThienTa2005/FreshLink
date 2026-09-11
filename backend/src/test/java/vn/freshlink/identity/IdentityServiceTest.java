package vn.freshlink.identity;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;

class IdentityServiceTest {
    @Test
    void actorLoadsMembershipsAndRolesWithOneDatabaseQuery() {
        var accounts = mock(AccountRepository.class);
        var jdbc = mock(JdbcTemplate.class);
        var passwords = mock(PasswordEncoder.class);
        when(passwords.encode(anyString())).thenReturn("dummy-hash");
        when(jdbc.queryForList(anyString(), eq(7L))).thenReturn(List.of(
            Map.of("member_id", 11L, "organization_id", 21L, "organization_name", "FreshLink",
                "organization_type", "FRESHLINK", "role_code", "ACCOUNTANT"),
            Map.of("member_id", 11L, "organization_id", 21L, "organization_name", "FreshLink",
                "organization_type", "FRESHLINK", "role_code", "SYSTEM_ADMIN")));

        var account = new Account();
        account.id = 7L;
        account.email = "admin@example.com";
        account.fullName = "Admin";
        account.status = Account.Status.ACTIVE;

        var actor = new IdentityService(accounts, jdbc, passwords).actor(account);

        assertEquals(1, actor.memberships().size());
        assertEquals(List.of("ACCOUNTANT", "SYSTEM_ADMIN"), actor.memberships().get(0).roles());
        verify(jdbc).queryForList(anyString(), eq(7L));
    }
}
