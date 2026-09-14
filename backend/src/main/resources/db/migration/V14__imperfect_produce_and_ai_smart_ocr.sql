-- V14: Imperfect produce classification (Grade B Rescue) and AI Smart OCR order logs

ALTER TABLE products
    ADD COLUMN grade_type VARCHAR(30) NOT NULL DEFAULT 'GRADE_A' AFTER product_name,
    ADD COLUMN rescue_reason VARCHAR(255) NULL AFTER grade_type,
    ADD COLUMN discount_percent INT NOT NULL DEFAULT 0 AFTER rescue_reason;

CREATE INDEX idx_products_grade ON products(grade_type);

CREATE TABLE ocr_order_logs (
    ocr_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    organization_id BIGINT UNSIGNED NULL,
    user_id BIGINT UNSIGNED NULL,
    scan_source ENUM('IMAGE_UPLOAD', 'CAMERA_SNAP', 'TEXT_NOTE', 'DEMO_SAMPLE') NOT NULL DEFAULT 'IMAGE_UPLOAD',
    detected_count INT NOT NULL DEFAULT 0,
    matched_count INT NOT NULL DEFAULT 0,
    raw_prompt_text TEXT NULL,
    status ENUM('SUCCESS', 'PARTIAL', 'FAILED') NOT NULL DEFAULT 'SUCCESS',
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    KEY idx_ocr_logs_org (organization_id, created_at)
) ENGINE=InnoDB;
