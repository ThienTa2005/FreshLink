package vn.freshlink.ordering;

import jakarta.validation.Valid;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import vn.freshlink.common.api.ApiResponse;
import vn.freshlink.identity.Actor;

@RestController @RequestMapping("/api/orders")
public class OrderingController {
    private final OrderingService ordering;
    public OrderingController(OrderingService ordering) {this.ordering=ordering;}
    @PostMapping public ApiResponse<?> create(@AuthenticationPrincipal Actor actor,@Valid @RequestBody OrderingService.Create request,@RequestHeader("Idempotency-Key") String key) {
        return ApiResponse.success(ordering.create(actor,request,key),"Đã chốt đơn, đang chờ phân nguồn");
    }
    @GetMapping public ApiResponse<?> list(@AuthenticationPrincipal Actor actor,@RequestParam long restaurantId) {return ApiResponse.success(ordering.list(actor,restaurantId),"Danh sách đơn");}
    @GetMapping("/{id}") public ApiResponse<?> detail(@AuthenticationPrincipal Actor actor,@PathVariable long id) {return ApiResponse.success(ordering.detail(actor,id),"Chi tiết đơn");}
}
