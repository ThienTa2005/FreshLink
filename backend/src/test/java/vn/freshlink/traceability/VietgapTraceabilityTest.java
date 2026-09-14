package vn.freshlink.traceability;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.google.zxing.BarcodeFormat;
import com.google.zxing.client.j2se.MatrixToImageWriter;
import com.google.zxing.qrcode.QRCodeWriter;
import org.junit.jupiter.api.Test;

import java.io.ByteArrayOutputStream;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class VietgapTraceabilityTest {

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Test
    void testDynamicQrUrlGenerationAndZxingEncoding() throws Exception {
        String frontendUrl = "https://freshlink.vn";
        String batchCode = "LO-20260913-001";
        String qrUrl = frontendUrl.replaceAll("/$", "") + "/trace/" + batchCode;

        assertEquals("https://freshlink.vn/trace/LO-20260913-001", qrUrl);

        // Verify ZXing creates QR code matrix
        var image = new QRCodeWriter().encode(qrUrl, BarcodeFormat.QR_CODE, 320, 320);
        assertNotNull(image);
        assertEquals(320, image.getWidth());
        assertEquals(320, image.getHeight());

        var bytes = new ByteArrayOutputStream();
        MatrixToImageWriter.writeToStream(image, "PNG", bytes);
        assertTrue(bytes.size() > 0, "QR PNG stream should contain encoded image data");
    }

    @Test
    void testCultivationDiarySerializationAndParsing() throws Exception {
        var diary = List.of(
            Map.of("date", "2026-08-10", "stage", "Làm đất", "activity", "Bón vôi khử trùng", "materials", "Vôi bột 50kg/sào"),
            Map.of("date", "2026-08-15", "stage", "Xuống giống", "activity", "Xuống bầu F1", "materials", "Hạt giống F1"),
            Map.of("date", "2026-08-28", "stage", "Phun BVTV", "activity", "Phun thảo mộc", "materials", "Chế phẩm tỏi ớt", "phiDays", 7),
            Map.of("date", "2026-09-12", "stage", "Thu hoạch", "activity", "Thu hoạch sớm", "materials", "Sọt SmartCrate")
        );

        String json = objectMapper.writeValueAsString(diary);
        assertNotNull(json);
        assertTrue(json.contains("Làm đất"));
        assertTrue(json.contains("phiDays"));

        // Parse back
        List<?> parsed = objectMapper.readValue(json, List.class);
        assertEquals(4, parsed.size());

        @SuppressWarnings("unchecked")
        Map<String, Object> thirdEvent = (Map<String, Object>) parsed.get(2);
        assertEquals("Phun BVTV", thirdEvent.get("stage"));
        assertEquals(7, ((Number) thirdEvent.get("phiDays")).intValue());
    }

    @Test
    void testVietgapDocumentRecordAndFields() {
        vn.freshlink.sourcing.PassportController.Document doc = new vn.freshlink.sourcing.PassportController.Document(
            10L, 25L, "VIETGAP", "VietGAP-TT-12-04-26-0001",
            LocalDate.of(2026, 1, 15), LocalDate.of(2028, 1, 15),
            "TQC CGLOBAL", "Rau ăn lá, rau củ quả an toàn"
        );

        assertEquals(10L, doc.supplierId());
        assertEquals("VIETGAP", doc.type());
        assertEquals("VietGAP-TT-12-04-26-0001", doc.number());
        assertEquals("TQC CGLOBAL", doc.certifyingBody());
        assertEquals("Rau ăn lá, rau củ quả an toàn", doc.scope());
        assertEquals(LocalDate.of(2028, 1, 15), doc.expiryDate());
    }

    @Test
    void testQualityBatchRecordCompatibility() {
        java.math.BigDecimal qty = new java.math.BigDecimal("150.000");

        // Old 3-parameter constructor
        vn.freshlink.quality.QualityService.Batch oldBatch = new vn.freshlink.quality.QualityService.Batch(1L, qty, "Nông trại Ba Vì");
        assertEquals(1L, oldBatch.requestItemId());
        assertEquals(qty, oldBatch.quantity());
        assertNull(oldBatch.varietyName());
        assertNull(oldBatch.plantingDate());
        assertNull(oldBatch.cultivationDiary());

        // New VietGAP 7-parameter constructor
        vn.freshlink.quality.QualityService.Batch newBatch = new vn.freshlink.quality.QualityService.Batch(
            1L, qty, "Nông trường Mộc Châu", "Cải thảo F1 Nhật Bản",
            LocalDate.of(2026, 8, 10), "Xưởng đóng gói Ba Vì", "[{\"stage\":\"Làm đất\"}]"
        );
        assertEquals("Cải thảo F1 Nhật Bản", newBatch.varietyName());
        assertEquals(LocalDate.of(2026, 8, 10), newBatch.plantingDate());
        assertEquals("Xưởng đóng gói Ba Vì", newBatch.packagingFacility());
        assertNotNull(newBatch.cultivationDiary());
    }

    @Test
    void testTraceCodeStrippingAndNormalization() {
        String rawWithPrefix = "LO-350984c1-39a5-4470-9c90-1c705b002ac3";
        String clean = rawWithPrefix.trim();
        String withoutLo = (clean.startsWith("LO-") || clean.startsWith("lo-")) ? clean.substring(3) : clean;
        String withLo = (clean.startsWith("LO-") || clean.startsWith("lo-")) ? clean : "LO-" + clean;

        assertEquals("350984c1-39a5-4470-9c90-1c705b002ac3", withoutLo);
        assertEquals("LO-350984c1-39a5-4470-9c90-1c705b002ac3", withLo);

        // Test without prefix
        String rawUuid = "350984c1-39a5-4470-9c90-1c705b002ac3";
        String withoutLo2 = (rawUuid.startsWith("LO-") || rawUuid.startsWith("lo-")) ? rawUuid.substring(3) : rawUuid;
        String withLo2 = (rawUuid.startsWith("LO-") || rawUuid.startsWith("lo-")) ? rawUuid : "LO-" + rawUuid;
        assertEquals("350984c1-39a5-4470-9c90-1c705b002ac3", withoutLo2);
        assertEquals("LO-350984c1-39a5-4470-9c90-1c705b002ac3", withLo2);
    }
}
