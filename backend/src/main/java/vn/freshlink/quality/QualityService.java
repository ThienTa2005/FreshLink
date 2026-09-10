package vn.freshlink.quality;

import java.math.BigDecimal;
import java.util.*;
import jakarta.validation.constraints.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vn.freshlink.identity.Actor;
import vn.freshlink.common.*;

@Service
public class QualityService {
    private final JdbcTemplate jdbc; private final Sql sql; private final Idempotency dedup; private final MediaController media;
    public QualityService(JdbcTemplate jdbc,Sql sql,Idempotency dedup,MediaController media) {this.jdbc=jdbc;this.sql=sql;this.dedup=dedup;this.media=media;}
    public record Batch(@NotNull Long requestItemId,@NotNull @DecimalMin("0.001") @Digits(integer=9,fraction=3) BigDecimal quantity,@NotBlank @Size(max=1000) String origin) {}
    @Transactional public long create(Actor actor,Batch r,String key) {
        return dedup.execute(actor.userId(),key,"CREATE_BATCH",r.toString(),()->{
            var item=jdbc.queryForMap("SELECT i.*,r.supplier_id FROM supply_request_items i JOIN supply_requests r ON r.supply_request_id=i.supply_request_id WHERE i.supply_request_item_id=? FOR UPDATE",r.requestItemId());
            actor.requireOrganization(((Number)item.get("supplier_id")).longValue(),"SUPPLIER_MANAGER","SUPPLIER_STAFF");
            if(!Set.of("ACCEPTED","PARTIALLY_ACCEPTED").contains(item.get("status"))) throw new IllegalArgumentException("Cần xác nhận cung ứng trước khi tạo lô");
            BigDecimal declared=jdbc.queryForObject("SELECT COALESCE(SUM(declared_quantity),0) FROM batches WHERE supply_request_item_id=?",BigDecimal.class,r.requestItemId());
            if(declared.add(r.quantity()).compareTo((BigDecimal)item.get("accepted_quantity"))>0) throw new IllegalArgumentException("Tổng lô vượt lượng cung ứng đã chốt");
            return sql.insert("INSERT INTO batches(batch_code,supplier_id,sku_id,supply_request_item_id,declared_quantity,trace_note,created_by) VALUES (?,?,?,?,?,?,?)","LO-"+UUID.randomUUID(),item.get("supplier_id"),item.get("sku_id"),r.requestItemId(),r.quantity(),r.origin(),actor.userId());
        });
    }
    public record Inspection(@NotNull @DecimalMin("0") @Digits(integer=9,fraction=3) BigDecimal accepted,
        @NotNull @DecimalMin("0") @Digits(integer=9,fraction=3) BigDecimal review,
        @NotNull @DecimalMin("0") @Digits(integer=9,fraction=3) BigDecimal rejected,
        @NotBlank @Size(max=1000) String note,Long evidenceId,Map<String,String> checklist) {
        public Inspection(BigDecimal accepted,BigDecimal review,BigDecimal rejected,String note) {this(accepted,review,rejected,note,null,Map.of());}
    }
    @Transactional public long inspect(Actor actor,long id,Inspection r,String key) {
        actor.requireRole("QUALITY_INSPECTOR");
        return dedup.execute(actor.userId(),key,"INSPECT_"+id,r.toString(),()->{
            media.requireOwned(actor,r.evidenceId());
            var batch=jdbc.queryForMap("SELECT * FROM batches WHERE batch_id=? FOR UPDATE",id);
            if(!batch.get("batch_status").equals("CREATED")) throw new IllegalArgumentException("Lô đã được kiểm nhận; cần quy trình kiểm tra lại riêng");
            BigDecimal received=r.accepted().add(r.review()).add(r.rejected());
            if(received.compareTo((BigDecimal)batch.get("declared_quantity"))>0) throw new IllegalArgumentException("Lượng nhận vượt lượng khai báo");
            String state=r.accepted().signum()>0?(r.accepted().compareTo(received)==0?"ACCEPTED":"PARTIALLY_ACCEPTED"):(r.review().signum()>0?"QUARANTINED":"REJECTED");
            String result=r.accepted().signum()>0?(r.accepted().compareTo(received)==0?"PASS":"PARTIAL_PASS"):(r.review().signum()>0?"QUARANTINE":"FAIL");
            jdbc.update("UPDATE batches SET received_quantity=?,accepted_quantity=?,review_quantity=?,rejected_quantity=?,batch_status=?,received_at=UTC_TIMESTAMP(3) WHERE batch_id=?",received,r.accepted(),r.review(),r.rejected(),state,id);
            long inspection=sql.insert("INSERT INTO batch_inspections(batch_id,inspector_id,final_result,accepted_quantity,review_quantity,rejected_quantity,general_note) VALUES (?,?,?,?,?,?,?)",id,actor.userId(),result,r.accepted(),r.review(),r.rejected(),r.note());
            if(r.checklist()!=null) for(var entry:r.checklist().entrySet()) {
                if(!Set.of("SPECIFICATION","PACKAGING","LABEL","APPEARANCE").contains(entry.getKey()) || !Set.of("PASS","REVIEW","FAIL","NOT_APPLICABLE").contains(entry.getValue())) throw new IllegalArgumentException("Checklist không hợp lệ");
                jdbc.update("INSERT INTO inspection_items(inspection_id,criterion_code,criterion_name,result,evidence_file_id) VALUES (?,?,?,?,?)",inspection,entry.getKey(),entry.getKey(),entry.getValue(),r.evidenceId());
            }
            // One supply line belongs to one order line in the MVP. Release unavailable units for replacement sourcing.
            BigDecimal lost=((BigDecimal)batch.get("declared_quantity")).subtract(r.accepted());
            var links=jdbc.queryForList("SELECT order_item_id,planned_quantity FROM supply_request_item_orders WHERE supply_request_item_id=? FOR UPDATE",batch.get("supply_request_item_id"));
            if(!links.isEmpty() && lost.signum()>0) {
                BigDecimal remaining=((BigDecimal)links.get(0).get("planned_quantity")).subtract(lost);
                if(remaining.signum()>0) jdbc.update("UPDATE supply_request_item_orders SET planned_quantity=? WHERE supply_request_item_id=?",remaining,batch.get("supply_request_item_id"));
                else jdbc.update("DELETE FROM supply_request_item_orders WHERE supply_request_item_id=?",batch.get("supply_request_item_id"));
            }
            return inspection;
        });
    }
    public record Allocation(@NotNull Long batchId,@NotNull Long orderItemId,@NotNull @DecimalMin("0.001") @Digits(integer=9,fraction=3) BigDecimal quantity) {}
    @Transactional public long allocate(Actor actor,Allocation r,String key) {
        actor.requireRole("OPERATIONS_COORDINATOR");
        return dedup.execute(actor.userId(),key,"ALLOCATE",r.toString(),()->{
            var item=jdbc.queryForMap("SELECT i.*,o.order_status FROM order_items i JOIN customer_orders o ON o.order_id=i.order_id WHERE i.order_item_id=? FOR UPDATE",r.orderItemId());
            var batch=jdbc.queryForMap("SELECT * FROM batches WHERE batch_id=? FOR UPDATE",r.batchId());
            if(!Set.of("CONFIRMED","SOURCING").contains(item.get("order_status"))) throw new IllegalArgumentException("Đơn không còn ở bước chia hàng");
            if(!item.get("sku_id").equals(batch.get("sku_id"))) throw new IllegalArgumentException("Lô và dòng đơn khác SKU");
            if(!Set.of("ACCEPTED","PARTIALLY_ACCEPTED").contains(batch.get("batch_status"))) throw new IllegalArgumentException("Lô chưa có lượng đạt");
            BigDecimal used=jdbc.queryForObject("SELECT COALESCE(SUM(allocated_quantity),0) FROM batch_allocations WHERE order_item_id=? AND allocation_status NOT IN ('RELEASED','CANCELLED')",BigDecimal.class,r.orderItemId());
            if(used.add(r.quantity()).compareTo((BigDecimal)item.get("confirmed_quantity"))>0) throw new IllegalArgumentException("Vượt lượng cần giao của dòng đơn");
            if(((BigDecimal)batch.get("allocated_quantity")).add(r.quantity()).compareTo((BigDecimal)batch.get("accepted_quantity"))>0) throw new IllegalArgumentException("Vượt lượng đạt còn lại của lô");
            long id=sql.insert("INSERT INTO batch_allocations(batch_id,order_item_id,allocated_quantity,allocated_by) VALUES (?,?,?,?)",r.batchId(),r.orderItemId(),r.quantity(),actor.userId());
            jdbc.update("UPDATE batches SET allocated_quantity=allocated_quantity+? WHERE batch_id=?",r.quantity(),r.batchId());
            return id;
        });
    }
}
