package vn.freshlink.system;

import java.time.*;
import java.util.*;
import org.springframework.boot.*;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.annotation.Order;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import vn.freshlink.identity.*;
import vn.freshlink.common.Sql;

@Component @Order(10)
@ConditionalOnProperty(name="app.demo.enabled",havingValue="true")
public class DemoData implements ApplicationRunner {
    private final JdbcTemplate jdbc;private final Sql sql;private final PartnerService partners;private final IdentityService identity;private final AccountRepository accounts;private final StaffController staff;
    @Value("${app.demo.password}") private String password;
    public DemoData(JdbcTemplate jdbc,Sql sql,PartnerService partners,IdentityService identity,AccountRepository accounts,StaffController staff) {this.jdbc=jdbc;this.sql=sql;this.partners=partners;this.identity=identity;this.accounts=accounts;this.staff=staff;}
    @Override @Transactional public void run(ApplicationArguments args) {
        if(password.length()<12) throw new IllegalArgumentException("DEMO_PASSWORD requires at least 12 characters");
        var admins=jdbc.queryForList("SELECT m.user_id FROM organization_members m JOIN member_roles mr ON mr.member_id=m.member_id JOIN roles r ON r.role_id=mr.role_id WHERE r.role_code='SYSTEM_ADMIN' ORDER BY m.user_id LIMIT 1",Long.class);
        if(admins.isEmpty()) throw new IllegalStateException("Bootstrap an administrator before enabling demo data");
        Actor admin=identity.actor(accounts.findById(admins.get(0)).orElseThrow());
        if(jdbc.queryForObject("SELECT COUNT(*) FROM users WHERE email='restaurant@demo.freshlink'",Integer.class)>0) return;
        long restaurant=partners.register("restaurant@demo.freshlink",password,"Nhà hàng demo","Nhà hàng minh họa","RESTAURANT");partners.approve(admin,restaurant);
        long supplier=partners.register("supplier1@demo.freshlink",password,"Nguồn 1 demo","Trang trại minh họa 1","SUPPLIER");partners.approve(admin,supplier);
        long supplier2=partners.register("supplier2@demo.freshlink",password,"Nguồn 2 demo","Trang trại minh họa 2","SUPPLIER");partners.approve(admin,supplier2);
        staff.create(admin,new StaffController.Staff("driver@demo.freshlink",password,"Tài xế demo",List.of("DRIVER")));
        staff.create(admin,new StaffController.Staff("operations@demo.freshlink",password,"Vận hành demo",List.of("OPERATIONS_COORDINATOR","QUALITY_INSPECTOR","ACCOUNTANT","CUSTOMER_SUPPORT")));
        long freshlink=admin.memberships().get(0).organizationId();
        for(long organization:List.of(restaurant,freshlink)) sql.insert("INSERT INTO addresses(organization_id,address_name,address_line,district,city,contact_name,contact_phone,address_type) VALUES (?,?,?,?,?,?,?,?)",organization,organization==restaurant?"Nhà hàng demo":"Điểm tập kết demo","Địa chỉ minh họa — thay trước khi vận hành","Quận minh họa","Hà Nội","Người nhận demo","0000000000",organization==restaurant?"DELIVERY":"CROSS_DOCK");
        LocalDate today=LocalDate.now(ZoneId.of("Asia/Ho_Chi_Minh"));
        for(long sku:jdbc.queryForList("SELECT sku_id FROM product_skus WHERE active=TRUE",Long.class)) {
            jdbc.update("INSERT INTO sku_prices(sku_id,selling_unit_price,valid_from,created_by) VALUES (?,20000,?,?)",sku,java.sql.Timestamp.from(today.atStartOfDay(ZoneId.of("Asia/Ho_Chi_Minh")).toInstant()),admin.userId());
            for(long source:List.of(supplier,supplier2)) for(int offset=1;offset<=14;offset++) jdbc.update("INSERT INTO supplier_sku_offers(supplier_id,sku_id,available_date,available_quantity,supplier_unit_price,status) VALUES (?,?,?,100,12000,'AVAILABLE')",source,sku,today.plusDays(offset));
        }
    }
}
