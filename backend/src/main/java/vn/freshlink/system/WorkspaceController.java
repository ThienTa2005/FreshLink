package vn.freshlink.system;

import java.util.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import vn.freshlink.identity.Actor;
import vn.freshlink.common.api.ApiResponse;

@RestController @RequestMapping("/api/workspace")
public class WorkspaceController {
 private final JdbcTemplate jdbc;
 public WorkspaceController(JdbcTemplate jdbc){this.jdbc=jdbc;}
 private void add(List<Map<String,Object>> out,String title,String url,String query,Object...args){
  if(out.stream().anyMatch(m->m.get("title").equals(title)&&m.get("url").equals(url)))return;
  out.add(Map.of("title",title,"url",url,"count",Objects.requireNonNullElse(jdbc.queryForObject(query,Long.class,args),0L)));
 }
 @GetMapping("/tasks") public ApiResponse<?> tasks(@AuthenticationPrincipal Actor a){
  var out=new ArrayList<Map<String,Object>>();
  for(var m:a.memberships()){
   long org=m.organizationId();
   if(m.organizationType().equals("RESTAURANT")){
    if(m.roles().contains("RESTAURANT_MANAGER"))add(out,"Đơn chờ duyệt","/portal/orders?status=SUBMITTED","SELECT COUNT(*) FROM customer_orders WHERE restaurant_id=? AND order_status='SUBMITTED'",org);
    add(out,"Hàng đang chuẩn bị / đang giao","/portal/orders","SELECT COUNT(*) FROM customer_orders WHERE restaurant_id=? AND order_status IN ('CONFIRMED','SOURCING','READY_FOR_DELIVERY','OUT_FOR_DELIVERY')",org);
    if(m.roles().contains("RESTAURANT_MANAGER")||m.roles().contains("RESTAURANT_RECEIVER")){
     add(out,"Chờ xác nhận nhận hàng","/portal/orders?receipt=pending","SELECT COUNT(*) FROM trip_stops s JOIN customer_orders o ON o.order_id=s.order_id WHERE o.restaurant_id=? AND s.restaurant_confirmed_at IS NULL AND s.status IN ('DELIVERED','PARTIALLY_DELIVERED','FAILED')",org);
     add(out,"Phương án chờ trả lời","/portal/claims","SELECT COUNT(*) FROM complaints WHERE restaurant_id=? AND status IN ('WAITING_PARTNER','RESOLVED')",org);
    }
    if(m.roles().contains("RESTAURANT_MANAGER"))add(out,"Đơn còn công nợ","/portal/invoices","SELECT COUNT(*) FROM customer_orders WHERE restaurant_id=? AND payment_status IN ('UNPAID','PARTIALLY_PAID') AND order_status NOT IN ('DRAFT','SUBMITTED','CANCELLED')",org);
   }
   if(m.organizationType().equals("SUPPLIER")){
    add(out,"Yêu cầu chờ phản hồi","/portal/supply-requests","SELECT COUNT(*) FROM supply_request_items i JOIN supply_requests r ON r.supply_request_id=i.supply_request_id WHERE r.supplier_id=? AND i.status='PENDING'",org);
    add(out,"Hàng phải giao hôm nay","/portal/supply-requests","SELECT COUNT(*) FROM supply_requests r JOIN supply_request_items i ON i.supply_request_id=r.supply_request_id WHERE r.supplier_id=? AND r.required_date=CURRENT_DATE AND i.status IN ('ACCEPTED','PARTIALLY_ACCEPTED')",org);
    add(out,"Lô đang giữ lại","/portal/batches","SELECT COUNT(*) FROM batches WHERE supplier_id=? AND review_quantity>0",org);
    add(out,"Hồ sơ lô cần bổ sung","/portal/batches","SELECT COUNT(*) FROM batch_document_requests r JOIN batches b ON b.batch_id=r.batch_id WHERE b.supplier_id=? AND r.status IN ('OPEN','REJECTED')",org);
    add(out,"Chứng nhận sắp hết hạn","/portal/supply-requests?tab=passport","SELECT COUNT(*) FROM supplier_documents WHERE supplier_id=? AND expiry_date<=DATE_ADD(CURRENT_DATE,INTERVAL 30 DAY)",org);
    if(m.roles().contains("SUPPLIER_MANAGER"))add(out,"Phiếu chờ chi trả","/portal/settlements","SELECT COUNT(*) FROM supplier_settlements WHERE supplier_id=? AND status='CONFIRMED'",org);
   }
  }
  if(a.hasRole("SYSTEM_ADMIN"))add(out,"Đối tác chờ duyệt","/portal/admin?tab=partners","SELECT COUNT(*) FROM organizations WHERE status='PENDING'");
  if(a.hasRole("OPERATIONS_COORDINATOR")){
   add(out,"Đơn cần chuẩn bị nguồn","/portal/supply-requests","SELECT COUNT(*) FROM customer_orders WHERE order_status IN ('CONFIRMED','SOURCING')");
   add(out,"NCC chưa phản hồi","/portal/supply-requests","SELECT COUNT(*) FROM supply_request_items WHERE status='PENDING'");
   add(out,"Lô chờ QC","/portal/batches","SELECT COUNT(*) FROM batches WHERE batch_status='CREATED'");
   add(out,"Chuyến chưa hoàn thành","/portal/trips","SELECT COUNT(*) FROM delivery_trips WHERE status IN ('PLANNED','LOADING','IN_PROGRESS')");
  }
  if(a.hasRole("QUALITY_INSPECTOR"))add(out,"Lô cần kiểm / tái kiểm","/portal/batches","SELECT COUNT(*) FROM batches WHERE batch_status='CREATED' OR review_quantity>0");
  if(a.hasRole("DRIVER"))add(out,"Chuyến được giao","/portal/trips","SELECT COUNT(*) FROM delivery_trips WHERE driver_user_id=? AND status IN ('PLANNED','LOADING','IN_PROGRESS')",a.userId());
  if(a.hasRole("CUSTOMER_SUPPORT"))add(out,"Khiếu nại chưa xong","/portal/claims","SELECT COUNT(*) FROM complaints WHERE status IN ('NEW','VERIFYING','WAITING_PARTNER')");
  if(a.hasRole("ACCOUNTANT"))add(out,"Phiếu cần thanh toán","/portal/invoices","SELECT COUNT(*) FROM invoices WHERE status NOT IN ('PAID','VOID')");
  return ApiResponse.success(out,"Việc theo vai trò hiện tại");
 }
 @GetMapping("/settlements/{id}") public ApiResponse<?> settlement(@AuthenticationPrincipal Actor a,@PathVariable long id){
  var row=jdbc.queryForMap("SELECT * FROM supplier_settlements WHERE settlement_id=?",id);
  if(!a.hasRole("ACCOUNTANT"))a.requireOrganization(((Number)row.get("supplier_id")).longValue(),"SUPPLIER_MANAGER");
  row.put("items",jdbc.queryForList("SELECT i.*,b.batch_code FROM settlement_items i JOIN batches b ON b.batch_id=i.batch_id WHERE settlement_id=?",id));return ApiResponse.success(row,"Chi tiết đối soát");
 }
}
