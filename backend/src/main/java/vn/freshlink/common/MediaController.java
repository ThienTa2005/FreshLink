package vn.freshlink.common;

import java.nio.file.*;
import java.util.*;
import java.io.IOException;
import java.security.MessageDigest;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import vn.freshlink.identity.Actor;
import vn.freshlink.common.api.ApiResponse;

@RestController @RequestMapping("/api/media")
public class MediaController {
    private final JdbcTemplate jdbc;private final Sql sql;private final Path root;
    public MediaController(JdbcTemplate jdbc,Sql sql,@Value("${app.media.directory:./uploads}") String directory) {this.jdbc=jdbc;this.sql=sql;this.root=Path.of(directory).toAbsolutePath().normalize();}
    @PostMapping public ApiResponse<?> upload(@AuthenticationPrincipal Actor a,@RequestParam MultipartFile file) throws Exception {
        if(file.isEmpty() || file.getSize()>10*1024*1024) throw new IllegalArgumentException("Tệp phải từ 1 byte đến 10 MB");
        byte[] bytes=file.getBytes();String type;
        if(bytes.length>8 && bytes[0]==(byte)0x89 && bytes[1]=='P' && bytes[2]=='N' && bytes[3]=='G') type="image/png";
        else if(bytes.length>3 && bytes[0]==(byte)0xff && bytes[1]==(byte)0xd8 && bytes[2]==(byte)0xff) type="image/jpeg";
        else if(bytes.length>4 && new String(bytes,0,4,java.nio.charset.StandardCharsets.US_ASCII).equals("%PDF")) type="application/pdf";
        else throw new IllegalArgumentException("Chỉ nhận ảnh PNG/JPEG hoặc PDF");
        String key=UUID.randomUUID().toString();Files.createDirectories(root);Path target=root.resolve(key);Files.write(target,bytes,StandardOpenOption.CREATE_NEW);
        try {
            String original=Optional.ofNullable(file.getOriginalFilename()).orElse("evidence");
            if(original.length()>255) original=original.substring(original.length()-255);
            long id=sql.insert("INSERT INTO media_files(uploaded_by,original_name,storage_key,mime_type,file_size_bytes,file_hash_sha256) VALUES (?,?,?,?,?,?)",a.userId(),original,key,type,bytes.length,HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes)));
            return ApiResponse.success(Map.of("id",id,"name",original),"Đã lưu bằng chứng");
        } catch(RuntimeException e) {Files.deleteIfExists(target);throw e;}
    }
    public void requireOwned(Actor a,Long id) {
        if(id!=null && jdbc.queryForObject("SELECT COUNT(*) FROM media_files WHERE file_id=? AND uploaded_by=?",Integer.class,id,a.userId())!=1) throw new IllegalArgumentException("Tệp bằng chứng không thuộc người gửi");
    }
    @GetMapping("/{id}") public ResponseEntity<byte[]> download(@AuthenticationPrincipal Actor a,@PathVariable long id) throws IOException {
        var file=jdbc.queryForMap("SELECT storage_key,mime_type,uploaded_by FROM media_files WHERE file_id=?",id);
        if(((Number)file.get("uploaded_by")).longValue()!=a.userId()) a.requireRole("QUALITY_INSPECTOR","CUSTOMER_SUPPORT","OPERATIONS_COORDINATOR");
        Path path=root.resolve((String)file.get("storage_key")).normalize();
        if(!path.startsWith(root)||!Files.isRegularFile(path)) return ResponseEntity.notFound().build();
        return ResponseEntity.ok().header("X-Content-Type-Options","nosniff").header("Content-Disposition","attachment; filename=\"evidence\"")
            .contentType(MediaType.parseMediaType((String)file.get("mime_type"))).body(Files.readAllBytes(path));
    }
}
