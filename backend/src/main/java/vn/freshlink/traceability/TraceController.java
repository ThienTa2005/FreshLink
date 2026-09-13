package vn.freshlink.traceability;

import java.util.*;
import java.io.ByteArrayOutputStream;
import com.google.zxing.*;
import com.google.zxing.qrcode.QRCodeWriter;
import com.google.zxing.client.j2se.MatrixToImageWriter;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
import vn.freshlink.identity.Actor;
import vn.freshlink.common.api.ApiResponse;

@RestController @RequestMapping("/api")
public class TraceController {
    private final JdbcTemplate jdbc;
    private final ObjectMapper objectMapper = new ObjectMapper();
    @Value("${app.frontend-url:http://localhost:5173}") private String frontendUrl;
    public TraceController(JdbcTemplate jdbc) {this.jdbc=jdbc;}
    @PostMapping("/qr/{type}/{id}") public ApiResponse<?> label(@AuthenticationPrincipal Actor a,@PathVariable String type,@PathVariable long id) throws Exception {
        switch(type) {
            case "BATCH" -> {
                var batch=jdbc.queryForMap("SELECT supplier_id FROM batches WHERE batch_id=?",id);
                if(!a.hasRole("OPERATIONS_COORDINATOR")&&!a.hasRole("QUALITY_INSPECTOR")) a.requireOrganization(((Number)batch.get("supplier_id")).longValue(),"SUPPLIER_MANAGER","SUPPLIER_STAFF");
            }
            case "DELIVERY_PACKAGE" -> {a.requireRole("OPERATIONS_COORDINATOR");jdbc.queryForMap("SELECT trip_stop_id FROM trip_stops WHERE trip_stop_id=?",id);}
            case "RETURNABLE_ASSET" -> {a.requireRole("OPERATIONS_COORDINATOR");jdbc.queryForMap("SELECT asset_id FROM returnable_assets WHERE asset_id=?",id);}
            default -> throw new IllegalArgumentException("Loại QR không hợp lệ");
        }
        jdbc.update("INSERT INTO qr_codes(public_code,entity_type,entity_id,created_by) VALUES (?,?,?,?) ON DUPLICATE KEY UPDATE entity_id=entity_id",UUID.randomUUID().toString(),type,id,a.userId());
        String code=jdbc.queryForObject("SELECT public_code FROM qr_codes WHERE entity_type=? AND entity_id=? AND status='ACTIVE'",String.class,type,id);
        String url=frontendUrl.replaceAll("/$","")+"/trace/"+code;
        var image=new QRCodeWriter().encode(url,BarcodeFormat.QR_CODE,320,320);
        var bytes=new ByteArrayOutputStream();MatrixToImageWriter.writeToStream(image,"PNG",bytes);
        return ApiResponse.success(Map.of("url",url,"code",code,"image","data:image/png;base64,"+Base64.getEncoder().encodeToString(bytes.toByteArray())),"Nhãn QR");
    }
    @GetMapping("/public/trace/{code}") public ApiResponse<?> trace(@PathVariable String code) {
        var codes=jdbc.queryForList("SELECT entity_type,entity_id FROM qr_codes WHERE public_code=? AND status='ACTIVE' AND (expires_at IS NULL OR expires_at>UTC_TIMESTAMP(3))",code);
        if(codes.isEmpty()) {
            var batchList=jdbc.queryForList("SELECT batch_id FROM batches WHERE batch_code=?",code);
            if(!batchList.isEmpty()) {
                long batchId=((Number)batchList.get(0).get("batch_id")).longValue();
                return ApiResponse.success(Map.of("type","BATCH","batches",publicBatches("b.batch_id=?",batchId)),"Thông tin truy xuất");
            }
            throw new ResponseStatusException(HttpStatus.NOT_FOUND,"QR không tồn tại hoặc đã hết hiệu lực");
        }
        var qr=codes.get(0);long id=((Number)qr.get("entity_id")).longValue();
        List<Map<String,Object>> batches;
        if(qr.get("entity_type").equals("BATCH")) batches=publicBatches("b.batch_id=?",id);
        else if(qr.get("entity_type").equals("DELIVERY_PACKAGE")) batches=publicBatches("b.batch_id IN (SELECT ba.batch_id FROM batch_allocations ba JOIN delivery_items d ON d.batch_allocation_id=ba.batch_allocation_id WHERE d.trip_stop_id=?)",id);
        else return ApiResponse.success(Map.of("type","RETURNABLE_ASSET","assets",jdbc.queryForList("SELECT asset_code,status,condition_status FROM returnable_assets WHERE asset_id=?",id)),"Thông tin thùng; vị trí và đơn vị giữ chỉ dành cho người có quyền");
        return ApiResponse.success(Map.of("type",qr.get("entity_type"),"batches",batches),"Thông tin truy xuất đã ghi nhận; QR không phải chứng nhận chất lượng");
    }
    private List<Map<String,Object>> publicBatches(String predicate,long id) {
        var rows=jdbc.queryForList("""
            SELECT b.batch_id, b.batch_code, b.supplier_id, b.sku_id,
                   s.sku_name, s.pack_description, s.image_url,
                   o.organization_name, o.tax_code AS supplier_tax_code, o.phone AS supplier_phone, o.email AS supplier_email,
                   b.variety_name, b.planting_date, b.packaging_facility, b.cultivation_diary,
                   b.harvest_at, b.packed_at, b.received_at, b.declared_quantity, b.accepted_quantity,
                   b.batch_status, b.trace_note
            FROM batches b
            JOIN product_skus s ON s.sku_id=b.sku_id
            JOIN organizations o ON o.organization_id=b.supplier_id
            WHERE """+predicate,id);

        List<Map<String,Object>> results=new ArrayList<>();
        for(var row:rows) {
            Map<String,Object> map=new HashMap<>(row);
            long supplierId=((Number)row.get("supplier_id")).longValue();
            long batchId=((Number)row.get("batch_id")).longValue();

            // 1. VietGAP Certificate (Nhóm 1)
            var certs=jdbc.queryForList("""
                SELECT supplier_document_id, document_number, certifying_body, certification_scope,
                       issued_date, expiry_date, verification_status, file_id
                FROM supplier_documents
                WHERE supplier_id=? AND document_type='VIETGAP' AND verification_status='APPROVED'
                ORDER BY supplier_document_id DESC LIMIT 1
            """,supplierId);
            map.put("vietgap_certificate",!certs.isEmpty()?certs.get(0):null);

            // 2. Farm and producer address info (Nhóm 2)
            var addrs=jdbc.queryForList("""
                SELECT address_name, contact_name, contact_phone, address_line, ward, district, city, latitude, longitude
                FROM addresses
                WHERE organization_id=?
                ORDER BY (address_type='FARM') DESC, is_default DESC, address_id DESC LIMIT 1
            """,supplierId);
            map.put("farm_address",!addrs.isEmpty()?addrs.get(0):null);

            // 3. Cultivation Diary parsed (Nhóm 4)
            if(row.get("cultivation_diary")!=null) {
                try {
                    map.put("cultivation_diary",objectMapper.readValue(row.get("cultivation_diary").toString(),Object.class));
                } catch(Exception ignored) {}
            }

            // 4. KCS Gate Inspection details & cold chain (Nhóm 5)
            var inspections=jdbc.queryForList("""
                SELECT inspection_id, final_result, accepted_quantity, review_quantity, rejected_quantity, general_note, inspected_at
                FROM batch_inspections
                WHERE batch_id=?
                ORDER BY inspection_id DESC LIMIT 1
            """,batchId);
            if(!inspections.isEmpty()) {
                var insp=new HashMap<>(inspections.get(0));
                long inspId=((Number)insp.get("inspection_id")).longValue();
                var items=jdbc.queryForList("""
                    SELECT criterion_code, criterion_name, result, note, evidence_file_id
                    FROM inspection_items
                    WHERE inspection_id=?
                """,inspId);
                insp.put("items",items);
                Long evidenceFileId=null;
                for(var item:items) {
                    if(item.get("evidence_file_id")!=null) {
                        evidenceFileId=((Number)item.get("evidence_file_id")).longValue();
                        break;
                    }
                }
                insp.put("evidence_file_id",evidenceFileId);
                map.put("gate_inspection",insp);
            } else {
                map.put("gate_inspection",null);
            }

            results.add(map);
        }
        return results;
    }
}
