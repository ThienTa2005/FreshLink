package vn.freshlink.esg;

import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import vn.freshlink.common.api.ApiResponse;
import vn.freshlink.identity.Actor;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api")
public class CoopTrustController {

    private final CoopTrustScoreService trustService;

    public CoopTrustController(CoopTrustScoreService trustService) {
        this.trustService = trustService;
    }

    @GetMapping("/suppliers/trust-scores")
    public ApiResponse<List<Map<String, Object>>> getTrustScores() {
        return ApiResponse.success(trustService.getRankings(), "Bảng xếp hạng điểm tín nhiệm Hợp tác xã");
    }

    @GetMapping("/suppliers/{id}/trust-detail")
    public ApiResponse<Map<String, Object>> getTrustDetail(@PathVariable long id) {
        return ApiResponse.success(trustService.getTrustDetail(id), "Chi tiết điểm tín nhiệm 5 trụ cột HTX");
    }

    @PostMapping("/admin/suppliers/recalculate-trust")
    public ApiResponse<?> recalculateAll(@AuthenticationPrincipal Actor actor) {
        actor.requireRole("SYSTEM_ADMIN", "OPERATIONS_COORDINATOR");
        trustService.recalculateAll();
        return ApiResponse.success(null, "Đã tính toán lại toàn bộ điểm tín nhiệm và thứ hạng HTX thành công");
    }

    @PostMapping("/suppliers/{id}/recalculate-trust")
    public ApiResponse<?> recalculateOne(@AuthenticationPrincipal Actor actor, @PathVariable long id) {
        if (!actor.hasRole("SYSTEM_ADMIN") && !actor.hasRole("OPERATIONS_COORDINATOR")) {
            actor.requireOrganization(id, "SUPPLIER_MANAGER");
        }
        trustService.updateSupplierScore(id);
        return ApiResponse.success(trustService.getTrustDetail(id), "Đã cập nhật điểm tín nhiệm HTX thành công");
    }
}
