package vn.freshlink;

import java.util.*;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;
import vn.freshlink.common.Sql;
import vn.freshlink.identity.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties="app.media.directory=./target/test-uploads")
@AutoConfigureMockMvc
@EnabledIfEnvironmentVariable(named="FRESHLINK_INTEGRATION", matches="true")
class ManagementIntegrationTest {
    @Autowired MockMvc mvc;
    @Autowired JdbcTemplate jdbc;
    @Autowired Sql sql;
    @Autowired PasswordEncoder passwords;
    @Autowired IdentityService identity;
    @Autowired PartnerService partners;
    @Autowired StaffController staff;
    @Autowired com.fasterxml.jackson.databind.ObjectMapper json;
    static final String PASSWORD="Management-test-123";
    IdentityService.LoginResult admin() {
        String email=UUID.randomUUID()+"@test.invalid";
        long user=sql.insert("INSERT INTO users(email,password_hash,full_name,status) VALUES (?,?,'Admin','ACTIVE')", email,passwords.encode(PASSWORD));
        long org=sql.insert("INSERT INTO organizations(organization_code,organization_name,organization_type,status) VALUES (?,'Test','FRESHLINK','ACTIVE')",UUID.randomUUID().toString().substring(0,24));
        long member=sql.insert("INSERT INTO organization_members(user_id,organization_id,status) VALUES (?,?,'ACTIVE')",user,org);
        jdbc.update("INSERT INTO member_roles(member_id,role_id) SELECT ?,role_id FROM roles WHERE role_code='SYSTEM_ADMIN'",member);
        return identity.login(email,PASSWORD);
    }
    String body(Object value) throws Exception { return json.writeValueAsString(value); }
    String bearer(IdentityService.LoginResult login) { return "Bearer "+login.token(); }

    @Test void changePasswordRequiresOldPasswordAndRevokesEveryToken() throws Exception {
        var admin=admin(); var second=identity.login(admin.user().email(),PASSWORD);
        mvc.perform(post("/api/auth/change-password").header("Authorization",bearer(admin)).contentType("application/json")
            .content(body(Map.of("currentPassword","incorrect","newPassword","Replacement-test-456"))))
            .andExpect(status().isBadRequest());
        assertTrue(identity.authenticate(admin.token()).isPresent());
        mvc.perform(post("/api/auth/change-password").header("Authorization",bearer(admin)).contentType("application/json")
            .content(body(Map.of("currentPassword",PASSWORD,"newPassword","Replacement-test-456"))))
            .andExpect(status().isOk());
        assertTrue(identity.authenticate(admin.token()).isEmpty());
        assertTrue(identity.authenticate(second.token()).isEmpty());
        assertThrows(org.springframework.security.authentication.BadCredentialsException.class,()->identity.login(admin.user().email(),PASSWORD));
        assertNotNull(identity.login(admin.user().email(),"Replacement-test-456"));
    }
    @Test void staffManagementCannotModifyAdminAndRevokesDisabledStaff() throws Exception {
        var admin=admin(); String email=UUID.randomUUID()+"@test.invalid";
        staff.create(admin.user(),new StaffController.Staff(email,PASSWORD,"Driver",List.of("DRIVER")));
        var driver=identity.login(email,PASSWORD);
        mvc.perform(get("/api/admin/staff").header("Authorization",bearer(driver))).andExpect(status().isForbidden());
        String update=body(Map.of("fullName","Driver edited","status","DISABLED","roles",List.of("DRIVER")));
        mvc.perform(put("/api/admin/staff/"+admin.user().userId()).header("Authorization",bearer(admin))
            .contentType("application/json").content(update)).andExpect(status().isConflict());
        mvc.perform(put("/api/admin/staff/"+driver.user().userId()).header("Authorization",bearer(admin))
            .contentType("application/json").content(update)).andExpect(status().isOk());
        assertTrue(identity.authenticate(driver.token()).isEmpty());
        mvc.perform(get("/api/admin/staff").header("Authorization",bearer(admin))).andExpect(status().isOk())
            .andExpect(content().string(org.hamcrest.Matchers.not(org.hamcrest.Matchers.containsString("password_hash"))));
    }
    @Test void partnerSuspensionRevokesAccessAndRequiresValidTransitions() throws Exception {
        var admin=admin(); String email=UUID.randomUUID()+"@test.invalid";
        long org=partners.register(email,PASSWORD,"Partner","Restaurant","RESTAURANT");
        mvc.perform(patch("/api/admin/partners/"+org+"/status").header("Authorization",bearer(admin))
            .contentType("application/json").content(body(Map.of("status","ACTIVE","reason","invalid bypass"))))
            .andExpect(status().isConflict());
        partners.approve(admin.user(),org); var partner=identity.login(email,PASSWORD);
        mvc.perform(patch("/api/admin/partners/"+org+"/status").header("Authorization",bearer(admin))
            .contentType("application/json").content(body(Map.of("status","SUSPENDED","reason","test suspension"))))
            .andExpect(status().isOk());
        assertTrue(identity.authenticate(partner.token()).isEmpty());
        assertEquals("SUSPENDED",jdbc.queryForObject("SELECT status FROM organizations WHERE organization_id=?",String.class,org));
    }
}
