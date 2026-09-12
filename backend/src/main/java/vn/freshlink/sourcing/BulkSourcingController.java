package vn.freshlink.sourcing;

import java.util.*;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import jakarta.validation.Validator;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import vn.freshlink.common.Idempotency;
import vn.freshlink.common.api.ApiResponse;
import vn.freshlink.identity.Actor;
import vn.freshlink.quality.QualityService;

@RestController @RequestMapping("/api")
public class BulkSourcingController {
 private final org.springframework.transaction.support.TransactionTemplate tx;private final SourcingService sourcing;private final QualityService quality;private final Idempotency dedup;private final Validator validator;private final JdbcTemplate jdbc;
 public BulkSourcingController(SourcingService s,QualityService q,Idempotency d,Validator v,JdbcTemplate j,org.springframework.transaction.PlatformTransactionManager tm){tx=new org.springframework.transaction.support.TransactionTemplate(tm);sourcing=s;quality=q;dedup=d;validator=v;jdbc=j;}
 public record Offers(@NotEmpty @Size(max=300) List<SourcingService.Offer> items,boolean dryRun){}
 public record Requests(@NotEmpty @Size(max=100) List<SourcingService.Request> items){}
 public record Allocations(@NotEmpty @Size(max=100) List<QualityService.Allocation> items){}
 private String invalid(Object x){var errors=validator.validate(x);return errors.isEmpty()?null:errors.iterator().next().getMessage();}
 @PostMapping("/supplier/offers/bulk") public ApiResponse<?> offers(@AuthenticationPrincipal Actor a,@Valid @RequestBody Offers r,@RequestHeader("Idempotency-Key") String key){
  var out=new ArrayList<Map<String,Object>>();for(int i=0;i<r.items().size();i++){var item=r.items().get(i);final int row=i;try{if(item==null)throw new IllegalArgumentException("Dòng trống");a.requireOrganization(item.supplierId(),"SUPPLIER_MANAGER","SUPPLIER_STAFF");String error=invalid(item);if(error!=null)throw new IllegalArgumentException(error);if(item.date().isBefore(java.time.LocalDate.now(java.time.ZoneId.of("Asia/Ho_Chi_Minh"))))throw new IllegalArgumentException("Ngày đã qua");if(jdbc.queryForObject("SELECT COUNT(*) FROM product_skus WHERE sku_id=? AND active=TRUE",Integer.class,item.skuId())!=1)throw new IllegalArgumentException("SKU không hoạt động");long id=r.dryRun()?0:tx.execute(status -> dedup.execute(a.userId(),key+"-"+row,"IMPORT_OFFER",item.toString(),()->sourcing.offer(a,item)));out.add(Map.of("row",i+1,"success",true,"id",id));}catch(IllegalArgumentException|org.springframework.dao.DataAccessException|org.springframework.security.access.AccessDeniedException e){out.add(Map.of("row",i+1,"success",false,"message",e instanceof org.springframework.dao.DataAccessException?"Dữ liệu xung đột; tải lại trước khi thử lại":e.getMessage()));}}
  return ApiResponse.success(out,r.dryRun()?"Đã kiểm tra từng dòng":"Kết quả nhập từng dòng");
 }
 @PostMapping("/operations/supply-requests/bulk") public ApiResponse<?> requests(@AuthenticationPrincipal Actor a,@Valid @RequestBody Requests r,@RequestHeader("Idempotency-Key") String key){
  a.requireRole("OPERATIONS_COORDINATOR");var out=new ArrayList<Map<String,Object>>();for(int i=0;i<r.items().size();i++){try{var item=r.items().get(i);String error=invalid(item);if(error!=null)throw new IllegalArgumentException(error);out.add(Map.of("row",i+1,"success",true,"id",sourcing.request(a,item,key+"-"+i)));}catch(RuntimeException e){out.add(Map.of("row",i+1,"success",false,"message",e instanceof org.springframework.dao.DataAccessException?"Dữ liệu xung đột; tải lại":e.getMessage()==null?"Không xử lý được dòng":e.getMessage()));}}return ApiResponse.success(out,"Kết quả phân nguồn từng dòng");
 }
 @PostMapping("/allocations/bulk") public ApiResponse<?> allocations(@AuthenticationPrincipal Actor a,@Valid @RequestBody Allocations r,@RequestHeader("Idempotency-Key") String key){
  a.requireRole("OPERATIONS_COORDINATOR");var out=new ArrayList<Map<String,Object>>();for(int i=0;i<r.items().size();i++){try{var item=r.items().get(i);String error=invalid(item);if(error!=null)throw new IllegalArgumentException(error);out.add(Map.of("row",i+1,"success",true,"id",quality.allocate(a,item,key+"-"+i)));}catch(RuntimeException e){out.add(Map.of("row",i+1,"success",false,"message",e instanceof org.springframework.dao.DataAccessException?"Dữ liệu xung đột; tải lại":e.getMessage()==null?"Không xử lý được dòng":e.getMessage()));}}return ApiResponse.success(out,"Kết quả chia hàng từng dòng");
 }
}
