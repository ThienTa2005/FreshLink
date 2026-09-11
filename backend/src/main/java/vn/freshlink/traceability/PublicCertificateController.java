package vn.freshlink.traceability;
import org.springframework.jdbc.core.JdbcTemplate;import org.springframework.web.bind.annotation.*;import vn.freshlink.common.api.ApiResponse;
@RestController @RequestMapping("/api/public/suppliers") public class PublicCertificateController{
 private final JdbcTemplate jdbc;public PublicCertificateController(JdbcTemplate j){jdbc=j;}
 @GetMapping("/{id}/certificates") public ApiResponse<?> certificates(@PathVariable long id){var supplier=jdbc.queryForMap("SELECT o.organization_id,o.organization_code,o.organization_name,o.status FROM organizations o JOIN supplier_profiles s ON s.supplier_id=o.organization_id WHERE o.organization_id=? AND o.status='ACTIVE'",id);supplier.put("certificates",jdbc.queryForList("SELECT document_type,document_number,issued_date,expiry_date,verification_status,verified_at FROM supplier_documents WHERE supplier_id=? AND verification_status='VERIFIED' AND (expiry_date IS NULL OR expiry_date>=CURRENT_DATE) ORDER BY document_type,expiry_date",id));return ApiResponse.success(supplier,"Chứng nhận nhà cung cấp đã xác minh");}
}
