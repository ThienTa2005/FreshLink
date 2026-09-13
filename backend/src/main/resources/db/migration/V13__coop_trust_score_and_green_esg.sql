-- V13: Cooperative Trust & Reliability Score and Green ESG Partner Certificate

ALTER TABLE supplier_profiles
    ADD COLUMN quality_score DECIMAL(5,2) NOT NULL DEFAULT 0.00 AFTER supplier_score,
    ADD COLUMN fulfillment_score DECIMAL(5,2) NOT NULL DEFAULT 0.00 AFTER quality_score,
    ADD COLUMN cert_score DECIMAL(5,2) NOT NULL DEFAULT 0.00 AFTER fulfillment_score,
    ADD COLUMN claim_score DECIMAL(5,2) NOT NULL DEFAULT 0.00 AFTER cert_score,
    ADD COLUMN consistency_score DECIMAL(5,2) NOT NULL DEFAULT 0.00 AFTER claim_score,
    ADD COLUMN tier_rank VARCHAR(20) NOT NULL DEFAULT 'STANDARD_B' AFTER consistency_score,
    ADD COLUMN score_recalculated_at DATETIME(3) NULL AFTER tier_rank;

CREATE TABLE esg_partner_certificates (
    certificate_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    certificate_code VARCHAR(60) NOT NULL UNIQUE,
    organization_id BIGINT UNSIGNED NOT NULL,
    organization_type ENUM('RESTAURANT', 'SUPPLIER') NOT NULL,
    period_type ENUM('30_DAYS', '60_DAYS', 'ALL_TIME') NOT NULL DEFAULT '60_DAYS',
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    plastic_saved_kg DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    co2_saved_kg DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    crates_circulated INT NOT NULL DEFAULT 0,
    km_optimized DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    verified_by_freshlink BOOLEAN NOT NULL DEFAULT TRUE,
    issued_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    qr_public_code VARCHAR(64) NULL,
    KEY idx_esg_cert_org (organization_id, period_type),
    CONSTRAINT fk_esg_cert_org FOREIGN KEY (organization_id) REFERENCES organizations(organization_id) ON DELETE CASCADE
) ENGINE=InnoDB;
