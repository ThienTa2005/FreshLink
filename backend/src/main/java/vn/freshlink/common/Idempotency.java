package vn.freshlink.common;

import java.util.function.LongSupplier;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;
import vn.freshlink.identity.IdentityService;

@Component
public class Idempotency {
    private final JdbcTemplate jdbc;
    public Idempotency(JdbcTemplate jdbc) { this.jdbc=jdbc; }
    @Transactional(propagation=Propagation.MANDATORY)
    public long execute(long userId,String key,String operation,String payload,LongSupplier action) {
        if (key==null || !key.matches("[A-Za-z0-9_-]{16,80}")) throw new IllegalArgumentException("Idempotency-Key cần từ 16 đến 80 ký tự chữ, số, gạch ngang");
        String hash=IdentityService.hash(payload);
        jdbc.update("INSERT INTO request_deduplication(user_id,request_key,operation,request_hash) VALUES (?,?,?,?) ON DUPLICATE KEY UPDATE request_key=request_key",userId,key,operation,hash);
        var row=jdbc.queryForMap("SELECT operation,request_hash,result_id FROM request_deduplication WHERE user_id=? AND request_key=? FOR UPDATE",userId,key);
        if (!operation.equals(row.get("operation")) || !hash.equals(row.get("request_hash"))) throw new ResponseStatusException(HttpStatus.CONFLICT,"Mã yêu cầu đã được dùng cho nội dung khác");
        if (row.get("result_id")!=null) return ((Number)row.get("result_id")).longValue();
        long result=action.getAsLong();
        jdbc.update("UPDATE request_deduplication SET result_id=? WHERE user_id=? AND request_key=?",result,userId,key);
        return result;
    }
}
