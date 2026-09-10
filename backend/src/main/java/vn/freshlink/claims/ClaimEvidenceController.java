package vn.freshlink.claims;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;
import vn.freshlink.identity.Actor;
import vn.freshlink.common.MediaController;
import vn.freshlink.common.api.ApiResponse;

@RestController
@RequestMapping("/api/claims")
public class ClaimEvidenceController {
    private final JdbcTemplate jdbc;
    private final MediaController media;
    public ClaimEvidenceController(JdbcTemplate jdbc,MediaController media) { this.jdbc=jdbc; this.media=media; }
    public record Evidence(@NotNull @Positive Long itemId,@NotNull @Positive Long evidenceId) {}
    @PutMapping("/{id}/evidence") @Transactional
    public ApiResponse<?> evidence(@AuthenticationPrincipal Actor actor,@PathVariable long id,@Valid @RequestBody Evidence r) {
        var claim=jdbc.queryForMap("SELECT restaurant_id,status FROM complaints WHERE complaint_id=? FOR UPDATE",id);
        actor.requireOrganization(((Number)claim.get("restaurant_id")).longValue(),"RESTAURANT_MANAGER","RESTAURANT_RECEIVER");
        if(!java.util.Set.of("NEW","VERIFYING","WAITING_PARTNER").contains(claim.get("status")))
            throw new ResponseStatusException(HttpStatus.CONFLICT,"Khiếu nại đã kết thúc, không sửa bằng chứng");
        jdbc.queryForMap("SELECT complaint_item_id FROM complaint_items WHERE complaint_item_id=? AND complaint_id=?",r.itemId(),id);
        media.requireOwned(actor,r.evidenceId());
        jdbc.update("UPDATE complaint_items SET evidence_file_id=? WHERE complaint_item_id=?",r.evidenceId(),r.itemId());
        return ApiResponse.success(null,"Đã gắn bằng chứng khiếu nại");
    }
}
