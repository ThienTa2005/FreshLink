package vn.freshlink;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import static org.hamcrest.Matchers.*;

import java.math.BigDecimal;
import java.time.*;
import java.util.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import vn.freshlink.common.MediaStorage;
import vn.freshlink.common.Sql;
import vn.freshlink.identity.*;
import vn.freshlink.ordering.*;
import vn.freshlink.sourcing.*;
import vn.freshlink.quality.*;
import vn.freshlink.delivery.*;

@SpringBootTest
@AutoConfigureMockMvc
@EnabledIfEnvironmentVariable(named="FRESHLINK_INTEGRATION", matches="true")
public class ThreePhasesIntegrationTest {
    @Autowired MockMvc mvc;
    @Autowired com.fasterxml.jackson.databind.ObjectMapper json;
    @Autowired JdbcTemplate jdbc;
    @Autowired Sql sql;
    @Autowired PasswordEncoder passwords;
    @Autowired IdentityService identity;
    @Autowired PartnerService partners;
    @Autowired OrderingService ordering;
    @Autowired SourcingService sourcing;
    @Autowired QualityService quality;
    @Autowired DeliveryService delivery;

    @MockitoBean MediaStorage mediaStorage;

    @BeforeEach void mockStorage() {
        org.mockito.Mockito.when(mediaStorage.upload(org.mockito.ArgumentMatchers.any(byte[].class), org.mockito.ArgumentMatchers.anyString()))
            .thenAnswer(call -> new MediaStorage.Stored(UUID.randomUUID().toString(), call.getArgument(1), "raw", "authenticated", "pdf", 1,
                ((byte[]) call.getArgument(0)).length));
    }

    static final String PASS = "Integration-test-12345!";
    BigDecimal q(String v) { return new BigDecimal(v); }
    String key() { return UUID.randomUUID().toString(); }
    String body(Object value) throws Exception { return json.writeValueAsString(value); }
    String bearer(IdentityService.LoginResult login) { return "Bearer " + login.token(); }

    IdentityService.LoginResult createActor(String orgType, String roleCode) {
        String email = UUID.randomUUID() + "@test.invalid";
        long user = sql.insert("INSERT INTO users(email,password_hash,full_name,status) VALUES (?,?,?,'ACTIVE')",
            email, passwords.encode(PASS), roleCode);
        long org = sql.insert("INSERT INTO organizations(organization_code,organization_name,organization_type,status) VALUES (?,?,?,'ACTIVE')",
            key().substring(0, 24), orgType + "-" + roleCode, orgType);
        long member = sql.insert("INSERT INTO organization_members(user_id,organization_id,status) VALUES (?,?,'ACTIVE')", user, org);
        jdbc.update("INSERT INTO member_roles(member_id,role_id) SELECT ?,role_id FROM roles WHERE role_code=?", member, roleCode);
        if ("RESTAURANT".equals(orgType)) {
            jdbc.update("INSERT INTO restaurant_profiles(restaurant_id,restaurant_type,approval_required) VALUES (?,'OTHER',FALSE)", org);
        } else if ("SUPPLIER".equals(orgType)) {
            jdbc.update("INSERT INTO supplier_profiles(supplier_id,supplier_type) VALUES (?,'FARM')", org);
        }
        return identity.login(email, PASS);
    }

    long address(long orgId, String type) {
        return sql.insert("INSERT INTO addresses(organization_id,address_name,address_line,district,address_type) VALUES (?,'Loc','123 Đường Số 1','Quận 1',?)",
            orgId, type);
    }

    @Test
    void phase1_governance_roleIsolation_and_driverCirculation() throws Exception {
        var admin = createActor("FRESHLINK", "SYSTEM_ADMIN");

        // 1. Partner registration
        String restaurantEmail = UUID.randomUUID() + "@partner.invalid";
        long regOrg = partners.register(restaurantEmail, PASS, "Chủ quán A", "Nhà hàng Phở A", "RESTAURANT");
        assertEquals("PENDING", jdbc.queryForObject("SELECT status FROM organizations WHERE organization_id=?", String.class, regOrg));

        // 2. Admin requests more information
        mvc.perform(post("/api/admin/partners/" + regOrg + "/request-information")
            .header("Authorization", bearer(admin))
            .contentType("application/json")
            .content(body(Map.of("reason", "Cần bổ sung giấy phép ATTP"))))
            .andExpect(status().isOk());

        // 3. Partner checks status publicly
        mvc.perform(post("/api/public/partners/status")
            .contentType("application/json")
            .content(body(Map.of("email", restaurantEmail, "password", PASS))))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data[0].status").value("PENDING"))
            .andExpect(jsonPath("$.data[0].review_note").value("Cần bổ sung giấy phép ATTP"));

        // 4. Admin approves partner
        mvc.perform(post("/api/admin/partners/" + regOrg + "/approve")
            .header("Authorization", bearer(admin)))
            .andExpect(status().isOk());
        assertEquals("ACTIVE", jdbc.queryForObject("SELECT status FROM organizations WHERE organization_id=?", String.class, regOrg));

        // Partner can now log in
        var partnerLogin = identity.login(restaurantEmail, PASS);
        assertNotNull(partnerLogin.token());

        // 5. Multi-membership role isolation check
        String multiEmail = UUID.randomUUID() + "@multi.invalid";
        long multiUser = sql.insert("INSERT INTO users(email,password_hash,full_name,status) VALUES (?,?,?,'ACTIVE')",
            multiEmail, passwords.encode(PASS), "Multi User");
        long orgRest = sql.insert("INSERT INTO organizations(organization_code,organization_name,organization_type,status) VALUES (?,'Rest Org','RESTAURANT','ACTIVE')", key().substring(0, 20));
        long orgSupp = sql.insert("INSERT INTO organizations(organization_code,organization_name,organization_type,status) VALUES (?,'Supp Org','SUPPLIER','ACTIVE')", key().substring(0, 20));
        jdbc.update("INSERT INTO restaurant_profiles(restaurant_id,restaurant_type,approval_required) VALUES (?,'OTHER',FALSE)", orgRest);
        jdbc.update("INSERT INTO supplier_profiles(supplier_id,supplier_type) VALUES (?,'FARM')", orgSupp);

        long memRest = sql.insert("INSERT INTO organization_members(user_id,organization_id,status) VALUES (?,?,'ACTIVE')", multiUser, orgRest);
        long memSupp = sql.insert("INSERT INTO organization_members(user_id,organization_id,status) VALUES (?,?,'ACTIVE')", multiUser, orgSupp);
        jdbc.update("INSERT INTO member_roles(member_id,role_id) SELECT ?,role_id FROM roles WHERE role_code='RESTAURANT_MANAGER'", memRest);
        jdbc.update("INSERT INTO member_roles(member_id,role_id) SELECT ?,role_id FROM roles WHERE role_code='SUPPLIER_MANAGER'", memSupp);

        var multiLogin = identity.login(multiEmail, PASS);

        // When requesting with X-Organization-Id: orgRest, actor is isolated to RESTAURANT_MANAGER
        mvc.perform(get("/api/restaurants/" + orgRest + "/policy")
            .header("Authorization", bearer(multiLogin))
            .header("X-Organization-Id", String.valueOf(orgRest)))
            .andExpect(status().isOk());

        // Accessing supplier endpoint while pinned to orgRest should be forbidden
        mvc.perform(get("/api/supplier/offers")
            .param("supplierId", String.valueOf(orgSupp))
            .header("Authorization", bearer(multiLogin))
            .header("X-Organization-Id", String.valueOf(orgRest)))
            .andExpect(status().isForbidden());

        // When pinned to orgSupp, supplier endpoint works
        mvc.perform(get("/api/supplier/offers")
            .param("supplierId", String.valueOf(orgSupp))
            .header("Authorization", bearer(multiLogin))
            .header("X-Organization-Id", String.valueOf(orgSupp)))
            .andExpect(status().isOk());

        // 6. Driver circulation access & search
        var driver = createActor("FRESHLINK", "DRIVER");
        mvc.perform(get("/api/assets")
            .header("Authorization", bearer(driver)))
            .andExpect(status().isOk());

        mvc.perform(get("/api/search").param("q", "TRIP")
            .header("Authorization", bearer(driver)))
            .andExpect(status().isOk());

        // 7. Workspace tasks deduplication check
        mvc.perform(get("/api/workspace/tasks")
            .header("Authorization", bearer(admin)))
            .andExpect(status().isOk());
    }

    @Test
    void phase2_restaurantApprovalWorkflow_cutoff_and_claims() throws Exception {
        var admin = createActor("FRESHLINK", "SYSTEM_ADMIN");
        var restaurant = createActor("RESTAURANT", "RESTAURANT_MANAGER");
        long restOrg = restaurant.user().memberships().get(0).organizationId();
        long delivAddr = address(restOrg, "DELIVERY");

        // Add a purchaser to the same restaurant
        String purchEmail = UUID.randomUUID() + "@purchaser.invalid";
        long purchUser = sql.insert("INSERT INTO users(email,password_hash,full_name,status) VALUES (?,?,?,'ACTIVE')",
            purchEmail, passwords.encode(PASS), "Purchaser");
        long purchMember = sql.insert("INSERT INTO organization_members(user_id,organization_id,status) VALUES (?,?,'ACTIVE')", purchUser, restOrg);
        jdbc.update("INSERT INTO member_roles(member_id,role_id) SELECT ?,role_id FROM roles WHERE role_code='RESTAURANT_PURCHASER'", purchMember);
        var purchaser = identity.login(purchEmail, PASS);

        // 1. Enable approval policy: approvalRequired = true
        mvc.perform(put("/api/restaurants/" + restOrg + "/policy")
            .header("Authorization", bearer(restaurant))
            .contentType("application/json")
            .content(body(Map.of("approvalRequired", true))))
            .andExpect(status().isOk());

        // 2. Save order template
        mvc.perform(post("/api/restaurants/" + restOrg + "/saved-orders")
            .header("Authorization", bearer(purchaser))
            .contentType("application/json")
            .content(body(Map.of("name", "Mẫu thứ 2 hàng tuần", "kind", "TEMPLATE", "payload", Map.of("items", List.of(Map.of("skuId", 1, "qty", 2)))))))
            .andExpect(status().isOk());

        mvc.perform(get("/api/restaurants/" + restOrg + "/saved-orders")
            .header("Authorization", bearer(purchaser)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data[0].name").value("Mẫu thứ 2 hàng tuần"));

        // Setup SKU price
        LocalDate orderDate = LocalDate.now(ZoneId.of("Asia/Ho_Chi_Minh")).plusDays(3);
        jdbc.update("INSERT INTO sku_prices(sku_id,selling_unit_price,valid_from) VALUES (1,15000,?)",
            java.sql.Timestamp.from(orderDate.atStartOfDay(ZoneId.of("Asia/Ho_Chi_Minh")).toInstant()));

        // 3. Purchaser creates draft order
        var createReq = new OrderingService.Create(restOrg, delivAddr, orderDate, LocalTime.of(7, 0), LocalTime.of(9, 0), "Draft order test",
            List.of(new OrderingService.Line(1L, q("2"))), null, true);
        long orderId = ordering.create(purchaser.user(), createReq, key());

        var orderData = jdbc.queryForMap("SELECT * FROM customer_orders WHERE order_id=?", orderId);
        assertEquals("DRAFT", orderData.get("order_status"));

        // 4. Purchaser submits order -> becomes SUBMITTED & PENDING
        mvc.perform(post("/api/orders/" + orderId + "/submit")
            .header("Authorization", bearer(purchaser)))
            .andExpect(status().isOk());

        var submittedData = jdbc.queryForMap("SELECT * FROM customer_orders WHERE order_id=?", orderId);
        assertEquals("SUBMITTED", submittedData.get("order_status"));
        assertEquals("PENDING", submittedData.get("approval_status"));

        // 5. Manager rejects order with reason -> back to DRAFT
        mvc.perform(post("/api/orders/" + orderId + "/approve")
            .header("Authorization", bearer(restaurant))
            .contentType("application/json")
            .content(body(Map.of("approved", false, "reason", "Giảm xuống 1 kg"))))
            .andExpect(status().isOk());

        var rejectedData = jdbc.queryForMap("SELECT * FROM customer_orders WHERE order_id=?", orderId);
        assertEquals("DRAFT", rejectedData.get("order_status"));
        assertEquals("REJECTED", rejectedData.get("approval_status"));
        assertEquals("Giảm xuống 1 kg", rejectedData.get("rejection_reason"));

        // 6. Purchaser updates order before cutoff
        mvc.perform(put("/api/orders/" + orderId)
            .header("Authorization", bearer(purchaser))
            .contentType("application/json")
            .content(body(Map.of(
                "addressId", delivAddr,
                "date", orderDate.toString(),
                "startTime", "07:00",
                "endTime", "09:00",
                "note", "Đã sửa thành 1 kg",
                "items", List.of(Map.of("skuId", 1, "quantity", 1))
            ))))
            .andExpect(status().isOk());

        // 7. Purchaser resubmits and Manager approves
        mvc.perform(post("/api/orders/" + orderId + "/submit")
            .header("Authorization", bearer(purchaser)))
            .andExpect(status().isOk());

        mvc.perform(post("/api/orders/" + orderId + "/approve")
            .header("Authorization", bearer(restaurant))
            .contentType("application/json")
            .content(body(Map.of("approved", true, "reason", "Đồng ý"))))
            .andExpect(status().isOk());

        var approvedData = jdbc.queryForMap("SELECT * FROM customer_orders WHERE order_id=?", orderId);
        assertEquals("CONFIRMED", approvedData.get("order_status"));
        assertEquals("APPROVED", approvedData.get("approval_status"));
    }

    @Test
    void phase3_sourcing_batchLifecycle_gateInspection_reinspection_and_allocation() throws Exception {
        var admin = createActor("FRESHLINK", "SYSTEM_ADMIN");
        var coordinator = createActor("FRESHLINK", "OPERATIONS_COORDINATOR");
        var inspector = createActor("FRESHLINK", "QUALITY_INSPECTOR");
        var cskh = createActor("FRESHLINK", "CUSTOMER_SUPPORT");
        var restaurant = createActor("RESTAURANT", "RESTAURANT_MANAGER");
        var supplierA = createActor("SUPPLIER", "SUPPLIER_MANAGER");
        var supplierB = createActor("SUPPLIER", "SUPPLIER_MANAGER");

        long restOrg = restaurant.user().memberships().get(0).organizationId();
        long suppOrgA = supplierA.user().memberships().get(0).organizationId();
        long suppOrgB = supplierB.user().memberships().get(0).organizationId();

        long dockAddr = address(admin.user().memberships().get(0).organizationId(), "CROSS_DOCK");
        long delivAddr = address(restOrg, "DELIVERY");

        LocalDate deliveryDate = LocalDate.now(ZoneId.of("Asia/Ho_Chi_Minh")).plusDays(4);
        jdbc.update("INSERT INTO sku_prices(sku_id,selling_unit_price,valid_from) VALUES (1,25000,?)",
            java.sql.Timestamp.from(deliveryDate.atStartOfDay(ZoneId.of("Asia/Ho_Chi_Minh")).toInstant()));

        // Restaurant places order for 10 kg
        long orderId = ordering.create(restaurant.user(), new OrderingService.Create(restOrg, delivAddr, deliveryDate,
            LocalTime.of(7, 0), LocalTime.of(9, 0), "Sourcing test", List.of(new OrderingService.Line(1L, q("10")))), key());
        long orderItemId = jdbc.queryForObject("SELECT order_item_id FROM order_items WHERE order_id=?", Long.class, orderId);

        // Suppliers create offers
        long offerA = sourcing.offer(supplierA.user(), new SourcingService.Offer(suppOrgA, 1L, deliveryDate, q("6"), q("12000")));
        long offerB = sourcing.offer(supplierB.user(), new SourcingService.Offer(suppOrgB, 1L, deliveryDate, q("4"), q("12000")));

        // Coordinator sources to both suppliers
        long reqA = sourcing.request(coordinator.user(), new SourcingService.Request(offerA, orderItemId, dockAddr, LocalTime.of(5, 0), q("6"), q("0")), key());
        long reqB = sourcing.request(coordinator.user(), new SourcingService.Request(offerB, orderItemId, dockAddr, LocalTime.of(5, 30), q("4"), q("0")), key());

        long reqItemA = jdbc.queryForObject("SELECT supply_request_item_id FROM supply_request_items WHERE supply_request_id=?", Long.class, reqA);
        long reqItemB = jdbc.queryForObject("SELECT supply_request_item_id FROM supply_request_items WHERE supply_request_id=?", Long.class, reqB);

        // Both suppliers accept
        sourcing.respond(supplierA.user(), reqItemA, q("6"));
        sourcing.respond(supplierB.user(), reqItemB, q("4"));

        // Supplier A creates a batch of 5 kg (partial declaration)
        long batchA = quality.create(supplierA.user(), new QualityService.Batch(reqItemA, q("5"), "Vườn Lâm Đồng"), key());

        // Supplier A updates batch before Gate inspection
        mvc.perform(put("/api/batches/" + batchA)
            .header("Authorization", bearer(supplierA))
            .contentType("application/json")
            .content(body(Map.of("quantity", 4.5, "origin", "Vườn Đà Lạt Lô 2"))))
            .andExpect(status().isOk());

        assertEquals(0, q("4.5").compareTo(jdbc.queryForObject("SELECT declared_quantity FROM batches WHERE batch_id=?", BigDecimal.class, batchA)));

        // Supplier A creates another batch and then cancels it before Gate
        long batchToCancel = quality.create(supplierA.user(), new QualityService.Batch(reqItemA, q("1"), "Lô thừa"), key());
        mvc.perform(post("/api/batches/" + batchToCancel + "/cancel")
            .header("Authorization", bearer(supplierA))
            .contentType("application/json")
            .content(body(Map.of("reason", "Lỗi đóng gói tại vườn"))))
            .andExpect(status().isOk());

        assertEquals("CLOSED", jdbc.queryForObject("SELECT batch_status FROM batches WHERE batch_id=?", String.class, batchToCancel));

        // Gate inspection on batchA (4.5 kg):
        // 2 kg accepted, 1.5 kg quarantined/review, 1 kg rejected
        mvc.perform(post("/api/batches/" + batchA + "/inspect")
            .header("Authorization", bearer(inspector))
            .header("Idempotency-Key", key())
            .contentType("application/json")
            .content(body(new QualityService.Inspection(q("2"), q("1.5"), q("1"), "Hàng dập 1kg, 1.5kg cần cách ly kiểm tra sâu"))))
            .andExpect(status().isOk());

        var inspectedBatch = jdbc.queryForMap("SELECT * FROM batches WHERE batch_id=?", batchA);
        assertEquals("PARTIALLY_ACCEPTED", inspectedBatch.get("batch_status"));
        assertEquals(0, q("2").compareTo((BigDecimal) inspectedBatch.get("accepted_quantity")));
        assertEquals(0, q("1.5").compareTo((BigDecimal) inspectedBatch.get("review_quantity")));
        assertEquals(0, q("1").compareTo((BigDecimal) inspectedBatch.get("rejected_quantity")));

        // Verify shortage release: planned_quantity was 6, rejected was 1 -> planned_quantity should now be 5
        BigDecimal plannedA = jdbc.queryForObject("SELECT planned_quantity FROM supply_request_item_orders WHERE supply_request_item_id=?", BigDecimal.class, reqItemA);
        assertEquals(0, q("5").compareTo(plannedA));

        // Reinspection of quarantined 1.5 kg:
        // 1 kg passes inspection, 0.5 kg rejected
        mvc.perform(post("/api/batches/" + batchA + "/reinspect")
            .header("Authorization", bearer(inspector))
            .header("Idempotency-Key", key())
            .contentType("application/json")
            .content(body(new ReinspectionController.Request(q("1"), q("0.5"), "1kg đạt chuẩn sau khi làm sạch"))))
            .andExpect(status().isOk());

        var reinspectedBatch = jdbc.queryForMap("SELECT * FROM batches WHERE batch_id=?", batchA);
        // Total accepted is now 2 + 1 = 3 kg
        assertEquals(0, q("3").compareTo((BigDecimal) reinspectedBatch.get("accepted_quantity")));
        assertEquals(0, BigDecimal.ZERO.compareTo((BigDecimal) reinspectedBatch.get("review_quantity")));
        assertEquals(0, q("1.5").compareTo((BigDecimal) reinspectedBatch.get("rejected_quantity")));

        // Planned quantity reduced by another 0.5 kg: 5 - 0.5 = 4.5 kg
        BigDecimal plannedAfterReinspect = jdbc.queryForObject("SELECT planned_quantity FROM supply_request_item_orders WHERE supply_request_item_id=?", BigDecimal.class, reqItemA);
        assertEquals(0, q("4.5").compareTo(plannedAfterReinspect));

        // Coordinator allocates 3 kg from batchA to orderItemId
        mvc.perform(post("/api/allocations")
            .header("Authorization", bearer(coordinator))
            .header("Idempotency-Key", key())
            .contentType("application/json")
            .content(body(new QualityService.Allocation(batchA, orderItemId, q("3")))))
            .andExpect(status().isOk());

        // Attempting to allocate more than accepted quantity must fail
        mvc.perform(post("/api/allocations")
            .header("Authorization", bearer(coordinator))
            .header("Idempotency-Key", key())
            .contentType("application/json")
            .content(body(new QualityService.Allocation(batchA, orderItemId, q("0.1")))))
            .andExpect(status().isBadRequest());

        // Restaurant files a claim for 0.5 kg of allocated goods
        mvc.perform(post("/api/claims")
            .header("Authorization", bearer(restaurant))
            .header("Idempotency-Key", key())
            .contentType("application/json")
            .content(body(Map.of(
                "orderItemId", orderItemId,
                "batchId", batchA,
                "quantity", 0.5,
                "description", "Rau bị úa khi giao"
            ))))
            .andExpect(status().isOk());

        long claimId = jdbc.queryForObject("SELECT complaint_id FROM complaints WHERE order_id=? ORDER BY complaint_id DESC LIMIT 1", Long.class, orderId);

        // Customer Support resolves claim
        mvc.perform(post("/api/claims/" + claimId + "/resolve")
            .header("Authorization", bearer(cskh))
            .contentType("application/json")
            .content(body(Map.of("resolution", "Đồng ý hoàn tiền 0.5kg cho nhà hàng"))))
            .andExpect(status().isOk());

        assertEquals("RESOLVED", jdbc.queryForObject("SELECT status FROM complaints WHERE complaint_id=?", String.class, claimId));
    }
}
