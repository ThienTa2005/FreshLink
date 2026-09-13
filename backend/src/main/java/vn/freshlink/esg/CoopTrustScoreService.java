package vn.freshlink.esg;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.*;

@Service
public class CoopTrustScoreService {

    private final JdbcTemplate jdbc;

    public CoopTrustScoreService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public record TrustBreakdown(
        double qualityScore,
        double fulfillmentScore,
        double certScore,
        double claimScore,
        double consistencyScore,
        double totalScore,
        String tierRank,
        String tierTitle,
        String tierBadgeColor,
        Map<String, Object> metrics
    ) {}

    public TrustBreakdown calculateTrust(long supplierId) {
        // 1. Pillar 1: KCS Quality Rate (35 points max)
        var kcsData = jdbc.queryForList("""
            SELECT COALESCE(SUM(bi.accepted_quantity), 0) AS total_accepted,
                   COALESCE(SUM(b.declared_quantity), 0) AS total_declared,
                   COUNT(bi.inspection_id) AS inspection_count
            FROM batches b
            LEFT JOIN batch_inspections bi ON bi.batch_id = b.batch_id
            WHERE b.supplier_id = ?
        """, supplierId);

        double totalAcceptedKcs = 0;
        double totalDeclaredKcs = 0;
        long inspectionCount = 0;
        if (!kcsData.isEmpty()) {
            totalAcceptedKcs = ((Number) kcsData.get(0).get("total_accepted")).doubleValue();
            totalDeclaredKcs = ((Number) kcsData.get(0).get("total_declared")).doubleValue();
            inspectionCount = ((Number) kcsData.get(0).get("inspection_count")).longValue();
        }

        double qualityScore;
        double kcsRate = 100.0;
        if (totalDeclaredKcs > 0) {
            kcsRate = Math.min(100.0, (totalAcceptedKcs / totalDeclaredKcs) * 100.0);
            qualityScore = (kcsRate / 100.0) * 35.0;
        } else {
            // Standard baseline for established or initial active cooperatives
            qualityScore = 31.5; // ~90% baseline
            kcsRate = 90.0;
        }

        // 2. Pillar 2: Supply Fulfillment Commitment Rate (25 points max)
        var fulfillData = jdbc.queryForList("""
            SELECT COALESCE(SUM(sri.accepted_quantity), 0) AS total_accepted,
                   COALESCE(SUM(sri.requested_quantity), 0) AS total_requested,
                   COUNT(sri.supply_request_item_id) AS request_count
            FROM supply_request_items sri
            JOIN supply_requests sr ON sr.supply_request_id = sri.supply_request_id
            WHERE sr.supplier_id = ?
        """, supplierId);

        double totalAcceptedFulfill = 0;
        double totalRequestedFulfill = 0;
        long requestCount = 0;
        if (!fulfillData.isEmpty()) {
            totalAcceptedFulfill = ((Number) fulfillData.get(0).get("total_accepted")).doubleValue();
            totalRequestedFulfill = ((Number) fulfillData.get(0).get("total_requested")).doubleValue();
            requestCount = ((Number) fulfillData.get(0).get("request_count")).longValue();
        }

        double fulfillmentScore;
        double fulfillmentRate = 100.0;
        if (totalRequestedFulfill > 0) {
            fulfillmentRate = Math.min(100.0, (totalAcceptedFulfill / totalRequestedFulfill) * 100.0);
            fulfillmentScore = (fulfillmentRate / 100.0) * 25.0;
        } else {
            fulfillmentScore = 22.5; // ~90% baseline
            fulfillmentRate = 90.0;
        }

        // 3. Pillar 3: Standards & Legal Certification (20 points max: VietGAP +15, Food Safety +5)
        var docs = jdbc.queryForList("""
            SELECT document_type
            FROM supplier_documents
            WHERE supplier_id = ? AND verification_status = 'APPROVED'
              AND (expiry_date IS NULL OR expiry_date >= CURRENT_DATE)
        """, supplierId);

        boolean hasVietgap = docs.stream().anyMatch(d -> "VIETGAP".equals(d.get("document_type")));
        boolean hasFoodSafety = docs.stream().anyMatch(d -> "FOOD_SAFETY".equals(d.get("document_type")));

        double certScore = (hasVietgap ? 15.0 : 0.0) + (hasFoodSafety ? 5.0 : 0.0);

        // 4. Pillar 4: Claims & Complaint Reliability (10 points max)
        var complaintCountList = jdbc.queryForList("""
            SELECT COUNT(c.complaint_id) AS count
            FROM complaints c
            WHERE c.order_item_id IN (
                SELECT oi.order_item_id
                FROM order_items oi
                JOIN delivery_items di ON di.trip_stop_id IN (
                    SELECT ts.trip_stop_id FROM trip_stops ts WHERE ts.order_id = oi.order_id
                )
                JOIN batch_allocations ba ON ba.batch_allocation_id = di.batch_allocation_id
                JOIN batches b ON b.batch_id = ba.batch_id
                WHERE b.supplier_id = ?
            ) AND c.status NOT IN ('REJECTED')
        """, supplierId);

        long complaintCount = 0;
        if (!complaintCountList.isEmpty()) {
            complaintCount = ((Number) complaintCountList.get(0).get("count")).longValue();
        }
        double claimScore = Math.max(0.0, 10.0 - (complaintCount * 2.5));

        // 5. Pillar 5: Cooperative Longevity & Consistency (10 points max)
        var batchCountList = jdbc.queryForList("""
            SELECT COUNT(batch_id) AS count
            FROM batches
            WHERE supplier_id = ? AND accepted_quantity > 0
        """, supplierId);

        long successfulBatches = 0;
        if (!batchCountList.isEmpty()) {
            successfulBatches = ((Number) batchCountList.get(0).get("count")).longValue();
        }

        double consistencyScore;
        if (successfulBatches >= 15) {
            consistencyScore = 10.0;
        } else if (successfulBatches >= 6) {
            consistencyScore = 7.5;
        } else if (successfulBatches >= 1) {
            consistencyScore = 5.0;
        } else {
            consistencyScore = 3.0;
        }

        double total = qualityScore + fulfillmentScore + certScore + claimScore + consistencyScore;
        total = Math.min(100.0, Math.max(0.0, Math.round(total * 10.0) / 10.0));

        String tierRank;
        String tierTitle;
        String tierBadgeColor;
        if (total >= 90.0) {
            tierRank = "DIAMOND_AAA";
            tierTitle = "Hạng Kim Cương (AAA) - Đối tác Chiến lược";
            tierBadgeColor = "#0284c7"; // Diamond Blue
        } else if (total >= 75.0) {
            tierRank = "GOLD_AA";
            tierTitle = "Hạng Vàng (AA) - Đạt Chuẩn Cao Cấp";
            tierBadgeColor = "#d97706"; // Amber / Gold
        } else if (total >= 60.0) {
            tierRank = "SILVER_A";
            tierTitle = "Hạng Bạc (A) - Đang Hoàn Thiện";
            tierBadgeColor = "#64748b"; // Slate / Silver
        } else {
            tierRank = "STANDARD_B";
            tierTitle = "Hạng Tiêu Chuẩn (B) - Giám Sát KCS";
            tierBadgeColor = "#475569";
        }

        Map<String, Object> metrics = new HashMap<>();
        metrics.put("kcsRatePercent", Math.round(kcsRate * 10.0) / 10.0);
        metrics.put("fulfillmentRatePercent", Math.round(fulfillmentRate * 10.0) / 10.0);
        metrics.put("hasVietgap", hasVietgap);
        metrics.put("hasFoodSafety", hasFoodSafety);
        metrics.put("complaintCount", complaintCount);
        metrics.put("successfulBatches", successfulBatches);
        metrics.put("inspectionCount", inspectionCount);
        metrics.put("requestCount", requestCount);

        return new TrustBreakdown(
            Math.round(qualityScore * 10.0) / 10.0,
            Math.round(fulfillmentScore * 10.0) / 10.0,
            Math.round(certScore * 10.0) / 10.0,
            Math.round(claimScore * 10.0) / 10.0,
            Math.round(consistencyScore * 10.0) / 10.0,
            total,
            tierRank,
            tierTitle,
            tierBadgeColor,
            metrics
        );
    }

    @Transactional
    public void updateSupplierScore(long supplierId) {
        var breakdown = calculateTrust(supplierId);
        jdbc.update("""
            UPDATE supplier_profiles
            SET supplier_score = ?,
                quality_score = ?,
                fulfillment_score = ?,
                cert_score = ?,
                claim_score = ?,
                consistency_score = ?,
                tier_rank = ?,
                score_recalculated_at = UTC_TIMESTAMP(3)
            WHERE supplier_id = ?
        """,
            BigDecimal.valueOf(breakdown.totalScore()).setScale(2, RoundingMode.HALF_UP),
            BigDecimal.valueOf(breakdown.qualityScore()).setScale(2, RoundingMode.HALF_UP),
            BigDecimal.valueOf(breakdown.fulfillmentScore()).setScale(2, RoundingMode.HALF_UP),
            BigDecimal.valueOf(breakdown.certScore()).setScale(2, RoundingMode.HALF_UP),
            BigDecimal.valueOf(breakdown.claimScore()).setScale(2, RoundingMode.HALF_UP),
            BigDecimal.valueOf(breakdown.consistencyScore()).setScale(2, RoundingMode.HALF_UP),
            breakdown.tierRank(),
            supplierId
        );
    }

    @Transactional
    public void recalculateAll() {
        var ids = jdbc.queryForList("SELECT supplier_id FROM supplier_profiles", Long.class);
        for (Long id : ids) {
            updateSupplierScore(id);
        }
    }

    public List<Map<String, Object>> getRankings() {
        var list = jdbc.queryForList("""
            SELECT sp.supplier_id, org.organization_code, org.organization_name,
                   sp.supplier_type, sp.verification_status, sp.supplier_score,
                   sp.quality_score, sp.fulfillment_score, sp.cert_score, sp.claim_score, sp.consistency_score,
                   sp.tier_rank, sp.score_recalculated_at,
                   (SELECT COUNT(*) FROM supplier_documents sd WHERE sd.supplier_id = sp.supplier_id AND sd.document_type = 'VIETGAP' AND sd.verification_status = 'APPROVED') > 0 AS has_approved_vietgap
            FROM supplier_profiles sp
            JOIN organizations org ON org.organization_id = sp.supplier_id
            WHERE org.status = 'ACTIVE'
            ORDER BY COALESCE(sp.supplier_score, 0) DESC, org.organization_name ASC
        """);

        int rank = 1;
        for (var row : list) {
            row.put("rank", rank++);
            String tier = (String) row.get("tier_rank");
            if (tier == null || "STANDARD_B".equals(tier)) {
                double s = row.get("supplier_score") != null ? ((Number) row.get("supplier_score")).doubleValue() : 0;
                if (s >= 90.0) tier = "DIAMOND_AAA";
                else if (s >= 75.0) tier = "GOLD_AA";
                else if (s >= 60.0) tier = "SILVER_A";
                else tier = "STANDARD_B";
                row.put("tier_rank", tier);
            }
        }
        return list;
    }

    public Map<String, Object> getTrustDetail(long supplierId) {
        var breakdown = calculateTrust(supplierId);
        var org = jdbc.queryForMap("""
            SELECT o.organization_id, o.organization_code, o.organization_name, o.status,
                   sp.supplier_type, sp.verification_status
            FROM organizations o
            JOIN supplier_profiles sp ON sp.supplier_id = o.organization_id
            WHERE o.organization_id = ?
        """, supplierId);

        Map<String, Object> result = new HashMap<>(org);
        result.put("breakdown", breakdown);
        return result;
    }
}
