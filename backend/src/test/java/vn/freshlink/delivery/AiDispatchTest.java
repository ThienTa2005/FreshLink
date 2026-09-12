package vn.freshlink.delivery;

import org.junit.jupiter.api.Test;

import java.math.BigDecimal;

import static org.junit.jupiter.api.Assertions.*;

class AiDispatchTest {

    @Test
    void testGeoUtilsDistance() {
        // Dong Anh (21.1458, 105.8452) to Hoang Mai (20.9782, 105.8546)
        double dist = GeoUtils.distanceKm(21.1458, 105.8452, 20.9782, 105.8546);
        assertTrue(dist > 15.0 && dist < 25.0, "Distance between Dong Anh and Hoang Mai should be around 18-22 km, got: " + dist);

        // Same point distance must be 0
        assertEquals(0.0, GeoUtils.distanceKm(21.0, 105.0, 21.0, 105.0), 0.001);
    }

    @Test
    void testGeoUtilsStripAccents() {
        assertEquals("cau giay", GeoUtils.stripAccents("Cầu Giấy"));
        assertEquals("dong da", GeoUtils.stripAccents("Đống Đa"));
        assertEquals("hai ba trung", GeoUtils.stripAccents("Hai Bà Trưng"));
        assertEquals("ha noi", GeoUtils.stripAccents("Hà Nội"));
    }

    @Test
    void testGeoUtilsResolveCoordinates() {
        // Provided coordinates should be preserved
        double[] direct = GeoUtils.resolveCoordinates(BigDecimal.valueOf(21.05), BigDecimal.valueOf(105.80), "Phường Dịch Vọng", "Cầu Giấy", "Hà Nội", 1);
        assertEquals(21.05, direct[0], 0.0001);
        assertEquals(105.80, direct[1], 0.0001);

        // Null coordinates should fallback to district
        double[] fallback = GeoUtils.resolveCoordinates(null, null, "Phường Dịch Vọng", "Quận Cầu Giấy", "Hà Nội", 3);
        assertNotNull(fallback);
        assertTrue(fallback[0] > 21.0 && fallback[0] < 21.1);
        assertTrue(fallback[1] > 105.7 && fallback[1] < 105.9);
    }
}
