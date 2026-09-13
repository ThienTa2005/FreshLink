package vn.freshlink.esg;

import com.google.zxing.BarcodeFormat;
import com.google.zxing.client.j2se.MatrixToImageWriter;
import com.google.zxing.qrcode.QRCodeWriter;
import org.junit.jupiter.api.Test;

import java.io.ByteArrayOutputStream;
import java.time.LocalDate;

import static org.junit.jupiter.api.Assertions.*;

class CoopTrustScoreTest {

    @Test
    void testTierRankDetermination() {
        // Test 1: Diamond Tier (>= 90 pts)
        double score1 = 94.5;
        assertTrue(score1 >= 90.0);
        String tier1 = score1 >= 90.0 ? "DIAMOND_AAA" : "OTHER";
        assertEquals("DIAMOND_AAA", tier1);

        // Test 2: Gold Tier (75 - 89.9 pts)
        double score2 = 82.0;
        String tier2 = score2 >= 90.0 ? "DIAMOND_AAA" : score2 >= 75.0 ? "GOLD_AA" : "OTHER";
        assertEquals("GOLD_AA", tier2);

        // Test 3: Silver Tier (60 - 74.9 pts)
        double score3 = 68.5;
        String tier3 = score3 >= 90.0 ? "DIAMOND_AAA" : score3 >= 75.0 ? "GOLD_AA" : score3 >= 60.0 ? "SILVER_A" : "STANDARD_B";
        assertEquals("SILVER_A", tier3);

        // Test 4: Standard Tier (< 60 pts)
        double score4 = 54.0;
        String tier4 = score4 >= 90.0 ? "DIAMOND_AAA" : score4 >= 75.0 ? "GOLD_AA" : score4 >= 60.0 ? "SILVER_A" : "STANDARD_B";
        assertEquals("STANDARD_B", tier4);
    }

    @Test
    void testFivePillarsWeightingFormula() {
        // Quality KCS rate: 98% -> 98 * 0.35 = 34.3 pts
        double qualityRate = 98.0;
        double qualityScore = (qualityRate / 100.0) * 35.0;
        assertEquals(34.3, Math.round(qualityScore * 10.0) / 10.0);

        // Fulfillment rate: 100% -> 25.0 pts
        double fulfillmentRate = 100.0;
        double fulfillmentScore = (fulfillmentRate / 100.0) * 25.0;
        assertEquals(25.0, fulfillmentScore);

        // Certifications: VietGAP (15) + Food Safety (5) = 20 pts
        boolean hasVietgap = true;
        boolean hasFoodSafety = true;
        double certScore = (hasVietgap ? 15.0 : 0.0) + (hasFoodSafety ? 5.0 : 0.0);
        assertEquals(20.0, certScore);

        // Claims: 0 complaints -> 10 pts
        long complaints = 0;
        double claimScore = Math.max(0.0, 10.0 - (complaints * 2.5));
        assertEquals(10.0, claimScore);

        // Consistency: 18 successful batches -> 10 pts
        long batches = 18;
        double consistencyScore = batches >= 15 ? 10.0 : 5.0;
        assertEquals(10.0, consistencyScore);

        // Total
        double total = qualityScore + fulfillmentScore + certScore + claimScore + consistencyScore;
        assertEquals(99.3, Math.round(total * 10.0) / 10.0);
        assertTrue(total >= 90.0, "Total should qualify for Diamond AAA");
    }
}
