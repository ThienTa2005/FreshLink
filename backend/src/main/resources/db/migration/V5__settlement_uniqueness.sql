-- MVP settles each inspected batch once; prevents paying the same goods twice.
ALTER TABLE settlement_items ADD UNIQUE KEY uk_settled_batch_once (batch_id);
