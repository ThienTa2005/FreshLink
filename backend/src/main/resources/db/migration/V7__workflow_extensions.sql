-- Workflow extensions. All changes are additive to preserve existing clients/data.
ALTER TABLE customer_orders
    ADD COLUMN approval_status ENUM('NOT_REQUIRED','PENDING','APPROVED','REJECTED') NOT NULL DEFAULT 'NOT_REQUIRED' AFTER order_status,
    ADD COLUMN approved_by BIGINT UNSIGNED NULL AFTER approval_status,
    ADD COLUMN approved_at DATETIME(3) NULL AFTER approved_by,
    ADD COLUMN rejection_reason VARCHAR(500) NULL AFTER approved_at,
    ADD CONSTRAINT fk_orders_approver FOREIGN KEY (approved_by) REFERENCES users(user_id) ON DELETE SET NULL;

ALTER TABLE supply_requests
    ADD COLUMN cancellation_reason VARCHAR(500) NULL AFTER note,
    ADD COLUMN cancelled_at DATETIME(3) NULL AFTER cancellation_reason;

ALTER TABLE delivery_trips
    ADD COLUMN cancellation_reason VARCHAR(500) NULL AFTER note,
    ADD COLUMN cancelled_at DATETIME(3) NULL AFTER cancellation_reason;

ALTER TABLE trip_stops
    ADD COLUMN eta_at DATETIME(3) NULL AFTER planned_arrival_at,
    ADD COLUMN last_latitude DECIMAL(10,7) NULL AFTER failure_reason,
    ADD COLUMN last_longitude DECIMAL(10,7) NULL AFTER last_latitude,
    ADD COLUMN location_updated_at DATETIME(3) NULL AFTER last_longitude,
    ADD CONSTRAINT chk_stop_location CHECK (
        (last_latitude IS NULL OR last_latitude BETWEEN -90 AND 90) AND
        (last_longitude IS NULL OR last_longitude BETWEEN -180 AND 180)
    );

CREATE TABLE organization_invitations (
    invitation_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    organization_id BIGINT UNSIGNED NOT NULL,
    email VARCHAR(150) NOT NULL,
    role_code VARCHAR(40) NOT NULL,
    token_hash CHAR(64) NOT NULL,
    status ENUM('PENDING','ACCEPTED','REVOKED','EXPIRED') NOT NULL DEFAULT 'PENDING',
    invited_by BIGINT UNSIGNED NOT NULL,
    expires_at DATETIME(3) NOT NULL,
    accepted_at DATETIME(3) NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    UNIQUE KEY uk_invitation_token (token_hash),
    KEY idx_invitation_org_status (organization_id,status,created_at),
    KEY idx_invitation_email_status (email,status),
    CONSTRAINT fk_invitation_org FOREIGN KEY (organization_id) REFERENCES organizations(organization_id) ON DELETE CASCADE,
    CONSTRAINT fk_invitation_role FOREIGN KEY (role_code) REFERENCES roles(role_code),
    CONSTRAINT fk_invitation_inviter FOREIGN KEY (invited_by) REFERENCES users(user_id)
) ENGINE=InnoDB;

CREATE TABLE invoices (
    invoice_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    invoice_code VARCHAR(40) NOT NULL,
    order_id BIGINT UNSIGNED NOT NULL,
    restaurant_id BIGINT UNSIGNED NOT NULL,
    issued_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    due_date DATE NOT NULL,
    subtotal_amount DECIMAL(15,2) NOT NULL,
    tax_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
    total_amount DECIMAL(15,2) NOT NULL,
    status ENUM('ISSUED','PARTIALLY_PAID','PAID','VOID','OVERDUE') NOT NULL DEFAULT 'ISSUED',
    note VARCHAR(500) NULL,
    created_by BIGINT UNSIGNED NOT NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    UNIQUE KEY uk_invoice_code (invoice_code),
    UNIQUE KEY uk_invoice_order (order_id),
    KEY idx_invoice_due (status,due_date),
    KEY idx_invoice_restaurant (restaurant_id,due_date),
    CONSTRAINT chk_invoice_amounts CHECK (subtotal_amount>=0 AND tax_amount>=0 AND total_amount>=0),
    CONSTRAINT fk_invoice_order FOREIGN KEY (order_id) REFERENCES customer_orders(order_id),
    CONSTRAINT fk_invoice_restaurant FOREIGN KEY (restaurant_id) REFERENCES restaurant_profiles(restaurant_id),
    CONSTRAINT fk_invoice_creator FOREIGN KEY (created_by) REFERENCES users(user_id)
) ENGINE=InnoDB;

CREATE TABLE supplier_ratings (
    rating_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    restaurant_id BIGINT UNSIGNED NOT NULL,
    supplier_id BIGINT UNSIGNED NOT NULL,
    order_id BIGINT UNSIGNED NOT NULL,
    score TINYINT UNSIGNED NOT NULL,
    comment VARCHAR(1000) NULL,
    created_by BIGINT UNSIGNED NOT NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    UNIQUE KEY uk_rating_order_supplier (order_id,supplier_id),
    KEY idx_rating_supplier (supplier_id,created_at),
    CONSTRAINT chk_rating_score CHECK (score BETWEEN 1 AND 5),
    CONSTRAINT fk_rating_restaurant FOREIGN KEY (restaurant_id) REFERENCES restaurant_profiles(restaurant_id),
    CONSTRAINT fk_rating_supplier FOREIGN KEY (supplier_id) REFERENCES supplier_profiles(supplier_id),
    CONSTRAINT fk_rating_order FOREIGN KEY (order_id) REFERENCES customer_orders(order_id),
    CONSTRAINT fk_rating_creator FOREIGN KEY (created_by) REFERENCES users(user_id)
) ENGINE=InnoDB;

CREATE TABLE asset_incidents (
    incident_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    asset_id BIGINT UNSIGNED NOT NULL,
    incident_type ENUM('DAMAGED','LOST') NOT NULL,
    fee_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
    description VARCHAR(1000) NOT NULL,
    status ENUM('OPEN','CONFIRMED','WAIVED','PAID') NOT NULL DEFAULT 'OPEN',
    reported_by BIGINT UNSIGNED NOT NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    resolved_at DATETIME(3) NULL,
    KEY idx_asset_incident_status (status,created_at),
    CONSTRAINT chk_incident_fee CHECK (fee_amount>=0),
    CONSTRAINT fk_incident_asset FOREIGN KEY (asset_id) REFERENCES returnable_assets(asset_id),
    CONSTRAINT fk_incident_reporter FOREIGN KEY (reported_by) REFERENCES users(user_id)
) ENGINE=InnoDB;

CREATE TABLE login_history (
    login_history_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT UNSIGNED NULL,
    email VARCHAR(150) NOT NULL,
    success BOOLEAN NOT NULL,
    ip_address VARCHAR(45) NULL,
    user_agent VARCHAR(500) NULL,
    occurred_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    KEY idx_login_user_time (user_id,occurred_at),
    KEY idx_login_email_time (email,occurred_at),
    CONSTRAINT fk_login_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE INDEX idx_notifications_user_created ON notifications(user_id,created_at);
