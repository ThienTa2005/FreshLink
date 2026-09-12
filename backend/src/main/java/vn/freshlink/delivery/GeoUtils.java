package vn.freshlink.delivery;

import java.math.BigDecimal;
import java.text.Normalizer;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Pattern;

public final class GeoUtils {

    private GeoUtils() {}

    private static final Pattern DIACRITICS = Pattern.compile("\\p{InCombiningDiacriticalMarks}+");

    public static String stripAccents(String s) {
        if (s == null) return "";
        String normalized = Normalizer.normalize(s, Normalizer.Form.NFD);
        return DIACRITICS.matcher(normalized).replaceAll("").replace('đ', 'd').replace('Đ', 'D').toLowerCase(Locale.ROOT).trim();
    }

    // Default coordinates for districts in Hanoi and key regions
    private static final Map<String, double[]> DISTRICT_COORDS = Map.ofEntries(
        Map.entry("dong anh", new double[]{21.1458, 105.8452}),
        Map.entry("hoang mai", new double[]{20.9782, 105.8546}),
        Map.entry("cau giay", new double[]{21.0362, 105.7906}),
        Map.entry("ba dinh", new double[]{21.0341, 105.8242}),
        Map.entry("hoan kiem", new double[]{21.0285, 105.8542}),
        Map.entry("dong da", new double[]{21.0181, 105.8275}),
        Map.entry("hai ba trung", new double[]{21.0069, 105.8542}),
        Map.entry("tay ho", new double[]{21.0664, 105.8222}),
        Map.entry("thanh xuan", new double[]{20.9937, 105.8083}),
        Map.entry("ha dong", new double[]{20.9668, 105.7666}),
        Map.entry("long bien", new double[]{21.0428, 105.8856}),
        Map.entry("nam tu liem", new double[]{21.0152, 105.7675}),
        Map.entry("bac tu liem", new double[]{21.0617, 105.7578}),
        Map.entry("gia lam", new double[]{21.0189, 105.9404}),
        Map.entry("thanh tri", new double[]{20.9482, 105.8398}),
        Map.entry("soc son", new double[]{21.2725, 105.8517}),
        Map.entry("me linh", new double[]{21.1783, 105.7197}),
        Map.entry("moc chau", new double[]{20.8436, 104.6642}),
        Map.entry("son la", new double[]{21.3283, 103.9148}),
        Map.entry("da lat", new double[]{11.9404, 108.4182}),
        Map.entry("lam dong", new double[]{11.6667, 107.8333}),
        Map.entry("cu chi", new double[]{10.9632, 106.5298}),
        Map.entry("thu duc", new double[]{10.8494, 106.7725}),
        Map.entry("quan 1", new double[]{10.7769, 106.7009}),
        Map.entry("quan 3", new double[]{10.7844, 106.6843}),
        Map.entry("quan 7", new double[]{10.7340, 106.7219}),
        Map.entry("binh thanh", new double[]{10.8016, 106.6984})
    );

    /**
     * Compute Haversine distance in kilometers between two GPS points.
     */
    public static double distanceKm(double lat1, double lon1, double lat2, double lon2) {
        double dLat = Math.toRadians(lat2 - lat1);
        double dLon = Math.toRadians(lon2 - lon1);
        double a = Math.sin(dLat / 2) * Math.sin(dLat / 2)
                 + Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2))
                 * Math.sin(dLon / 2) * Math.sin(dLon / 2);
        double c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return 6371.0 * c;
    }

    /**
     * Resolves valid GPS coordinates from provided latitude/longitude or fallbacks to district/city.
     */
    public static double[] resolveCoordinates(BigDecimal lat, BigDecimal lon, String ward, String district, String city, int seed) {
        if (lat != null && lon != null && lat.doubleValue() != 0.0 && lon.doubleValue() != 0.0) {
            return new double[]{lat.doubleValue(), lon.doubleValue()};
        }

        String dClean = stripAccents(district);
        for (var entry : DISTRICT_COORDS.entrySet()) {
            if (!entry.getKey().isEmpty() && dClean.contains(entry.getKey())) {
                double jitter = ((seed % 7) - 3) * 0.005;
                return new double[]{entry.getValue()[0] + jitter, entry.getValue()[1] + jitter};
            }
        }

        String cClean = stripAccents(city);
        if (cClean.contains("ho chi minh") || cClean.contains("hcm")) {
            return new double[]{10.7769 + ((seed % 5) * 0.008), 106.7009 + ((seed % 5) * 0.008)};
        }

        // Default to central Hanoi
        return new double[]{21.0285 + ((seed % 5) * 0.007), 105.8542 + ((seed % 5) * 0.007)};
    }
}
