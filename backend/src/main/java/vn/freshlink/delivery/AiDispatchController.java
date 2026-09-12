package vn.freshlink.delivery;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import vn.freshlink.common.api.ApiResponse;
import vn.freshlink.identity.Actor;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/operations/trips")
public class AiDispatchController {

    private final AiDispatchService aiDispatchService;

    public AiDispatchController(AiDispatchService aiDispatchService) {
        this.aiDispatchService = aiDispatchService;
    }

    public record SuggestRequest(
        @NotNull @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
        @NotNull Long originId,
        String strategy,
        Integer attempt
    ) {}

    @GetMapping("/candidates")
    public ApiResponse<List<AiDispatchService.CandidateOrder>> getCandidates(
        @AuthenticationPrincipal Actor actor,
        @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date
    ) {
        actor.requireRole("OPERATIONS_COORDINATOR");
        List<AiDispatchService.CandidateOrder> candidates = aiDispatchService.getCandidateOrders(date);
        return ApiResponse.success(candidates, "Danh sách đơn sẵn sàng điều phối");
    }

    @PostMapping("/ai-suggest")
    public ApiResponse<AiDispatchService.SuggestionResult> suggestTrips(
        @AuthenticationPrincipal Actor actor,
        @Valid @RequestBody SuggestRequest request
    ) {
        actor.requireRole("OPERATIONS_COORDINATOR");
        int attempt = request.attempt() != null && request.attempt() > 0 ? request.attempt() : 1;
        AiDispatchService.SuggestionResult result = aiDispatchService.suggestTrips(
            request.date(),
            request.originId(),
            request.strategy(),
            attempt
        );
        return ApiResponse.success(result, "Đề xuất ghép chuyến bằng AI thành công");
    }

    @PostMapping("/ai-apply")
    public ApiResponse<Map<String, Object>> applyPlan(
        @AuthenticationPrincipal Actor actor,
        @Valid @RequestBody AiDispatchService.ApplyPlanRequest request
    ) {
        actor.requireRole("OPERATIONS_COORDINATOR");
        List<Long> createdTripIds = aiDispatchService.applyPlan(actor, request);
        return ApiResponse.success(
            Map.of("tripIds", createdTripIds, "count", createdTripIds.size()),
            "Đã tự động tạo " + createdTripIds.size() + " chuyến giao xe lạnh thành công!"
        );
    }
}
