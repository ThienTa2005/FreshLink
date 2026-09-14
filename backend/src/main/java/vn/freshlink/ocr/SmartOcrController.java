package vn.freshlink.ocr;

import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import vn.freshlink.common.api.ApiResponse;
import vn.freshlink.identity.Actor;

import java.io.IOException;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/ordering/smart-ocr")
public class SmartOcrController {

    private final SmartOcrService smartOcrService;

    public SmartOcrController(SmartOcrService smartOcrService) {
        this.smartOcrService = smartOcrService;
    }

    @PostMapping(value = "/scan", consumes = {"multipart/form-data"})
    public ApiResponse<SmartOcrService.SmartOcrResult> scan(
        @AuthenticationPrincipal Actor actor,
        @RequestParam(value = "file", required = false) MultipartFile file,
        @RequestParam(value = "text", required = false) String text,
        @RequestParam(value = "date", required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date
    ) throws IOException {
        Long orgId = (actor != null && !actor.memberships().isEmpty()) ? actor.memberships().get(0).organizationId() : null;
        Long userId = actor != null ? actor.userId() : null;

        SmartOcrService.SmartOcrResult result;
        if (file != null && !file.isEmpty()) {
            result = smartOcrService.processImage(file.getBytes(), file.getContentType(), orgId, userId, date);
        } else if (text != null && !text.isBlank()) {
            result = smartOcrService.processTextNote(text, orgId, userId, date);
        } else {
            throw new IllegalArgumentException("Vui lòng tải lên ảnh chụp ghi chú hoặc nhập nội dung văn bản.");
        }

        return ApiResponse.success(result, result.notes());
    }

    @PostMapping(value = "/scan-text")
    public ApiResponse<SmartOcrService.SmartOcrResult> scanText(
        @AuthenticationPrincipal Actor actor,
        @RequestBody Map<String, Object> payload
    ) {
        Long orgId = (actor != null && !actor.memberships().isEmpty()) ? actor.memberships().get(0).organizationId() : null;
        Long userId = actor != null ? actor.userId() : null;

        String text = (String) payload.get("text");
        String dateStr = (String) payload.get("date");
        LocalDate date = (dateStr != null && !dateStr.isBlank()) ? LocalDate.parse(dateStr) : null;

        if (text == null || text.isBlank()) {
            throw new IllegalArgumentException("Nội dung ghi chú không được để trống");
        }

        SmartOcrService.SmartOcrResult result = smartOcrService.processTextNote(text, orgId, userId, date);
        return ApiResponse.success(result, result.notes());
    }

    @GetMapping("/samples")
    public ApiResponse<List<Map<String, String>>> getSampleNotes() {
        List<Map<String, String>> samples = List.of(
            Map.of(
                "title", "🍲 Nhà hàng Lẩu nấm & Rau rừng",
                "tag", "Bếp Trưởng Lẩu",
                "content", "5kg cải thảo\n10 bó rau muống\n3kg nấm đùi gà\n2kg cà chua bi\n4kg bắp mỹ"
            ),
            Map.of(
                "title", "🥤 Quán Sinh tố & Nước ép (Săn nông sản xấu mã -30%)",
                "tag", "Rescue Juice Bar",
                "content", "15kg dưa hấu giải cứu\n10kg ổi ruột hồng xước vỏ\n8kg cam sành loại 2\n5kg chanh dây méo mó"
            ),
            Map.of(
                "title", "🍜 Quán Phở bò & Cơm văn phòng",
                "tag", "Bếp Trung Tâm",
                "content", "Hành lá: 3kg\nNgò gai - 1kg\nGiá đỗ: 8kg\nChanh tươi - 4kg\nỚt sừng: 500g"
            )
        );
        return ApiResponse.success(samples, "Danh sách mẫu ghi chú đầu bếp thực tế");
    }
}
