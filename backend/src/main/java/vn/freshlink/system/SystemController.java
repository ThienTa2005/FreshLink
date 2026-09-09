package vn.freshlink.system;

import java.util.Map;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import vn.freshlink.common.api.ApiResponse;

@RestController
@RequestMapping("/api/public")
public class SystemController {
    private final String applicationName;

    public SystemController(@Value("${spring.application.name}") String applicationName) {
        this.applicationName = applicationName;
    }

    @GetMapping("/health")
    public ApiResponse<Map<String, String>> health() {
        return ApiResponse.success(
            Map.of("service", applicationName, "status", "UP"),
            "FreshLink API đang hoạt động"
        );
    }
}
