-- V12: VietGAP traceability, dynamic QR data groups and digital cultivation diary

ALTER TABLE supplier_documents
    ADD COLUMN certifying_body VARCHAR(150) NULL AFTER document_number,
    ADD COLUMN certification_scope VARCHAR(255) NULL AFTER certifying_body;

ALTER TABLE batches
    ADD COLUMN variety_name VARCHAR(150) NULL AFTER sku_id,
    ADD COLUMN planting_date DATE NULL AFTER variety_name,
    ADD COLUMN packaging_facility VARCHAR(255) NULL AFTER planting_date,
    ADD COLUMN cultivation_diary JSON NULL AFTER trace_note;
