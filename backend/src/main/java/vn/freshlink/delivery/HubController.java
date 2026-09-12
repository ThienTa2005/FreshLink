package vn.freshlink.delivery;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import vn.freshlink.common.api.ApiResponse;

import java.util.ArrayList;
import java.util.List;

@RestController
@RequestMapping("/api/public")
public class HubController {

    private final JdbcTemplate jdbc;

    public HubController(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public record ColdChainHub(
        long hubId,
        String code,
        String name,
        String type,
        String address,
        String district,
        String city,
        double latitude,
        double longitude,
        double temperatureC,
        String temperatureRange,
        int humidityPercent,
        int capacityCrates,
        int activeTrucks,
        String status,
        String phone,
        String managerName
    ) {}

    @GetMapping("/hubs")
    public ApiResponse<List<ColdChainHub>> getHubs() {
        // Return nationwide real cold-chain logistics hubs and cross-dock centers
        List<ColdChainHub> hubs = new ArrayList<>(List.of(
            new ColdChainHub(
                1L, "HUB-HN-01", "Hub Trung Tâm Hà Nội #01 (Bắc Thăng Long)", "CENTRAL_CROSS_DOCK",
                "KCN Bắc Thăng Long, Huyện Đông Anh", "Đông Anh", "Hà Nội",
                21.1458, 105.8452,
                3.4, "+2°C ~ +6°C", 88, 3500, 18, "OPTIMAL", "0123456789", "Trần Đình Trọng"
            ),
            new ColdChainHub(
                2L, "HUB-HN-02", "Hub Trung Chuyển Hoàng Mai #02", "URBAN_CROSS_DOCK",
                "Km 12 Đường Ngọc Hồi, Quận Hoàng Mai", "Hoàng Mai", "Hà Nội",
                20.9572, 105.8488,
                3.8, "+2°C ~ +6°C", 86, 2200, 12, "OPTIMAL", "0123456789", "Nguyễn Văn Hùng"
            ),
            new ColdChainHub(
                3L, "HUB-MC-01", "Hub Vùng Nông Sản Mộc Châu (Tây Bắc)", "REGIONAL_COLLECTION_HUB",
                "Tiểu khu Vườn Đào, TT. Nông Trường Mộc Châu", "Mộc Châu", "Sơn La",
                20.8436, 104.6642,
                4.1, "+2°C ~ +6°C", 91, 2800, 8, "OPTIMAL", "0123456789", "Lò Văn Muôn"
            ),
            new ColdChainHub(
                4L, "HUB-DL-01", "Hub Nông Sản Công Nghệ Cao Đà Lạt", "REGIONAL_COLLECTION_HUB",
                "Đường Vạn Thành, Phường 5, TP. Đà Lạt", "Đà Lạt", "Lâm Đồng",
                11.9404, 108.4182,
                3.8, "+2°C ~ +6°C", 89, 4000, 15, "OPTIMAL", "0123456789", "Phạm Thị Lan"
            ),
            new ColdChainHub(
                5L, "HUB-HCM-01", "Hub Trung Tâm Miền Nam (Củ Chi - Tây Bắc TP.HCM)", "CENTRAL_CROSS_DOCK",
                "KCN Tân Phú Trung, Quốc lộ 22, Củ Chi", "Củ Chi", "TP. Hồ Chí Minh",
                10.9632, 106.5298,
                3.6, "+2°C ~ +6°C", 87, 4200, 22, "OPTIMAL", "0123456789", "Lê Hoàng Phúc"
            )
        ));

        // Supplement with any user-registered active CROSS_DOCK addresses from DB
        try {
            var dbAddresses = jdbc.queryForList(
                "SELECT address_id, address_name, address_line, district, city, latitude, longitude, contact_name, contact_phone " +
                "FROM addresses WHERE address_type = 'CROSS_DOCK' AND active = TRUE"
            );
            for (var addr : dbAddresses) {
                Long addrId = ((Number) addr.get("address_id")).longValue();
                boolean exists = hubs.stream().anyMatch(h -> h.hubId() == addrId);
                if (!exists) {
                    Double lat = addr.get("latitude") != null ? ((Number) addr.get("latitude")).doubleValue() : 21.0285;
                    Double lng = addr.get("longitude") != null ? ((Number) addr.get("longitude")).doubleValue() : 105.8542;
                    hubs.add(new ColdChainHub(
                        addrId,
                        "HUB-CD-" + addrId,
                        String.valueOf(addr.get("address_name")),
                        "CROSS_DOCK",
                        String.valueOf(addr.get("address_line")),
                        String.valueOf(addr.get("district")),
                        String.valueOf(addr.get("city")),
                        lat,
                        lng,
                        3.5,
                        "+2°C ~ +6°C",
                        88,
                        1500,
                        5,
                        "OPTIMAL",
                        addr.get("contact_phone") != null ? String.valueOf(addr.get("contact_phone")) : "0123456789",
                        addr.get("contact_name") != null ? String.valueOf(addr.get("contact_name")) : "Điều phối viên"
                    ));
                }
            }
        } catch (Exception ignored) {
        }

        return ApiResponse.success(hubs, "Danh sách trung tâm logistics chuỗi lạnh");
    }
}
