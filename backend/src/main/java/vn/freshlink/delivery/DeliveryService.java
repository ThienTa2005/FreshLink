package vn.freshlink.delivery;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.*;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vn.freshlink.identity.Actor;
import vn.freshlink.common.*;

@Service
public class DeliveryService {
    private final JdbcTemplate jdbc; private final Sql sql; private final Idempotency dedup;private final MediaController media;
    public DeliveryService(JdbcTemplate jdbc,Sql sql,Idempotency dedup,MediaController media) {this.jdbc=jdbc;this.sql=sql;this.dedup=dedup;this.media=media;}
    public record Trip(@NotNull LocalDate date,@NotNull Long originId,@NotNull Long driverId,@NotEmpty @Size(max=50) List<@NotNull Long> orderIds) {}
    @Transactional public long create(Actor actor,Trip r,String key) {
        actor.requireRole("OPERATIONS_COORDINATOR");
        return dedup.execute(actor.userId(),key,"CREATE_TRIP",r.toString(),()->{
            if(new HashSet<>(r.orderIds()).size()!=r.orderIds().size()) throw new IllegalArgumentException("Đơn bị lặp trong chuyến");
            if(jdbc.queryForObject("SELECT COUNT(*) FROM users u JOIN organization_members m ON m.user_id=u.user_id JOIN member_roles mr ON mr.member_id=m.member_id JOIN roles role ON role.role_id=mr.role_id JOIN organizations org ON org.organization_id=m.organization_id WHERE u.user_id=? AND u.status='ACTIVE' AND m.status='ACTIVE' AND org.status='ACTIVE' AND role.role_code='DRIVER'",Integer.class,r.driverId())==0) throw new IllegalArgumentException("Tài xế không hoạt động");
            if(jdbc.queryForObject("SELECT COUNT(*) FROM addresses WHERE address_id=? AND address_type='CROSS_DOCK' AND active=TRUE",Integer.class,r.originId())!=1) throw new IllegalArgumentException("Điểm tập kết không hợp lệ");
            long trip=sql.insert("INSERT INTO delivery_trips(trip_code,trip_date,origin_address_id,driver_user_id,created_by) VALUES (?,?,?,?,?)","TR-"+UUID.randomUUID().toString().substring(0,24),r.date(),r.originId(),r.driverId(),actor.userId());
            // Lock orders in deterministic order, while preserving requested stop order.
            for(long orderId:r.orderIds().stream().sorted().toList()) jdbc.queryForMap("SELECT order_id FROM customer_orders WHERE order_id=? FOR UPDATE",orderId);
            int sequence=0;
            for(long orderId:r.orderIds()) {
                var order=jdbc.queryForMap("SELECT * FROM customer_orders WHERE order_id=?",orderId);
                if(!order.get("delivery_date").toString().equals(r.date().toString()) || !Set.of("CONFIRMED","SOURCING").contains(order.get("order_status"))) throw new IllegalArgumentException("Đơn phải cùng ngày giao và chưa xếp chuyến");
                var allocations=jdbc.queryForList("SELECT a.*,i.order_id FROM batch_allocations a JOIN order_items i ON i.order_item_id=a.order_item_id WHERE i.order_id=? AND a.allocation_status='RESERVED' FOR UPDATE",orderId);
                if(allocations.isEmpty()) throw new IllegalArgumentException("Đơn chưa được chia hàng");
                BigDecimal required=jdbc.queryForObject("SELECT COALESCE(SUM(confirmed_quantity),0) FROM order_items WHERE order_id=? AND item_status<>'CANCELLED'",BigDecimal.class,orderId);
                BigDecimal allocated=allocations.stream().map(al->(BigDecimal)al.get("allocated_quantity")).reduce(BigDecimal.ZERO,BigDecimal::add);
                if(allocated.compareTo(required)<0) {
                    int approvedRemedies=jdbc.queryForObject("SELECT COUNT(*) FROM order_remedies WHERE order_id=? AND status='ACCEPTED'",Integer.class,orderId);
                    if(approvedRemedies==0) throw new IllegalArgumentException("Đơn chưa đủ lượng phân bổ; cần có phương án giao một phần được duyệt trước khi xếp chuyến");
                }
                long stop=sql.insert("INSERT INTO trip_stops(trip_id,order_id,delivery_address_id,stop_sequence) VALUES (?,?,?,?)",trip,orderId,order.get("delivery_address_id"),++sequence);
                for(var allocation:allocations) {
                    sql.insert("INSERT INTO delivery_items(trip_stop_id,order_item_id,batch_allocation_id,loaded_quantity) VALUES (?,?,?,?)",stop,allocation.get("order_item_id"),allocation.get("batch_allocation_id"),allocation.get("allocated_quantity"));
                    jdbc.update("UPDATE batch_allocations SET allocation_status='PICKED' WHERE batch_allocation_id=?",allocation.get("batch_allocation_id"));
                }
                jdbc.update("UPDATE customer_orders SET order_status='READY_FOR_DELIVERY' WHERE order_id=?",orderId);
            }
            return trip;
        });
    }
    @Transactional public long redeliver(Actor actor, long failedStopId, Long newTripId, String key) {
        actor.requireRole("OPERATIONS_COORDINATOR");
        return dedup.execute(actor.userId(), key, "REDELIVER_" + failedStopId, "", () -> {
            var oldStop = jdbc.queryForMap("SELECT * FROM trip_stops WHERE trip_stop_id=? FOR UPDATE", failedStopId);
            if (!Set.of("FAILED", "PARTIALLY_DELIVERED").contains(oldStop.get("status"))) {
                throw new IllegalArgumentException("Chỉ tái giao cho điểm giao thất bại hoặc giao thiếu");
            }
            if (jdbc.queryForObject("SELECT COUNT(*) FROM trip_stops WHERE redelivered_from_stop_id=?", Integer.class, failedStopId) > 0) {
                throw new IllegalArgumentException("Điểm giao này đã được lập lịch tái giao");
            }
            long orderId = ((Number) oldStop.get("order_id")).longValue();
            long targetTripId;
            if (newTripId != null) {
                targetTripId = newTripId;
            } else {
                long originId = ((Number) jdbc.queryForObject("SELECT origin_address_id FROM delivery_trips WHERE trip_id=?", Long.class, oldStop.get("trip_id"))).longValue();
                targetTripId = sql.insert("INSERT INTO delivery_trips(trip_code,trip_date,origin_address_id,driver_user_id,created_by) VALUES (?,CURRENT_DATE(),?,?,?)",
                    "TR-RE-" + UUID.randomUUID().toString().substring(0, 20), originId, actor.userId(), actor.userId());
            }
            int nextSeq = jdbc.queryForObject("SELECT COALESCE(MAX(stop_sequence), 0) + 1 FROM trip_stops WHERE trip_id=?", Integer.class, targetTripId);
            int round = ((Number) oldStop.get("delivery_round")).intValue() + 1;
            long newStopId = sql.insert("""
                INSERT INTO trip_stops(trip_id, order_id, delivery_address_id, stop_sequence, delivery_round, redelivered_from_stop_id)
                VALUES (?, ?, ?, ?, ?, ?)
                """, targetTripId, orderId, oldStop.get("delivery_address_id"), nextSeq, round, failedStopId);

            var oldItems = jdbc.queryForList("SELECT * FROM delivery_items WHERE trip_stop_id=?", failedStopId);
            for (var item : oldItems) {
                BigDecimal loaded = (BigDecimal) item.get("loaded_quantity");
                BigDecimal delivered = (BigDecimal) item.get("delivered_quantity");
                BigDecimal remaining = loaded.subtract(delivered == null ? BigDecimal.ZERO : delivered);
                if (remaining.signum() > 0) {
                    sql.insert("INSERT INTO delivery_items(trip_stop_id, order_item_id, batch_allocation_id, loaded_quantity) VALUES (?, ?, ?, ?)",
                        newStopId, item.get("order_item_id"), item.get("batch_allocation_id"), remaining);
                }
            }
            jdbc.update("UPDATE customer_orders SET order_status='READY_FOR_DELIVERY' WHERE order_id=?", orderId);
            return newStopId;
        });
    }

    public Map<String,Object> trip(Actor actor,long id) {
        var trip=jdbc.queryForMap("""
            SELECT t.*,
                   orig.address_name AS origin_name,
                   orig.address_line AS origin_address_line,
                   orig.district AS origin_district,
                   orig.city AS origin_city,
                   orig.latitude AS origin_latitude,
                   orig.longitude AS origin_longitude,
                   u.full_name AS driver_name,
                   u.phone AS driver_phone
            FROM delivery_trips t
            LEFT JOIN addresses orig ON orig.address_id=t.origin_address_id
            LEFT JOIN users u ON u.user_id=t.driver_user_id
            WHERE t.trip_id=?
        """,id);
        requireDriver(actor,trip);
        var stops=jdbc.queryForList("""
            SELECT s.*,
                   a.address_name, a.address_line, a.district, a.city,
                   a.contact_name, a.contact_phone,
                   a.latitude, a.longitude,
                   o.order_code,
                   org.organization_name AS restaurant_name
            FROM trip_stops s
            JOIN addresses a ON a.address_id=s.delivery_address_id
            JOIN customer_orders o ON o.order_id=s.order_id
            JOIN organizations org ON org.organization_id=o.restaurant_id
            WHERE s.trip_id=?
            ORDER BY s.stop_sequence
        """,id);
        for(var stop:stops) {
            stop.put("items",jdbc.queryForList("SELECT d.*,s.sku_name FROM delivery_items d JOIN order_items i ON i.order_item_id=d.order_item_id JOIN product_skus s ON s.sku_id=i.sku_id WHERE d.trip_stop_id=?",stop.get("trip_stop_id")));
            stop.put("assets",jdbc.queryForList("SELECT a.asset_id,a.asset_code,a.status FROM returnable_assets a JOIN addresses addr ON addr.organization_id=a.current_organization_id WHERE addr.address_id=?",stop.get("delivery_address_id")));
        }
        trip.put("stops",stops);return trip;
    }
    private void requireDriver(Actor actor,Map<String,Object> trip) {
        if(actor.hasRole("SYSTEM_ADMIN") || actor.hasRole("OPERATIONS_COORDINATOR")) return;
        actor.requireRole("DRIVER");
        if(((Number)trip.get("driver_user_id")).longValue()!=actor.userId()) throw new org.springframework.security.access.AccessDeniedException("Chuyến không được giao cho bạn");
    }
    @Transactional public void start(Actor actor,long id) {
        var trip=jdbc.queryForMap("SELECT * FROM delivery_trips WHERE trip_id=? FOR UPDATE",id);requireDriver(actor,trip);
        if(!trip.get("status").equals("PLANNED")) throw new IllegalArgumentException("Chuyến đã bắt đầu hoặc kết thúc");
        jdbc.update("UPDATE delivery_trips SET status='IN_PROGRESS',actual_departure_at=UTC_TIMESTAMP(3) WHERE trip_id=?",id);
        jdbc.update("UPDATE customer_orders o JOIN trip_stops s ON s.order_id=o.order_id SET o.order_status='OUT_FOR_DELIVERY' WHERE s.trip_id=?",id);
        jdbc.update("UPDATE batch_allocations a JOIN delivery_items d ON d.batch_allocation_id=a.batch_allocation_id JOIN trip_stops s ON s.trip_stop_id=d.trip_stop_id SET a.allocation_status='LOADED' WHERE s.trip_id=?",id);
    }
    public record Quantity(@NotNull Long deliveryItemId,@NotNull @DecimalMin("0") @Digits(integer=9,fraction=3) BigDecimal quantity) {}
    public record Proof(@NotBlank @Size(max=150) String receiver,@Size(max=500) String note,@NotEmpty @Size(max=200) List<@NotNull @Valid Quantity> items,Long evidenceId) {
        public Proof(String receiver,String note,List<Quantity> items) {this(receiver,note,items,null);}
    }
    @Transactional public long confirm(Actor actor,long stopId,Proof r,String key,boolean restaurant) {
        return dedup.execute(actor.userId(),key,(restaurant?"RECEIVE_":"DELIVER_")+stopId,r.toString(),()->{
            media.requireOwned(actor,r.evidenceId());
            var stop=jdbc.queryForMap("SELECT s.*,o.restaurant_id,t.driver_user_id,t.status AS trip_status FROM trip_stops s JOIN customer_orders o ON o.order_id=s.order_id JOIN delivery_trips t ON t.trip_id=s.trip_id WHERE s.trip_stop_id=? FOR UPDATE",stopId);
            if(restaurant) {
                actor.requireOrganization(((Number)stop.get("restaurant_id")).longValue(),"RESTAURANT_MANAGER","RESTAURANT_RECEIVER");
                if(!Set.of("DELIVERED","PARTIALLY_DELIVERED","FAILED").contains(stop.get("status")) || stop.get("restaurant_confirmed_at")!=null) throw new IllegalArgumentException("Điểm giao chưa có kết quả hoặc đã được xác nhận nhận");
            } else {
                requireDriver(actor,stop);
                if(!stop.get("trip_status").equals("IN_PROGRESS") || !stop.get("status").equals("PENDING")) throw new IllegalArgumentException("Điểm giao không còn chờ giao");
            }
            var items=jdbc.queryForList("SELECT * FROM delivery_items WHERE trip_stop_id=? FOR UPDATE",stopId);
            var quantities=new HashMap<Long,BigDecimal>();
            for(Quantity q:r.items()) if(quantities.put(q.deliveryItemId(),q.quantity())!=null) throw new IllegalArgumentException("Dòng giao bị trùng");
            if(quantities.size()!=items.size()) throw new IllegalArgumentException("Phải khai báo đủ các dòng giao");
            BigDecimal total=BigDecimal.ZERO,loaded=BigDecimal.ZERO;
            boolean discrepancy=false;
            for(var item:items) {
                BigDecimal q=quantities.get(((Number)item.get("delivery_item_id")).longValue());
                if(q==null || q.compareTo((BigDecimal)item.get("loaded_quantity"))>0) throw new IllegalArgumentException("Lượng giao/nhận vượt lượng xuất hoặc sai dòng hàng");
                BigDecimal expected=(BigDecimal)item.get(restaurant?"delivered_quantity":"loaded_quantity");
                if(q.compareTo(expected==null?BigDecimal.ZERO:expected)!=0)discrepancy=true;
                jdbc.update(restaurant?"UPDATE delivery_items SET received_quantity=? WHERE delivery_item_id=?":"UPDATE delivery_items SET delivered_quantity=? WHERE delivery_item_id=?",q,item.get("delivery_item_id"));
                total=total.add(q);loaded=loaded.add((BigDecimal)item.get("loaded_quantity"));
            }
            if(discrepancy&&(r.note()==null||r.note().isBlank()))throw new IllegalArgumentException("Cần ghi lý do khi số lượng giao/nhận có sai lệch");
            if(restaurant) {
                jdbc.update("UPDATE trip_stops SET restaurant_confirmed_at=UTC_TIMESTAMP(3) WHERE trip_stop_id=?",stopId);
                if(discrepancy)jdbc.update("INSERT INTO notifications(user_id,notification_type,title,message,related_entity_type,related_entity_id) SELECT DISTINCT m.user_id,'RECEIPT_MISMATCH','Cần xác minh chênh lệch nhận hàng',?,'ORDER',? FROM organization_members m JOIN member_roles mr ON mr.member_id=m.member_id JOIN roles ro ON ro.role_id=mr.role_id WHERE m.status='ACTIVE' AND ro.role_code IN ('CUSTOMER_SUPPORT','OPERATIONS_COORDINATOR')",r.note(),stop.get("order_id"));
            }
            else {
                String state=total.signum()==0?"FAILED":total.compareTo(loaded)==0?"DELIVERED":"PARTIALLY_DELIVERED";
                jdbc.update("UPDATE trip_stops SET status=?,completed_at=UTC_TIMESTAMP(3),receiver_name=?,receiver_note=?,failure_reason=? WHERE trip_stop_id=?",state,r.receiver(),r.note(),state.equals("DELIVERED")?null:r.note(),stopId);
                BigDecimal required=jdbc.queryForObject("SELECT SUM(confirmed_quantity) FROM order_items WHERE order_id=?",BigDecimal.class,stop.get("order_id"));
                jdbc.update("UPDATE customer_orders SET order_status=? WHERE order_id=?",total.compareTo(required)==0?"DELIVERED":"PARTIALLY_DELIVERED",stop.get("order_id"));
                jdbc.update("UPDATE order_items i SET delivered_quantity=(SELECT COALESCE(SUM(d.delivered_quantity),0) FROM delivery_items d WHERE d.order_item_id=i.order_item_id) WHERE i.order_id=?",stop.get("order_id"));
                if(jdbc.queryForObject("SELECT COUNT(*) FROM trip_stops WHERE trip_id=? AND status='PENDING'",Integer.class,stop.get("trip_id"))==0) jdbc.update("UPDATE delivery_trips SET status='COMPLETED',completed_at=UTC_TIMESTAMP(3) WHERE trip_id=?",stop.get("trip_id"));
            }
            return sql.insert("INSERT INTO delivery_events(trip_stop_id,event_type,actor_user_id,note,evidence_file_id) VALUES (?,?,?,?,?)",stopId,restaurant?"RESTAURANT_CONFIRMED":"DRIVER_CONFIRMED",actor.userId(),r.note(),r.evidenceId());
        });
    }
}
