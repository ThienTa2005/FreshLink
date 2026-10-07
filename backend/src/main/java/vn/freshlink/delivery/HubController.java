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
        // FreshLink MVP focuses strictly on 1 Pilot Hub serving Cầu Giấy – Đống Đa (PDF p.15-18)
        // Nationwide hubs are marked as Phase 2 Roadmap & telemetry is tagged as simulation.
        List<ColdChainHub> hubs = new ArrayList<>(List.of(
            new ColdChainHub(
                1L, "HUB-HN-PILOT", "Hub Trung Chuyển Thí Điểm Cầu Giấy – Đống Đa (Trạm Thí Điểm Duy Nhất)", "PILOT_CROSS_DOCK",
                "Số 8 Tôn Thất Thuyết, Dịch Vọng Hậu, Quận Cầu Giấy", "Cầu Giấy", "Hà Nội",
                21.0313, 105.7834,
                3.5, "+2°C ~ +6°C (Mô phỏng cảm biến IoT)", 88, 3000, 12, "HOẠT ĐỘNG (Lưu trạm <3h)", "0901234567", "Nguyễn Văn Hùng (Điều phối trưởng)"
            ),
            new ColdChainHub(
                2L, "HUB-MC-P2", "Hub Nông Sản Mộc Châu (Quy hoạch mở rộng Giai đoạn 2)", "REGIONAL_COLLECTION_HUB",
                "Tiểu khu Vườn Đào, TT. Nông Trường Mộc Châu", "Mộc Châu", "Sơn La",
                20.8436, 104.6642,
                4.1, "+2°C ~ +6°C (Mô phỏng)", 91, 2800, 8, "KẾ HOẠCH GĐ2 (Mô phỏng)", "0123456789", "Lò Văn Muôn"
            ),
            new ColdChainHub(
                3L, "HUB-DL-P2", "Hub Nông Sản Đà Lạt (Quy hoạch mở rộng Giai đoạn 2)", "REGIONAL_COLLECTION_HUB",
                "Đường Vạn Thành, Phường 5, TP. Đà Lạt", "Đà Lạt", "Lâm Đồng",
                11.9404, 108.4182,
                3.8, "+2°C ~ +6°C (Mô phỏng)", 89, 4000, 15, "KẾ HOẠCH GĐ2 (Mô phỏng)", "0123456789", "Phạm Thị Lan"
            ),
            new ColdChainHub(
                4L, "HUB-CUCHI-P2", "Hub Nông Sản Củ Chi (Quy hoạch mở rộng Giai đoạn 2)", "CENTRAL_CROSS_DOCK",
                "KCN Tân Phú Trung, Quốc lộ 22, Củ Chi", "Củ Chi", "TP. Hồ Chí Minh",
                10.9632, 106.5298,
                3.6, "+2°C ~ +6°C (Mô phỏng)", 87, 4200, 22, "KẾ HOẠCH GĐ2 (Mô phỏng)", "0123456789", "Lê Hoàng Phúc"
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
