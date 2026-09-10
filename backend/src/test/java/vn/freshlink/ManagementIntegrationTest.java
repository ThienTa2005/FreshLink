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
import static org.hamcrest.Matchers.*;

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
    long create(String path, Object request, IdentityService.LoginResult login) throws Exception {
        var result=mvc.perform(post(path).header("Authorization",bearer(login)).contentType("application/json").content(body(request)))
            .andExpect(status().isOk()).andReturn();
        return json.readTree(result.getResponse().getContentAsString()).get("data").asLong();
    }

    @Test void catalogueCrudPreservesHistoryAndPreventsOrderingArchivedCategory() throws Exception {
        var admin=admin(); String code=UUID.randomUUID().toString().substring(0,20);
        long category=create("/api/operations/categories",Map.of("code",code,"name","Test category","active",true),admin);
        long product=create("/api/operations/products",Map.of("categoryId",category,"code",code,"name","Test product","active",true),admin);
        long sku=create("/api/operations/skus",Map.of("productId",product,"code",code,"name","Test SKU","unit","KG",
            "packSize",1,"packDescription","1 kg","minimum",1,"step",1),admin);
        mvc.perform(put("/api/operations/skus/"+sku).header("Authorization",bearer(admin)).contentType("application/json")
            .content(body(Map.of("name","Updated SKU","packDescription","1 kg","minimum",1,"step",0,"active",true))))
            .andExpect(status().isBadRequest());
        mvc.perform(put("/api/operations/skus/"+sku).header("Authorization",bearer(admin)).contentType("application/json")
            .content(body(Map.of("name","Updated SKU","packDescription","1 kg","minimum",1,"step",1,"active",true))))
            .andExpect(status().isOk());
        String email=UUID.randomUUID()+"@test.invalid";
        long org=partners.register(email,PASSWORD,"Buyer","Buyer","RESTAURANT"); partners.approve(admin.user(),org);
        var buyer=identity.login(email,PASSWORD);
        mvc.perform(delete("/api/operations/categories/"+category).header("Authorization",bearer(buyer))).andExpect(status().isForbidden());
        mvc.perform(delete("/api/operations/categories/"+category).header("Authorization",bearer(admin))).andExpect(status().isOk());
        assertEquals(1,jdbc.queryForObject("SELECT COUNT(*) FROM product_skus WHERE sku_id=?",Integer.class,sku));
        var date=java.time.LocalDate.now(java.time.ZoneId.of("Asia/Ho_Chi_Minh")).plusDays(3);
        mvc.perform(get("/api/public/catalog").param("date",date.toString())).andExpect(status().isOk())
            .andExpect(content().string(not(containsString(code))));
        long addr=sql.insert("INSERT INTO addresses(organization_id,address_name,address_line,district,address_type) VALUES (?,'Test','Street','District','DELIVERY')",org);
        jdbc.update("INSERT INTO sku_prices(sku_id,selling_unit_price,valid_from) VALUES (?,1000,'2020-01-01')",sku);
        mvc.perform(post("/api/orders").header("Authorization",bearer(buyer)).header("Idempotency-Key",UUID.randomUUID().toString())
            .contentType("application/json").content(body(Map.of("restaurantId",org,"addressId",addr,"date",date.toString(),
                "startTime","07:00","endTime","09:00","items",List.of(Map.of("skuId",sku,"quantity",1))))))
            .andExpect(status().isBadRequest());
        assertEquals(0,jdbc.queryForObject("SELECT COUNT(*) FROM customer_orders WHERE restaurant_id=?",Integer.class,org));
        mvc.perform(delete("/api/operations/skus/9223372036854775807").header("Authorization",bearer(admin))).andExpect(status().isNotFound());
    }

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
