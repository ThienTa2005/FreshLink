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
}
