package vn.freshlink.esg;

import org.springframework.web.bind.annotation.*;
import vn.freshlink.common.api.ApiResponse;

import java.util.Map;

@RestController
@RequestMapping("/api/public")
public class PublicEsgController {

    private final EsgCertificateService esgService;

    public PublicEsgController(EsgCertificateService esgService) {
        this.esgService = esgService;
    }

    @GetMapping("/verify-cert/{code}")
    public ApiResponse<Map<String, Object>> verifyCertificate(@PathVariable String code) {
        return ApiResponse.success(esgService.getCertificateByCode(code), "Xác thực Giấy Chứng Nhận Xanh FreshLink ESG thành công");
    }
}
