package vn.freshlink.delivery;

import jakarta.validation.Valid;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import vn.freshlink.identity.Actor;
import vn.freshlink.common.api.ApiResponse;

@RestController @RequestMapping("/api")
public class DeliveryController {
    private final DeliveryService service; private final JdbcTemplate jdbc;
    public DeliveryController(DeliveryService service,JdbcTemplate jdbc) {this.service=service;this.jdbc=jdbc;}
    @PostMapping("/trips") public ApiResponse<?> create(@AuthenticationPrincipal Actor a,@Valid @RequestBody DeliveryService.Trip r,@RequestHeader("Idempotency-Key") String key) {return ApiResponse.success(service.create(a,r,key),"Đã xếp chuyến");}
    @GetMapping("/trips") public ApiResponse<?> list(@AuthenticationPrincipal Actor a) {
        a.requireRole("DRIVER","OPERATIONS_COORDINATOR");
        return ApiResponse.success(a.hasRole("SYSTEM_ADMIN")||a.hasRole("OPERATIONS_COORDINATOR")?jdbc.queryForList("SELECT * FROM delivery_trips ORDER BY trip_date DESC LIMIT 200"):jdbc.queryForList("SELECT * FROM delivery_trips WHERE driver_user_id=? ORDER BY trip_date DESC LIMIT 200",a.userId()),"Chuyến giao");
    }
    @GetMapping("/trips/{id}") public ApiResponse<?> trip(@AuthenticationPrincipal Actor a,@PathVariable long id) {return ApiResponse.success(service.trip(a,id),"Chi tiết chuyến");}
    @PostMapping("/trips/{id}/start") public ApiResponse<?> start(@AuthenticationPrincipal Actor a,@PathVariable long id) {service.start(a,id);return ApiResponse.success(null,"Đã nhận hàng và bắt đầu chuyến");}
    @PostMapping("/stops/{id}/deliver") public ApiResponse<?> deliver(@AuthenticationPrincipal Actor a,@PathVariable long id,@Valid @RequestBody DeliveryService.Proof r,@RequestHeader("Idempotency-Key") String key) {return ApiResponse.success(service.confirm(a,id,r,key,false),"Đã ghi nhận kết quả giao");}
    @PostMapping("/stops/{id}/receive") public ApiResponse<?> receive(@AuthenticationPrincipal Actor a,@PathVariable long id,@Valid @RequestBody DeliveryService.Proof r,@RequestHeader("Idempotency-Key") String key) {return ApiResponse.success(service.confirm(a,id,r,key,true),"Đã xác nhận nhận hàng");}
}
