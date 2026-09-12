package vn.freshlink.delivery;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;import org.springframework.jdbc.core.JdbcTemplate;import org.springframework.scheduling.annotation.Scheduled;import org.springframework.stereotype.Component;import org.springframework.transaction.annotation.Transactional;
@Component @ConditionalOnProperty(name="app.jobs.enabled",havingValue="true",matchIfMissing=true) public class LateDeliveryMonitor{
 private final JdbcTemplate jdbc;public LateDeliveryMonitor(JdbcTemplate j){jdbc=j;}
 @Scheduled(initialDelayString="${app.jobs.initial-delay-ms:60000}",fixedDelayString="${app.jobs.late-delivery-delay-ms:60000}") @Transactional public void detect(){
  var late=jdbc.queryForList("SELECT s.trip_stop_id,s.trip_id,t.trip_code,s.stop_sequence,COALESCE(s.eta_at,s.planned_arrival_at) expected_at FROM trip_stops s JOIN delivery_trips t ON t.trip_id=s.trip_id WHERE t.status='IN_PROGRESS' AND s.status IN ('PENDING','ARRIVED') AND COALESCE(s.eta_at,s.planned_arrival_at)<DATE_SUB(UTC_TIMESTAMP(3),INTERVAL 10 MINUTE) AND s.late_alerted_at IS NULL FOR UPDATE");
  for(var stop:late){long id=((Number)stop.get("trip_stop_id")).longValue();jdbc.update("INSERT INTO notifications(user_id,notification_type,title,message,related_entity_type,related_entity_id) SELECT DISTINCT m.user_id,'TRIP_LATE',CONCAT('Chuyến ',?,' đang trễ'),CONCAT('Điểm giao số ',?,' đã trễ hơn 10 phút'),'TRIP',? FROM organization_members m JOIN member_roles mr ON mr.member_id=m.member_id JOIN roles r ON r.role_id=mr.role_id WHERE r.role_code='OPERATIONS_COORDINATOR' AND m.status='ACTIVE'",stop.get("trip_code"),stop.get("stop_sequence"),stop.get("trip_id"));jdbc.update("UPDATE trip_stops SET late_alerted_at=UTC_TIMESTAMP(3) WHERE trip_stop_id=?",id);}
 }
}
