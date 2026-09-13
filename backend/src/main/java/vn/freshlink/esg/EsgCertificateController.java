package vn.freshlink.esg;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import vn.freshlink.common.api.ApiResponse;
import vn.freshlink.identity.Actor;

import java.util.Map;

@RestController
@RequestMapping("/api/esg")
public class EsgCertificateController {

    private final EsgCertificateService esgService;

    public EsgCertificateController(EsgCertificateService esgService) {
        this.esgService = esgService;
    }

    @GetMapping("/summary")
    public ApiResponse<EsgCertificateService.EsgImpactSummary> getSummary(
        @AuthenticationPrincipal Actor actor,
        @RequestParam long organizationId,
        @RequestParam(defaultValue = "60_DAYS") String periodType
    ) {
        if (!actor.hasRole("SYSTEM_ADMIN") && !actor.hasRole("OPERATIONS_COORDINATOR")) {
            actor.requireOrganization(organizationId, "RESTAURANT_MANAGER", "RESTAURANT_PURCHASER", "SUPPLIER_MANAGER", "SUPPLIER_STAFF");
        }
        return ApiResponse.success(esgService.calculateImpact(organizationId, periodType), "Báo cáo tác động môi trường & cắt giảm rác nhựa");
    }

    public record IssueCertRequest(@NotNull Long organizationId, String periodType) {}

    @PostMapping("/issue")
    public ApiResponse<Map<String, Object>> issueCertificate(
        @AuthenticationPrincipal Actor actor,
        @Valid @RequestBody IssueCertRequest request
    ) {
        if (!actor.hasRole("SYSTEM_ADMIN") && !actor.hasRole("OPERATIONS_COORDINATOR")) {
            actor.requireOrganization(request.organizationId(), "RESTAURANT_MANAGER", "RESTAURANT_PURCHASER", "SUPPLIER_MANAGER");
        }
        String period = request.periodType() != null && !request.periodType().isBlank() ? request.periodType() : "60_DAYS";
        return ApiResponse.success(esgService.issueCertificate(request.organizationId(), period), "Đã cấp Giấy Chứng Nhận Xanh FreshLink ESG thành công");
    }
}
