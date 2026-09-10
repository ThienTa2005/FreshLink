package vn.freshlink;

import static org.junit.jupiter.api.Assertions.*;
import java.math.BigDecimal;
import java.time.*;
import java.util.*;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import vn.freshlink.common.Sql;
import vn.freshlink.identity.*;
import vn.freshlink.ordering.*;
import vn.freshlink.sourcing.*;
import vn.freshlink.quality.*;
import vn.freshlink.delivery.*;
import vn.freshlink.traceability.*;
import vn.freshlink.assets.*;
import vn.freshlink.billing.*;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.test.web.servlet.MockMvc;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties={"spring.devtools.restart.enabled=false","app.media.directory=./target/test-uploads"})
@AutoConfigureMockMvc
@EnabledIfEnvironmentVariable(named="FRESHLINK_INTEGRATION",matches="true")
class MvpIntegrationTest {
    @Autowired MockMvc mvc;
    @Autowired com.fasterxml.jackson.databind.ObjectMapper json;
    @Autowired JdbcTemplate jdbc; @Autowired Sql sql; @Autowired PasswordEncoder passwords;
    @Autowired IdentityService identity; @Autowired PartnerService partners;
    @Autowired OrderingService ordering; @Autowired SourcingService sourcing; @Autowired QualityService quality;
    @Autowired DeliveryService delivery; @Autowired TraceController trace; @Autowired AssetController assets; @Autowired BillingController billing;
    @Autowired WeeklyPlanController weekly; @Autowired SettlementController settlements;
    BigDecimal q(String value) {return new BigDecimal(value);}
    String key() {return UUID.randomUUID().toString();}
    Actor actor(String type,String role) {
        String email=UUID.randomUUID()+"@test.invalid";
        long user=sql.insert("INSERT INTO users(email,password_hash,full_name,status) VALUES (?,?,?,'ACTIVE')",email,passwords.encode("Integration-only-123"),role);
        long org=sql.insert("INSERT INTO organizations(organization_code,organization_name,organization_type,status) VALUES (?,?,?,'ACTIVE')",key().substring(0,24),type,type);
        long member=sql.insert("INSERT INTO organization_members(user_id,organization_id,status) VALUES (?,?,'ACTIVE')",user,org);
        jdbc.update("INSERT INTO member_roles(member_id,role_id) SELECT ?,role_id FROM roles WHERE role_code=?",member,role);
        if(type.equals("RESTAURANT")) jdbc.update("INSERT INTO restaurant_profiles(restaurant_id,restaurant_type) VALUES (?,'OTHER')",org);
        if(type.equals("SUPPLIER")) jdbc.update("INSERT INTO supplier_profiles(supplier_id,supplier_type) VALUES (?,'FARM')",org);
        return identity.login(email,"Integration-only-123").user();
    }
    long org(Actor a) {return a.memberships().get(0).organizationId();}
    long address(Actor a,String type) {return sql.insert("INSERT INTO addresses(organization_id,address_name,address_line,district,address_type) VALUES (?,'Test','Test street','Test district',?)",org(a),type);}
    @Test void httpAuthenticationAndRegistration() throws Exception {
        mvc.perform(get("/api/auth/me")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/public/catalog").param("date",LocalDate.now().plusDays(3).toString())).andExpect(status().isOk()).andExpect(jsonPath("$.data[0].sku_id").exists());
        mvc.perform(post("/api/public/partners").contentType("application/json").content("{\"email\":\"admin@test.invalid\",\"password\":\"LongPassword123\",\"fullName\":\"Test\",\"organizationName\":\"Test\",\"type\":\"FRESHLINK\"}")).andExpect(status().isBadRequest());
        Actor admin=actor("FRESHLINK","SYSTEM_ADMIN");String email=key()+"@test.invalid";
        long org=partners.register(email,"LongPassword123","Test","Pending","RESTAURANT");
        assertThrows(org.springframework.security.authentication.BadCredentialsException.class,()->identity.login(email,"LongPassword123"));
        partners.approve(admin,org);
        var result=identity.login(email,"LongPassword123");
        assertFalse(result.user().hasRole("SYSTEM_ADMIN"));
        mvc.perform(get("/api/auth/me").header("Authorization","Bearer "+result.token())).andExpect(status().isOk()).andExpect(jsonPath("$.data.email").value(email));
        mvc.perform(get("/api/admin/partners/pending").header("Authorization","Bearer "+result.token())).andExpect(status().isForbidden());
        mvc.perform(post("/api/auth/logout").header("Authorization","Bearer "+result.token())).andExpect(status().isOk());
        mvc.perform(get("/api/auth/me").header("Authorization","Bearer "+result.token())).andExpect(status().isUnauthorized());
    }
    @Test void simultaneousAllocationsCannotOversell() throws Exception {
        Actor admin=actor("FRESHLINK","SYSTEM_ADMIN"),restaurant=actor("RESTAURANT","RESTAURANT_MANAGER"),supplier=actor("SUPPLIER","SUPPLIER_MANAGER");
        LocalDate date=LocalDate.now(ZoneId.of("Asia/Ho_Chi_Minh")).plusDays(4);long addr=address(restaurant,"DELIVERY"),dock=address(admin,"CROSS_DOCK");
        jdbc.update("INSERT INTO sku_prices(sku_id,selling_unit_price,valid_from) VALUES (1,20000,?)",java.sql.Timestamp.from(date.atStartOfDay(ZoneId.of("Asia/Ho_Chi_Minh")).toInstant()));
        var request=new OrderingService.Create(org(restaurant),addr,date,LocalTime.of(7,0),LocalTime.of(9,0),"Race",List.of(new OrderingService.Line(1L,q("1"))));
        long first=ordering.create(restaurant,request,key()),second=ordering.create(restaurant,request,key());
        long firstItem=jdbc.queryForObject("SELECT order_item_id FROM order_items WHERE order_id=?",Long.class,first),secondItem=jdbc.queryForObject("SELECT order_item_id FROM order_items WHERE order_id=?",Long.class,second);
        long offer=sourcing.offer(supplier,new SourcingService.Offer(org(supplier),1L,date,q("1"),q("10000")));
        long supply=sourcing.request(admin,new SourcingService.Request(offer,firstItem,dock,LocalTime.of(5,0),q("1"),q("0")),key());
        long supplyItem=jdbc.queryForObject("SELECT supply_request_item_id FROM supply_request_items WHERE supply_request_id=?",Long.class,supply);
        sourcing.respond(supplier,supplyItem,q("1"));long batch=quality.create(supplier,new QualityService.Batch(supplyItem,q("1"),"Race"),key());
        quality.inspect(admin,batch,new QualityService.Inspection(q("1"),q("0"),q("0"),"Pass"),key());
        var executor=java.util.concurrent.Executors.newFixedThreadPool(2);var ready=new java.util.concurrent.CountDownLatch(2);var go=new java.util.concurrent.CountDownLatch(1);
        try {
            var futures=new ArrayList<java.util.concurrent.Future<Boolean>>();
            for(long item:List.of(firstItem,secondItem)) futures.add(executor.submit(()->{ready.countDown();go.await();try {quality.allocate(admin,new QualityService.Allocation(batch,item,q("1")),key());return true;}catch(IllegalArgumentException e){return false;}}));
            assertTrue(ready.await(5,java.util.concurrent.TimeUnit.SECONDS));go.countDown();
            int successes=0;for(var f:futures) if(f.get(15,java.util.concurrent.TimeUnit.SECONDS)) successes++;
            assertEquals(1,successes);assertEquals(0,q("1").compareTo(jdbc.queryForObject("SELECT allocated_quantity FROM batches WHERE batch_id=?",BigDecimal.class,batch)));
        } finally {executor.shutdownNow();}
    }
    @Test void weeklyPlansRequireExplicitConfirmationAndPricesAreSnapshots() {
        Actor restaurant=actor("RESTAURANT","RESTAURANT_MANAGER");long addr=address(restaurant,"DELIVERY");
        LocalDate date=LocalDate.now(ZoneId.of("Asia/Ho_Chi_Minh")).plusDays(10),monday=date.with(java.time.temporal.TemporalAdjusters.previousOrSame(java.time.DayOfWeek.MONDAY));
        long plan=((Number)weekly.save(restaurant,new WeeklyPlanController.Plan(org(restaurant),monday,List.of(new WeeklyPlanController.Item(1L,date,q("2"))))).data()).longValue();
        assertEquals(0,jdbc.queryForObject("SELECT COUNT(*) FROM customer_orders WHERE restaurant_id=?",Integer.class,org(restaurant)));
        jdbc.update("INSERT INTO sku_prices(sku_id,selling_unit_price,valid_from) VALUES (1,20000,?)",java.sql.Timestamp.from(date.atStartOfDay(ZoneId.of("Asia/Ho_Chi_Minh")).toInstant()));
        var create=new OrderingService.Create(org(restaurant),addr,date,LocalTime.of(7,0),LocalTime.of(9,0),"Plan",List.of(new OrderingService.Line(1L,q("2"))),plan);
        long order=ordering.create(restaurant,create,key());
        assertThrows(IllegalArgumentException.class,()->ordering.create(restaurant,create,key()));
        jdbc.update("INSERT INTO sku_prices(sku_id,selling_unit_price,valid_from) VALUES (1,30000,?)",java.sql.Timestamp.from(date.atStartOfDay(ZoneId.of("Asia/Ho_Chi_Minh")).toInstant()));
        long reorder=ordering.create(restaurant,new OrderingService.Create(org(restaurant),addr,date,LocalTime.of(7,0),LocalTime.of(9,0),"New price",List.of(new OrderingService.Line(1L,q("2")))),key());
        assertEquals(0,q("40000").compareTo(jdbc.queryForObject("SELECT total_amount FROM customer_orders WHERE order_id=?",BigDecimal.class,order)));
        assertEquals(0,q("60000").compareTo(jdbc.queryForObject("SELECT total_amount FROM customer_orders WHERE order_id=?",BigDecimal.class,reorder)));
        assertEquals(1,jdbc.queryForObject("SELECT COUNT(*) FROM weekly_plan_items WHERE weekly_plan_id=? AND converted_order_item_id IS NOT NULL",Integer.class,plan));
    }
    @Test void fullWorkflowAndSecurityInvariants() throws Exception {
        Actor admin=actor("FRESHLINK","SYSTEM_ADMIN"), restaurant=actor("RESTAURANT","RESTAURANT_MANAGER"), other=actor("RESTAURANT","RESTAURANT_MANAGER"), supplier=actor("SUPPLIER","SUPPLIER_MANAGER"), supplier2=actor("SUPPLIER","SUPPLIER_MANAGER"), driver=actor("LOGISTICS","DRIVER"), otherDriver=actor("LOGISTICS","DRIVER");
        long dock=address(admin,"CROSS_DOCK"),addr=address(restaurant,"DELIVERY");
        LocalDate date=LocalDate.now(ZoneId.of("Asia/Ho_Chi_Minh")).plusDays(3);
        jdbc.update("INSERT INTO sku_prices(sku_id,selling_unit_price,valid_from) VALUES (1,20000,?)",java.sql.Timestamp.from(date.atStartOfDay(ZoneId.of("Asia/Ho_Chi_Minh")).toInstant()));
        var create=new OrderingService.Create(org(restaurant),addr,date,LocalTime.of(7,0),LocalTime.of(9,0),"Test",List.of(new OrderingService.Line(1L,q("10"))));
        String orderKey=key();long order=ordering.create(restaurant,create,orderKey);
        assertEquals(order,ordering.create(restaurant,create,orderKey));
        assertThrows(org.springframework.security.access.AccessDeniedException.class,()->ordering.detail(other,order));
        long item=jdbc.queryForObject("SELECT order_item_id FROM order_items WHERE order_id=?",Long.class,order);
        long offer=sourcing.offer(supplier,new SourcingService.Offer(org(supplier),1L,date,q("7"),q("10000")));
        long offer2=sourcing.offer(supplier2,new SourcingService.Offer(org(supplier2),1L,date,q("4"),q("12000")));
        long request=sourcing.request(admin,new SourcingService.Request(offer,item,dock,LocalTime.of(5,0),q("7"),q("5")),key());
        long request2=sourcing.request(admin,new SourcingService.Request(offer2,item,dock,LocalTime.of(5,0),q("3"),q("5")),key());
        long requestItem=jdbc.queryForObject("SELECT supply_request_item_id FROM supply_request_items WHERE supply_request_id=?",Long.class,request);
        long requestItem2=jdbc.queryForObject("SELECT supply_request_item_id FROM supply_request_items WHERE supply_request_id=?",Long.class,request2);
        assertThrows(org.springframework.security.access.AccessDeniedException.class,()->sourcing.respond(supplier2,requestItem,q("7")));
        sourcing.respond(supplier,requestItem,q("7"));sourcing.respond(supplier2,requestItem2,q("3"));
        long batch=quality.create(supplier,new QualityService.Batch(requestItem,q("7"),"Farm 1"),key());
        long batch2=quality.create(supplier2,new QualityService.Batch(requestItem2,q("3"),"Farm 2"),key());
        quality.inspect(admin,batch,new QualityService.Inspection(q("6"),q("0"),q("1"),"One damaged"),key());
        quality.inspect(admin,batch2,new QualityService.Inspection(q("3"),q("0"),q("0"),"Pass"),key());
        assertThrows(IllegalArgumentException.class,()->quality.allocate(admin,new QualityService.Allocation(batch,item,q("7")),key()));
        long replacement=sourcing.request(admin,new SourcingService.Request(offer2,item,dock,LocalTime.of(5,0),q("1"),q("5")),key());
        long replacementItem=jdbc.queryForObject("SELECT supply_request_item_id FROM supply_request_items WHERE supply_request_id=?",Long.class,replacement);
        sourcing.respond(supplier2,replacementItem,q("1"));
        long batch3=quality.create(supplier2,new QualityService.Batch(replacementItem,q("1"),"Replacement"),key());
        quality.inspect(admin,batch3,new QualityService.Inspection(q("1"),q("0"),q("0"),"Pass"),key());
        quality.allocate(admin,new QualityService.Allocation(batch,item,q("6")),key());
        quality.allocate(admin,new QualityService.Allocation(batch2,item,q("3")),key());
        quality.allocate(admin,new QualityService.Allocation(batch3,item,q("1")),key());
        long trip=delivery.create(admin,new DeliveryService.Trip(date,dock,driver.userId(),List.of(order)),key());
        assertThrows(org.springframework.security.access.AccessDeniedException.class,()->delivery.trip(otherDriver,trip));
        delivery.start(driver,trip);
        long stop=jdbc.queryForObject("SELECT trip_stop_id FROM trip_stops WHERE trip_id=?",Long.class,trip);
        var quantities=jdbc.query("SELECT delivery_item_id,loaded_quantity FROM delivery_items WHERE trip_stop_id=?",(rs,n)->new DeliveryService.Quantity(rs.getLong(1),rs.getBigDecimal(2)),stop);
        String proofKey=key();var proof=new DeliveryService.Proof("Receiver","All delivered",quantities);
        long event=delivery.confirm(driver,stop,proof,proofKey,false);
        assertEquals(event,delivery.confirm(driver,stop,proof,proofKey,false));
        assertNull(jdbc.queryForObject("SELECT restaurant_confirmed_at FROM trip_stops WHERE trip_stop_id=?",java.sql.Timestamp.class,stop));
        delivery.confirm(restaurant,stop,proof,key(),true);
        assertEquals(2,jdbc.queryForObject("SELECT COUNT(*) FROM delivery_events WHERE trip_stop_id=?",Integer.class,stop));
        var label=(Map<?,?>)trace.label(supplier,"BATCH",batch).data();
        assertEquals(label.get("code"),((Map<?,?>)trace.label(supplier,"BATCH",batch).data()).get("code"));
        String publicData=trace.trace(label.get("code").toString()).data().toString();
        assertFalse(publicData.contains("restaurant_id"));assertFalse(publicData.contains("unit_price"));
        long asset=((Number)assets.create(admin,new AssetController.Create("CR-"+key())).data()).longValue();
        assets.move(admin,asset,new AssetController.Move("ISSUE",stop,"Issued"));
        assets.move(driver,asset,new AssetController.Move("DELIVER",stop,"Good"));
        assets.move(driver,asset,new AssetController.Move("COLLECT",stop,"Good"));
        assertThrows(IllegalArgumentException.class,()->assets.move(admin,asset,new AssetController.Move("ISSUE",stop,"Dirty")));
        assets.move(admin,asset,new AssetController.Move("CLEAN",null,"Cleaned and checked"));
        String payKey=key();var payment=new BillingController.Payment(order,q("200000"),"CASH","TEST");
        assertEquals(billing.pay(admin,payment,payKey).data(),billing.pay(admin,payment,payKey).data());
        assertEquals("PAID",jdbc.queryForObject("SELECT payment_status FROM customer_orders WHERE order_id=?",String.class,order));
        jdbc.update("UPDATE supplier_sku_offers SET supplier_unit_price=99999 WHERE supplier_offer_id=?",offer);
        long settlement=((Number)settlements.create(admin,new SettlementController.Settlement(batch,q("0"),"Agreed"),key()).data()).longValue();
        assertEquals(0,q("57000").compareTo(jdbc.queryForObject("SELECT payable_amount FROM supplier_settlements WHERE settlement_id=?",BigDecimal.class,settlement)));
        String settlementKey=key();var payout=new SettlementController.Pay("TEST-PAYOUT");
        assertEquals(settlements.pay(admin,settlement,payout,settlementKey).data(),settlements.pay(admin,settlement,payout,settlementKey).data());
        assertThrows(org.springframework.dao.DataIntegrityViolationException.class,()->settlements.create(admin,new SettlementController.Settlement(batch,q("0"),"Duplicate"),key()));
        String supplierToken="Bearer "+identity.login(supplier.email(),"Integration-only-123").token();
        String otherSupplierToken="Bearer "+identity.login(supplier2.email(),"Integration-only-123").token();
        String adminToken="Bearer "+identity.login(admin.email(),"Integration-only-123").token();
        String restaurantToken="Bearer "+identity.login(restaurant.email(),"Integration-only-123").token();
        String otherToken="Bearer "+identity.login(other.email(),"Integration-only-123").token();
        mvc.perform(get("/api/batches/"+batch).header("Authorization",supplierToken)).andExpect(status().isOk())
            .andExpect(jsonPath("$.data.inspections[0].final_result").value("PARTIAL_PASS"))
            .andExpect(jsonPath("$.data.allocations").doesNotExist());
        mvc.perform(get("/api/batches/"+batch).header("Authorization",otherSupplierToken)).andExpect(status().isForbidden());
        mvc.perform(get("/api/batches/"+batch).header("Authorization",adminToken)).andExpect(status().isOk())
            .andExpect(jsonPath("$.data.allocations[0].order_id").value(order));
        mvc.perform(get("/api/supplier/requests/"+request).header("Authorization",supplierToken)).andExpect(status().isOk())
            .andExpect(jsonPath("$.data.delivery_address.address_id").value(dock));
        mvc.perform(get("/api/supplier/requests/"+request).header("Authorization",otherSupplierToken)).andExpect(status().isForbidden());
        mvc.perform(get("/api/assets/"+asset+"/history").header("Authorization",adminToken)).andExpect(status().isOk())
            .andExpect(jsonPath("$.data.length()").value(4));
        var claimResult=mvc.perform(post("/api/claims").header("Authorization",restaurantToken).header("Idempotency-Key",key())
            .contentType("application/json").content(json.writeValueAsString(Map.of("orderItemId",item,"batchId",batch,"quantity",1,"description","Test claim"))))
            .andExpect(status().isOk()).andReturn();
        long claim=json.readTree(claimResult.getResponse().getContentAsString()).get("data").asLong();
        mvc.perform(get("/api/claims/"+claim).header("Authorization",otherToken)).andExpect(status().isForbidden());
        var detail=mvc.perform(get("/api/claims/"+claim).header("Authorization",restaurantToken)).andExpect(status().isOk()).andReturn();
        long claimItem=json.readTree(detail.getResponse().getContentAsString()).at("/data/items/0/complaint_item_id").asLong();
        var upload=mvc.perform(multipart("/api/media").file(new org.springframework.mock.web.MockMultipartFile("file","proof.pdf","application/pdf","%PDF-test-evidence".getBytes(java.nio.charset.StandardCharsets.UTF_8)))
            .header("Authorization",restaurantToken)).andExpect(status().isOk()).andReturn();
        long file=json.readTree(upload.getResponse().getContentAsString()).at("/data/id").asLong();
        String evidence=json.writeValueAsString(Map.of("itemId",claimItem,"evidenceId",file));
        mvc.perform(put("/api/claims/"+claim+"/evidence").header("Authorization",otherToken).contentType("application/json").content(evidence)).andExpect(status().isForbidden());
        mvc.perform(put("/api/claims/"+claim+"/evidence").header("Authorization",restaurantToken).contentType("application/json").content(evidence)).andExpect(status().isOk());
        mvc.perform(post("/api/claims/"+claim+"/resolve").header("Authorization",adminToken).contentType("application/json").content("{\"resolution\":\"Reviewed\"}")).andExpect(status().isOk());
        mvc.perform(put("/api/claims/"+claim+"/evidence").header("Authorization",restaurantToken).contentType("application/json").content(evidence)).andExpect(status().isConflict());
    }
}
