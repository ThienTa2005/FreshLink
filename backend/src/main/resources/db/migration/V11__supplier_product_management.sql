-- V11: Supplier product management and product image support for Cloudinary

ALTER TABLE products
    ADD COLUMN supplier_id BIGINT UNSIGNED NULL AFTER category_id,
    ADD COLUMN image_url VARCHAR(1000) NULL AFTER image_file_id,
    ADD CONSTRAINT fk_products_supplier FOREIGN KEY (supplier_id) REFERENCES organizations(organization_id) ON DELETE SET NULL;

CREATE INDEX idx_products_supplier ON products(supplier_id);
