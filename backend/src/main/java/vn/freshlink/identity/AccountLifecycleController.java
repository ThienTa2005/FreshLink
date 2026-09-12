package vn.freshlink.identity;

import java.nio.charset.StandardCharsets;
import java.time.*;
import java.util.*;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;
import vn.freshlink.common.api.ApiResponse;

@RestController @RequestMapping("/api")
public class AccountLifecycleController {
 private final JdbcTemplate jdbc;private final PasswordEncoder passwords;
 @Value("${app.frontend-url}") private String frontend;
 @Value("${SMTP_HOST:}") private String smtp;
 public AccountLifecycleController(JdbcTemplate j,PasswordEncoder p){jdbc=j;passwords=p;}
 public record Email(@NotBlank @jakarta.validation.constraints.Email String email){}
 public record Reset(@NotBlank @Size(max=150) String token,@NotBlank @Size(min=12,max=72) String password){}
 public record Status(@NotBlank @jakarta.validation.constraints.Email String email,@NotBlank @Size(max=72) String password){}
 public record Reason(@NotBlank @Size(max=1000) String reason){}
 public record Preview(@NotBlank String role){}
 @PostMapping("/public/auth/forgot-password") @Transactional public ApiResponse<?> forgot(@Valid @RequestBody Email r){
  if(smtp.isBlank())throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,"Chức năng email chưa được cấu hình. Liên hệ quản trị để khôi phục tài khoản.");
  var ids=jdbc.queryForList("SELECT user_id FROM users WHERE email=? AND status='ACTIVE' FOR UPDATE",Long.class,r.email().trim().toLowerCase(Locale.ROOT));
  if(!ids.isEmpty()) {long id=ids.get(0);if(jdbc.queryForObject("SELECT COUNT(*) FROM password_reset_tokens WHERE user_id=? AND created_at>DATE_SUB(UTC_TIMESTAMP(3),INTERVAL 5 MINUTE)",Integer.class,id)==0){String token=UUID.randomUUID()+"."+UUID.randomUUID();jdbc.update("UPDATE password_reset_tokens SET used_at=UTC_TIMESTAMP(3) WHERE user_id=? AND used_at IS NULL",id);jdbc.update("INSERT INTO password_reset_tokens(token_hash,user_id,expires_at) VALUES (?,?,DATE_ADD(UTC_TIMESTAMP(3),INTERVAL 30 MINUTE))",IdentityService.hash(token),id);jdbc.update("INSERT INTO email_outbox(recipient,template_code,payload) VALUES (?,'PASSWORD_RESET',JSON_OBJECT('subject','Khôi phục mật khẩu FreshLink','text',?))",r.email().trim().toLowerCase(Locale.ROOT),"Mở liên kết trong 30 phút: "+frontend+"/reset-password#token="+token);}}
  return ApiResponse.success(null,"Nếu tài khoản hợp lệ, hướng dẫn sẽ được gửi tới email. Kiểm tra cả thư rác.");
 }
 @PostMapping("/public/auth/reset-password") @Transactional public ApiResponse<?> reset(@Valid @RequestBody Reset r){
  if(r.password().getBytes(StandardCharsets.UTF_8).length>72)throw new IllegalArgumentException("Mật khẩu tối đa 72 byte UTF-8");
  var rows=jdbc.queryForList("SELECT * FROM password_reset_tokens WHERE token_hash=? AND used_at IS NULL AND expires_at>UTC_TIMESTAMP(3) FOR UPDATE",IdentityService.hash(r.token()));if(rows.isEmpty())throw new ResponseStatusException(HttpStatus.CONFLICT,"Liên kết không hợp lệ hoặc đã hết hạn");Object user=rows.get(0).get("user_id");jdbc.update("UPDATE users SET password_hash=?,failed_login_count=0,locked_until=NULL WHERE user_id=?",passwords.encode(r.password()),user);jdbc.update("UPDATE password_reset_tokens SET used_at=UTC_TIMESTAMP(3) WHERE user_id=?",user);jdbc.update("DELETE FROM api_tokens WHERE user_id=?",user);return ApiResponse.success(null,"Đã đổi mật khẩu; hãy đăng nhập lại");
 }
 @PostMapping("/public/partners/status") public ApiResponse<?> status(@Valid @RequestBody Status r){
  var users=jdbc.queryForList("SELECT user_id,password_hash FROM users WHERE email=?",r.email().trim().toLowerCase(Locale.ROOT));
  if(users.isEmpty()||!passwords.matches(r.password(),users.get(0).get("password_hash").toString()))throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Không xác minh được thông tin");
  return ApiResponse.success(jdbc.queryForList("SELECT o.organization_name,o.status,o.review_note FROM organizations o JOIN organization_members m ON m.organization_id=o.organization_id WHERE m.user_id=?",users.get(0).get("user_id")),"Trạng thái đăng ký");
 }
 @PostMapping("/admin/partners/{id}/request-information") @Transactional public ApiResponse<?> requestInformation(@AuthenticationPrincipal Actor a,@PathVariable long id,@Valid @RequestBody Reason r){a.requireRole("SYSTEM_ADMIN");if(jdbc.update("UPDATE organizations SET review_note=? WHERE organization_id=? AND status='PENDING'",r.reason(),id)!=1)throw new ResponseStatusException(HttpStatus.CONFLICT,"Chỉ yêu cầu bổ sung hồ sơ đang chờ duyệt");jdbc.update("INSERT INTO audit_logs(actor_user_id,action_code,entity_type,entity_id,new_data) VALUES (?,'REQUEST_PARTNER_INFORMATION','ORGANIZATION',?,JSON_OBJECT('reason',?))",a.userId(),id,r.reason());return ApiResponse.success(null,"Đã ghi yêu cầu bổ sung; đối tác xem tại trang trạng thái đăng ký");}
 @PostMapping("/admin/preview") public ApiResponse<?> preview(@AuthenticationPrincipal Actor a,@Valid @RequestBody Preview r){a.requireRole("SYSTEM_ADMIN");if(jdbc.queryForObject("SELECT COUNT(*) FROM roles WHERE role_code=?",Integer.class,r.role())!=1)throw new IllegalArgumentException("Vai trò không tồn tại");jdbc.update("INSERT INTO audit_logs(actor_user_id,action_code,entity_type,new_data) VALUES (?,'PREVIEW_ROLE','ROLE',JSON_OBJECT('role',?))",a.userId(),r.role());return ApiResponse.success(null,"Chế độ xem trước chỉ đọc");}
}
