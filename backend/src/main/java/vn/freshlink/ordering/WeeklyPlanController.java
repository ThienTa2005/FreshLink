package vn.freshlink.ordering;

import java.time.LocalDate;
import java.math.BigDecimal;
import java.util.*;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import vn.freshlink.identity.Actor;
import vn.freshlink.common.Sql;
import vn.freshlink.common.api.ApiResponse;

@RestController @RequestMapping("/api/weekly-plans")
public class WeeklyPlanController {
    private final JdbcTemplate jdbc;private final Sql sql;
    public WeeklyPlanController(JdbcTemplate jdbc,Sql sql) {this.jdbc=jdbc;this.sql=sql;}
    public record Item(@NotNull Long skuId,@NotNull LocalDate date,@NotNull @DecimalMin("0.001") @Digits(integer=9,fraction=3) BigDecimal quantity) {}
    public record Plan(@NotNull Long restaurantId,@NotNull LocalDate weekStart,@NotEmpty @Size(max=700) List<@NotNull @Valid Item> items) {}
    @PostMapping @Transactional public ApiResponse<?> save(@AuthenticationPrincipal Actor a,@Valid @RequestBody Plan r) {
        a.requireOrganization(r.restaurantId(),"RESTAURANT_MANAGER","RESTAURANT_PURCHASER");
        if(r.weekStart().getDayOfWeek()!=java.time.DayOfWeek.MONDAY) throw new IllegalArgumentException("Tuần bắt đầu vào thứ Hai");
        for(Item i:r.items()) if(i.date().isBefore(r.weekStart()) || i.date().isAfter(r.weekStart().plusDays(6))) throw new IllegalArgumentException("Ngày nhu cầu nằm ngoài tuần");
        jdbc.update("INSERT INTO weekly_demand_plans(restaurant_id,week_start_date,created_by) VALUES (?,?,?) ON DUPLICATE KEY UPDATE weekly_plan_id=weekly_plan_id",r.restaurantId(),r.weekStart(),a.userId());
        var plan=jdbc.queryForMap("SELECT weekly_plan_id,status FROM weekly_demand_plans WHERE restaurant_id=? AND week_start_date=? FOR UPDATE",r.restaurantId(),r.weekStart());
        if(!plan.get("status").equals("DRAFT")) throw new IllegalArgumentException("Kế hoạch không còn ở trạng thái nháp");
        long id=((Number)plan.get("weekly_plan_id")).longValue();
        for(Item i:r.items()) {
            if(jdbc.queryForObject("SELECT COUNT(*) FROM weekly_plan_items WHERE weekly_plan_id=? AND demand_date=? AND converted_order_item_id IS NOT NULL",Integer.class,id,i.date())>0) throw new IllegalArgumentException("Ngày này đã chốt đơn, không sửa nhu cầu cũ");
            jdbc.update("INSERT INTO weekly_plan_items(weekly_plan_id,sku_id,demand_date,planned_quantity) VALUES (?,?,?,?) ON DUPLICATE KEY UPDATE planned_quantity=VALUES(planned_quantity)",id,i.skuId(),i.date(),i.quantity());
        }
        return ApiResponse.success(id,"Đã lưu nhu cầu dự kiến; cần xác nhận đơn ngày riêng");
    }
    @GetMapping public ApiResponse<?> list(@AuthenticationPrincipal Actor a,@RequestParam long restaurantId) {
        a.requireOrganization(restaurantId,"RESTAURANT_MANAGER","RESTAURANT_PURCHASER");
        return ApiResponse.success(jdbc.queryForList("SELECT p.week_start_date,IF(i.converted_order_item_id IS NULL,'Dự kiến','Đã chốt') AS status,i.*,s.sku_name FROM weekly_demand_plans p JOIN weekly_plan_items i ON i.weekly_plan_id=p.weekly_plan_id JOIN product_skus s ON s.sku_id=i.sku_id WHERE p.restaurant_id=? ORDER BY i.demand_date DESC LIMIT 700",restaurantId),"Nhu cầu dự kiến, không phải đơn đã chốt");
    }
}
