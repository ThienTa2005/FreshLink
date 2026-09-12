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
import vn.freshlink.common.EmailOutboxWorker;
import vn.freshlink.identity.*;
import vn.freshlink.ordering.*;
import vn.freshlink.sourcing.*;
import vn.freshlink.quality.*;
import vn.freshlink.delivery.*;
import vn.freshlink.assets.*;
import vn.freshlink.billing.*;
import vn.freshlink.claims.*;
import vn.freshlink.system.NotificationService;

@SpringBootTest
@AutoConfigureMockMvc
@EnabledIfEnvironmentVariable(named="FRESHLINK_INTEGRATION", matches="true")
public class Phases456IntegrationTest {
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
    @Autowired AssetController assets;
    @Autowired OrderRemedyController remedies;
    @Autowired ClaimDossierController claimDossier;
    @Autowired InvoiceController invoices;
    @Autowired SettlementController settlements;
    @Autowired NotificationService notificationService;
    @Autowired EmailOutboxWorker emailWorker;

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
    void phase4_orderRemedies_driverCockpit_crateLifecycle_and_redeliveryWithoutDuplicateCharges() throws Exception {
        var admin = createActor("FRESHLINK", "SYSTEM_ADMIN");
        var coordinator = createActor("FRESHLINK", "OPERATIONS_COORDINATOR");
        var driver = createActor("FRESHLINK", "DRIVER");
        var restaurant = createActor("RESTAURANT", "RESTAURANT_MANAGER");
        var supplier = createActor("SUPPLIER", "SUPPLIER_MANAGER");

        long restOrg = restaurant.user().memberships().get(0).organizationId();
        long suppOrg = supplier.user().memberships().get(0).organizationId();
        long hubOrg = coordinator.user().memberships().get(0).organizationId();

        long restAddr = address(restOrg, "DELIVERY");
        long hubAddr = address(hubOrg, "CROSS_DOCK");

        long cat = sql.insert("INSERT INTO product_categories(category_code,category_name) VALUES (?,'Rau củ')", key().substring(0, 20));
        long prod = sql.insert("INSERT INTO products(category_id,product_code,product_name) VALUES (?,?,'Cải ngọt')", cat, key().substring(0, 20));
        long sku = sql.insert("INSERT INTO product_skus(product_id,sku_code,sku_name,base_unit,pack_size,pack_description,minimum_order_quantity,quantity_step) VALUES (?,?,?,'KG',1.0,'Gói 1kg',1.0,1.0)",
            prod, key().substring(0, 20), "Cải ngọt chuẩn");
        long subSku = sql.insert("INSERT INTO product_skus(product_id,sku_code,sku_name,base_unit,pack_size,pack_description,minimum_order_quantity,quantity_step) VALUES (?,?,?,'KG',1.0,'Gói 1kg thay thế',1.0,1.0)",
            prod, key().substring(0, 20), "Cải thìa thay thế");

        LocalDate deliveryDate = LocalDate.now(ZoneId.of("Asia/Ho_Chi_Minh")).plusDays(4);
        jdbc.update("INSERT INTO sku_prices(sku_id,selling_unit_price,valid_from) VALUES (?,25000,?)", sku,
            java.sql.Timestamp.from(deliveryDate.minusDays(5).atStartOfDay(ZoneId.of("Asia/Ho_Chi_Minh")).toInstant()));
        jdbc.update("INSERT INTO sku_prices(sku_id,selling_unit_price,valid_from) VALUES (?,22000,?)", subSku,
            java.sql.Timestamp.from(deliveryDate.minusDays(5).atStartOfDay(ZoneId.of("Asia/Ho_Chi_Minh")).toInstant()));

        // 1. Create order
        long order = ordering.create(restaurant.user(), new OrderingService.Create(
            restOrg, restAddr, deliveryDate, LocalTime.of(7, 0), LocalTime.of(9, 0), null,
            List.of(new OrderingService.Line(sku, q("10.0")))
        ), key());

        long orderItemId = jdbc.queryForObject("SELECT order_item_id FROM order_items WHERE order_id=?", Long.class, order);

        // 2. Propose Remedy: Substitute 5kg with subSku, price diff -15000, deadline 60 min
        mvc.perform(post("/api/orders/" + order + "/remedies")
                .header("Authorization", bearer(coordinator))
                .contentType("application/json")
                .content(body(Map.of(
                    "orderItemId", orderItemId,
                    "remedyType", "SUBSTITUTION",
                    "affectedQuantity", 5.0,
                    "substituteSkuId", subSku,
                    "substituteQuantity", 5.0,
                    "priceDifference", -15000,
                    "deadlineMinutes", 60,
                    "proposalNote", "Thiếu 5kg cải ngọt, đề xuất đổi cải thìa giảm 15k"
                ))))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.success").value(true));

        // List remedies: should show 1 PENDING remedy
        mvc.perform(get("/api/orders/" + order + "/remedies")
                .header("Authorization", bearer(restaurant)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data", hasSize(1)))
            .andExpect(jsonPath("$.data[0].status").value("PENDING"));

        long remedyId = jdbc.queryForObject("SELECT remedy_id FROM order_remedies WHERE order_item_id=?", Long.class, orderItemId);

        // 3. Restaurant manager accepts remedy
        mvc.perform(post("/api/orders/remedies/" + remedyId + "/respond")
                .header("Authorization", bearer(restaurant))
                .contentType("application/json")
                .content(body(Map.of("decision", "ACCEPT"))))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.message").value("Đã chấp thuận phương án ngoại lệ; đơn hàng đã được cập nhật"));

        assertEquals("ACCEPTED", jdbc.queryForObject("SELECT status FROM order_remedies WHERE remedy_id=?", String.class, remedyId));

        // 4. Propose second remedy and reject it
        mvc.perform(post("/api/orders/" + order + "/remedies")
                .header("Authorization", bearer(coordinator))
                .contentType("application/json")
                .content(body(Map.of(
                    "orderItemId", orderItemId,
                    "remedyType", "SHORTAGE_REDUCTION",
                    "affectedQuantity", 2.0,
                    "priceDifference", -50000,
                    "deadlineMinutes", 30,
                    "proposalNote", "Bớt thêm 2kg"
                ))))
            .andExpect(status().isOk());

        long remedy2Id = jdbc.queryForObject("SELECT remedy_id FROM order_remedies WHERE order_item_id=? AND version=2", Long.class, orderItemId);

        mvc.perform(post("/api/orders/remedies/" + remedy2Id + "/respond")
                .header("Authorization", bearer(restaurant))
                .contentType("application/json")
                .content(body(Map.of("decision", "REJECT", "reason", "Cần đủ hàng phục vụ tiệc"))))
            .andExpect(status().isOk());

        assertEquals("REJECTED", jdbc.queryForObject("SELECT status FROM order_remedies WHERE remedy_id=?", String.class, remedy2Id));
        assertEquals("Cần đủ hàng phục vụ tiệc", jdbc.queryForObject("SELECT rejection_reason FROM order_remedies WHERE remedy_id=?", String.class, remedy2Id));

        // 5. Crate Lifecycle: ISSUE_TO_VEHICLE -> DELIVER -> COLLECT -> CLEAN -> REPORT_DAMAGED
        long crateId = ((Number) assets.create(coordinator.user(), new AssetController.Create("CR-" + key().substring(0, 10))).data()).longValue();

        // Create trip and stop for testing crate movements
        long trip = sql.insert("INSERT INTO delivery_trips(trip_code,trip_date,origin_address_id,driver_user_id,status,created_by) VALUES (?,?,?,?,'IN_PROGRESS',?)",
            "TRIP-" + key().substring(0, 10), deliveryDate, hubAddr, driver.user().userId(), coordinator.user().userId());
        long stop = sql.insert("INSERT INTO trip_stops(trip_id,order_id,delivery_address_id,stop_sequence,status) VALUES (?,?,?,1,'PENDING')",
            trip, order, restAddr);

        // Issue crate to vehicle
        mvc.perform(post("/api/assets/" + crateId + "/move")
                .header("Authorization", bearer(coordinator))
                .contentType("application/json")
                .content(body(Map.of("action", "ISSUE_TO_VEHICLE", "stopId", stop, "note", "Cấp lên xe giao hàng"))))
            .andExpect(status().isOk());
        assertEquals("ON_VEHICLE", jdbc.queryForObject("SELECT status FROM returnable_assets WHERE asset_id=?", String.class, crateId));
        assertEquals(driver.user().userId(), jdbc.queryForObject("SELECT driver_user_id FROM returnable_assets WHERE asset_id=?", Long.class, crateId));

        // Deliver crate to restaurant
        mvc.perform(post("/api/assets/" + crateId + "/move")
                .header("Authorization", bearer(driver))
                .contentType("application/json")
                .content(body(Map.of("action", "DELIVER", "stopId", stop, "note", "Giao thùng cho bếp"))))
            .andExpect(status().isOk());
        assertEquals("AT_RESTAURANT", jdbc.queryForObject("SELECT status FROM returnable_assets WHERE asset_id=?", String.class, crateId));
        assertEquals(restOrg, jdbc.queryForObject("SELECT current_organization_id FROM returnable_assets WHERE asset_id=?", Long.class, crateId));

        // Collect dirty crate back to vehicle
        mvc.perform(post("/api/assets/" + crateId + "/move")
                .header("Authorization", bearer(driver))
                .contentType("application/json")
                .content(body(Map.of("action", "COLLECT", "stopId", stop, "note", "Thu vỏ thùng dơ"))))
            .andExpect(status().isOk());
        assertEquals("RETURNED_DIRTY", jdbc.queryForObject("SELECT status FROM returnable_assets WHERE asset_id=?", String.class, crateId));

        // Clean crate
        mvc.perform(post("/api/assets/" + crateId + "/move")
                .header("Authorization", bearer(coordinator))
                .contentType("application/json")
                .content(body(Map.of("action", "CLEAN", "note", "Khử trùng nhiệt và dung dịch"))))
            .andExpect(status().isOk());
        assertEquals("AVAILABLE", jdbc.queryForObject("SELECT status FROM returnable_assets WHERE asset_id=?", String.class, crateId));

        // 6. Stop operations: Arrive -> Fail -> Redeliver
        mvc.perform(post("/api/stops/" + stop + "/arrive")
                .header("Authorization", bearer(driver))
                .contentType("application/json")
                .content(body(Map.of("latitude", 10.7769, "longitude", 106.7009))))
            .andExpect(status().isOk());
        assertNotNull(jdbc.queryForObject("SELECT actual_arrival_at FROM trip_stops WHERE trip_stop_id=?", java.sql.Timestamp.class, stop));

        // Driver reports failure
        mvc.perform(post("/api/stops/" + stop + "/fail")
                .header("Authorization", bearer(driver))
                .contentType("application/json")
                .content(body(Map.of("reasonCode", "RECEIVER_UNAVAILABLE", "reason", "Gọi 5 cuộc không nghe máy"))))
            .andExpect(status().isOk());
        assertEquals("FAILED", jdbc.queryForObject("SELECT status FROM trip_stops WHERE trip_stop_id=?", String.class, stop));

        BigDecimal orderTotalBeforeRedeliver = jdbc.queryForObject("SELECT total_amount FROM customer_orders WHERE order_id=?", BigDecimal.class, order);

        // Redeliver without duplicate charges
        mvc.perform(post("/api/stops/" + stop + "/redeliver")
                .header("Authorization", bearer(coordinator))
                .header("Idempotency-Key", key())
                .param("tripId", String.valueOf(trip)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.message").value("Đã lên lịch giao bù"));

        // Verify new stop created with delivery_round = 2 and linked to previous failed stop
        Long redeliveredStopId = jdbc.queryForObject("SELECT trip_stop_id FROM trip_stops WHERE redelivered_from_stop_id=?", Long.class, stop);
        assertNotNull(redeliveredStopId);
        Integer deliveryRound = jdbc.queryForObject("SELECT delivery_round FROM trip_stops WHERE trip_stop_id=?", Integer.class, redeliveredStopId);
        assertEquals(2, deliveryRound);

        // Verify order total amount is identical (NO duplicate billing)
        BigDecimal orderTotalAfterRedeliver = jdbc.queryForObject("SELECT total_amount FROM customer_orders WHERE order_id=?", BigDecimal.class, order);
        assertEquals(orderTotalBeforeRedeliver, orderTotalAfterRedeliver);
    }

    @Test
    void phase5_cskhDossier_sla_debtAdjustments_periodSettlements_and_notifications() throws Exception {
        var admin = createActor("FRESHLINK", "SYSTEM_ADMIN");
        var cskh = createActor("FRESHLINK", "CUSTOMER_SUPPORT");
        var accountant = createActor("FRESHLINK", "ACCOUNTANT");
        var restaurant = createActor("RESTAURANT", "RESTAURANT_MANAGER");
        var supplier = createActor("SUPPLIER", "SUPPLIER_MANAGER");

        long restOrg = restaurant.user().memberships().get(0).organizationId();
        long suppOrg = supplier.user().memberships().get(0).organizationId();
        long restAddr = address(restOrg, "DELIVERY");

        long cat = sql.insert("INSERT INTO product_categories(category_code,category_name) VALUES (?,'Củ quả')", key().substring(0, 20));
        long prod = sql.insert("INSERT INTO products(category_id,product_code,product_name) VALUES (?,?,'Cà rốt')", cat, key().substring(0, 20));
        long sku = sql.insert("INSERT INTO product_skus(product_id,sku_code,sku_name,base_unit,pack_size,pack_description,minimum_order_quantity,quantity_step) VALUES (?,?,?,'KG',5.0,'Bao 5kg',5.0,5.0)",
            prod, key().substring(0, 20), "Cà rốt Đà Lạt");

        LocalDate deliveryDate = LocalDate.now(ZoneId.of("Asia/Ho_Chi_Minh")).plusDays(4);
        jdbc.update("INSERT INTO sku_prices(sku_id,selling_unit_price,valid_from) VALUES (?,30000,?)", sku,
            java.sql.Timestamp.from(deliveryDate.minusDays(5).atStartOfDay(ZoneId.of("Asia/Ho_Chi_Minh")).toInstant()));

        long order = ordering.create(restaurant.user(), new OrderingService.Create(
            restOrg, restAddr, deliveryDate, LocalTime.of(7, 0), LocalTime.of(9, 0), null,
            List.of(new OrderingService.Line(sku, q("5.0")))
        ), key());
        long orderItemId = jdbc.queryForObject("SELECT order_item_id FROM order_items WHERE order_id=?", Long.class, order);

        // Create supply request, item, and batch for settlement and allocations
        long req = sql.insert("INSERT INTO supply_requests(request_code,supplier_id,delivery_to_address_id,required_date,required_arrival_time,status,created_by) VALUES (?,?,?,?,?,'RECEIVED',?)",
            "SRQ-" + key().substring(0, 10), suppOrg, restAddr, LocalDate.now(), LocalTime.of(8, 0), accountant.user().userId());
        long reqItem = sql.insert("INSERT INTO supply_request_items(supply_request_id,sku_id,requested_quantity,accepted_quantity,received_quantity,supplier_unit_price,commission_rate,status) VALUES (?,?,5.0,5.0,5.0,20000,5.0,'RECEIVED')",
            req, sku);

        long batch = sql.insert("INSERT INTO batches(batch_code,supplier_id,sku_id,supply_request_item_id,declared_quantity,received_quantity,accepted_quantity,allocated_quantity,batch_status,received_at,created_by) VALUES (?,?,?,?,5.0,5.0,5.0,5.0,'ACCEPTED',UTC_TIMESTAMP(3),?)",
            "B-" + key().substring(0, 10), suppOrg, sku, reqItem, accountant.user().userId());
        sql.insert("INSERT INTO batch_allocations(order_item_id,batch_id,allocated_quantity,allocated_by) VALUES (?,?,5.0,?)", orderItemId, batch, accountant.user().userId());

        // 1. File complaint
        mvc.perform(post("/api/claims")
                .header("Authorization", bearer(restaurant))
                .header("Idempotency-Key", key())
                .contentType("application/json")
                .content(body(Map.of(
                    "orderItemId", orderItemId,
                    "batchId", batch,
                    "quantity", 2.0,
                    "description", "Cà rốt bị dập nát khi nhận hàng"
                ))))
            .andExpect(status().isOk());

        long complaintId = jdbc.queryForObject("SELECT complaint_id FROM complaints WHERE order_id=?", Long.class, order);

        // 2. Query CSKH Inbox
        mvc.perform(get("/api/claims/inbox?department=CSKH")
                .header("Authorization", bearer(cskh)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data", hasSize(greaterThanOrEqualTo(1))));

        // 3. Query 360-degree Dossier
        mvc.perform(get("/api/claims/" + complaintId + "/dossier")
                .header("Authorization", bearer(cskh)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.complaint.complaint_id").value(complaintId))
            .andExpect(jsonPath("$.data.isInternalViewer").value(true));

        // 4. Post External Note (updates first_responded_at)
        mvc.perform(post("/api/claims/" + complaintId + "/notes")
                .header("Authorization", bearer(cskh))
                .contentType("application/json")
                .content(body(Map.of("content", "CSKH đã tiếp nhận và đang xác minh với nhà vận chuyển", "isInternal", false))))
            .andExpect(status().isOk());
        assertNotNull(jdbc.queryForObject("SELECT first_responded_at FROM complaints WHERE complaint_id=?", Object.class, complaintId));

        // Post Internal Note
        mvc.perform(post("/api/claims/" + complaintId + "/notes")
                .header("Authorization", bearer(cskh))
                .contentType("application/json")
                .content(body(Map.of("content", "Ghi chú nội bộ: tài xế báo đường dằn xóc", "isInternal", true))))
            .andExpect(status().isOk());

        // Restaurant manager view dossier: should not see internal notes
        mvc.perform(get("/api/claims/" + complaintId + "/dossier")
                .header("Authorization", bearer(restaurant)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.notes", hasSize(1))); // only public note

        // 5. Delegate to QC
        mvc.perform(post("/api/claims/" + complaintId + "/delegate")
                .header("Authorization", bearer(cskh))
                .contentType("application/json")
                .content(body(Map.of("department", "QC", "note", "Chuyển QC kiểm tra nguồn hàng"))))
            .andExpect(status().isOk());
        assertEquals("QC", jdbc.queryForObject("SELECT assigned_department FROM complaints WHERE complaint_id=?", String.class, complaintId));

        // 6. Close complaint
        mvc.perform(post("/api/claims/" + complaintId + "/close")
                .header("Authorization", bearer(cskh))
                .contentType("application/json")
                .content(body(Map.of("reason", "Đã bồi thường sản phẩm tương đương"))))
            .andExpect(status().isOk());
        assertEquals("CLOSED", jdbc.queryForObject("SELECT status FROM complaints WHERE complaint_id=?", String.class, complaintId));

        // 7. Accounting: Invoices, Credit Notes, Debit Notes
        long invoiceId = sql.insert("INSERT INTO invoices(invoice_code,order_id,restaurant_id,issued_at,due_date,subtotal_amount,tax_amount,total_amount,created_by,status) VALUES (?,?,?,UTC_TIMESTAMP(3),DATE_ADD(UTC_TIMESTAMP(3),INTERVAL 7 DAY),500000,0,500000,?,'PARTIALLY_PAID')",
            "INV-" + key().substring(0, 10), order, restOrg, accountant.user().userId());

        // Issue Credit Note (Giảm nợ 50,000)
        mvc.perform(post("/api/billing/invoices/" + invoiceId + "/adjust")
                .header("Authorization", bearer(accountant))
                .contentType("application/json")
                .content(body(Map.of("adjustmentType", "CREDIT_NOTE", "amount", 50000, "reason", "Giảm trừ hàng dập"))))
            .andExpect(status().isOk());

        // Total should be 450,000
        BigDecimal invTotal = jdbc.queryForObject("SELECT total_amount FROM invoices WHERE invoice_id=?", BigDecimal.class, invoiceId);
        assertEquals(new BigDecimal("450000.00"), invTotal);

        // Issue Debit Note (Tăng nợ 20,000)
        mvc.perform(post("/api/billing/invoices/" + invoiceId + "/adjust")
                .header("Authorization", bearer(accountant))
                .contentType("application/json")
                .content(body(Map.of("adjustmentType", "DEBIT_NOTE", "amount", 20000, "reason", "Phụ phí giao hỏa tốc"))))
            .andExpect(status().isOk());

        invTotal = jdbc.queryForObject("SELECT total_amount FROM invoices WHERE invoice_id=?", BigDecimal.class, invoiceId);
        assertEquals(new BigDecimal("470000.00"), invTotal);

        // View adjustments
        mvc.perform(get("/api/billing/invoices/" + invoiceId + "/adjustments")
                .header("Authorization", bearer(accountant)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data", hasSize(2)));

        // 8. Supplier Period Settlement & Statement
        mvc.perform(post("/api/billing/settlements/period")
                .header("Authorization", bearer(accountant))
                .header("Idempotency-Key", key())
                .contentType("application/json")
                .content(body(Map.of(
                    "supplierId", suppOrg,
                    "periodStart", LocalDate.now().minusDays(5).toString(),
                    "periodEnd", LocalDate.now().plusDays(5).toString(),
                    "adjustment", 0,
                    "note", "Đối soát kỳ này"
                ))))
            .andExpect(status().isOk());

        Long settlementId = jdbc.queryForObject("SELECT settlement_id FROM supplier_settlements WHERE supplier_id=? ORDER BY settlement_id DESC LIMIT 1", Long.class, suppOrg);
        assertNotNull(settlementId);

        // View statement
        mvc.perform(get("/api/billing/settlements/" + settlementId + "/statement")
                .header("Authorization", bearer(supplier)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.items", hasSize(greaterThanOrEqualTo(1))));

        // 9. Notifications Deduplication and Unread Count
        long testUser = cskh.user().userId();
        assertTrue(notificationService.send(testUser, "TEST_TYPE", "Tiêu đề 1", "Tin nhắn 1", "ORDER", order));
        assertFalse(notificationService.send(testUser, "TEST_TYPE", "Tiêu đề 1", "Tin nhắn 1", "ORDER", order)); // Deduplicated!

        mvc.perform(get("/api/notifications/unread-count")
                .header("Authorization", bearer(cskh)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.unread_count", greaterThanOrEqualTo(1)));

        // 10. Email SMTP Adapter SKIPPED status
        sql.insert("INSERT INTO email_outbox(recipient,template_code,payload,status) VALUES ('user@test.invalid','TEST',JSON_OBJECT('text','test'),'PENDING')");
        emailWorker.send();
        String outboxStatus = jdbc.queryForObject("SELECT status FROM email_outbox WHERE recipient='user@test.invalid' ORDER BY email_outbox_id DESC LIMIT 1", String.class);
        assertEquals("SKIPPED", outboxStatus);
    }

    @Test
    void phase6_pilotReadiness_roleIsolation_tracing_and_kpiActualBalance() throws Exception {
        var admin = createActor("FRESHLINK", "SYSTEM_ADMIN");
        var driver = createActor("FRESHLINK", "DRIVER");
        var restaurant = createActor("RESTAURANT", "RESTAURANT_PURCHASER");

        // 1. Request ID Tracing
        String explicitReqId = "trace-" + UUID.randomUUID();
        mvc.perform(get("/api/auth/me")
                .header("Authorization", bearer(admin))
                .header("X-Request-Id", explicitReqId))
            .andExpect(status().isOk())
            .andExpect(header().string("X-Request-Id", explicitReqId));

        // Generates Request ID if missing
        mvc.perform(get("/api/auth/me")
                .header("Authorization", bearer(admin)))
            .andExpect(status().isOk())
            .andExpect(header().exists("X-Request-Id"));

        // 2. Role Isolation
        // Driver cannot adjust invoice
        mvc.perform(post("/api/billing/invoices/9999/adjust")
                .header("Authorization", bearer(driver))
                .contentType("application/json")
                .content(body(Map.of("adjustmentType", "CREDIT_NOTE", "amount", 1000, "reason", "Hack"))))
            .andExpect(status().isForbidden());

        // Restaurant purchaser cannot adjust invoice
        mvc.perform(post("/api/billing/invoices/9999/adjust")
                .header("Authorization", bearer(restaurant))
                .contentType("application/json")
                .content(body(Map.of("adjustmentType", "CREDIT_NOTE", "amount", 1000, "reason", "Hack"))))
            .andExpect(status().isForbidden());

        // 3. KPI Receivables Actual Balance (total_amount - paid_amount)
        LocalDate from = LocalDate.now().minusDays(10);
        LocalDate to = LocalDate.now().plusDays(10);
        mvc.perform(get("/api/analytics/kpis?from=" + from + "&to=" + to)
                .header("Authorization", bearer(admin)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.receivables.actual_balance").exists())
            .andExpect(jsonPath("$.data.receivables.overdue_balance").exists())
            .andExpect(jsonPath("$.data.receivables.invoiced").exists());
    }
}
