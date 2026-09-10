package vn.freshlink.claims;

import java.math.BigDecimal;
import java.util.*;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import vn.freshlink.identity.Actor;
import vn.freshlink.common.*;
import vn.freshlink.common.api.ApiResponse;

@RestController @RequestMapping("/api/claims")
public class ClaimController {
    private final JdbcTemplate jdbc;private final Sql sql;private final Idempotency dedup;
    public ClaimController(JdbcTemplate jdbc,Sql sql,Idempotency dedup) {this.jdbc=jdbc;this.sql=sql;this.dedup=dedup;}
    public record Claim(@NotNull Long orderItemId,@NotNull Long batchId,@NotNull @DecimalMin("0.001") @Digits(integer=9,fraction=3) BigDecimal quantity,@NotBlank @Size(max=2000) String description) {}
    @PostMapping @Transactional public ApiResponse<?> create(@AuthenticationPrincipal Actor a,@Valid @RequestBody Claim r,@RequestHeader("Idempotency-Key") String key) {
        long id=dedup.execute(a.userId(),key,"CLAIM",r.toString(),()->{
            var row=jdbc.queryForMap("SELECT i.order_id,o.restaurant_id,ba.allocated_quantity FROM order_items i JOIN customer_orders o ON o.order_id=i.order_id JOIN batch_allocations ba ON ba.order_item_id=i.order_item_id WHERE i.order_item_id=? AND ba.batch_id=?",r.orderItemId(),r.batchId());
            a.requireOrganization(((Number)row.get("restaurant_id")).longValue(),"RESTAURANT_MANAGER","RESTAURANT_RECEIVER");
            if(r.quantity().compareTo((BigDecimal)row.get("allocated_quantity"))>0) throw new IllegalArgumentException("Lượng khiếu nại vượt lượng từ lô đã cấp");
            long claim=sql.insert("INSERT INTO complaints(complaint_code,order_id,restaurant_id,complaint_type,description,requested_resolution,submitted_by) VALUES (?,?,?,'QUALITY',?,'OTHER',?)","CL-"+UUID.randomUUID().toString().substring(0,24),row.get("order_id"),row.get("restaurant_id"),r.description(),a.userId());
            jdbc.update("INSERT INTO complaint_items(complaint_id,order_item_id,batch_id,affected_quantity) VALUES (?,?,?,?)",claim,r.orderItemId(),r.batchId(),r.quantity());return claim;
        });return ApiResponse.success(id,"Đã gửi khiếu nại");
    }
    @GetMapping public ApiResponse<?> list(@AuthenticationPrincipal Actor a,@RequestParam(required=false) Long restaurantId) {
        if(restaurantId!=null) {a.requireOrganization(restaurantId,"RESTAURANT_MANAGER","RESTAURANT_RECEIVER");return ApiResponse.success(jdbc.queryForList("SELECT * FROM complaints WHERE restaurant_id=? ORDER BY complaint_id DESC LIMIT 200",restaurantId),"Khiếu nại");}
        a.requireRole("CUSTOMER_SUPPORT");return ApiResponse.success(jdbc.queryForList("SELECT * FROM complaints ORDER BY complaint_id DESC LIMIT 200"),"Khiếu nại");
    }
    public record Resolution(@NotBlank @Size(max=1000) String resolution) {}
    @PostMapping("/{id}/resolve") @Transactional public ApiResponse<?> resolve(@AuthenticationPrincipal Actor a,@PathVariable long id,@Valid @RequestBody Resolution r) {
        a.requireRole("CUSTOMER_SUPPORT");
        if(jdbc.update("UPDATE complaints SET status='RESOLVED',final_resolution=?,assigned_to=?,resolved_at=UTC_TIMESTAMP(3) WHERE complaint_id=? AND status IN ('NEW','VERIFYING','WAITING_PARTNER')",r.resolution(),a.userId(),id)!=1) throw new IllegalArgumentException("Khiếu nại không ở trạng thái xử lý");
        jdbc.update("INSERT INTO audit_logs(actor_user_id,action_code,entity_type,entity_id,new_data) VALUES (?,'RESOLVE_CLAIM','COMPLAINT',?,JSON_OBJECT('resolution',?))",a.userId(),id,r.resolution());
        return ApiResponse.success(null,"Đã lưu phương án xử lý");
    }
}
