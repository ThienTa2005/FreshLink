package vn.freshlink.chat;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import vn.freshlink.identity.Actor;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class ChatControllerTest {

    private final ObjectMapper objectMapper = new ObjectMapper();
    private final ChatController controller = new ChatController("", "gemini-2.5-flash", objectMapper);

    @Test
    void guestChatReturnsFriendlyHelpAndHotline() {
        var req = new ChatController.ChatRequest("Làm sao để liên hệ FreshLink?", List.of());
        var res = controller.chat(null, req);

        assertTrue(res.success());
        assertNotNull(res.data());
        assertEquals("Khách vãng lai / Khách hàng tiềm năng", res.data().role());
        assertTrue(res.data().reply().contains("0123456789"));
        assertFalse(res.data().suggestions().isEmpty());
    }

    @Test
    void restaurantChatReturnsScopedGuidance() {
        var membership = new Actor.Membership(12, "Nhà hàng Hải Đăng", "RESTAURANT", List.of("RESTAURANT_MANAGER"));
        var actor = new Actor(5, "chef@haidang.vn", "Bếp Trưởng", List.of(membership));

        var req = new ChatController.ChatRequest("Giờ chốt đơn hàng ngày là mấy giờ?", List.of());
        var res = controller.chat(actor, req);

        assertTrue(res.success());
        assertTrue(res.data().role().contains("Nhà hàng"));
        assertTrue(res.data().reply().contains("17:00"));
    }

    @Test
    void supplierChatReturnsQualityGateInfo() {
        var membership = new Actor.Membership(9, "HTX Nông nghiệp Đà Lạt", "SUPPLIER", List.of("SUPPLIER_MANAGER"));
        var actor = new Actor(8, "dalat@gap.vn", "HTX Đà Lạt", List.of(membership));

        var req = new ChatController.ChatRequest("Tiêu chuẩn kiểm nhận QC tại Gate là gì?", List.of());
        var res = controller.chat(actor, req);

        assertTrue(res.success());
        assertTrue(res.data().role().contains("Hợp tác xã"));
        assertTrue(res.data().reply().contains("Gate") || res.data().reply().contains("+2°C ~ +6°C"));
    }

    @Test
    void driverChatReturnsColdChainTemperatureStandard() {
        var membership = new Actor.Membership(1, "FreshLink Ops", "FRESHLINK", List.of("DRIVER"));
        var actor = new Actor(15, "driver@freshlink.vn", "Tài xế Nguyễn Văn A", List.of(membership));

        var req = new ChatController.ChatRequest("Nhiệt độ thùng xe lạnh bao nhiêu là đạt?", List.of());
        var res = controller.chat(actor, req);

        assertTrue(res.success());
        assertTrue(res.data().role().contains("Tài xế"));
        assertTrue(res.data().reply().contains("+2°C đến +6°C"), () -> "Actual reply was: " + res.data().reply());
    }
}
