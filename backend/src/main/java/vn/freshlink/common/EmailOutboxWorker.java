package vn.freshlink.common;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSenderImpl;
import com.fasterxml.jackson.databind.ObjectMapper;

@Component public class EmailOutboxWorker {
 private final JdbcTemplate jdbc;private final ObjectMapper json;
 @Value("${SMTP_HOST:}") private String host;
 @Value("${SMTP_PORT:587}") private int port;
 @Value("${SMTP_USERNAME:}") private String username;
 @Value("${SMTP_PASSWORD:}") private String password;
 @Value("${SMTP_FROM:}") private String from;
 public EmailOutboxWorker(JdbcTemplate j,ObjectMapper o){jdbc=j;json=o;}
 @Scheduled(fixedDelay=30000) @Transactional public void send(){
  if(host.isBlank()||from.isBlank())return;
  var rows=jdbc.queryForList("SELECT * FROM email_outbox WHERE status IN ('PENDING','FAILED') AND attempts<5 AND next_attempt_at<=UTC_TIMESTAMP(3) ORDER BY email_outbox_id LIMIT 5 FOR UPDATE SKIP LOCKED");
  var sender=new JavaMailSenderImpl();sender.setHost(host);sender.setPort(port);sender.setUsername(username);sender.setPassword(password);sender.getJavaMailProperties().put("mail.smtp.auth",!username.isBlank());sender.getJavaMailProperties().put("mail.smtp.starttls.enable",true);sender.getJavaMailProperties().put("mail.smtp.connectiontimeout",5000);sender.getJavaMailProperties().put("mail.smtp.timeout",5000);sender.getJavaMailProperties().put("mail.smtp.writetimeout",5000);
  for(var row:rows)try{var payload=json.readTree(row.get("payload").toString());var mail=new SimpleMailMessage();mail.setFrom(from);mail.setTo(row.get("recipient").toString());mail.setSubject(payload.path("subject").asText("FreshLink"));mail.setText(payload.path("text").asText());sender.send(mail);jdbc.update("UPDATE email_outbox SET status='SENT',sent_at=UTC_TIMESTAMP(3),attempts=attempts+1,payload=JSON_OBJECT('redacted',TRUE) WHERE email_outbox_id=?",row.get("email_outbox_id"));}catch(Exception e){jdbc.update("UPDATE email_outbox SET status='FAILED',attempts=attempts+1,next_attempt_at=DATE_ADD(UTC_TIMESTAMP(3),INTERVAL 5 MINUTE),last_error='Không gửi được email; kiểm tra cấu hình SMTP' WHERE email_outbox_id=?",row.get("email_outbox_id"));}
 }
}
