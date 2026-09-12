package vn.freshlink.common;

import java.security.MessageDigest;
import java.time.Instant;
import java.util.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;
import vn.freshlink.identity.Actor;
import vn.freshlink.common.api.ApiResponse;

@RestController @RequestMapping("/api/media")
public class MediaController {
    private final JdbcTemplate jdbc;
    private final Sql sql;
    private final MediaStorage storage;
    private final long accessSeconds;

    public MediaController(JdbcTemplate jdbc, Sql sql, MediaStorage storage,
                           @Value("${app.cloudinary.access-seconds:300}") long accessSeconds) {
        this.jdbc=jdbc; this.sql=sql; this.storage=storage; this.accessSeconds=accessSeconds;
    }

    @PostMapping public ApiResponse<?> upload(@AuthenticationPrincipal Actor actor,
                                               @RequestParam MultipartFile file,
                                               @RequestParam(required=false, defaultValue="false") boolean isPublic) throws Exception {
        if(file.isEmpty() || file.getSize()>10*1024*1024) throw new IllegalArgumentException("Tệp phải từ 1 byte đến 10 MB");
        byte[] bytes=file.getBytes();
        String mimeType=detectType(bytes);
        String original=Optional.ofNullable(file.getOriginalFilename()).orElse("evidence");
        if(original.length()>255) original=original.substring(original.length()-255);
        MediaStorage.Stored stored = isPublic
            ? storage.upload(bytes, UUID.randomUUID().toString(), true)
            : storage.upload(bytes, UUID.randomUUID().toString());
        try {
            long id=sql.insert("""
                INSERT INTO media_files(uploaded_by,original_name,storage_provider,storage_key,cloudinary_asset_id,
                  cloudinary_resource_type,cloudinary_delivery_type,cloudinary_format,cloudinary_version,
                  mime_type,file_size_bytes,file_hash_sha256,visibility)
                VALUES (?,?,'CLOUDINARY',?,?,?,?,?,?,?,?,?,?)
                """,actor.userId(),original,stored.publicId(),stored.assetId(),stored.resourceType(),
                stored.deliveryType(),stored.format(),stored.version(),mimeType,stored.bytes(),
                HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes)),
                isPublic ? "PUBLIC" : "PRIVATE");
            String url = stored.secureUrl() != null && !stored.secureUrl().isBlank()
                ? stored.secureUrl() : "/api/public/media/" + id;
            return ApiResponse.success(Map.of("id",id,"name",original,"url",url),"Đã lưu tệp hình ảnh");
        } catch(RuntimeException e) {
            storage.delete(stored);
            throw e;
        }
    }

    private String detectType(byte[] bytes) {
        if(bytes.length>8 && bytes[0]==(byte)0x89 && bytes[1]=='P' && bytes[2]=='N' && bytes[3]=='G'
            && bytes[4]==13 && bytes[5]==10 && bytes[6]==26 && bytes[7]==10) return "image/png";
        if(bytes.length>3 && bytes[0]==(byte)0xff && bytes[1]==(byte)0xd8 && bytes[2]==(byte)0xff) return "image/jpeg";
        if(bytes.length>4 && bytes[0]=='%' && bytes[1]=='P' && bytes[2]=='D' && bytes[3]=='F' && bytes[4]=='-') return "application/pdf";
        throw new IllegalArgumentException("Chỉ nhận ảnh PNG/JPEG hoặc PDF hợp lệ");
    }

    public void requireOwned(Actor actor,Long id) {
        if(id!=null && jdbc.queryForObject("SELECT COUNT(*) FROM media_files WHERE file_id=? AND uploaded_by=?",Integer.class,id,actor.userId())!=1)
            throw new IllegalArgumentException("Tệp bằng chứng không thuộc người gửi");
    }

    private Map<String,Object> authorizedFile(Actor actor,long id) {
        var file=jdbc.queryForMap("""
            SELECT original_name,storage_provider,storage_key,cloudinary_asset_id,cloudinary_resource_type,
              cloudinary_delivery_type,cloudinary_format,cloudinary_version,mime_type,uploaded_by,file_size_bytes
            FROM media_files WHERE file_id=?
            """,id);
        Object uploader=file.get("uploaded_by");
        if(!(uploader instanceof Number number) || number.longValue()!=actor.userId())
            actor.requireRole("QUALITY_INSPECTOR","CUSTOMER_SUPPORT","OPERATIONS_COORDINATOR");
        if(!"CLOUDINARY".equals(file.get("storage_provider")))
            throw new ResponseStatusException(HttpStatus.GONE,"Tệp cũ không còn trên máy chủ; vui lòng tải lên lại");
        return file;
    }

    private MediaStorage.Stored stored(Map<String,Object> file) {
        return new MediaStorage.Stored((String)file.get("cloudinary_asset_id"),(String)file.get("storage_key"),
            (String)file.get("cloudinary_resource_type"),(String)file.get("cloudinary_delivery_type"),
            (String)file.get("cloudinary_format"),((Number)file.get("cloudinary_version")).longValue(),
            ((Number)file.get("file_size_bytes")).longValue());
    }

    public record Access(String url,Instant expiresAt,String name,String mimeType) {}

    @GetMapping("/{id}/access") public ApiResponse<Access> access(@AuthenticationPrincipal Actor actor,
                                                                   @PathVariable long id) {
        var file=authorizedFile(actor,id);
        Instant expiresAt=Instant.now().plusSeconds(accessSeconds);
        var access=storage.createAccessUrl(stored(file),expiresAt);
        return ApiResponse.success(new Access(access.url(),access.expiresAt(),(String)file.get("original_name"),
            (String)file.get("mime_type")),"Liên kết tải tệp có hiệu lực trong 5 phút");
    }

    /** Compatibility endpoint for older clients. New clients should use /access. */
    @GetMapping("/{id}") public ResponseEntity<Void> download(@AuthenticationPrincipal Actor actor,
                                                               @PathVariable long id) {
        var file=authorizedFile(actor,id);
        var access=storage.createAccessUrl(stored(file),Instant.now().plusSeconds(accessSeconds));
        return ResponseEntity.status(HttpStatus.FOUND).location(java.net.URI.create(access.url())).build();
    }

    @GetMapping("/public/media/{id}") public ResponseEntity<Void> publicDownload(@PathVariable long id) {
        var file=jdbc.queryForMap("""
            SELECT original_name,storage_provider,storage_key,cloudinary_asset_id,cloudinary_resource_type,
              cloudinary_delivery_type,cloudinary_format,cloudinary_version,mime_type,uploaded_by,file_size_bytes
            FROM media_files WHERE file_id=?
            """,id);
        var access=storage.createAccessUrl(stored(file),Instant.now().plusSeconds(86400));
        return ResponseEntity.status(HttpStatus.FOUND).location(java.net.URI.create(access.url())).build();
    }
}
