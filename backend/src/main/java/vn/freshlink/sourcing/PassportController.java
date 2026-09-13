package vn.freshlink.sourcing;

import java.time.LocalDate;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import vn.freshlink.identity.Actor;
import vn.freshlink.common.*;
import vn.freshlink.common.api.ApiResponse;

@RestController @RequestMapping("/api/supplier/passport")
public class PassportController {
    private final JdbcTemplate jdbc;private final Sql sql;private final MediaController media;
    public PassportController(JdbcTemplate jdbc,Sql sql,MediaController media) {this.jdbc=jdbc;this.sql=sql;this.media=media;}
    @GetMapping public ApiResponse<?> get(@AuthenticationPrincipal Actor a,@RequestParam long supplierId) {
        a.requireOrganization(supplierId,"SUPPLIER_MANAGER","SUPPLIER_STAFF","OPERATIONS_COORDINATOR","SYSTEM_ADMIN");
        return ApiResponse.success(jdbc.queryForList("SELECT d.supplier_document_id,d.document_type,d.document_number,d.certifying_body,d.certification_scope,d.issued_date,d.expiry_date,d.verification_status,d.rejection_reason,f.original_name,d.file_id FROM supplier_documents d JOIN media_files f ON f.file_id=d.file_id WHERE d.supplier_id=? ORDER BY d.supplier_document_id DESC",supplierId),"Hồ sơ nhà cung cấp");
    }
    public record Document(@NotNull Long supplierId,@NotNull Long fileId,
        @NotBlank @Pattern(regexp="BUSINESS_LICENSE|FOOD_SAFETY|VIETGAP|ORIGIN_PROOF|OTHER") String type,
        @Size(max=100) String number,LocalDate issuedDate,LocalDate expiryDate,
        @Size(max=150) String certifyingBody,@Size(max=255) String scope) {
        public Document(Long supplierId,Long fileId,String type,String number,LocalDate issuedDate,LocalDate expiryDate) {
            this(supplierId,fileId,type,number,issuedDate,expiryDate,null,null);
        }
    }
    @PostMapping public ApiResponse<?> document(@AuthenticationPrincipal Actor a,@Valid @RequestBody Document r) {
        a.requireOrganization(r.supplierId(),"SUPPLIER_MANAGER","SUPPLIER_STAFF");media.requireOwned(a,r.fileId());
        if(r.issuedDate()!=null && r.expiryDate()!=null && r.expiryDate().isBefore(r.issuedDate())) throw new IllegalArgumentException("Ngày hết hạn phải sau ngày cấp");
        return ApiResponse.success(sql.insert("INSERT INTO supplier_documents(supplier_id,file_id,document_type,document_number,certifying_body,certification_scope,issued_date,expiry_date) VALUES (?,?,?,?,?,?,?,?)",r.supplierId(),r.fileId(),r.type(),r.number(),r.certifyingBody(),r.scope(),r.issuedDate(),r.expiryDate()),"Đã gửi hồ sơ chờ xác minh");
    }
    @GetMapping("/vietgap-status") public ApiResponse<?> vietgapStatus(@AuthenticationPrincipal Actor a,@RequestParam long supplierId) {
        a.requireOrganization(supplierId,"SUPPLIER_MANAGER","SUPPLIER_STAFF","OPERATIONS_COORDINATOR","SYSTEM_ADMIN");
        var docs=jdbc.queryForList("""
            SELECT supplier_document_id,document_type,document_number,certifying_body,certification_scope,
                   issued_date,expiry_date,verification_status,verified_at
            FROM supplier_documents
            WHERE supplier_id=? AND document_type='VIETGAP' AND verification_status='APPROVED'
              AND (expiry_date IS NULL OR expiry_date>=CURRENT_DATE())
            ORDER BY supplier_document_id DESC LIMIT 1
            """,supplierId);
        boolean hasApproved=!docs.isEmpty();
        return ApiResponse.success(java.util.Map.of(
            "hasApprovedVietgap",hasApproved,
            "document",hasApproved?docs.get(0):java.util.Map.of()
        ),"Trạng thái kiểm định VietGAP");
    }
}
