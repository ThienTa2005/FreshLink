package vn.freshlink.chat;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import vn.freshlink.common.api.ApiResponse;
import vn.freshlink.identity.Actor;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.*;

@RestController
@RequestMapping("/api/public/chat")
public class ChatController {

    private static final Logger log = LoggerFactory.getLogger(ChatController.class);

    private final String geminiApiKey;
    private final String geminiModel;
    private final ObjectMapper objectMapper;
    private final HttpClient httpClient;

    public ChatController(
        @Value("${app.gemini.api-key:}") String geminiApiKey,
        @Value("${app.gemini.model:gemini-2.5-flash}") String geminiModel,
        ObjectMapper objectMapper
    ) {
        this.geminiApiKey = geminiApiKey != null ? geminiApiKey.trim() : "";
        this.geminiModel = geminiModel != null && !geminiModel.isBlank() ? geminiModel.trim() : "gemini-2.5-flash";
        this.objectMapper = objectMapper;
        this.httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(10))
            .build();
    }

    public record ChatMessage(String role, String content) {}

    public record ChatRequest(
        String message,
        List<ChatMessage> history
    ) {}

    public record ChatResponse(
        String reply,
        String role,
        String organizationName,
        List<String> suggestions
    ) {}

    @PostMapping
    public ApiResponse<ChatResponse> chat(
        @AuthenticationPrincipal Actor actor,
        @RequestBody ChatRequest req
    ) {
        String userMessage = req.message() != null ? req.message().trim() : "";
        if (userMessage.isEmpty()) {
            throw new IllegalArgumentException("Tin nhắn không được để trống");
        }

        // 1. Determine User Role and Scoped Persona
        UserPersona persona = resolvePersona(actor);

        // 2. Call Google AI Studio Gemini API if configured, else use intelligent fallback
        String reply;
        if (!geminiApiKey.isEmpty()) {
            reply = callGeminiApi(persona, req);
        } else {
            reply = generateFallbackReply(persona, userMessage);
        }

        List<String> suggestions = getQuickSuggestions(persona.roleCode);

        return ApiResponse.success(new ChatResponse(reply, persona.roleName, persona.orgName, suggestions), "Trợ lý AI phản hồi");
    }

    private record UserPersona(
        String roleCode,
        String roleName,
        String orgName,
        String systemInstruction
    ) {}

    private UserPersona resolvePersona(Actor actor) {
        if (actor == null || actor.memberships().isEmpty()) {
            return new UserPersona(
                "GUEST",
                "Khách vãng lai / Khách hàng tiềm năng",
                "Chưa đăng nhập",
                """
                Bạn là Trợ lý AI FreshLink dành cho Khách vãng lai và Khách hàng tiềm năng.
                Hotline hỗ trợ CSKH: 0123456789. Kênh Zalo: 0123456789.
                PHẠM VI ĐƯỢC PHÉP TRẢ LỜI:
                - Giới thiệu tổng quan về giải pháp Logistics chuỗi lạnh B2B của FreshLink.
                - Quy trình tiếp nhận, bảo quản nông sản VietGAP nhiệt độ +2°C ~ +6°C.
                - Hướng dẫn đăng ký trở thành đối tác Nhà hàng / Khách hàng F&B hoặc Hợp tác xã / Nhà cung cấp.
                - Giờ chốt đơn chung của hệ thống (17:00 ngày hôm trước cho giao sáng hôm sau).
                - Chính sách chăm sóc khách hàng và hotline 0123456789.
                
                GIỚI HẠN BẢO MẬT NGHIÊM NGẶT:
                - BẠN TUYỆT ĐỐI KHÔNG ĐƯỢC trả lời hay tra cứu thông tin đơn hàng cụ thể, doanh thu, giá nhập sỉ nội bộ, thông tin người dùng hay dữ liệu mật của bất kỳ tổ chức nào.
                - Nếu người dùng hỏi các nội dung bảo mật ngoài phạm vi, bạn phải từ chối lịch sự và hướng dẫn họ đăng nhập hoặc liên hệ hotline CSKH 0123456789.
                - Phản hồi bằng tiếng Việt thân thiện, súc tích, chuyên nghiệp.
                """
            );
        }

        var mem = actor.memberships().get(0);
        String orgType = mem.organizationType() != null ? mem.organizationType() : "FRESHLINK";
        String orgName = mem.organizationName() != null ? mem.organizationName() : "FreshLink";
        List<String> roles = mem.roles() != null ? mem.roles() : List.of();

        if (orgType.equals("RESTAURANT")) {
            return new UserPersona(
                "RESTAURANT",
                "Nhà hàng / Khách hàng F&B (" + orgName + ")",
                orgName,
                """
                Bạn là Trợ lý AI FreshLink chuyên biệt dành cho Khách hàng Nhà hàng và Chuỗi F&B ({orgName}).
                Hotline hỗ trợ CSKH: 0123456789. Zalo: 0123456789.
                PHẠM VI HỖ TRỢ VÀ DỮ LIỆU ĐƯỢC PHÉP:
                - Hướng dẫn đặt hàng trên Portal: chọn ngày nhận, giờ nhận (06:00 - 08:00), lưu đơn nháp, quản lý đơn thường mua.
                - Giờ chốt đơn: 17:00 ngày hôm trước cho đơn ngày hôm sau.
                - Quy cách sản phẩm: theo sọt bảo ôn, hộp carton, đơn vị tính (KG, GRAM, BUNCH, BOX...).
                - Hướng dẫn tạo khiếu nại báo thiếu/hàng dập nát: phải báo trong vòng 4 giờ kể từ khi nhận hàng, đính kèm hình ảnh bằng chứng rõ nét.
                - Hướng dẫn thanh toán và theo dõi công nợ, hóa đơn điện tử tại mục 'Tài chính & Hóa đơn'.
                - Quản lý thùng luân chuyển SmartCrate đã nhận và cần trả lại tài xế.

                GIỚI HẠN BẢO MẬT & PHÂN QUYỀN TUYỆT ĐỐI:
                - KHÔNG ĐƯỢC tiết lộ giá mua đầu vào/giá gốc từ Hợp tác xã nông trại.
                - KHÔNG ĐƯỢC cung cấp dữ liệu đơn hàng, doanh thu, công nợ của các nhà hàng khác.
                - KHÔNG ĐƯỢC trả lời các câu hỏi về thông tin nội bộ hệ thống hoặc nhân sự không thuộc tổ chức của mình.
                - Từ chối lịch sự nếu người dùng cố gắng yêu cầu truy xuất dữ liệu ngoài quyền hạn và đề xuất liên hệ Hotline 0123456789.
                """.replace("{orgName}", orgName)
            );
        }

        if (orgType.equals("SUPPLIER")) {
            return new UserPersona(
                "SUPPLIER",
                "Hợp tác xã / Nhà cung cấp (" + orgName + ")",
                orgName,
                """
                Bạn là Trợ lý AI FreshLink chuyên biệt dành cho Hợp tác xã và Nhà cung cấp nông sản ({orgName}).
                Hotline hỗ trợ CSKH: 0123456789. Zalo: 0123456789.
                PHẠM VI HỖ TRỢ VÀ DỮ LIỆU ĐƯỢC PHÉP:
                - Quản lý danh mục nông sản HTX, quy cách đóng gói, cập nhật hình ảnh sản phẩm.
                - Tiếp nhận và phản hồi Yêu cầu cung ứng (Supply Request) từ Điều phối FreshLink.
                - Hướng dẫn tạo lô hàng (Batches), dán nhãn QR VietGAP và khai báo nguồn gốc thu hoạch.
                - Tiêu chuẩn chất lượng tiếp nhận tại Hub Cross-dock (Gate QC): nhiệt độ lõi hàng +2°C ~ +6°C, độ ẩm, độ tươi, tỷ lệ lỗi cho phép < 3%.
                - Bổ sung hồ sơ kiểm định VietGAP, an toàn thực phẩm, giấy phép kinh doanh tại mục 'Hồ sơ nhà cung cấp'.
                - Quy trình đối soát bảng kê thu mua (Settlements) và lịch thanh toán của FreshLink.

                GIỚI HẠN BẢO MẬT & PHÂN QUYỀN TUYỆT ĐỐI:
                - KHÔNG ĐƯỢC tiết lộ giá bán của FreshLink cho các nhà hàng/khách mua cuối.
                - KHÔNG ĐƯỢC tiết lộ danh sách khách hàng nhà hàng mua sản phẩm hoặc dữ liệu các HTX đối thủ.
                - KHÔNG ĐƯỢC can thiệp vào dữ liệu tài chính nội bộ FreshLink.
                - Từ chối lịch sự nếu câu hỏi vượt quá phạm vi và nhắc liên hệ Hotline 0123456789.
                """.replace("{orgName}", orgName)
            );
        }

        if (roles.contains("DRIVER")) {
            return new UserPersona(
                "DRIVER",
                "Tài xế Xe Lạnh Vệ Tinh (" + orgName + ")",
                orgName,
                """
                Bạn là Trợ lý AI FreshLink chuyên biệt dành cho Tài xế xe lạnh giao nhận.
                Hotline điều phối khẩn cấp: 0123456789. Zalo: 0123456789.
                PHẠM VI HỖ TRỢ VÀ DỮ LIỆU ĐƯỢC PHÉP:
                - Hướng dẫn sử dụng màn hình Chuyến giao xe lạnh (Lộ trình điểm giao, liên hệ người nhận, cập nhật trạng thái Đã đến / Đã giao).
                - Quy trình giao nhận thùng SmartCrate: ghi nhận số lượng thùng giao cho nhà hàng và số lượng thùng rỗng thu hồi.
                - Tiêu chuẩn nhiệt độ thùng xe lạnh: duy trì ổn định trong khoảng +2°C đến +6°C xuyên suốt hành trình.
                - Hướng dẫn xử lý sự cố: tắc đường, xe gặp trục trặc, nhà hàng đóng cửa hoặc từ chối nhận hàng (gọi ngay điều phối 0123456789).

                GIỚI HẠN BẢO MẬT & PHÂN QUYỀN TUYỆT ĐỐI:
                - KHÔNG ĐƯỢC xem thông tin công nợ, giá trị tiền mặt hoặc hóa đơn tổng thể của nhà hàng.
                - KHÔNG ĐƯỢC truy cập thông tin đối soát của nhà cung cấp.
                - Từ chối lịch sự và chuyển hướng về Hotline 0123456789 khi vượt thẩm quyền.
                """
            );
        }

        return new UserPersona(
            "INTERNAL",
            "Nhân sự Điều hành FreshLink (" + orgName + ")",
            orgName,
            """
            Bạn là Trợ lý AI Nghiệp vụ Chuỗi cung ứng FreshLink dành cho Nhân sự Vận hành, QC, CSKH, Điều phối và Kế toán.
            Hotline nội bộ: 0123456789.
            PHẠM VI HỖ TRỢ:
            - Quy trình vận hành chuỗi cung ứng nông sản lạnh B2B: khớp cung - cầu FIFO, xếp chuyến giao xe lạnh.
            - Hướng dẫn quy trình kiểm nhận KCS tại cổng Gate (đạt chuẩn, tạm giữ, từ chối lô hàng).
            - Quy trình điều phối ngoại lệ đơn hàng (re-route xe, duyệt phương án giao một phần, thay thế mã hàng).
            - Hồ sơ giải quyết khiếu nại 360° theo chuẩn cam kết SLA.
            - Quy trình đối soát tài chính 3 bên (Nhà hàng - FreshLink - HTX Cung ứng).
            Tuân thủ tính bảo mật dữ liệu doanh nghiệp và trung thực với số liệu.
            """
        );
    }

    private String callGeminiApi(UserPersona persona, ChatRequest req) {
        try {
            String endpoint = "https://generativelanguage.googleapis.com/v1beta/models/"
                + geminiModel + ":generateContent?key=" + geminiApiKey;

            Map<String, Object> body = new HashMap<>();

            // 1. System instruction
            Map<String, Object> systemInstruction = Map.of(
                "parts", List.of(Map.of("text", persona.systemInstruction))
            );
            body.put("system_instruction", systemInstruction);

            // 2. Contents history + current user message
            List<Map<String, Object>> contents = new ArrayList<>();
            if (req.history() != null) {
                for (ChatMessage m : req.history()) {
                    if (m.content() == null || m.content().isBlank()) continue;
                    String gRole = "assistant".equalsIgnoreCase(m.role()) ? "model" : "user";
                    contents.add(Map.of(
                        "role", gRole,
                        "parts", List.of(Map.of("text", m.content()))
                    ));
                }
            }
            contents.add(Map.of(
                "role", "user",
                "parts", List.of(Map.of("text", req.message()))
            ));
            body.put("contents", contents);

            // 3. Generation configuration
            body.put("generationConfig", Map.of(
                "temperature", 0.4,
                "maxOutputTokens", 800
            ));

            String jsonPayload = objectMapper.writeValueAsString(body);

            HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(endpoint))
                .header("Content-Type", "application/json")
                .timeout(Duration.ofSeconds(25))
                .POST(HttpRequest.BodyPublishers.ofString(jsonPayload))
                .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());

            if (response.statusCode() == 200) {
                JsonNode root = objectMapper.readTree(response.body());
                JsonNode candidates = root.path("candidates");
                if (candidates.isArray() && !candidates.isEmpty()) {
                    JsonNode textNode = candidates.get(0).path("content").path("parts").get(0).path("text");
                    if (!textNode.isMissingNode()) {
                        return textNode.asText();
                    }
                }
            } else {
                log.warn("Gemini API call failed with status: {}, body: {}", response.statusCode(), response.body());
            }
        } catch (Exception e) {
            log.error("Exception calling Gemini API: {}", e.getMessage());
        }

        // Fallback if API call failed
        return generateFallbackReply(persona, req.message());
    }

    private String generateFallbackReply(UserPersona persona, String msg) {
        String lower = msg.toLowerCase();

        if (lower.contains("chào") || lower.contains("hello") || lower.equals("hi") || lower.startsWith("hi ") || lower.endsWith(" hi") || lower.contains(" hi ")) {
            return "Xin chào! Tôi là Trợ lý AI FreshLink (" + persona.roleName + "). Tôi có thể giúp gì cho bạn về chuỗi cung ứng, đơn hàng hoặc quy trình nghiệp vụ? Hotline hỗ trợ: 0123456789.";
        }

        if (lower.contains("hotline") || lower.contains("liên hệ") || lower.contains("tổng đài") || lower.contains("số điện thoại") || lower.contains("sđt") || lower.equals("gọi") || lower.startsWith("gọi ") || lower.contains(" gọi ") || lower.endsWith(" gọi")) {
            return "Tổng đài Chăm sóc Khách hàng & Hỗ trợ Kỹ thuật FreshLink: **0123456789** (Hỗ trợ 24/7). Bạn cũng có thể bấm biểu tượng cuộc gọi hoặc Zalo ở góc phải để kết nối ngay!";
        }

        if (lower.contains("zalo")) {
            return "Kênh Zalo CSKH FreshLink được liên kết trực tiếp qua số **0123456789**. Bạn có thể bấm vào biểu tượng Zalo trong nút hỗ trợ để mở khung chat trực tiếp.";
        }

        switch (persona.roleCode) {
            case "RESTAURANT" -> {
                if (lower.contains("đặt hàng") || lower.contains("giờ chốt") || lower.contains("cutoff") || lower.contains("hạn")) {
                    return "Giờ chốt đơn hàng ngày là **17:00** cho đơn nhận sáng hôm sau (khung giờ 06:00 - 08:00). Bạn có thể vào tab 'Đặt hàng' để chọn nông sản VietGAP theo danh mục.";
                }
                if (lower.contains("khiếu nại") || lower.contains("hỏng") || lower.contains("thiếu") || lower.contains("dập")) {
                    return "Khi nhận hàng phát hiện nông sản dập nát hoặc thiếu số lượng, vui lòng mở mục **'Khiếu nại'** trong vòng **4 giờ**, chụp hình ảnh thực tế và gửi biên bản để đội CSKH bù trừ tiền ngay trên hóa đơn.";
                }
                if (lower.contains("thùng") || lower.contains("smartcrate")) {
                    return "Thùng luân chuyển SmartCrate được mượn miễn phí khi giao hàng. Bếp vui lòng bảo quản sạch sẽ và hoàn trả lại số thùng rỗng cho tài xế ở chuyến giao kế tiếp.";
                }
                return "Là đối tác Nhà hàng của FreshLink, bạn được đảm bảo 100% rau củ quả đạt chuẩn VietGAP bảo quản lạnh +2°C ~ +6°C, giao trước 08:00 sáng. Cần tư vấn chi tiết hơn, vui lòng gọi Hotline **0123456789**.";
            }

            case "SUPPLIER" -> {
                if (lower.contains("yêu cầu") || lower.contains("cung ứng") || lower.contains("nhận lệnh")) {
                    return "Bạn vui lòng vào tab **'Yêu cầu cung ứng'** để xem các mặt hàng Điều phối cần nhập. Hãy bấm 'Phản hồi' và nhập số lượng HTX có thể đáp ứng trước giờ hẹn.";
                }
                if (lower.contains("lô") || lower.contains("qr") || lower.contains("batch") || lower.contains("vietgap")) {
                    return "Sau khi phản hồi yêu cầu, hãy tạo Lô hàng (Batch), hệ thống sẽ cấp mã QR VietGAP tự động. Vui lòng in mã QR dán lên các sọt hàng trước khi chuyển đến Hub.";
                }
                if (lower.contains("qc") || lower.contains("gate") || lower.contains("tiêu chuẩn") || lower.contains("kiểm nhận")) {
                    return "Tại cổng Gate, chuyên viên KCS sẽ kiểm tra nhiệt độ bảo quản (+2°C ~ +6°C), cảm quan độ tươi và tỷ lệ sâu bệnh/dập nát (< 3%). Hàng đạt chuẩn sẽ được thông quan nhập kho ngay.";
                }
                return "Trợ lý HTX sẵn sàng hỗ trợ bạn về quy trình chuẩn bị lô, in mã QR và đối soát bảng kê thu mua. Cần hỗ trợ trực tiếp từ Điều phối viên, vui lòng gọi Hotline **0123456789**.";
            }

            case "DRIVER" -> {
                if (lower.contains("chuyến") || lower.contains("lộ trình") || lower.contains("điểm giao")) {
                    return "Bác tài hãy mở mục **'Chuyến giao & Lộ trình'**, bấm vào từng điểm giao theo thứ tự để xem địa chỉ nhà hàng, số điện thoại người nhận và bấm 'Đã đến' khi tới nơi.";
                }
                if (lower.contains("nhiệt độ") || lower.contains("xe lạnh")) {
                    return "Nhiệt độ thùng xe lạnh phải duy trì ổn định từ **+2°C đến +6°C**. Nếu cảm biến báo quá nhiệt, hãy kiểm tra dàn lạnh thùng xe ngay và gọi Điều phối qua 0123456789.";
                }
                if (lower.contains("thùng") || lower.contains("thu hồi")) {
                    return "Tại mỗi điểm nhận, bác tài nhớ đối chiếu số lượng thùng giao và nhập số lượng thùng rỗng thu hồi vào ứng dụng để tránh lệch tồn kho SmartCrate.";
                }
                return "Chúc bác tài có những chuyến xe an toàn! Mọi phát sinh sự cố trên đường, vui lòng gọi ngay Tổng đài Điều phối: **0123456789**.";
            }

            default -> {
                if (lower.contains("nông sản") || lower.contains("dịch vụ") || lower.contains("freshlink")) {
                    return "FreshLink là nền tảng B2B kết nối trực tiếp Hợp tác xã nông sản VietGAP với các chuỗi Nhà hàng thông qua mạng lưới kho Cross-dock và xe lạnh chuyên dụng, kiểm soát nhiệt độ từ nông trại tới bàn ăn.";
                }
                if (lower.contains("đăng ký") || lower.contains("hợp tác")) {
                    return "Quý khách có thể bấm nút **'Đăng ký hợp tác'** trên trang chủ hoặc liên hệ Hotline **0123456789** để được chuyên viên kinh doanh liên hệ tư vấn mở tài khoản B2B.";
                }
                return "FreshLink luôn đồng hành cùng bạn để mang đến nguồn nông sản tươi sạch, chuẩn nhiệt độ chuỗi lạnh. Nếu cần giải đáp thêm, xin vui lòng gọi hotline **0123456789** hoặc nhắn tin Zalo.";
            }
        }
    }

    private List<String> getQuickSuggestions(String roleCode) {
        return switch (roleCode) {
            case "RESTAURANT" -> List.of(
                "Giờ chốt đơn hàng ngày?",
                "Quy định khiếu nại hàng dập nát?",
                "Bảo quản thùng SmartCrate?",
                "Số điện thoại Hotline CSKH?"
            );
            case "SUPPLIER" -> List.of(
                "Tiêu chuẩn kiểm nhận tại Gate?",
                "Cách tạo lô hàng và in mã QR?",
                "Chính sách đối soát thu mua?",
                "Liên hệ điều phối thu mua?"
            );
            case "DRIVER" -> List.of(
                "Nhiệt độ thùng xe đạt chuẩn?",
                "Cách bàn giao và thu hồi thùng?",
                "Xử lý khi nhà hàng chưa mở cửa?",
                "Hotline hỗ trợ khẩn cấp?"
            );
            default -> List.of(
                "FreshLink hoạt động như thế nào?",
                "Làm sao để đăng ký đối tác?",
                "Tiêu chuẩn chuỗi lạnh VietGAP?",
                "Hotline và Zalo tư vấn?"
            );
        };
    }
}
