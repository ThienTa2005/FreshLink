package vn.freshlink.identity;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import vn.freshlink.common.api.ApiResponse;

@RestController
@RequestMapping("/api")
public class AuthController {
    private final IdentityService identity;
    public AuthController(IdentityService identity) { this.identity = identity; }
    public record Login(@NotBlank @Email @Size(max=150) String email, @NotBlank @Size(max=72) String password) {}
    @PostMapping("/public/auth/login")
    public ApiResponse<IdentityService.LoginResult> login(@Valid @RequestBody Login request) {
        return ApiResponse.success(identity.login(request.email(), request.password()), "Đăng nhập thành công");
    }
    @GetMapping("/auth/me") public ApiResponse<Actor> me(@AuthenticationPrincipal Actor actor) {
        return ApiResponse.success(actor, "Thông tin tài khoản");
    }
    @PostMapping("/auth/logout") public ApiResponse<Void> logout(@RequestHeader("Authorization") String authorization) {
        identity.logout(authorization.substring(7));
        return ApiResponse.success(null, "Đã đăng xuất");
    }
}
