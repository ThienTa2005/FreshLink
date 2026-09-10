package vn.freshlink.identity;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import vn.freshlink.common.api.ApiResponse;

@RestController @RequestMapping("/api")
public class PartnerController {
    private final PartnerService partners;
    public PartnerController(PartnerService partners) { this.partners=partners; }
    public record Registration(@NotBlank @Email @Size(max=150) String email,
        @NotBlank @Size(min=10,max=72) String password, @NotBlank @Size(max=150) String fullName,
        @NotBlank @Size(max=200) String organizationName, @NotBlank String type) {}
    @PostMapping("/public/partners") public ApiResponse<?> register(@Valid @RequestBody Registration r) {
        return ApiResponse.success(partners.register(r.email(),r.password(),r.fullName(),r.organizationName(),r.type()),"Đã gửi đăng ký. Vui lòng chờ quản trị viên duyệt.");
    }
    @GetMapping("/admin/partners/pending") public ApiResponse<?> pending(@AuthenticationPrincipal Actor actor) { return ApiResponse.success(partners.pending(actor),"Hồ sơ chờ duyệt"); }
    @PostMapping("/admin/partners/{id}/approve") public ApiResponse<?> approve(@AuthenticationPrincipal Actor actor,@PathVariable long id) {
        partners.approve(actor,id); return ApiResponse.success(null,"Đã duyệt hồ sơ");
    }
}
