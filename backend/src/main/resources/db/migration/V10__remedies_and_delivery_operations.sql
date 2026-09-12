-- V10: Order remedies, complaint notes & SLA, invoice adjustments, and crate vehicle tracking

CREATE TABLE order_remedies (
    remedy_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    order_id BIGINT UNSIGNED NOT NULL,
    order_item_id BIGINT UNSIGNED NOT NULL,
    version INT NOT NULL DEFAULT 1,
    remedy_type ENUM('SHORTAGE_REDUCTION', 'SUBSTITUTION', 'REDELIVERY', 'CANCEL_LINE') NOT NULL,
    affected_quantity DECIMAL(12,3) NOT NULL,
    substitute_sku_id BIGINT UNSIGNED NULL,
    substitute_quantity DECIMAL(12,3) NULL,
    price_difference DECIMAL(15,2) NOT NULL DEFAULT 0,
    deadline_at DATETIME(3) NOT NULL,
    status ENUM('PENDING', 'ACCEPTED', 'REJECTED', 'EXPIRED') NOT NULL DEFAULT 'PENDING',
    rejection_reason VARCHAR(500) NULL,
    proposed_by BIGINT UNSIGNED NOT NULL,
    decided_by BIGINT UNSIGNED NULL,
    decided_at DATETIME(3) NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    KEY idx_remedies_order (order_id, status),
    KEY idx_remedies_deadline (status, deadline_at),
    CONSTRAINT fk_remedy_order FOREIGN KEY (order_id) REFERENCES customer_orders(order_id) ON DELETE CASCADE,
    CONSTRAINT fk_remedy_order_item FOREIGN KEY (order_item_id) REFERENCES order_items(order_item_id),
    CONSTRAINT fk_remedy_substitute_sku FOREIGN KEY (substitute_sku_id) REFERENCES product_skus(sku_id),
    CONSTRAINT fk_remedy_proposer FOREIGN KEY (proposed_by) REFERENCES users(user_id),
    CONSTRAINT fk_remedy_decider FOREIGN KEY (decided_by) REFERENCES users(user_id)
) ENGINE=InnoDB;

CREATE TABLE complaint_notes (
    note_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    complaint_id BIGINT UNSIGNED NOT NULL,
    author_user_id BIGINT UNSIGNED NOT NULL,
    content VARCHAR(2000) NOT NULL,
    is_internal BOOLEAN NOT NULL DEFAULT FALSE,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    KEY idx_notes_complaint (complaint_id, created_at),
    CONSTRAINT fk_note_complaint FOREIGN KEY (complaint_id) REFERENCES complaints(complaint_id) ON DELETE CASCADE,
    CONSTRAINT fk_note_author FOREIGN KEY (author_user_id) REFERENCES users(user_id)
) ENGINE=InnoDB;

CREATE TABLE invoice_adjustments (
    adjustment_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    adjustment_code VARCHAR(30) NOT NULL UNIQUE,
    invoice_id BIGINT UNSIGNED NOT NULL,
    adjustment_type ENUM('CREDIT_NOTE', 'DEBIT_NOTE') NOT NULL,
    amount DECIMAL(15,2) NOT NULL,
    reason VARCHAR(500) NOT NULL,
    created_by BIGINT UNSIGNED NOT NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    KEY idx_adjustments_invoice (invoice_id),
    CONSTRAINT fk_adjustment_invoice FOREIGN KEY (invoice_id) REFERENCES invoices(invoice_id) ON DELETE CASCADE,
    CONSTRAINT fk_adjustment_creator FOREIGN KEY (created_by) REFERENCES users(user_id)
) ENGINE=InnoDB;

ALTER TABLE complaints
    ADD COLUMN first_response_due_at DATETIME(3) NULL AFTER submitted_at,
    ADD COLUMN first_responded_at DATETIME(3) NULL AFTER first_response_due_at,
    ADD COLUMN resolution_due_at DATETIME(3) NULL AFTER first_responded_at,
    ADD COLUMN assigned_department VARCHAR(30) NOT NULL DEFAULT 'CSKH' AFTER assigned_to;

ALTER TABLE returnable_assets
    MODIFY COLUMN status ENUM('AVAILABLE', 'IN_TRANSIT', 'ON_VEHICLE', 'AT_RESTAURANT', 'RETURNED_DIRTY', 'CLEANING', 'DAMAGED', 'LOST', 'RETIRED') NOT NULL DEFAULT 'AVAILABLE',
    ADD COLUMN driver_user_id BIGINT UNSIGNED NULL AFTER current_address_id,
    ADD CONSTRAINT fk_assets_driver FOREIGN KEY (driver_user_id) REFERENCES users(user_id) ON DELETE SET NULL;

ALTER TABLE trip_stops
    ADD COLUMN delivery_round SMALLINT UNSIGNED NOT NULL DEFAULT 1 AFTER stop_sequence,
    ADD COLUMN redelivered_from_stop_id BIGINT UNSIGNED NULL AFTER delivery_round,
    ADD CONSTRAINT fk_stop_redelivery FOREIGN KEY (redelivered_from_stop_id) REFERENCES trip_stops(trip_stop_id) ON DELETE SET NULL;
