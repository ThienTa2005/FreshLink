package vn.freshlink.common.api;

import java.time.Instant;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.*;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestControllerAdvice
public class ApiExceptionHandler {
    private static final org.slf4j.Logger log = org.slf4j.LoggerFactory.getLogger(ApiExceptionHandler.class);
    private ResponseEntity<ApiResponse<Void>> error(HttpStatusCode status, String message) {
        return ResponseEntity.status(status).body(new ApiResponse<>(false, null, message, Instant.now()));
    }
    @ExceptionHandler(AuthenticationException.class) public ResponseEntity<?> authentication(AuthenticationException e) { return error(HttpStatus.UNAUTHORIZED, e.getMessage()); }
    @ExceptionHandler(AccessDeniedException.class) public ResponseEntity<?> denied(AccessDeniedException e) { return error(HttpStatus.FORBIDDEN, e.getMessage()); }
    @ExceptionHandler(ResponseStatusException.class) public ResponseEntity<?> status(ResponseStatusException e) { return error(e.getStatusCode(), e.getReason()); }
    @ExceptionHandler(MethodArgumentNotValidException.class) public ResponseEntity<?> validation(MethodArgumentNotValidException e) {
        return error(HttpStatus.BAD_REQUEST, e.getBindingResult().getFieldErrors().stream().map(f -> f.getField() + ": " + f.getDefaultMessage()).findFirst().orElse("Dữ liệu không hợp lệ"));
    }
    @ExceptionHandler(DataIntegrityViolationException.class) public ResponseEntity<?> conflict(DataIntegrityViolationException e) { return error(HttpStatus.CONFLICT, "Dữ liệu trùng hoặc không thỏa điều kiện nghiệp vụ"); }
    @ExceptionHandler(IllegalArgumentException.class) public ResponseEntity<?> invalid(IllegalArgumentException e) { return error(HttpStatus.BAD_REQUEST, e.getMessage()); }
    @ExceptionHandler(org.springframework.dao.EmptyResultDataAccessException.class) public ResponseEntity<?> missing(Exception e) { return error(HttpStatus.NOT_FOUND, "Không tìm thấy dữ liệu"); }
    @ExceptionHandler({org.springframework.http.converter.HttpMessageNotReadableException.class,
        org.springframework.web.bind.MissingServletRequestParameterException.class,
        org.springframework.web.bind.MissingRequestHeaderException.class,
        org.springframework.web.method.annotation.MethodArgumentTypeMismatchException.class,
        jakarta.validation.ConstraintViolationException.class})
    public ResponseEntity<?> malformed(Exception e) { return error(HttpStatus.BAD_REQUEST, "Thiếu tham số hoặc dữ liệu gửi lên không đúng định dạng"); }
    @ExceptionHandler(org.springframework.web.multipart.MaxUploadSizeExceededException.class)
    public ResponseEntity<?> tooLarge(Exception e) { return error(HttpStatus.PAYLOAD_TOO_LARGE, "Tệp vượt giới hạn 10 MB"); }
    @ExceptionHandler(org.springframework.web.HttpRequestMethodNotSupportedException.class)
    public ResponseEntity<?> method(Exception e) { return error(HttpStatus.METHOD_NOT_ALLOWED, "Phương thức không được hỗ trợ"); }
    @ExceptionHandler(org.springframework.web.HttpMediaTypeNotSupportedException.class)
    public ResponseEntity<?> mediaType(Exception e) { return error(HttpStatus.UNSUPPORTED_MEDIA_TYPE, "Định dạng nội dung không được hỗ trợ"); }
    @ExceptionHandler(org.springframework.web.servlet.resource.NoResourceFoundException.class)
    public ResponseEntity<?> noResource(Exception e) { return error(HttpStatus.NOT_FOUND, "Không tìm thấy đường dẫn"); }
    @ExceptionHandler(Exception.class)
    public ResponseEntity<?> unexpected(Exception e) {
        log.error("Unhandled API failure", e);
        return error(HttpStatus.INTERNAL_SERVER_ERROR, "Không thể xử lý yêu cầu. Vui lòng thử lại sau");
    }
}
