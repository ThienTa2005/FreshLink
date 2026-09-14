package vn.freshlink.ocr;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;

import java.math.BigDecimal;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.mock;

class SmartOcrTest {

    private SmartOcrService ocrService;

    @BeforeEach
    void setUp() {
        JdbcTemplate mockJdbc = mock(JdbcTemplate.class);
        ObjectMapper objectMapper = new ObjectMapper();
        ocrService = new SmartOcrService(mockJdbc, objectMapper, "", "gemini-2.5-flash");
    }

    @Test
    void testVietnameseNoteParsingRegex() {
        String chefNote = """
            5kg cải thảo
            10 bó rau muống
            Hành lá: 3kg
            Nấm đùi gà - 2 gói
            Ớt sừng: 500 gram
            15kg dưa hấu giải cứu
            """;

        List<SmartOcrService.DetectedItem> items = ocrService.parseVietnameseOrderText(chefNote);

        assertNotNull(items);
        assertEquals(6, items.size());

        // 1. 5kg cải thảo
        assertEquals("cải thảo", items.get(0).detectedName());
        assertEquals(new BigDecimal("5"), items.get(0).quantity());
        assertEquals("KG", items.get(0).unit());

        // 2. 10 bó rau muống
        assertEquals("rau muống", items.get(1).detectedName());
        assertEquals(new BigDecimal("10"), items.get(1).quantity());
        assertEquals("BUNCH", items.get(1).unit());

        // 3. Hành lá: 3kg
        assertEquals("Hành lá", items.get(2).detectedName());
        assertEquals(new BigDecimal("3"), items.get(2).quantity());
        assertEquals("KG", items.get(2).unit());

        // 4. Nấm đùi gà - 2 gói
        assertEquals("Nấm đùi gà", items.get(3).detectedName());
        assertEquals(new BigDecimal("2"), items.get(3).quantity());
        assertEquals("PACK", items.get(3).unit());

        // 5. Ớt sừng: 500 gram
        assertEquals("Ớt sừng", items.get(4).detectedName());
        assertEquals(new BigDecimal("500"), items.get(4).quantity());
        assertEquals("GRAM", items.get(4).unit());

        // 6. 15kg dưa hấu giải cứu (Rescue produce)
        assertEquals("dưa hấu giải cứu", items.get(5).detectedName());
        assertEquals(new BigDecimal("15"), items.get(5).quantity());
        assertEquals("KG", items.get(5).unit());
    }

    @Test
    void testSnapQuantityToMoqAndStep() {
        // Below MOQ: requested 0.5kg when MOQ is 2kg -> snaps to 2kg
        BigDecimal snapped1 = ocrService.snapQuantity(new BigDecimal("0.5"), new BigDecimal("2.0"), new BigDecimal("0.5"));
        assertEquals(0, new BigDecimal("2.0").compareTo(snapped1));

        // Exactly matches MOQ: requested 5kg with MOQ 5kg, step 2.5kg -> 5kg
        BigDecimal snapped2 = ocrService.snapQuantity(new BigDecimal("5.0"), new BigDecimal("5.0"), new BigDecimal("2.5"));
        assertEquals(0, new BigDecimal("5.0").compareTo(snapped2));

        // Snaps to nearest step: requested 6.8kg with MOQ 5kg, step 2kg -> diff 1.8 / 2 = 0.9 -> 1 step -> 5 + 2 = 7kg
        BigDecimal snapped3 = ocrService.snapQuantity(new BigDecimal("6.8"), new BigDecimal("5.0"), new BigDecimal("2.0"));
        assertEquals(0, new BigDecimal("7.0").compareTo(snapped3));
    }

    @Test
    void testGradeBRescueProduceCalculations() {
        // Test price discount formula for Grade B Imperfect Produce
        BigDecimal originalPrice = new BigDecimal("30000"); // 30,000 VND / kg
        int discountPercent = 35; // 35% discount for imperfect cosmetics

        BigDecimal discountAmount = originalPrice.multiply(BigDecimal.valueOf(discountPercent))
            .divide(BigDecimal.valueOf(100), 0, java.math.RoundingMode.HALF_UP);
        BigDecimal rescuePrice = originalPrice.subtract(discountAmount);

        assertEquals(new BigDecimal("10500"), discountAmount);
        assertEquals(new BigDecimal("19500"), rescuePrice);

        // Restaurant buying 20kg of Grade B saves:
        BigDecimal restaurantSavings = discountAmount.multiply(new BigDecimal("20"));
        assertEquals(new BigDecimal("210000"), restaurantSavings);
    }
}
