package vn.freshlink.traceability;

import java.util.*;
import java.io.ByteArrayOutputStream;
import com.google.zxing.*;
import com.google.zxing.qrcode.QRCodeWriter;
import com.google.zxing.client.j2se.MatrixToImageWriter;
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
        if(codes.isEmpty()) throw new ResponseStatusException(HttpStatus.NOT_FOUND,"QR không tồn tại hoặc đã hết hiệu lực");
        var qr=codes.get(0);long id=((Number)qr.get("entity_id")).longValue();
        List<Map<String,Object>> batches;
        if(qr.get("entity_type").equals("BATCH")) batches=publicBatches("b.batch_id=?",id);
        else if(qr.get("entity_type").equals("DELIVERY_PACKAGE")) batches=publicBatches("b.batch_id IN (SELECT ba.batch_id FROM batch_allocations ba JOIN delivery_items d ON d.batch_allocation_id=ba.batch_allocation_id WHERE d.trip_stop_id=?)",id);
        else return ApiResponse.success(Map.of("type","RETURNABLE_ASSET","assets",jdbc.queryForList("SELECT asset_code,status,condition_status FROM returnable_assets WHERE asset_id=?",id)),"Thông tin thùng; vị trí và đơn vị giữ chỉ dành cho người có quyền");
        return ApiResponse.success(Map.of("type",qr.get("entity_type"),"batches",batches),"Thông tin truy xuất đã ghi nhận; QR không phải chứng nhận chất lượng");
    }
    private List<Map<String,Object>> publicBatches(String predicate,long id) {
        // The predicate comes only from fixed server-side branches; private order data is never selected.
        return jdbc.queryForList("SELECT b.batch_code,s.sku_name,s.pack_description,o.organization_name,b.harvest_at,b.packed_at,b.received_at,b.batch_status FROM batches b JOIN product_skus s ON s.sku_id=b.sku_id JOIN organizations o ON o.organization_id=b.supplier_id WHERE "+predicate,id);
    }
}
