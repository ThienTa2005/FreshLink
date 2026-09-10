package vn.freshlink.system;

import java.time.LocalDate;
import java.util.Map;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import vn.freshlink.identity.Actor;
import vn.freshlink.common.api.ApiResponse;

@RestController @RequestMapping("/api/operations")
public class DashboardController {
    private final JdbcTemplate jdbc;public DashboardController(JdbcTemplate jdbc) {this.jdbc=jdbc;}
    @GetMapping("/dashboard") public ApiResponse<?> dashboard(@AuthenticationPrincipal Actor a,@RequestParam LocalDate date) {
        a.requireRole("OPERATIONS_COORDINATOR");
        return ApiResponse.success(Map.of("orders",jdbc.queryForObject("SELECT COUNT(*) FROM customer_orders WHERE delivery_date=?",Integer.class,date),
            "shortages",jdbc.queryForObject("SELECT COUNT(*) FROM customer_orders o WHERE o.delivery_date=? AND o.order_status IN ('CONFIRMED','SOURCING') AND EXISTS (SELECT 1 FROM order_items i WHERE i.order_id=o.order_id AND i.confirmed_quantity>(SELECT COALESCE(SUM(x.planned_quantity),0) FROM supply_request_item_orders x JOIN supply_request_items s ON s.supply_request_item_id=x.supply_request_item_id WHERE x.order_item_id=i.order_item_id AND s.status NOT IN ('REJECTED','CANCELLED')))",Integer.class,date),
            "waitingBatches",jdbc.queryForObject("SELECT COUNT(*) FROM batches WHERE batch_status='CREATED'",Integer.class),
            "trips",jdbc.queryForObject("SELECT COUNT(*) FROM delivery_trips WHERE trip_date=? AND status NOT IN ('COMPLETED','CANCELLED')",Integer.class,date),
            "claims",jdbc.queryForObject("SELECT COUNT(*) FROM complaints WHERE status IN ('NEW','VERIFYING','WAITING_PARTNER')",Integer.class)),"Việc cần xử lý");
    }
    @GetMapping("/orders") public ApiResponse<?> orders(@AuthenticationPrincipal Actor a,@RequestParam LocalDate date) {
        a.requireRole("OPERATIONS_COORDINATOR");return ApiResponse.success(jdbc.queryForList("SELECT order_id,order_code,restaurant_id,delivery_date,order_status,total_amount FROM customer_orders WHERE delivery_date=? ORDER BY order_id",date),"Đơn theo ngày");
    }
    @GetMapping("/stops") public ApiResponse<?> stops(@AuthenticationPrincipal Actor a) {
        a.requireRole("OPERATIONS_COORDINATOR");return ApiResponse.success(jdbc.queryForList("SELECT s.trip_stop_id,CONCAT(t.trip_code,' / ',s.stop_sequence,' / ',o.order_code) AS label FROM trip_stops s JOIN delivery_trips t ON t.trip_id=s.trip_id JOIN customer_orders o ON o.order_id=s.order_id ORDER BY s.trip_stop_id DESC LIMIT 200"),"Điểm giao");
    }
}
