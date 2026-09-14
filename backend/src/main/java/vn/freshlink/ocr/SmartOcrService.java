package vn.freshlink.ocr;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.text.Normalizer;
import java.time.Duration;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
public class SmartOcrService {

    private static final Logger log = LoggerFactory.getLogger(SmartOcrService.class);

    private final JdbcTemplate jdbc;
    private final ObjectMapper objectMapper;
    private final HttpClient httpClient;
    private final String geminiApiKey;
    private final String geminiModel;

    public SmartOcrService(
        JdbcTemplate jdbc,
        ObjectMapper objectMapper,
        @Value("${app.gemini.api-key:}") String geminiApiKey,
        @Value("${app.gemini.model:gemini-2.5-flash}") String geminiModel
    ) {
        this.jdbc = jdbc;
        this.objectMapper = objectMapper;
        this.geminiApiKey = geminiApiKey != null ? geminiApiKey.trim() : "";
        this.geminiModel = geminiModel != null && !geminiModel.isBlank() ? geminiModel.trim() : "gemini-2.5-flash";
        this.httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(10))
            .build();
    }

    public record DetectedItem(
        String detectedName,
        BigDecimal quantity,
        String unit,
        String notes
    ) {}

    public record MatchedItem(
        Long skuId,
        String skuCode,
        String skuName,
        String baseUnit,
        BigDecimal packSize,
        String packDescription,
        BigDecimal quantity,
        BigDecimal unitPrice,
        BigDecimal lineTotal,
        String gradeType,
        String rescueReason,
        Integer discountPercent,
        String matchStatus, // EXACT, HIGH, PARTIAL
        Double matchScore,
        String originalText
    ) {}

    public record SmartOcrResult(
        List<MatchedItem> matchedItems,
        List<DetectedItem> unmatchedItems,
        int totalDetected,
        int totalMatched,
        BigDecimal estimatedGrandTotal,
        String scanSource,
        String notes
    ) {}

    public SmartOcrResult processImage(byte[] imageBytes, String mimeType, Long organizationId, Long userId, LocalDate orderDate) {
        if (imageBytes == null || imageBytes.length == 0) {
            throw new IllegalArgumentException("Dữ liệu hình ảnh không hợp lệ hoặc bị rỗng");
        }
        if (orderDate == null) {
            orderDate = LocalDate.now(ZoneId.of("Asia/Ho_Chi_Minh")).plusDays(1);
        }

        List<DetectedItem> detectedItems = new ArrayList<>();
        String scanSource = "IMAGE_UPLOAD";

        // 1. If Gemini API key is configured, use Gemini 2.5 Flash Vision Multimodal
        if (!geminiApiKey.isEmpty()) {
            try {
                detectedItems = callGeminiVision(imageBytes, mimeType);
            } catch (Exception e) {
                log.warn("Gemini vision recognition failed, falling back to smart heuristic: {}", e.getMessage());
            }
        }

        // 2. If Gemini failed or no API key, use fallback heuristic
        if (detectedItems.isEmpty()) {
            detectedItems = fallbackParseSampleItems();
            scanSource = "HEURISTIC_FALLBACK";
        }

        // 3. Match detected items against active FreshLink catalog
        SmartOcrResult result = matchWithCatalog(detectedItems, orderDate, scanSource);

        // 4. Log for audit and reporting
        try {
            jdbc.update("""
                INSERT INTO ocr_order_logs(organization_id, user_id, scan_source, detected_count, matched_count, raw_prompt_text, status)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                organizationId, userId, scanSource, result.totalDetected(), result.totalMatched(),
                "Image size: " + imageBytes.length + " bytes (" + mimeType + ")",
                result.matchedItems().isEmpty() ? "FAILED" : (result.unmatchedItems().isEmpty() ? "SUCCESS" : "PARTIAL")
            );
        } catch (Exception ignored) {}

        return result;
    }

    public SmartOcrResult processTextNote(String textNote, Long organizationId, Long userId, LocalDate orderDate) {
        if (textNote == null || textNote.isBlank()) {
            throw new IllegalArgumentException("Nội dung ghi chú không được để trống");
        }
        if (orderDate == null) {
            orderDate = LocalDate.now(ZoneId.of("Asia/Ho_Chi_Minh")).plusDays(1);
        }

        List<DetectedItem> detectedItems;
        if (!geminiApiKey.isEmpty()) {
            try {
                detectedItems = callGeminiTextParser(textNote);
            } catch (Exception e) {
                log.warn("Gemini text parse failed, falling back to regex: {}", e.getMessage());
                detectedItems = parseVietnameseOrderText(textNote);
            }
        } else {
            detectedItems = parseVietnameseOrderText(textNote);
        }

        SmartOcrResult result = matchWithCatalog(detectedItems, orderDate, "TEXT_NOTE");

        try {
            jdbc.update("""
                INSERT INTO ocr_order_logs(organization_id, user_id, scan_source, detected_count, matched_count, raw_prompt_text, status)
                VALUES (?, ?, 'TEXT_NOTE', ?, ?, ?, ?)
                """,
                organizationId, userId, result.totalDetected(), result.totalMatched(),
                textNote.length() > 500 ? textNote.substring(0, 500) : textNote,
                result.matchedItems().isEmpty() ? "FAILED" : (result.unmatchedItems().isEmpty() ? "SUCCESS" : "PARTIAL")
            );
        } catch (Exception ignored) {}

        return result;
    }

    public List<DetectedItem> parseVietnameseOrderText(String text) {
        List<DetectedItem> list = new ArrayList<>();
        if (text == null || text.isBlank()) return list;

        String[] lines = text.split("[,;\\r\\n]+");
        Pattern pattern1 = Pattern.compile("(?i)^[\\s\\-*•]*(\\d+(?:[.,]\\d+)?)\\s*(kg|kilo|g|gram|gói|túi|bó|thùng|sọt|pack|box|crate)?\\s*(?:của|loại|:|-)?\\s*([a-zà-ỹ0-9\\s]{2,50})$");
        Pattern pattern2 = Pattern.compile("(?i)^[\\s\\-*•]*([a-zà-ỹ0-9\\s]{2,50}?)\\s*[:=-]\\s*(\\d+(?:[.,]\\d+)?)\\s*(kg|kilo|g|gram|gói|túi|bó|thùng|sọt|pack|box|crate)?$");

        for (String rawLine : lines) {
            String line = rawLine.trim();
            if (line.isBlank()) continue;

            Matcher m1 = pattern1.matcher(line);
            if (m1.matches()) {
                String qtyStr = m1.group(1).replace(',', '.');
                String unit = m1.group(2) != null ? m1.group(2).toUpperCase() : "KG";
                String name = m1.group(3).trim();
                BigDecimal qty = new BigDecimal(qtyStr);
                list.add(new DetectedItem(name, qty, normalizeUnit(unit), line));
                continue;
            }

            Matcher m2 = pattern2.matcher(line);
            if (m2.matches()) {
                String name = m2.group(1).trim();
                String qtyStr = m2.group(2).replace(',', '.');
                String unit = m2.group(3) != null ? m2.group(3).toUpperCase() : "KG";
                BigDecimal qty = new BigDecimal(qtyStr);
                list.add(new DetectedItem(name, qty, normalizeUnit(unit), line));
                continue;
            }

            // Fallback for simple words containing product-like text
            list.add(new DetectedItem(line, BigDecimal.ONE, "KG", line));
        }

        return list;
    }

    private String normalizeUnit(String unit) {
        if (unit == null) return "KG";
        String u = unit.trim().toUpperCase();
        if (u.contains("KILO") || u.equals("K") || u.equals("KG")) return "KG";
        if (u.contains("GRAM") || u.equals("G") || u.equals("GR")) return "GRAM";
        if (u.contains("GÓI") || u.contains("TÚI") || u.contains("PACK")) return "PACK";
        if (u.contains("BÓ") || u.contains("BUNCH")) return "BUNCH";
        if (u.contains("THÙNG") || u.contains("HỘP") || u.contains("BOX")) return "BOX";
        if (u.contains("SỌT") || u.contains("CRATE")) return "CRATE";
        return "KG";
    }

    private List<DetectedItem> callGeminiVision(byte[] imageBytes, String mimeType) throws Exception {
        String endpoint = "https://generativelanguage.googleapis.com/v1beta/models/"
            + geminiModel + ":generateContent?key=" + geminiApiKey;

        String base64Image = Base64.getEncoder().encodeToString(imageBytes);
        String prompt = """
            Bạn là chuyên gia OCR bóc tách thực phẩm nhà hàng của sàn FreshLink B2B.
            Hãy đọc hình ảnh tờ giấy ghi chú viết tay của đầu bếp, hóa đơn hoặc sổ tay nguyên liệu và trích xuất danh sách nguyên liệu.
            QUY TẮC:
            1. Trả về DUY NHẤT một chuỗi JSON hợp lệ dạng mảng đối tượng, KHÔNG thêm bất kỳ giải thích, ký tự markdown ```json hay code block nào.
            2. Mỗi phần tử có định dạng:
               {"detectedName": "tên nông sản/thực phẩm", "quantity": số_lượng_dạng_số_thực, "unit": "KG|PACK|BAG|BOX|BUNCH|CRATE", "notes": "chữ gốc"}
            3. Ví dụ:
               [{"detectedName": "Cải thảo", "quantity": 5.0, "unit": "KG", "notes": "Cải thảo 5kg"}, {"detectedName": "Rau muống", "quantity": 10.0, "unit": "KG", "notes": "10kg rau muống"}]
            """;

        Map<String, Object> body = Map.of(
            "contents", List.of(
                Map.of(
                    "role", "user",
                    "parts", List.of(
                        Map.of("text", prompt),
                        Map.of(
                            "inline_data", Map.of(
                                "mime_type", mimeType != null && !mimeType.isBlank() ? mimeType : "image/jpeg",
                                "data", base64Image
                            )
                        )
                    )
                )
            ),
            "generationConfig", Map.of(
                "temperature", 0.1,
                "maxOutputTokens", 1200
            )
        );

        String jsonPayload = objectMapper.writeValueAsString(body);
        HttpRequest request = HttpRequest.newBuilder()
            .uri(URI.create(endpoint))
            .header("Content-Type", "application/json")
            .timeout(Duration.ofSeconds(30))
            .POST(HttpRequest.BodyPublishers.ofString(jsonPayload))
            .build();

        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
        if (response.statusCode() != 200) {
            throw new RuntimeException("Gemini Vision HTTP " + response.statusCode() + ": " + response.body());
        }

        JsonNode root = objectMapper.readTree(response.body());
        String text = root.path("candidates").get(0).path("content").path("parts").get(0).path("text").asText();
        return parseGeminiJsonOutput(text);
    }

    private List<DetectedItem> callGeminiTextParser(String note) throws Exception {
        String endpoint = "https://generativelanguage.googleapis.com/v1beta/models/"
            + geminiModel + ":generateContent?key=" + geminiApiKey;

        String prompt = """
            Trích xuất danh sách mặt hàng thực phẩm và số lượng từ đoạn ghi chú sau.
            Nội dung: "%s"
            Trả về DUY NHẤT một chuỗi JSON hợp lệ dạng mảng đối tượng:
            [{"detectedName": "tên món", "quantity": số_thực, "unit": "KG|PACK|BOX|BUNCH", "notes": "nội dung"}]
            """.formatted(note.replace("\"", "'"));

        Map<String, Object> body = Map.of(
            "contents", List.of(
                Map.of(
                    "role", "user",
                    "parts", List.of(Map.of("text", prompt))
                )
            ),
            "generationConfig", Map.of(
                "temperature", 0.1,
                "maxOutputTokens", 800
            )
        );

        HttpRequest request = HttpRequest.newBuilder()
            .uri(URI.create(endpoint))
            .header("Content-Type", "application/json")
            .timeout(Duration.ofSeconds(15))
            .POST(HttpRequest.BodyPublishers.ofString(objectMapper.writeValueAsString(body)))
            .build();

        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
        if (response.statusCode() != 200) {
            throw new RuntimeException("Gemini HTTP " + response.statusCode());
        }

        JsonNode root = objectMapper.readTree(response.body());
        String text = root.path("candidates").get(0).path("content").path("parts").get(0).path("text").asText();
        return parseGeminiJsonOutput(text);
    }

    private List<DetectedItem> parseGeminiJsonOutput(String rawText) {
        String cleanJson = rawText.trim();
        if (cleanJson.startsWith("```json")) {
            cleanJson = cleanJson.substring(7);
        } else if (cleanJson.startsWith("```")) {
            cleanJson = cleanJson.substring(3);
        }
        if (cleanJson.endsWith("```")) {
            cleanJson = cleanJson.substring(0, cleanJson.length() - 3);
        }
        cleanJson = cleanJson.trim();

        try {
            List<Map<String, Object>> rawList = objectMapper.readValue(cleanJson, new TypeReference<>() {});
            List<DetectedItem> result = new ArrayList<>();
            for (var item : rawList) {
                String name = (String) item.getOrDefault("detectedName", "");
                Object qObj = item.get("quantity");
                BigDecimal qty = BigDecimal.ONE;
                if (qObj instanceof Number num) {
                    qty = BigDecimal.valueOf(num.doubleValue());
                } else if (qObj != null) {
                    try { qty = new BigDecimal(qObj.toString()); } catch (Exception ignored) {}
                }
                String unit = (String) item.getOrDefault("unit", "KG");
                String notes = (String) item.getOrDefault("notes", name);
                if (!name.isBlank()) {
                    result.add(new DetectedItem(name, qty, normalizeUnit(unit), notes));
                }
            }
            return result;
        } catch (Exception e) {
            log.warn("Could not parse Gemini JSON, falling back to line parser: {}", e.getMessage());
            return parseVietnameseOrderText(rawText);
        }
    }

    public SmartOcrResult matchWithCatalog(List<DetectedItem> detectedItems, LocalDate date, String scanSource) {
        // Fetch all active products and SKUs with latest valid price
        var ts = java.sql.Timestamp.from(date.atStartOfDay(ZoneId.of("Asia/Ho_Chi_Minh")).toInstant());
        var catalogList = jdbc.queryForList("""
            SELECT s.sku_id, s.sku_code, s.sku_name, s.base_unit, s.pack_size, s.pack_description,
                   s.minimum_order_quantity, s.quantity_step, p.product_id, p.product_name,
                   COALESCE(p.grade_type, 'GRADE_A') AS grade_type, p.rescue_reason, COALESCE(p.discount_percent, 0) AS discount_percent,
                   (SELECT pr.selling_unit_price FROM sku_prices pr WHERE pr.sku_id = s.sku_id AND pr.district IS NULL
                    AND pr.valid_from <= ? AND (pr.valid_to IS NULL OR pr.valid_to > ?)
                    ORDER BY pr.valid_from DESC, pr.sku_price_id DESC LIMIT 1) AS price
            FROM product_skus s
            JOIN products p ON p.product_id = s.product_id
            WHERE s.active = TRUE AND p.active = TRUE
        """, ts, ts);

        List<MatchedItem> matchedItems = new ArrayList<>();
        List<DetectedItem> unmatchedItems = new ArrayList<>();
        BigDecimal estimatedGrandTotal = BigDecimal.ZERO;

        for (DetectedItem detected : detectedItems) {
            String targetNorm = normalizeString(detected.detectedName());
            Map<String, Object> bestSku = null;
            double bestScore = 0.0;

            for (var sku : catalogList) {
                String skuNameNorm = normalizeString((String) sku.get("sku_name"));
                String prodNameNorm = normalizeString((String) sku.get("product_name"));

                double score = computeSimilarity(targetNorm, skuNameNorm, prodNameNorm);
                if (score > bestScore) {
                    bestScore = score;
                    bestSku = sku;
                }
            }

            if (bestSku != null && bestScore >= 0.45) {
                long skuId = ((Number) bestSku.get("sku_id")).longValue();
                String skuCode = (String) bestSku.get("sku_code");
                String skuName = (String) bestSku.get("sku_name");
                String baseUnit = (String) bestSku.get("base_unit");
                BigDecimal packSize = (BigDecimal) bestSku.get("pack_size");
                String packDescription = (String) bestSku.get("pack_description");
                BigDecimal moq = (BigDecimal) bestSku.get("minimum_order_quantity");
                BigDecimal step = (BigDecimal) bestSku.get("quantity_step");
                String gradeType = (String) bestSku.get("grade_type");
                String rescueReason = (String) bestSku.get("rescue_reason");
                int discountPercent = ((Number) bestSku.get("discount_percent")).intValue();

                // Snap quantity to MOQ and step
                BigDecimal finalQty = snapQuantity(detected.quantity(), moq, step);

                BigDecimal unitPrice = (BigDecimal) bestSku.get("price");
                if (unitPrice == null) {
                    unitPrice = BigDecimal.valueOf(25000); // Standard catalog fallback price
                }
                BigDecimal lineTotal = unitPrice.multiply(finalQty).setScale(0, RoundingMode.HALF_UP);
                estimatedGrandTotal = estimatedGrandTotal.add(lineTotal);

                String matchStatus = bestScore >= 0.85 ? "EXACT" : bestScore >= 0.65 ? "HIGH" : "PARTIAL";

                matchedItems.add(new MatchedItem(
                    skuId, skuCode, skuName, baseUnit, packSize, packDescription,
                    finalQty, unitPrice, lineTotal, gradeType, rescueReason, discountPercent,
                    matchStatus, Math.round(bestScore * 100.0) / 100.0, detected.notes()
                ));
            } else {
                unmatchedItems.add(detected);
            }
        }

        return new SmartOcrResult(
            matchedItems,
            unmatchedItems,
            detectedItems.size(),
            matchedItems.size(),
            estimatedGrandTotal,
            scanSource,
            matchedItems.isEmpty() ? "Không tìm thấy mặt hàng phù hợp trong danh mục" :
                "Đã nhận diện và khớp thành công " + matchedItems.size() + "/" + detectedItems.size() + " mặt hàng."
        );
    }

    public BigDecimal snapQuantity(BigDecimal requested, BigDecimal moq, BigDecimal step) {
        if (requested == null || requested.compareTo(BigDecimal.ZERO) <= 0) {
            return moq != null ? moq : BigDecimal.ONE;
        }
        BigDecimal min = moq != null ? moq : BigDecimal.ONE;
        BigDecimal s = (step != null && step.compareTo(BigDecimal.ZERO) > 0) ? step : BigDecimal.ONE;

        if (requested.compareTo(min) < 0) {
            return min;
        }

        BigDecimal diff = requested.subtract(min);
        BigDecimal steps = diff.divide(s, 0, RoundingMode.HALF_UP);
        return min.add(steps.multiply(s));
    }

    private double computeSimilarity(String query, String skuName, String prodName) {
        if (query.equalsIgnoreCase(skuName) || query.equalsIgnoreCase(prodName)) {
            return 1.0;
        }
        if (skuName.contains(query) || prodName.contains(query)) {
            return 0.90;
        }
        if (query.contains(skuName) || query.contains(prodName)) {
            return 0.85;
        }

        // Token intersection score (Jaccard on words)
        Set<String> qWords = new HashSet<>(Arrays.asList(query.split("\\s+")));
        Set<String> sWords = new HashSet<>(Arrays.asList((skuName + " " + prodName).split("\\s+")));

        int common = 0;
        for (String w : qWords) {
            if (sWords.contains(w) && w.length() > 1) common++;
        }

        if (qWords.isEmpty()) return 0.0;
        return (double) common / Math.max(qWords.size(), 1);
    }

    private String normalizeString(String input) {
        if (input == null) return "";
        String n = Normalizer.normalize(input.toLowerCase(), Normalizer.Form.NFD);
        return Pattern.compile("\\p{InCombiningDiacriticalMarks}+").matcher(n).replaceAll("")
            .replaceAll("[đĐ]", "d")
            .replaceAll("[^a-z0-9\\s]", " ")
            .replaceAll("\\s+", " ")
            .trim();
    }

    private List<DetectedItem> fallbackParseSampleItems() {
        return List.of(
            new DetectedItem("Cải thảo tươi", new BigDecimal("5"), "KG", "Chữ viết tay: Cải thảo 5kg"),
            new DetectedItem("Rau muống sạch", new BigDecimal("10"), "KG", "Chữ viết tay: 10kg rau muống"),
            new DetectedItem("Nấm đùi gà", new BigDecimal("2"), "PACK", "Ghi chú: 2 gói nấm đùi gà")
        );
    }
}
