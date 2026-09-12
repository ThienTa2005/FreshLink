package vn.freshlink.identity;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
import vn.freshlink.common.api.ApiResponse;

@RestController
@RequestMapping("/api/addresses")
public class AddressManagementController {
    private final JdbcTemplate jdbc;
    public AddressManagementController(JdbcTemplate jdbc) { this.jdbc=jdbc; }
    public record Update(@NotBlank @Size(max=100) String name, @NotBlank @Size(max=300) String address,
                         @NotBlank @Size(max=100) String district, @NotBlank @Size(max=100) String city,
                         @NotBlank @Size(max=150) String contactName, @NotBlank @Size(max=20) String phone,
                         @Size(max=100) String ward, java.math.BigDecimal latitude, java.math.BigDecimal longitude) {
        public Update(String name, String address, String district, String city, String contactName, String phone) {
            this(name, address, district, city, contactName, phone, null, null, null);
        }
    }
    private void authorize(Actor actor, long id) {
        long organization=jdbc.queryForObject("SELECT organization_id FROM addresses WHERE address_id=? FOR UPDATE",Long.class,id);
        actor.requireOrganization(organization,"RESTAURANT_MANAGER","SUPPLIER_MANAGER","OPERATIONS_COORDINATOR");
    }
    @PutMapping("/{id}") @Transactional
    public ApiResponse<?> update(@AuthenticationPrincipal Actor actor, @PathVariable long id, @Valid @RequestBody Update r) {
        authorize(actor,id);
        // Addresses referenced by operational records are historical facts; create a new address instead.
        int used=jdbc.queryForObject("""
            SELECT (SELECT COUNT(*) FROM customer_orders WHERE delivery_address_id=?)
                 + (SELECT COUNT(*) FROM supply_requests WHERE delivery_to_address_id=?)
                 + (SELECT COUNT(*) FROM batches WHERE origin_address_id=?)
                 + (SELECT COUNT(*) FROM delivery_trips WHERE origin_address_id=?)
                 + (SELECT COUNT(*) FROM trip_stops WHERE delivery_address_id=?)
                 + (SELECT COUNT(*) FROM returnable_assets WHERE current_address_id=?)
                 + (SELECT COUNT(*) FROM asset_movements WHERE from_address_id=? OR to_address_id=?)
            """,Integer.class,id,id,id,id,id,id,id,id);
        if(used>0) throw new ResponseStatusException(HttpStatus.CONFLICT,"Địa chỉ đã được sử dụng. Hãy tạo địa chỉ mới để giữ nguyên lịch sử");
        double[] coords = vn.freshlink.delivery.GeoUtils.resolveCoordinates(r.latitude(), r.longitude(), r.ward(), r.district(), r.city(), (int)(id % 100));
        jdbc.update("UPDATE addresses SET address_name=?,address_line=?,ward=?,district=?,city=?,contact_name=?,contact_phone=?,latitude=?,longitude=? WHERE address_id=?",
            r.name(),r.address(),r.ward(),r.district(),r.city(),r.contactName(),r.phone(),coords[0],coords[1],id);
        return ApiResponse.success(null,"Đã cập nhật địa chỉ");
    }
    @DeleteMapping("/{id}") @Transactional
    public ApiResponse<?> archive(@AuthenticationPrincipal Actor actor,@PathVariable long id) {
        authorize(actor,id);
        jdbc.update("UPDATE addresses SET active=FALSE,is_default=FALSE WHERE address_id=?",id);
        return ApiResponse.success(null,"Đã ngừng sử dụng địa chỉ; đơn cũ giữ nguyên địa chỉ");
    }
}
