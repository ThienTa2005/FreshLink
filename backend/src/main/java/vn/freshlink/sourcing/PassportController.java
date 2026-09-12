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
        a.requireOrganization(supplierId,"SUPPLIER_MANAGER","SUPPLIER_STAFF");
        return ApiResponse.success(jdbc.queryForList("SELECT d.supplier_document_id,d.document_type,d.document_number,d.issued_date,d.expiry_date,d.verification_status,f.original_name,d.file_id FROM supplier_documents d JOIN media_files f ON f.file_id=d.file_id WHERE d.supplier_id=? ORDER BY d.supplier_document_id DESC",supplierId),"Hồ sơ nhà cung cấp");
    }
    public record Document(@NotNull Long supplierId,@NotNull Long fileId,
        @NotBlank @Pattern(regexp="BUSINESS_LICENSE|FOOD_SAFETY|VIETGAP|ORIGIN_PROOF|OTHER") String type,
        @Size(max=100) String number,LocalDate issuedDate,LocalDate expiryDate) {}
    @PostMapping public ApiResponse<?> document(@AuthenticationPrincipal Actor a,@Valid @RequestBody Document r) {
        a.requireOrganization(r.supplierId(),"SUPPLIER_MANAGER","SUPPLIER_STAFF");media.requireOwned(a,r.fileId());
        if(r.issuedDate()!=null && r.expiryDate()!=null && r.expiryDate().isBefore(r.issuedDate())) throw new IllegalArgumentException("Ngày hết hạn phải sau ngày cấp");
        return ApiResponse.success(sql.insert("INSERT INTO supplier_documents(supplier_id,file_id,document_type,document_number,issued_date,expiry_date) VALUES (?,?,?,?,?,?)",r.supplierId(),r.fileId(),r.type(),r.number(),r.issuedDate(),r.expiryDate()),"Đã gửi hồ sơ chờ xác minh");
    }
}
