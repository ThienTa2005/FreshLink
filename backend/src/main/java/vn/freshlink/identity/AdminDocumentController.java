package vn.freshlink.identity;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import vn.freshlink.common.api.ApiResponse;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/admin/supplier-documents")
public class AdminDocumentController {

    private final JdbcTemplate jdbc;

    public AdminDocumentController(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @GetMapping("/pending")
    public ApiResponse<List<Map<String, Object>>> getPendingDocuments(@AuthenticationPrincipal Actor actor) {
        actor.requireRole("SYSTEM_ADMIN", "OPERATIONS_COORDINATOR");
        var list = jdbc.queryForList("""
            SELECT d.supplier_document_id, d.supplier_id, org.organization_name AS supplier_name,
                   d.document_type, d.document_number, d.certifying_body, d.certification_scope,
                   d.issued_date, d.expiry_date, d.verification_status, d.created_at,
                   f.file_id, f.original_name, f.storage_key
            FROM supplier_documents d
            JOIN organizations org ON org.organization_id = d.supplier_id
            JOIN media_files f ON f.file_id = d.file_id
            ORDER BY (d.verification_status = 'PENDING') DESC, d.supplier_document_id DESC
            LIMIT 100
        """);
        return ApiResponse.success(list, "Danh sách hồ sơ chứng nhận");
    }

    public record VerifyRequest(@NotNull Boolean approved, String reason) {}

    @PostMapping("/{id}/verify")
    @Transactional
    public ApiResponse<?> verifyDocument(
        @AuthenticationPrincipal Actor actor,
        @PathVariable long id,
        @Valid @RequestBody VerifyRequest request
    ) {
        actor.requireRole("SYSTEM_ADMIN", "OPERATIONS_COORDINATOR");

        var doc = jdbc.queryForMap("SELECT supplier_id, document_type FROM supplier_documents WHERE supplier_document_id = ? FOR UPDATE", id);
        long supplierId = ((Number) doc.get("supplier_id")).longValue();
        String docType = (String) doc.get("document_type");

        if (Boolean.TRUE.equals(request.approved())) {
            jdbc.update("""
                UPDATE supplier_documents
                SET verification_status = 'APPROVED', verified_by = ?, verified_at = UTC_TIMESTAMP(3), rejection_reason = NULL
                WHERE supplier_document_id = ?
            """, actor.userId(), id);

            if ("VIETGAP".equals(docType)) {
                jdbc.update("""
                    UPDATE supplier_profiles
                    SET verification_status = 'VERIFIED', verified_by = ?, verified_at = UTC_TIMESTAMP(3)
                    WHERE supplier_id = ?
                """, actor.userId(), supplierId);
            }
            return ApiResponse.success(null, "Đã phê duyệt chứng nhận đạt chuẩn!");
        } else {
            jdbc.update("""
                UPDATE supplier_documents
                SET verification_status = 'REJECTED', verified_by = ?, verified_at = UTC_TIMESTAMP(3), rejection_reason = ?
                WHERE supplier_document_id = ?
            """, actor.userId(), request.reason() != null ? request.reason() : "Chưa đạt tiêu chuẩn", id);
            return ApiResponse.success(null, "Đã từ chối hồ sơ và yêu cầu HTX bổ sung");
        }
    }
}
