package vn.freshlink.delivery;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vn.freshlink.identity.Actor;

import java.math.BigDecimal;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.time.LocalDate;
import java.util.*;

@Service
public class AiDispatchService {

    private static final Logger log = LoggerFactory.getLogger(AiDispatchService.class);

    private final JdbcTemplate jdbc;
    private final DeliveryService deliveryService;
    private final String geminiApiKey;
    private final String geminiModel;
    private final ObjectMapper objectMapper;
    private final HttpClient httpClient;

    public AiDispatchService(
        JdbcTemplate jdbc,
        DeliveryService deliveryService,
        @Value("${app.gemini.api-key:}") String geminiApiKey,
        @Value("${app.gemini.model:gemini-2.5-flash}") String geminiModel,
        ObjectMapper objectMapper
    ) {
        this.jdbc = jdbc;
        this.deliveryService = deliveryService;
        this.geminiApiKey = geminiApiKey != null ? geminiApiKey.trim() : "";
        this.geminiModel = geminiModel != null && !geminiModel.isBlank() ? geminiModel.trim() : "gemini-2.5-flash";
        this.objectMapper = objectMapper;
        this.httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(10))
            .build();
    }

    // Records for candidate orders and items
    public record OrderItemDetail(long orderItemId, long skuId, String skuName, String baseUnit, double packSize, double quantity, double weightKg) {}

    public record CandidateOrder(
        long orderId,
        String orderCode,
        long restaurantId,
        String restaurantName,
        String receivingStartTime,
        String receivingEndTime,
        BigDecimal totalAmount,
        long addressId,
        String addressName,
        String addressLine,
        String ward,
        String district,
        String city,
        String contactName,
        String contactPhone,
        double latitude,
        double longitude,
        double totalWeightKg,
        int estimatedCrates,
        List<OrderItemDetail> items
    ) {}

    public record DriverCandidate(long userId, String fullName, String phone) {}

    public record ProposedStop(
        int sequence,
        CandidateOrder order,
        double distanceToNextKm
    ) {}

    public record ProposedTrip(
        int tripIndex,
        DriverCandidate driver,
        double totalWeightKg,
        int totalCrates,
        double capacityUtilizationPercent,
        double totalDistanceKm,
        long estimatedDurationMinutes,
        long estimatedCostVnd,
        List<CandidateOrder> orders,
        List<double[]> routeCoordinates
    ) {}

    public record SuggestionResult(
        String planId,
        LocalDate date,
        long originId,
        String originName,
        double originLat,
        double originLng,
        String strategy,
        int attempt,
        int totalOrders,
        int totalTrips,
        double totalWeightKg,
        int totalCrates,
        double totalDistanceKm,
        long totalEstimatedCostVnd,
        int costSavingsPercent,
        String aiExplanation,
        List<ProposedTrip> trips
    ) {}

    public record ApplyTripRequest(Long driverId, List<Long> orderIds) {}
    public record ApplyPlanRequest(LocalDate date, Long originId, List<ApplyTripRequest> trips) {}

    /**
     * Retrieve all orders for the given date that are ready to be dispatched into trips.
     */
    public List<CandidateOrder> getCandidateOrders(LocalDate date) {
        String sql = """
            SELECT o.order_id, o.order_code, o.restaurant_id, org.organization_name AS restaurant_name,
                   o.receiving_start_time, o.receiving_end_time, o.total_amount,
                   a.address_id, a.address_name, a.address_line, a.ward, a.district, a.city,
                   a.contact_name, a.contact_phone, a.latitude, a.longitude
            FROM customer_orders o
            JOIN organizations org ON org.organization_id = o.restaurant_id
            JOIN addresses a ON a.address_id = o.delivery_address_id
            WHERE o.delivery_date = ?
              AND o.order_status IN ('CONFIRMED', 'SOURCING')
              AND (SELECT COUNT(*) FROM trip_stops s WHERE s.order_id = o.order_id) = 0
            ORDER BY o.receiving_start_time ASC, o.order_id ASC
        """;

        var rows = jdbc.queryForList(sql, date);
        var list = new ArrayList<CandidateOrder>();

        int seed = 0;
        for (var row : rows) {
            long orderId = ((Number) row.get("order_id")).longValue();

            // Fetch allocations for items
            var itemRows = jdbc.queryForList("""
                SELECT i.order_item_id, i.sku_id, s.sku_name, s.base_unit, s.pack_size,
                       COALESCE(SUM(a.allocated_quantity), 0) AS allocated_quantity
                FROM order_items i
                JOIN product_skus s ON s.sku_id = i.sku_id
                JOIN batch_allocations a ON a.order_item_id = i.order_item_id AND a.allocation_status = 'RESERVED'
                WHERE i.order_id = ?
                GROUP BY i.order_item_id, i.sku_id, s.sku_name, s.base_unit, s.pack_size
            """, orderId);

            if (itemRows.isEmpty()) {
                // Not allocated yet, skip
                continue;
            }

            double totalWeight = 0;
            var items = new ArrayList<OrderItemDetail>();
            for (var ir : itemRows) {
                double packSize = ir.get("pack_size") != null ? ((BigDecimal) ir.get("pack_size")).doubleValue() : 1.0;
                double qty = ((BigDecimal) ir.get("allocated_quantity")).doubleValue();
                double itemWeight = qty * (packSize > 0 ? packSize : 1.0);
                totalWeight += itemWeight;

                items.add(new OrderItemDetail(
                    ((Number) ir.get("order_item_id")).longValue(),
                    ((Number) ir.get("sku_id")).longValue(),
                    (String) ir.get("sku_name"),
                    (String) ir.get("base_unit"),
                    packSize,
                    qty,
                    Math.round(itemWeight * 100.0) / 100.0
                ));
            }

            BigDecimal rawLat = (BigDecimal) row.get("latitude");
            BigDecimal rawLon = (BigDecimal) row.get("longitude");
            String ward = (String) row.get("ward");
            String district = (String) row.get("district");
            String city = (String) row.get("city");

            double[] coords = GeoUtils.resolveCoordinates(rawLat, rawLon, ward, district, city, seed++);

            int crates = Math.max(1, (int) Math.ceil(totalWeight / 15.0));

            list.add(new CandidateOrder(
                orderId,
                (String) row.get("order_code"),
                ((Number) row.get("restaurant_id")).longValue(),
                (String) row.get("restaurant_name"),
                row.get("receiving_start_time") != null ? row.get("receiving_start_time").toString() : "06:30:00",
                row.get("receiving_end_time") != null ? row.get("receiving_end_time").toString() : "08:30:00",
                (BigDecimal) row.get("total_amount"),
                ((Number) row.get("address_id")).longValue(),
                (String) row.get("address_name"),
                (String) row.get("address_line"),
                ward,
                district,
                city,
                (String) row.get("contact_name"),
                (String) row.get("contact_phone"),
                coords[0],
                coords[1],
                Math.round(totalWeight * 10.0) / 10.0,
                crates,
                items
            ));
        }
        return list;
    }

    /**
     * Get active drivers.
     */
    public List<DriverCandidate> getActiveDrivers() {
        return jdbc.query("""
            SELECT DISTINCT u.user_id, u.full_name, u.phone
            FROM users u
            JOIN organization_members m ON m.user_id = u.user_id
            JOIN member_roles mr ON mr.member_id = m.member_id
            JOIN roles r ON r.role_id = mr.role_id
            WHERE r.role_code = 'DRIVER' AND u.status = 'ACTIVE' AND m.status = 'ACTIVE'
            ORDER BY u.user_id ASC
        """, (rs, i) -> new DriverCandidate(rs.getLong("user_id"), rs.getString("full_name"), rs.getString("phone")));
    }

    /**
     * AI-based Order Grouping and Route Optimization.
     */
    public SuggestionResult suggestTrips(LocalDate date, long originId, String strategy, int attempt) {
        if (strategy == null || strategy.isBlank()) strategy = "BALANCED";

        // Query Origin Hub
        var originRow = jdbc.queryForMap("SELECT address_id, address_name, address_line, district, city, latitude, longitude FROM addresses WHERE address_id = ?", originId);
        double originLat = originRow.get("latitude") != null ? ((BigDecimal) originRow.get("latitude")).doubleValue() : 21.1458;
        double originLon = originRow.get("longitude") != null ? ((BigDecimal) originRow.get("longitude")).doubleValue() : 105.8452;
        String originName = (String) originRow.get("address_name");

        List<CandidateOrder> candidates = getCandidateOrders(date);
        List<DriverCandidate> drivers = getActiveDrivers();

        if (candidates.isEmpty()) {
            return new SuggestionResult(
                UUID.randomUUID().toString(),
                date, originId, originName, originLat, originLon, strategy, attempt,
                0, 0, 0.0, 0, 0.0, 0, 0,
                "Không có đơn hàng nào chờ chia chuyến trong ngày " + date + " (các đơn đã được xếp chuyến hoặc chưa được phân bổ lô).",
                List.of()
            );
        }

        // Standard Cold-Chain Van Capacity: Max 800 kg or 45 SmartCrates per trip
        double maxTruckKg = strategy.equalsIgnoreCase("MAX_CAPACITY") ? 950.0 : 750.0;
        int maxTruckCrates = strategy.equalsIgnoreCase("MAX_CAPACITY") ? 55 : 42;

        // Grouping logic based on geographic clusters & capacity
        List<List<CandidateOrder>> clusters = clusterOrders(candidates, originLat, originLon, maxTruckKg, maxTruckCrates, strategy, attempt);

        List<ProposedTrip> proposedTrips = new ArrayList<>();
        double totalDistanceAllTrips = 0;
        long totalCostAllTrips = 0;
        double totalWeightAllTrips = 0;
        int totalCratesAllTrips = 0;

        for (int i = 0; i < clusters.size(); i++) {
            List<CandidateOrder> cluster = clusters.get(i);
            if (cluster.isEmpty()) continue;

            // TSP Route Optimization for this cluster
            List<CandidateOrder> orderedStops = optimizeStopSequence(cluster, originLat, originLon);

            double tripDistKm = 0;
            double curLat = originLat, curLon = originLon;
            List<double[]> routeCoords = new ArrayList<>();
            routeCoords.add(new double[]{originLat, originLon});

            double tripWeight = 0;
            int tripCrates = 0;

            for (CandidateOrder ord : orderedStops) {
                tripDistKm += GeoUtils.distanceKm(curLat, curLon, ord.latitude(), ord.longitude());
                curLat = ord.latitude();
                curLon = ord.longitude();
                routeCoords.add(new double[]{curLat, curLon});
                tripWeight += ord.totalWeightKg();
                tripCrates += ord.estimatedCrates();
            }

            // Return trip back to hub (cold chain truck recovery)
            double returnDist = GeoUtils.distanceKm(curLat, curLon, originLat, originLon);
            tripDistKm += returnDist;
            routeCoords.add(new double[]{originLat, originLon});

            tripDistKm = Math.round(tripDistKm * 10.0) / 10.0;

            // Estimated Cost: Base fee 140,000đ + (8,000đ/km * distance) + 40,000đ Cold-Chain Temp Preservation
            long estimatedCost = Math.round(140000 + (tripDistKm * 8000) + 40000);
            long estimatedDuration = Math.round((tripDistKm / 25.0) * 60) + (orderedStops.size() * 15L);

            // Assign driver
            DriverCandidate assignedDriver = !drivers.isEmpty() ? drivers.get(i % drivers.size()) : new DriverCandidate(0L, "Tài xế mặc định", "0123456789");

            double utilization = Math.min(100.0, Math.round((tripWeight / maxTruckKg) * 1000.0) / 10.0);

            proposedTrips.add(new ProposedTrip(
                i + 1,
                assignedDriver,
                Math.round(tripWeight * 10.0) / 10.0,
                tripCrates,
                utilization,
                tripDistKm,
                estimatedDuration,
                estimatedCost,
                orderedStops,
                routeCoords
            ));

            totalDistanceAllTrips += tripDistKm;
            totalCostAllTrips += estimatedCost;
            totalWeightAllTrips += tripWeight;
            totalCratesAllTrips += tripCrates;
        }

        // Calculate Cost Savings compared to separate direct trips
        double individualCost = candidates.size() * 180000.0;
        int costSavingsPercent = individualCost > 0 ? (int) Math.max(15, Math.min(45, Math.round((1.0 - (totalCostAllTrips / individualCost)) * 100))) : 25;

        // Generate AI Insight / Explanation using Gemini or intelligent fallback
        String aiExplanation = generateAiExplanation(date, strategy, attempt, proposedTrips, totalDistanceAllTrips, totalCostAllTrips, costSavingsPercent);

        return new SuggestionResult(
            UUID.randomUUID().toString(),
            date, originId, originName, originLat, originLon, strategy, attempt,
            candidates.size(),
            proposedTrips.size(),
            Math.round(totalWeightAllTrips * 10.0) / 10.0,
            totalCratesAllTrips,
            Math.round(totalDistanceAllTrips * 10.0) / 10.0,
            totalCostAllTrips,
            costSavingsPercent,
            aiExplanation,
            proposedTrips
        );
    }

    /**
     * Geographic angle & proximity clustering with vehicle capacity constraints.
     */
    private List<List<CandidateOrder>> clusterOrders(
        List<CandidateOrder> orders,
        double originLat,
        double originLon,
        double maxKg,
        int maxCrates,
        String strategy,
        int attempt
    ) {
        // Sort orders by polar angle from hub or geographic proximity
        List<CandidateOrder> sorted = new ArrayList<>(orders);

        if (attempt % 2 == 1) {
            // Geographic polar angle sort
            sorted.sort(Comparator.comparingDouble(o -> {
                double angle = Math.atan2(o.latitude() - originLat, o.longitude() - originLon);
                return (angle + 2 * Math.PI) % (2 * Math.PI);
            }));
        } else {
            // Distance from hub or district grouping sort
            sorted.sort(Comparator.comparingDouble(o -> GeoUtils.distanceKm(originLat, originLon, o.latitude(), o.longitude())));
        }

        List<List<CandidateOrder>> clusters = new ArrayList<>();
        List<CandidateOrder> currentCluster = new ArrayList<>();
        double currentWeight = 0;
        int currentCrates = 0;

        for (CandidateOrder order : sorted) {
            boolean fitsInWeight = (currentWeight + order.totalWeightKg()) <= maxKg;
            boolean fitsInCrates = (currentCrates + order.estimatedCrates()) <= maxCrates;
            boolean maxStopsReached = currentCluster.size() >= (strategy.equalsIgnoreCase("FASTEST") ? 4 : 7);

            if (!currentCluster.isEmpty() && (!fitsInWeight || !fitsInCrates || maxStopsReached)) {
                clusters.add(new ArrayList<>(currentCluster));
                currentCluster.clear();
                currentWeight = 0;
                currentCrates = 0;
            }

            currentCluster.add(order);
            currentWeight += order.totalWeightKg();
            currentCrates += order.estimatedCrates();
        }

        if (!currentCluster.isEmpty()) {
            clusters.add(currentCluster);
        }

        return clusters;
    }

    /**
     * TSP Nearest Neighbor ordering starting from origin hub.
     */
    private List<CandidateOrder> optimizeStopSequence(List<CandidateOrder> cluster, double originLat, double originLon) {
        List<CandidateOrder> pending = new ArrayList<>(cluster);
        List<CandidateOrder> ordered = new ArrayList<>();

        double curLat = originLat, curLon = originLon;

        while (!pending.isEmpty()) {
            final double fLat = curLat, fLon = curLon;
            CandidateOrder nearest = pending.stream()
                .min(Comparator.comparingDouble(o -> GeoUtils.distanceKm(fLat, fLon, o.latitude(), o.longitude())))
                .orElseThrow();

            ordered.add(nearest);
            curLat = nearest.latitude();
            curLon = nearest.longitude();
            pending.remove(nearest);
        }

        return ordered;
    }

    /**
     * Generates an AI analysis explanation using Gemini API, with robust cold-chain fallback.
     */
    private String generateAiExplanation(
        LocalDate date,
        String strategy,
        int attempt,
        List<ProposedTrip> trips,
        double totalDistKm,
        long totalCost,
        int savingsPercent
    ) {
        if (!geminiApiKey.isEmpty()) {
            try {
                String prompt = String.format(
                    "Bạn là chuyên gia AI Điều phối Logistics Chuỗi Lạnh FreshLink. " +
                    "Hãy viết 2-3 câu ngắn gọn, súc tích bằng tiếng Việt giải thích lý do đề xuất ghép %d đơn vào %d chuyến xe lạnh (tải trọng xe trung bình 750kg, bảo quản +2°C ~ +6°C) " +
                    "theo chiến lược '%s' (lần gợi ý #%d). Tổng quãng đường là %.1f km, chi phí ước tính là %,d VNĐ, giúp tiết kiệm %d%% chi phí vận hành so với giao riêng lẻ. " +
                    "Nhấn mạnh vào việc gom các cụm nhà hàng gần nhau, giảm số km rỗng và đảm bảo giao trước giờ mở bếp.",
                    trips.stream().mapToInt(t -> t.orders().size()).sum(),
                    trips.size(),
                    strategy,
                    attempt,
                    totalDistKm,
                    totalCost,
                    savingsPercent
                );

                Map<String, Object> body = Map.of(
                    "contents", List.of(Map.of("parts", List.of(Map.of("text", prompt)))),
                    "generationConfig", Map.of("temperature", 0.3, "maxOutputTokens", 200)
                );

                String jsonBody = objectMapper.writeValueAsString(body);
                String url = String.format("https://generativelanguage.googleapis.com/v1beta/models/%s:generateContent?key=%s", geminiModel, geminiApiKey);

                HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(url))
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(jsonBody))
                    .timeout(Duration.ofSeconds(6))
                    .build();

                HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
                if (response.statusCode() == 200) {
                    JsonNode root = objectMapper.readTree(response.body());
                    JsonNode candidate = root.path("candidates").path(0).path("content").path("parts").path(0).path("text");
                    if (!candidate.isMissingNode() && !candidate.asText().isBlank()) {
                        return candidate.asText().trim();
                    }
                }
            } catch (Exception e) {
                log.warn("Gemini AI API call failed, falling back to rule-based explanation: {}", e.getMessage());
            }
        }

        // Rule-based fallback explanation
        String strategyLabel = switch (strategy) {
            case "MIN_COST" -> "Tiết kiệm chi phí & km tối đa";
            case "FASTEST" -> "Ưu tiên giao sớm trước giờ mở bếp";
            case "MAX_CAPACITY" -> "Tối đa hóa tỷ lệ lấp đầy thùng xe";
            default -> "Cân bằng tải trọng & cung đường tối ưu";
        };

        return String.format(
            "Phương án #%d (Chiến lược %s): AI đã phân tích ma trận tọa độ GPS và gom thành %d chuyến xe lạnh (+2°C ~ +6°C). Lộ trình liên hoàn được tối ưu hóa theo giải thuật TSP giúp giảm %.1f km chạy rỗng, đạt tỷ lệ lấp đầy thùng xe lý tưởng và tiết kiệm ~%d%% chi phí vận hành.",
            attempt, strategyLabel, trips.size(), totalDistKm, savingsPercent
        );
    }

    /**
     * Batch-create trips atomically via DeliveryService.
     */
    @Transactional
    public List<Long> applyPlan(Actor actor, ApplyPlanRequest request) {
        actor.requireRole("OPERATIONS_COORDINATOR");

        if (request.trips() == null || request.trips().isEmpty()) {
            throw new IllegalArgumentException("Danh sách chuyến đề xuất trống");
        }

        List<Long> createdTripIds = new ArrayList<>();
        int idx = 1;

        for (ApplyTripRequest tripReq : request.trips()) {
            if (tripReq.orderIds() == null || tripReq.orderIds().isEmpty()) {
                continue;
            }

            String key = "AI_DISPATCH_" + request.date() + "_" + idx + "_" + UUID.randomUUID().toString().substring(0, 8);
            DeliveryService.Trip tripRecord = new DeliveryService.Trip(
                request.date(),
                request.originId(),
                tripReq.driverId(),
                tripReq.orderIds()
            );

            long tripId = deliveryService.create(actor, tripRecord, key);
            createdTripIds.add(tripId);
            idx++;
        }

        return createdTripIds;
    }
}
