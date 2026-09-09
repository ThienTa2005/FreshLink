-- ============================================================
-- FreshLink - MySQL Database Schema
-- Target: MySQL 8.0+ / InnoDB / utf8mb4
-- Time convention: store DATETIME values in UTC; convert to
-- Asia/Ho_Chi_Minh in the application layer.
-- ============================================================

SET NAMES utf8mb4;

-- Run this schema on a new/empty database. It intentionally contains no
-- DROP TABLE commands, so importing it cannot silently erase existing data.

-- ============================================================
-- 1. ACCOUNT, ORGANIZATION AND AUTHORIZATION
-- ============================================================

CREATE TABLE organizations (
    organization_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    organization_code VARCHAR(30) NOT NULL,
    organization_name VARCHAR(200) NOT NULL,
    organization_type ENUM('FRESHLINK', 'RESTAURANT', 'SUPPLIER', 'LOGISTICS') NOT NULL,
    tax_code VARCHAR(30) NULL,
    phone VARCHAR(20) NULL,
    email VARCHAR(150) NULL,
    status ENUM('PENDING', 'ACTIVE', 'SUSPENDED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
        ON UPDATE CURRENT_TIMESTAMP(3),
    UNIQUE KEY uk_organizations_code (organization_code),
    UNIQUE KEY uk_organizations_tax_code (tax_code),
    KEY idx_organizations_type_status (organization_type, status)
) ENGINE=InnoDB;

CREATE TABLE users (
    user_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(150) NOT NULL,
    phone VARCHAR(20) NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(150) NOT NULL,
    avatar_url VARCHAR(500) NULL,
    status ENUM('PENDING', 'ACTIVE', 'LOCKED', 'DISABLED') NOT NULL DEFAULT 'PENDING',
    failed_login_count INT UNSIGNED NOT NULL DEFAULT 0,
    locked_until DATETIME(3) NULL,
    last_login_at DATETIME(3) NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
        ON UPDATE CURRENT_TIMESTAMP(3),
    UNIQUE KEY uk_users_email (email),
    UNIQUE KEY uk_users_phone (phone),
    KEY idx_users_status (status)
) ENGINE=InnoDB;

CREATE TABLE roles (
    role_id SMALLINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    role_code VARCHAR(40) NOT NULL,
    role_name VARCHAR(100) NOT NULL,
    description VARCHAR(500) NULL,
    UNIQUE KEY uk_roles_code (role_code)
) ENGINE=InnoDB;

CREATE TABLE organization_members (
    member_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    organization_id BIGINT UNSIGNED NOT NULL,
    user_id BIGINT UNSIGNED NOT NULL,
    job_title VARCHAR(100) NULL,
    is_primary BOOLEAN NOT NULL DEFAULT FALSE,
    status ENUM('INVITED', 'ACTIVE', 'DISABLED') NOT NULL DEFAULT 'INVITED',
    joined_at DATETIME(3) NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    UNIQUE KEY uk_org_member (organization_id, user_id),
    KEY idx_members_user_status (user_id, status),
    CONSTRAINT fk_members_organization
        FOREIGN KEY (organization_id) REFERENCES organizations(organization_id),
    CONSTRAINT fk_members_user
        FOREIGN KEY (user_id) REFERENCES users(user_id)
) ENGINE=InnoDB;

CREATE TABLE member_roles (
    member_id BIGINT UNSIGNED NOT NULL,
    role_id SMALLINT UNSIGNED NOT NULL,
    assigned_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    assigned_by BIGINT UNSIGNED NULL,
    PRIMARY KEY (member_id, role_id),
    CONSTRAINT fk_member_roles_member
        FOREIGN KEY (member_id) REFERENCES organization_members(member_id) ON DELETE CASCADE,
    CONSTRAINT fk_member_roles_role
        FOREIGN KEY (role_id) REFERENCES roles(role_id),
    CONSTRAINT fk_member_roles_assigner
        FOREIGN KEY (assigned_by) REFERENCES users(user_id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE media_files (
    file_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    organization_id BIGINT UNSIGNED NULL,
    uploaded_by BIGINT UNSIGNED NULL,
    original_name VARCHAR(255) NOT NULL,
    storage_key VARCHAR(500) NOT NULL,
    mime_type VARCHAR(120) NOT NULL,
    file_size_bytes BIGINT UNSIGNED NOT NULL,
    file_hash_sha256 CHAR(64) NULL,
    visibility ENUM('PRIVATE', 'AUTHENTICATED', 'PUBLIC') NOT NULL DEFAULT 'PRIVATE',
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    UNIQUE KEY uk_media_storage_key (storage_key),
    KEY idx_media_organization (organization_id, created_at),
    CONSTRAINT fk_media_organization
        FOREIGN KEY (organization_id) REFERENCES organizations(organization_id) ON DELETE SET NULL,
    CONSTRAINT fk_media_uploader
        FOREIGN KEY (uploaded_by) REFERENCES users(user_id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE addresses (
    address_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    organization_id BIGINT UNSIGNED NOT NULL,
    address_name VARCHAR(100) NOT NULL,
    contact_name VARCHAR(150) NULL,
    contact_phone VARCHAR(20) NULL,
    address_line VARCHAR(300) NOT NULL,
    ward VARCHAR(100) NULL,
    district VARCHAR(100) NOT NULL,
    city VARCHAR(100) NOT NULL DEFAULT 'Hà Nội',
    latitude DECIMAL(10,7) NULL,
    longitude DECIMAL(10,7) NULL,
    address_type ENUM('HEADQUARTER', 'DELIVERY', 'FARM', 'CROSS_DOCK', 'OTHER') NOT NULL,
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
        ON UPDATE CURRENT_TIMESTAMP(3),
    KEY idx_addresses_org_type (organization_id, address_type, active),
    KEY idx_addresses_area (city, district, ward),
    CONSTRAINT fk_addresses_organization
        FOREIGN KEY (organization_id) REFERENCES organizations(organization_id)
) ENGINE=InnoDB;

CREATE TABLE restaurant_profiles (
    restaurant_id BIGINT UNSIGNED PRIMARY KEY,
    restaurant_type ENUM('HOT_POT', 'BBQ', 'HOT_POT_BBQ', 'OTHER') NOT NULL,
    receiving_start_time TIME NULL,
    receiving_end_time TIME NULL,
    default_payment_term_days SMALLINT UNSIGNED NOT NULL DEFAULT 0,
    note VARCHAR(1000) NULL,
    CONSTRAINT fk_restaurant_profile_org
        FOREIGN KEY (restaurant_id) REFERENCES organizations(organization_id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE supplier_profiles (
    supplier_id BIGINT UNSIGNED PRIMARY KEY,
    supplier_type ENUM('COOPERATIVE', 'FARM', 'PROCESSOR', 'DISTRIBUTOR') NOT NULL,
    verification_status ENUM('NOT_SUBMITTED', 'UNDER_REVIEW', 'VERIFIED', 'EXPIRED', 'REJECTED')
        NOT NULL DEFAULT 'NOT_SUBMITTED',
    verified_at DATETIME(3) NULL,
    verified_by BIGINT UNSIGNED NULL,
    supplier_score DECIMAL(5,2) NULL,
    note VARCHAR(1000) NULL,
    CONSTRAINT chk_supplier_score
        CHECK (supplier_score IS NULL OR (supplier_score >= 0 AND supplier_score <= 100)),
    CONSTRAINT fk_supplier_profile_org
        FOREIGN KEY (supplier_id) REFERENCES organizations(organization_id) ON DELETE CASCADE,
    CONSTRAINT fk_supplier_verifier
        FOREIGN KEY (verified_by) REFERENCES users(user_id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE supplier_documents (
    supplier_document_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    supplier_id BIGINT UNSIGNED NOT NULL,
    file_id BIGINT UNSIGNED NOT NULL,
    document_type ENUM('BUSINESS_LICENSE', 'FOOD_SAFETY', 'VIETGAP', 'ORIGIN_PROOF', 'OTHER') NOT NULL,
    document_number VARCHAR(100) NULL,
    issued_date DATE NULL,
    expiry_date DATE NULL,
    verification_status ENUM('PENDING', 'APPROVED', 'REJECTED', 'EXPIRED') NOT NULL DEFAULT 'PENDING',
    verified_by BIGINT UNSIGNED NULL,
    verified_at DATETIME(3) NULL,
    rejection_reason VARCHAR(500) NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    KEY idx_supplier_documents_status (supplier_id, verification_status, expiry_date),
    CONSTRAINT fk_supplier_documents_supplier
        FOREIGN KEY (supplier_id) REFERENCES supplier_profiles(supplier_id),
    CONSTRAINT fk_supplier_documents_file
        FOREIGN KEY (file_id) REFERENCES media_files(file_id),
    CONSTRAINT fk_supplier_documents_verifier
        FOREIGN KEY (verified_by) REFERENCES users(user_id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ============================================================
-- 2. PRODUCT CATALOGUE, SKU, SUPPLY CAPACITY AND PRICE
-- ============================================================

CREATE TABLE product_categories (
    category_id SMALLINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    category_code VARCHAR(30) NOT NULL,
    category_name VARCHAR(100) NOT NULL,
    description VARCHAR(500) NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    UNIQUE KEY uk_categories_code (category_code)
) ENGINE=InnoDB;

CREATE TABLE products (
    product_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    category_id SMALLINT UNSIGNED NOT NULL,
    product_code VARCHAR(40) NOT NULL,
    product_name VARCHAR(150) NOT NULL,
    description VARCHAR(1000) NULL,
    image_file_id BIGINT UNSIGNED NULL,
    storage_temperature_note VARCHAR(255) NULL,
    shelf_life_hours SMALLINT UNSIGNED NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
        ON UPDATE CURRENT_TIMESTAMP(3),
    UNIQUE KEY uk_products_code (product_code),
    KEY idx_products_category_active (category_id, active),
    CONSTRAINT fk_products_category
        FOREIGN KEY (category_id) REFERENCES product_categories(category_id),
    CONSTRAINT fk_products_image
        FOREIGN KEY (image_file_id) REFERENCES media_files(file_id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE product_skus (
    sku_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    product_id BIGINT UNSIGNED NOT NULL,
    sku_code VARCHAR(50) NOT NULL,
    sku_name VARCHAR(180) NOT NULL,
    base_unit ENUM('KG', 'GRAM', 'PACK', 'BAG', 'BOX', 'BUNCH', 'CRATE') NOT NULL,
    pack_size DECIMAL(12,3) NOT NULL DEFAULT 1,
    pack_description VARCHAR(200) NULL,
    minimum_order_quantity DECIMAL(12,3) NOT NULL DEFAULT 1,
    quantity_step DECIMAL(12,3) NOT NULL DEFAULT 1,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
        ON UPDATE CURRENT_TIMESTAMP(3),
    UNIQUE KEY uk_product_skus_code (sku_code),
    KEY idx_product_skus_product_active (product_id, active),
    CONSTRAINT chk_sku_pack_size CHECK (pack_size > 0),
    CONSTRAINT chk_sku_minimum_quantity CHECK (minimum_order_quantity > 0),
    CONSTRAINT chk_sku_quantity_step CHECK (quantity_step > 0),
    CONSTRAINT fk_skus_product
        FOREIGN KEY (product_id) REFERENCES products(product_id)
) ENGINE=InnoDB;

CREATE TABLE supplier_sku_offers (
    supplier_offer_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    supplier_id BIGINT UNSIGNED NOT NULL,
    sku_id BIGINT UNSIGNED NOT NULL,
    available_date DATE NOT NULL,
    available_quantity DECIMAL(12,3) NOT NULL,
    reserved_quantity DECIMAL(12,3) NOT NULL DEFAULT 0,
    supplier_unit_price DECIMAL(15,2) NOT NULL,
    ready_time TIME NULL,
    lead_time_hours SMALLINT UNSIGNED NULL,
    status ENUM('DRAFT', 'AVAILABLE', 'PARTIALLY_RESERVED', 'FULLY_RESERVED', 'CLOSED')
        NOT NULL DEFAULT 'DRAFT',
    note VARCHAR(500) NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
        ON UPDATE CURRENT_TIMESTAMP(3),
    UNIQUE KEY uk_supplier_sku_date (supplier_id, sku_id, available_date),
    KEY idx_supplier_offers_date_status (available_date, status, sku_id),
    CONSTRAINT chk_offer_quantities CHECK (
        available_quantity >= 0 AND
        reserved_quantity >= 0 AND
        reserved_quantity <= available_quantity
    ),
    CONSTRAINT chk_offer_price CHECK (supplier_unit_price >= 0),
    CONSTRAINT fk_supplier_offers_supplier
        FOREIGN KEY (supplier_id) REFERENCES supplier_profiles(supplier_id),
    CONSTRAINT fk_supplier_offers_sku
        FOREIGN KEY (sku_id) REFERENCES product_skus(sku_id)
) ENGINE=InnoDB;

CREATE TABLE sku_prices (
    sku_price_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    sku_id BIGINT UNSIGNED NOT NULL,
    district VARCHAR(100) NULL,
    selling_unit_price DECIMAL(15,2) NOT NULL,
    valid_from DATETIME(3) NOT NULL,
    valid_to DATETIME(3) NULL,
    created_by BIGINT UNSIGNED NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    KEY idx_sku_prices_lookup (sku_id, district, valid_from, valid_to),
    CONSTRAINT chk_sku_selling_price CHECK (selling_unit_price >= 0),
    CONSTRAINT chk_sku_price_period CHECK (valid_to IS NULL OR valid_to > valid_from),
    CONSTRAINT fk_sku_prices_sku
        FOREIGN KEY (sku_id) REFERENCES product_skus(sku_id),
    CONSTRAINT fk_sku_prices_creator
        FOREIGN KEY (created_by) REFERENCES users(user_id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ============================================================
-- 3. WEEKLY DEMAND PLAN AND CUSTOMER ORDER
-- ============================================================

CREATE TABLE weekly_demand_plans (
    weekly_plan_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    restaurant_id BIGINT UNSIGNED NOT NULL,
    week_start_date DATE NOT NULL,
    status ENUM('DRAFT', 'SUBMITTED', 'LOCKED', 'CANCELLED') NOT NULL DEFAULT 'DRAFT',
    note VARCHAR(1000) NULL,
    submitted_at DATETIME(3) NULL,
    created_by BIGINT UNSIGNED NOT NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
        ON UPDATE CURRENT_TIMESTAMP(3),
    UNIQUE KEY uk_weekly_plan_restaurant_week (restaurant_id, week_start_date),
    KEY idx_weekly_plan_status (week_start_date, status),
    CONSTRAINT fk_weekly_plan_restaurant
        FOREIGN KEY (restaurant_id) REFERENCES restaurant_profiles(restaurant_id),
    CONSTRAINT fk_weekly_plan_creator
        FOREIGN KEY (created_by) REFERENCES users(user_id)
) ENGINE=InnoDB;

CREATE TABLE weekly_plan_items (
    weekly_plan_item_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    weekly_plan_id BIGINT UNSIGNED NOT NULL,
    sku_id BIGINT UNSIGNED NOT NULL,
    demand_date DATE NOT NULL,
    planned_quantity DECIMAL(12,3) NOT NULL,
    converted_order_item_id BIGINT UNSIGNED NULL,
    note VARCHAR(500) NULL,
    UNIQUE KEY uk_weekly_plan_sku_date (weekly_plan_id, sku_id, demand_date),
    KEY idx_weekly_items_demand_date (demand_date, sku_id),
    CONSTRAINT chk_weekly_planned_quantity CHECK (planned_quantity > 0),
    CONSTRAINT fk_weekly_items_plan
        FOREIGN KEY (weekly_plan_id) REFERENCES weekly_demand_plans(weekly_plan_id) ON DELETE CASCADE,
    CONSTRAINT fk_weekly_items_sku
        FOREIGN KEY (sku_id) REFERENCES product_skus(sku_id)
) ENGINE=InnoDB;

CREATE TABLE customer_orders (
    order_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    order_code VARCHAR(30) NOT NULL,
    restaurant_id BIGINT UNSIGNED NOT NULL,
    delivery_address_id BIGINT UNSIGNED NOT NULL,
    weekly_plan_id BIGINT UNSIGNED NULL,
    delivery_date DATE NOT NULL,
    receiving_start_time TIME NOT NULL,
    receiving_end_time TIME NOT NULL,
    order_status ENUM(
        'DRAFT', 'SUBMITTED', 'CONFIRMED', 'SOURCING', 'READY_FOR_DELIVERY',
        'OUT_FOR_DELIVERY', 'PARTIALLY_DELIVERED', 'DELIVERED', 'CANCELLED'
    ) NOT NULL DEFAULT 'DRAFT',
    payment_status ENUM('UNPAID', 'PARTIALLY_PAID', 'PAID', 'REFUNDED') NOT NULL DEFAULT 'UNPAID',
    substitution_policy ENUM('NO_SUBSTITUTION', 'ASK_BEFORE_SUBSTITUTION', 'ALLOW_EQUIVALENT')
        NOT NULL DEFAULT 'ASK_BEFORE_SUBSTITUTION',
    subtotal_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
    service_fee DECIMAL(15,2) NOT NULL DEFAULT 0,
    delivery_fee DECIMAL(15,2) NOT NULL DEFAULT 0,
    discount_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
    adjustment_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
    total_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
    note VARCHAR(1000) NULL,
    submitted_at DATETIME(3) NULL,
    confirmed_at DATETIME(3) NULL,
    cancelled_at DATETIME(3) NULL,
    cancellation_reason VARCHAR(500) NULL,
    created_by BIGINT UNSIGNED NOT NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
        ON UPDATE CURRENT_TIMESTAMP(3),
    UNIQUE KEY uk_orders_code (order_code),
    KEY idx_orders_restaurant_date (restaurant_id, delivery_date, order_status),
    KEY idx_orders_operations (delivery_date, order_status),
    CONSTRAINT chk_order_receiving_window CHECK (receiving_end_time > receiving_start_time),
    CONSTRAINT chk_order_amounts CHECK (
        subtotal_amount >= 0 AND service_fee >= 0 AND delivery_fee >= 0 AND
        discount_amount >= 0 AND total_amount >= 0
    ),
    CONSTRAINT fk_orders_restaurant
        FOREIGN KEY (restaurant_id) REFERENCES restaurant_profiles(restaurant_id),
    CONSTRAINT fk_orders_address
        FOREIGN KEY (delivery_address_id) REFERENCES addresses(address_id),
    CONSTRAINT fk_orders_weekly_plan
        FOREIGN KEY (weekly_plan_id) REFERENCES weekly_demand_plans(weekly_plan_id) ON DELETE SET NULL,
    CONSTRAINT fk_orders_creator
        FOREIGN KEY (created_by) REFERENCES users(user_id)
) ENGINE=InnoDB;

CREATE TABLE order_items (
    order_item_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    order_id BIGINT UNSIGNED NOT NULL,
    sku_id BIGINT UNSIGNED NOT NULL,
    requested_quantity DECIMAL(12,3) NOT NULL,
    confirmed_quantity DECIMAL(12,3) NOT NULL DEFAULT 0,
    delivered_quantity DECIMAL(12,3) NOT NULL DEFAULT 0,
    rejected_quantity DECIMAL(12,3) NOT NULL DEFAULT 0,
    unit_price DECIMAL(15,2) NOT NULL,
    line_discount_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
    line_total_amount DECIMAL(15,2) NOT NULL,
    item_status ENUM(
        'PENDING', 'CONFIRMED', 'PARTIALLY_SOURCED', 'SOURCED',
        'PARTIALLY_DELIVERED', 'DELIVERED', 'CANCELLED'
    ) NOT NULL DEFAULT 'PENDING',
    substitution_note VARCHAR(500) NULL,
    note VARCHAR(500) NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    UNIQUE KEY uk_order_item_sku (order_id, sku_id),
    KEY idx_order_items_sku_status (sku_id, item_status),
    CONSTRAINT chk_order_item_quantities CHECK (
        requested_quantity > 0 AND confirmed_quantity >= 0 AND
        delivered_quantity >= 0 AND rejected_quantity >= 0
    ),
    CONSTRAINT chk_order_item_amounts CHECK (
        unit_price >= 0 AND line_discount_amount >= 0 AND line_total_amount >= 0
    ),
    CONSTRAINT fk_order_items_order
        FOREIGN KEY (order_id) REFERENCES customer_orders(order_id) ON DELETE CASCADE,
    CONSTRAINT fk_order_items_sku
        FOREIGN KEY (sku_id) REFERENCES product_skus(sku_id)
) ENGINE=InnoDB;

ALTER TABLE weekly_plan_items
    ADD CONSTRAINT fk_weekly_items_converted_order_item
    FOREIGN KEY (converted_order_item_id) REFERENCES order_items(order_item_id) ON DELETE SET NULL;

CREATE TABLE order_status_history (
    order_status_history_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    order_id BIGINT UNSIGNED NOT NULL,
    old_status VARCHAR(40) NULL,
    new_status VARCHAR(40) NOT NULL,
    reason VARCHAR(500) NULL,
    changed_by BIGINT UNSIGNED NULL,
    changed_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    KEY idx_order_history_order_time (order_id, changed_at),
    CONSTRAINT fk_order_history_order
        FOREIGN KEY (order_id) REFERENCES customer_orders(order_id) ON DELETE CASCADE,
    CONSTRAINT fk_order_history_user
        FOREIGN KEY (changed_by) REFERENCES users(user_id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ============================================================
-- 4. SOURCE ALLOCATION AND SUPPLIER REQUEST
-- ============================================================

CREATE TABLE supply_requests (
    supply_request_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    request_code VARCHAR(30) NOT NULL,
    supplier_id BIGINT UNSIGNED NOT NULL,
    delivery_to_address_id BIGINT UNSIGNED NOT NULL,
    required_date DATE NOT NULL,
    required_arrival_time TIME NOT NULL,
    status ENUM(
        'DRAFT', 'SENT', 'ACCEPTED', 'PARTIALLY_ACCEPTED', 'REJECTED',
        'PREPARING', 'DISPATCHED', 'RECEIVED', 'CANCELLED'
    ) NOT NULL DEFAULT 'DRAFT',
    sent_at DATETIME(3) NULL,
    responded_at DATETIME(3) NULL,
    note VARCHAR(1000) NULL,
    created_by BIGINT UNSIGNED NOT NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
        ON UPDATE CURRENT_TIMESTAMP(3),
    UNIQUE KEY uk_supply_requests_code (request_code),
    KEY idx_supply_requests_supplier_date (supplier_id, required_date, status),
    KEY idx_supply_requests_operations (required_date, status),
    CONSTRAINT fk_supply_requests_supplier
        FOREIGN KEY (supplier_id) REFERENCES supplier_profiles(supplier_id),
    CONSTRAINT fk_supply_requests_address
        FOREIGN KEY (delivery_to_address_id) REFERENCES addresses(address_id),
    CONSTRAINT fk_supply_requests_creator
        FOREIGN KEY (created_by) REFERENCES users(user_id)
) ENGINE=InnoDB;

CREATE TABLE supply_request_items (
    supply_request_item_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    supply_request_id BIGINT UNSIGNED NOT NULL,
    sku_id BIGINT UNSIGNED NOT NULL,
    supplier_offer_id BIGINT UNSIGNED NULL,
    requested_quantity DECIMAL(12,3) NOT NULL,
    accepted_quantity DECIMAL(12,3) NOT NULL DEFAULT 0,
    received_quantity DECIMAL(12,3) NOT NULL DEFAULT 0,
    supplier_unit_price DECIMAL(15,2) NOT NULL,
    commission_rate DECIMAL(5,2) NOT NULL DEFAULT 0,
    status ENUM('PENDING', 'ACCEPTED', 'PARTIALLY_ACCEPTED', 'REJECTED', 'RECEIVED', 'CANCELLED')
        NOT NULL DEFAULT 'PENDING',
    rejection_reason VARCHAR(500) NULL,
    UNIQUE KEY uk_supply_request_sku (supply_request_id, sku_id),
    KEY idx_supply_request_items_sku (sku_id, status),
    CONSTRAINT chk_supply_item_quantities CHECK (
        requested_quantity > 0 AND accepted_quantity >= 0 AND received_quantity >= 0 AND
        accepted_quantity <= requested_quantity
    ),
    CONSTRAINT chk_supply_item_price CHECK (supplier_unit_price >= 0),
    CONSTRAINT chk_supply_item_commission CHECK (commission_rate >= 0 AND commission_rate <= 100),
    CONSTRAINT fk_supply_items_request
        FOREIGN KEY (supply_request_id) REFERENCES supply_requests(supply_request_id) ON DELETE CASCADE,
    CONSTRAINT fk_supply_items_sku
        FOREIGN KEY (sku_id) REFERENCES product_skus(sku_id),
    CONSTRAINT fk_supply_items_offer
        FOREIGN KEY (supplier_offer_id) REFERENCES supplier_sku_offers(supplier_offer_id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE supply_request_item_orders (
    supply_request_item_id BIGINT UNSIGNED NOT NULL,
    order_item_id BIGINT UNSIGNED NOT NULL,
    planned_quantity DECIMAL(12,3) NOT NULL,
    PRIMARY KEY (supply_request_item_id, order_item_id),
    KEY idx_supply_item_orders_order (order_item_id),
    CONSTRAINT chk_supply_order_planned_quantity CHECK (planned_quantity > 0),
    CONSTRAINT fk_supply_item_orders_supply_item
        FOREIGN KEY (supply_request_item_id) REFERENCES supply_request_items(supply_request_item_id)
        ON DELETE CASCADE,
    CONSTRAINT fk_supply_item_orders_order_item
        FOREIGN KEY (order_item_id) REFERENCES order_items(order_item_id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ============================================================
-- 5. BATCH, FRESHLINK GATE AND TRACEABILITY
-- ============================================================

CREATE TABLE batches (
    batch_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    batch_code VARCHAR(40) NOT NULL,
    supplier_id BIGINT UNSIGNED NOT NULL,
    sku_id BIGINT UNSIGNED NOT NULL,
    supply_request_item_id BIGINT UNSIGNED NULL,
    origin_address_id BIGINT UNSIGNED NULL,
    harvest_at DATETIME(3) NULL,
    packed_at DATETIME(3) NULL,
    expiry_at DATETIME(3) NULL,
    dispatched_at DATETIME(3) NULL,
    received_at DATETIME(3) NULL,
    declared_quantity DECIMAL(12,3) NOT NULL,
    received_quantity DECIMAL(12,3) NOT NULL DEFAULT 0,
    accepted_quantity DECIMAL(12,3) NOT NULL DEFAULT 0,
    review_quantity DECIMAL(12,3) NOT NULL DEFAULT 0,
    rejected_quantity DECIMAL(12,3) NOT NULL DEFAULT 0,
    allocated_quantity DECIMAL(12,3) NOT NULL DEFAULT 0,
    batch_status ENUM(
        'CREATED', 'DISPATCHED', 'RECEIVED', 'WAITING_INSPECTION',
        'ACCEPTED', 'PARTIALLY_ACCEPTED', 'QUARANTINED', 'REJECTED', 'CLOSED'
    ) NOT NULL DEFAULT 'CREATED',
    trace_note VARCHAR(1000) NULL,
    created_by BIGINT UNSIGNED NOT NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
        ON UPDATE CURRENT_TIMESTAMP(3),
    UNIQUE KEY uk_batches_code (batch_code),
    KEY idx_batches_supplier_time (supplier_id, created_at),
    KEY idx_batches_gate (batch_status, received_at),
    KEY idx_batches_sku_expiry (sku_id, expiry_at),
    CONSTRAINT chk_batch_quantities CHECK (
        declared_quantity > 0 AND received_quantity >= 0 AND accepted_quantity >= 0 AND
        review_quantity >= 0 AND rejected_quantity >= 0 AND allocated_quantity >= 0 AND
        allocated_quantity <= accepted_quantity
    ),
    CONSTRAINT chk_batch_dates CHECK (expiry_at IS NULL OR packed_at IS NULL OR expiry_at > packed_at),
    CONSTRAINT fk_batches_supplier
        FOREIGN KEY (supplier_id) REFERENCES supplier_profiles(supplier_id),
    CONSTRAINT fk_batches_sku
        FOREIGN KEY (sku_id) REFERENCES product_skus(sku_id),
    CONSTRAINT fk_batches_supply_item
        FOREIGN KEY (supply_request_item_id) REFERENCES supply_request_items(supply_request_item_id)
        ON DELETE SET NULL,
    CONSTRAINT fk_batches_origin_address
        FOREIGN KEY (origin_address_id) REFERENCES addresses(address_id) ON DELETE SET NULL,
    CONSTRAINT fk_batches_creator
        FOREIGN KEY (created_by) REFERENCES users(user_id)
) ENGINE=InnoDB;

CREATE TABLE batch_inspections (
    inspection_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    batch_id BIGINT UNSIGNED NOT NULL,
    inspection_round SMALLINT UNSIGNED NOT NULL DEFAULT 1,
    inspector_id BIGINT UNSIGNED NOT NULL,
    ai_suggestion ENUM('NOT_USED', 'PASS', 'REVIEW', 'FAIL') NOT NULL DEFAULT 'NOT_USED',
    ai_confidence DECIMAL(5,2) NULL,
    final_result ENUM('PASS', 'PARTIAL_PASS', 'REVIEW', 'QUARANTINE', 'FAIL') NOT NULL,
    accepted_quantity DECIMAL(12,3) NOT NULL DEFAULT 0,
    review_quantity DECIMAL(12,3) NOT NULL DEFAULT 0,
    rejected_quantity DECIMAL(12,3) NOT NULL DEFAULT 0,
    general_note VARCHAR(1000) NULL,
    inspected_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    UNIQUE KEY uk_batch_inspection_round (batch_id, inspection_round),
    KEY idx_inspections_result_time (final_result, inspected_at),
    CONSTRAINT chk_inspection_ai_confidence CHECK (
        ai_confidence IS NULL OR (ai_confidence >= 0 AND ai_confidence <= 100)
    ),
    CONSTRAINT chk_inspection_quantities CHECK (
        accepted_quantity >= 0 AND review_quantity >= 0 AND rejected_quantity >= 0
    ),
    CONSTRAINT fk_inspections_batch
        FOREIGN KEY (batch_id) REFERENCES batches(batch_id) ON DELETE CASCADE,
    CONSTRAINT fk_inspections_inspector
        FOREIGN KEY (inspector_id) REFERENCES users(user_id)
) ENGINE=InnoDB;

CREATE TABLE inspection_items (
    inspection_item_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    inspection_id BIGINT UNSIGNED NOT NULL,
    criterion_code VARCHAR(50) NOT NULL,
    criterion_name VARCHAR(150) NOT NULL,
    result ENUM('PASS', 'REVIEW', 'FAIL', 'NOT_APPLICABLE') NOT NULL,
    measured_value VARCHAR(100) NULL,
    note VARCHAR(500) NULL,
    evidence_file_id BIGINT UNSIGNED NULL,
    UNIQUE KEY uk_inspection_criterion (inspection_id, criterion_code),
    CONSTRAINT fk_inspection_items_inspection
        FOREIGN KEY (inspection_id) REFERENCES batch_inspections(inspection_id) ON DELETE CASCADE,
    CONSTRAINT fk_inspection_items_evidence
        FOREIGN KEY (evidence_file_id) REFERENCES media_files(file_id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE batch_allocations (
    batch_allocation_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    batch_id BIGINT UNSIGNED NOT NULL,
    order_item_id BIGINT UNSIGNED NOT NULL,
    allocated_quantity DECIMAL(12,3) NOT NULL,
    allocation_status ENUM('RESERVED', 'PICKED', 'LOADED', 'DELIVERED', 'RELEASED', 'CANCELLED')
        NOT NULL DEFAULT 'RESERVED',
    allocated_by BIGINT UNSIGNED NOT NULL,
    allocated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
        ON UPDATE CURRENT_TIMESTAMP(3),
    UNIQUE KEY uk_batch_order_item (batch_id, order_item_id),
    KEY idx_allocations_order_item (order_item_id, allocation_status),
    KEY idx_allocations_batch_status (batch_id, allocation_status),
    CONSTRAINT chk_allocation_quantity CHECK (allocated_quantity > 0),
    CONSTRAINT fk_allocations_batch
        FOREIGN KEY (batch_id) REFERENCES batches(batch_id),
    CONSTRAINT fk_allocations_order_item
        FOREIGN KEY (order_item_id) REFERENCES order_items(order_item_id),
    CONSTRAINT fk_allocations_user
        FOREIGN KEY (allocated_by) REFERENCES users(user_id)
) ENGINE=InnoDB;

-- IMPORTANT: when creating/updating an allocation, the backend must use a
-- transaction and lock the batch row (SELECT ... FOR UPDATE), then ensure:
-- SUM(active batch_allocations.allocated_quantity) <= batches.accepted_quantity.

-- ============================================================
-- 6. VEHICLE, DELIVERY TRIP AND DELIVERY EVIDENCE
-- ============================================================

CREATE TABLE vehicles (
    vehicle_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    logistics_organization_id BIGINT UNSIGNED NOT NULL,
    license_plate VARCHAR(20) NOT NULL,
    vehicle_type ENUM('MOTORBIKE', 'CAR', 'VAN', 'TRUCK') NOT NULL,
    capacity_kg DECIMAL(12,3) NULL,
    refrigerated BOOLEAN NOT NULL DEFAULT FALSE,
    status ENUM('AVAILABLE', 'IN_USE', 'MAINTENANCE', 'INACTIVE') NOT NULL DEFAULT 'AVAILABLE',
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    UNIQUE KEY uk_vehicles_license_plate (license_plate),
    KEY idx_vehicles_logistics_status (logistics_organization_id, status),
    CONSTRAINT chk_vehicle_capacity CHECK (capacity_kg IS NULL OR capacity_kg > 0),
    CONSTRAINT fk_vehicles_logistics_org
        FOREIGN KEY (logistics_organization_id) REFERENCES organizations(organization_id)
) ENGINE=InnoDB;

CREATE TABLE delivery_trips (
    trip_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    trip_code VARCHAR(30) NOT NULL,
    trip_date DATE NOT NULL,
    origin_address_id BIGINT UNSIGNED NOT NULL,
    driver_user_id BIGINT UNSIGNED NOT NULL,
    vehicle_id BIGINT UNSIGNED NULL,
    status ENUM('PLANNED', 'LOADING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED')
        NOT NULL DEFAULT 'PLANNED',
    planned_departure_at DATETIME(3) NULL,
    actual_departure_at DATETIME(3) NULL,
    completed_at DATETIME(3) NULL,
    total_distance_km DECIMAL(10,2) NULL,
    route_data JSON NULL,
    note VARCHAR(1000) NULL,
    created_by BIGINT UNSIGNED NOT NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
        ON UPDATE CURRENT_TIMESTAMP(3),
    UNIQUE KEY uk_delivery_trips_code (trip_code),
    KEY idx_trips_driver_date (driver_user_id, trip_date, status),
    KEY idx_trips_operations (trip_date, status),
    CONSTRAINT chk_trip_distance CHECK (total_distance_km IS NULL OR total_distance_km >= 0),
    CONSTRAINT fk_trips_origin
        FOREIGN KEY (origin_address_id) REFERENCES addresses(address_id),
    CONSTRAINT fk_trips_driver
        FOREIGN KEY (driver_user_id) REFERENCES users(user_id),
    CONSTRAINT fk_trips_vehicle
        FOREIGN KEY (vehicle_id) REFERENCES vehicles(vehicle_id) ON DELETE SET NULL,
    CONSTRAINT fk_trips_creator
        FOREIGN KEY (created_by) REFERENCES users(user_id)
) ENGINE=InnoDB;

CREATE TABLE trip_stops (
    trip_stop_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    trip_id BIGINT UNSIGNED NOT NULL,
    order_id BIGINT UNSIGNED NOT NULL,
    delivery_address_id BIGINT UNSIGNED NOT NULL,
    stop_sequence SMALLINT UNSIGNED NOT NULL,
    planned_arrival_at DATETIME(3) NULL,
    actual_arrival_at DATETIME(3) NULL,
    completed_at DATETIME(3) NULL,
    status ENUM('PENDING', 'ARRIVED', 'DELIVERED', 'PARTIALLY_DELIVERED', 'FAILED', 'SKIPPED')
        NOT NULL DEFAULT 'PENDING',
    receiver_name VARCHAR(150) NULL,
    receiver_phone VARCHAR(20) NULL,
    receiver_note VARCHAR(500) NULL,
    failure_reason VARCHAR(500) NULL,
    latitude_at_completion DECIMAL(10,7) NULL,
    longitude_at_completion DECIMAL(10,7) NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    UNIQUE KEY uk_trip_stop_sequence (trip_id, stop_sequence),
    KEY idx_trip_stops_order (order_id, status),
    CONSTRAINT fk_trip_stops_trip
        FOREIGN KEY (trip_id) REFERENCES delivery_trips(trip_id) ON DELETE CASCADE,
    CONSTRAINT fk_trip_stops_order
        FOREIGN KEY (order_id) REFERENCES customer_orders(order_id),
    CONSTRAINT fk_trip_stops_address
        FOREIGN KEY (delivery_address_id) REFERENCES addresses(address_id)
) ENGINE=InnoDB;

CREATE TABLE delivery_items (
    delivery_item_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    trip_stop_id BIGINT UNSIGNED NOT NULL,
    order_item_id BIGINT UNSIGNED NOT NULL,
    batch_allocation_id BIGINT UNSIGNED NOT NULL,
    loaded_quantity DECIMAL(12,3) NOT NULL,
    delivered_quantity DECIMAL(12,3) NOT NULL DEFAULT 0,
    rejected_quantity DECIMAL(12,3) NOT NULL DEFAULT 0,
    rejection_reason VARCHAR(500) NULL,
    UNIQUE KEY uk_delivery_allocation (trip_stop_id, batch_allocation_id),
    KEY idx_delivery_items_order_item (order_item_id),
    CONSTRAINT chk_delivery_item_quantities CHECK (
        loaded_quantity > 0 AND delivered_quantity >= 0 AND rejected_quantity >= 0 AND
        delivered_quantity + rejected_quantity <= loaded_quantity
    ),
    CONSTRAINT fk_delivery_items_stop
        FOREIGN KEY (trip_stop_id) REFERENCES trip_stops(trip_stop_id) ON DELETE CASCADE,
    CONSTRAINT fk_delivery_items_order_item
        FOREIGN KEY (order_item_id) REFERENCES order_items(order_item_id),
    CONSTRAINT fk_delivery_items_allocation
        FOREIGN KEY (batch_allocation_id) REFERENCES batch_allocations(batch_allocation_id)
) ENGINE=InnoDB;

CREATE TABLE delivery_events (
    delivery_event_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    trip_stop_id BIGINT UNSIGNED NOT NULL,
    event_type ENUM(
        'DRIVER_ARRIVED', 'DRIVER_CONFIRMED', 'RESTAURANT_CONFIRMED',
        'PARTIAL_DELIVERY', 'DELIVERY_FAILED', 'PHOTO_ADDED', 'SIGNATURE_ADDED'
    ) NOT NULL,
    actor_user_id BIGINT UNSIGNED NULL,
    evidence_file_id BIGINT UNSIGNED NULL,
    latitude DECIMAL(10,7) NULL,
    longitude DECIMAL(10,7) NULL,
    note VARCHAR(500) NULL,
    occurred_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    KEY idx_delivery_events_stop_time (trip_stop_id, occurred_at),
    CONSTRAINT fk_delivery_events_stop
        FOREIGN KEY (trip_stop_id) REFERENCES trip_stops(trip_stop_id) ON DELETE CASCADE,
    CONSTRAINT fk_delivery_events_actor
        FOREIGN KEY (actor_user_id) REFERENCES users(user_id) ON DELETE SET NULL,
    CONSTRAINT fk_delivery_events_evidence
        FOREIGN KEY (evidence_file_id) REFERENCES media_files(file_id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ============================================================
-- 7. COMPLAINT, PAYMENT AND SUPPLIER SETTLEMENT
-- ============================================================

CREATE TABLE complaints (
    complaint_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    complaint_code VARCHAR(30) NOT NULL,
    order_id BIGINT UNSIGNED NOT NULL,
    restaurant_id BIGINT UNSIGNED NOT NULL,
    complaint_type ENUM(
        'LATE_DELIVERY', 'MISSING_QUANTITY', 'WRONG_ITEM', 'WRONG_SPECIFICATION',
        'QUALITY', 'DAMAGED_PACKAGING', 'OTHER'
    ) NOT NULL,
    status ENUM('NEW', 'VERIFYING', 'WAITING_PARTNER', 'RESOLVED', 'REJECTED', 'CLOSED')
        NOT NULL DEFAULT 'NEW',
    description VARCHAR(2000) NOT NULL,
    requested_resolution ENUM('REPLACE', 'DELIVER_MISSING', 'REFUND', 'CREDIT', 'OTHER') NOT NULL,
    final_resolution VARCHAR(1000) NULL,
    refund_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
    assigned_to BIGINT UNSIGNED NULL,
    submitted_by BIGINT UNSIGNED NOT NULL,
    submitted_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    resolved_at DATETIME(3) NULL,
    closed_at DATETIME(3) NULL,
    UNIQUE KEY uk_complaints_code (complaint_code),
    KEY idx_complaints_operations (status, submitted_at),
    KEY idx_complaints_restaurant (restaurant_id, submitted_at),
    CONSTRAINT chk_complaint_refund CHECK (refund_amount >= 0),
    CONSTRAINT fk_complaints_order
        FOREIGN KEY (order_id) REFERENCES customer_orders(order_id),
    CONSTRAINT fk_complaints_restaurant
        FOREIGN KEY (restaurant_id) REFERENCES restaurant_profiles(restaurant_id),
    CONSTRAINT fk_complaints_assignee
        FOREIGN KEY (assigned_to) REFERENCES users(user_id) ON DELETE SET NULL,
    CONSTRAINT fk_complaints_submitter
        FOREIGN KEY (submitted_by) REFERENCES users(user_id)
) ENGINE=InnoDB;

CREATE TABLE complaint_items (
    complaint_item_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    complaint_id BIGINT UNSIGNED NOT NULL,
    order_item_id BIGINT UNSIGNED NOT NULL,
    batch_id BIGINT UNSIGNED NULL,
    affected_quantity DECIMAL(12,3) NOT NULL,
    evidence_file_id BIGINT UNSIGNED NULL,
    responsibility ENUM('UNDETERMINED', 'SUPPLIER', 'FRESHLINK', 'LOGISTICS', 'RESTAURANT')
        NOT NULL DEFAULT 'UNDETERMINED',
    note VARCHAR(500) NULL,
    KEY idx_complaint_items_batch (batch_id),
    CONSTRAINT chk_complaint_affected_quantity CHECK (affected_quantity > 0),
    CONSTRAINT fk_complaint_items_complaint
        FOREIGN KEY (complaint_id) REFERENCES complaints(complaint_id) ON DELETE CASCADE,
    CONSTRAINT fk_complaint_items_order_item
        FOREIGN KEY (order_item_id) REFERENCES order_items(order_item_id),
    CONSTRAINT fk_complaint_items_batch
        FOREIGN KEY (batch_id) REFERENCES batches(batch_id) ON DELETE SET NULL,
    CONSTRAINT fk_complaint_items_evidence
        FOREIGN KEY (evidence_file_id) REFERENCES media_files(file_id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE payments (
    payment_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    payment_code VARCHAR(40) NOT NULL,
    order_id BIGINT UNSIGNED NOT NULL,
    restaurant_id BIGINT UNSIGNED NOT NULL,
    payment_type ENUM('CUSTOMER_PAYMENT', 'REFUND') NOT NULL,
    method ENUM('BANK_TRANSFER', 'CASH', 'PAYMENT_GATEWAY', 'CREDIT_BALANCE') NOT NULL,
    amount DECIMAL(15,2) NOT NULL,
    status ENUM('PENDING', 'CONFIRMED', 'FAILED', 'CANCELLED') NOT NULL DEFAULT 'PENDING',
    external_reference VARCHAR(150) NULL,
    evidence_file_id BIGINT UNSIGNED NULL,
    paid_at DATETIME(3) NULL,
    confirmed_by BIGINT UNSIGNED NULL,
    confirmed_at DATETIME(3) NULL,
    note VARCHAR(500) NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    UNIQUE KEY uk_payments_code (payment_code),
    KEY idx_payments_order_status (order_id, status),
    KEY idx_payments_restaurant_time (restaurant_id, created_at),
    CONSTRAINT chk_payment_amount CHECK (amount > 0),
    CONSTRAINT fk_payments_order
        FOREIGN KEY (order_id) REFERENCES customer_orders(order_id),
    CONSTRAINT fk_payments_restaurant
        FOREIGN KEY (restaurant_id) REFERENCES restaurant_profiles(restaurant_id),
    CONSTRAINT fk_payments_evidence
        FOREIGN KEY (evidence_file_id) REFERENCES media_files(file_id) ON DELETE SET NULL,
    CONSTRAINT fk_payments_confirmer
        FOREIGN KEY (confirmed_by) REFERENCES users(user_id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE supplier_settlements (
    settlement_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    settlement_code VARCHAR(40) NOT NULL,
    supplier_id BIGINT UNSIGNED NOT NULL,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    gross_goods_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
    commission_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
    adjustment_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
    payable_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
    status ENUM('DRAFT', 'CONFIRMED', 'PAID', 'CANCELLED') NOT NULL DEFAULT 'DRAFT',
    paid_at DATETIME(3) NULL,
    external_reference VARCHAR(150) NULL,
    created_by BIGINT UNSIGNED NOT NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
        ON UPDATE CURRENT_TIMESTAMP(3),
    UNIQUE KEY uk_settlements_code (settlement_code),
    KEY idx_settlements_supplier_period (supplier_id, period_start, period_end),
    CONSTRAINT chk_settlement_period CHECK (period_end >= period_start),
    CONSTRAINT chk_settlement_amounts CHECK (
        gross_goods_amount >= 0 AND commission_amount >= 0 AND payable_amount >= 0
    ),
    CONSTRAINT fk_settlements_supplier
        FOREIGN KEY (supplier_id) REFERENCES supplier_profiles(supplier_id),
    CONSTRAINT fk_settlements_creator
        FOREIGN KEY (created_by) REFERENCES users(user_id)
) ENGINE=InnoDB;

CREATE TABLE settlement_items (
    settlement_item_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    settlement_id BIGINT UNSIGNED NOT NULL,
    batch_id BIGINT UNSIGNED NOT NULL,
    delivered_quantity DECIMAL(12,3) NOT NULL,
    supplier_unit_price DECIMAL(15,2) NOT NULL,
    gross_amount DECIMAL(15,2) NOT NULL,
    commission_rate DECIMAL(5,2) NOT NULL,
    commission_amount DECIMAL(15,2) NOT NULL,
    adjustment_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
    net_amount DECIMAL(15,2) NOT NULL,
    note VARCHAR(500) NULL,
    UNIQUE KEY uk_settlement_batch (settlement_id, batch_id),
    CONSTRAINT chk_settlement_item_values CHECK (
        delivered_quantity >= 0 AND supplier_unit_price >= 0 AND gross_amount >= 0 AND
        commission_rate >= 0 AND commission_rate <= 100 AND commission_amount >= 0 AND net_amount >= 0
    ),
    CONSTRAINT fk_settlement_items_settlement
        FOREIGN KEY (settlement_id) REFERENCES supplier_settlements(settlement_id) ON DELETE CASCADE,
    CONSTRAINT fk_settlement_items_batch
        FOREIGN KEY (batch_id) REFERENCES batches(batch_id)
) ENGINE=InnoDB;

-- ============================================================
-- 8. RETURNABLE CRATES AND REVERSE LOGISTICS
-- ============================================================

CREATE TABLE returnable_asset_types (
    asset_type_id SMALLINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    asset_type_code VARCHAR(30) NOT NULL,
    asset_type_name VARCHAR(100) NOT NULL,
    deposit_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
    cleaning_required BOOLEAN NOT NULL DEFAULT TRUE,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    UNIQUE KEY uk_asset_types_code (asset_type_code),
    CONSTRAINT chk_asset_type_deposit CHECK (deposit_amount >= 0)
) ENGINE=InnoDB;

CREATE TABLE returnable_assets (
    asset_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    asset_code VARCHAR(40) NOT NULL,
    asset_type_id SMALLINT UNSIGNED NOT NULL,
    current_organization_id BIGINT UNSIGNED NULL,
    current_address_id BIGINT UNSIGNED NULL,
    status ENUM(
        'AVAILABLE', 'IN_TRANSIT', 'AT_RESTAURANT', 'RETURNED_DIRTY',
        'CLEANING', 'DAMAGED', 'LOST', 'RETIRED'
    ) NOT NULL DEFAULT 'AVAILABLE',
    condition_status ENUM('GOOD', 'MINOR_DAMAGE', 'MAJOR_DAMAGE', 'UNUSABLE') NOT NULL DEFAULT 'GOOD',
    purchased_at DATE NULL,
    retired_at DATE NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
        ON UPDATE CURRENT_TIMESTAMP(3),
    UNIQUE KEY uk_assets_code (asset_code),
    KEY idx_assets_location_status (current_organization_id, status),
    CONSTRAINT fk_assets_type
        FOREIGN KEY (asset_type_id) REFERENCES returnable_asset_types(asset_type_id),
    CONSTRAINT fk_assets_current_org
        FOREIGN KEY (current_organization_id) REFERENCES organizations(organization_id) ON DELETE SET NULL,
    CONSTRAINT fk_assets_current_address
        FOREIGN KEY (current_address_id) REFERENCES addresses(address_id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE asset_movements (
    movement_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    asset_id BIGINT UNSIGNED NOT NULL,
    trip_stop_id BIGINT UNSIGNED NULL,
    movement_type ENUM(
        'ISSUED_FOR_DELIVERY', 'DELIVERED_TO_RESTAURANT', 'COLLECTED_FROM_RESTAURANT',
        'RETURNED_TO_CROSS_DOCK', 'SENT_TO_CLEANING', 'CLEANED', 'DAMAGED', 'LOST', 'RETIRED'
    ) NOT NULL,
    from_organization_id BIGINT UNSIGNED NULL,
    to_organization_id BIGINT UNSIGNED NULL,
    from_address_id BIGINT UNSIGNED NULL,
    to_address_id BIGINT UNSIGNED NULL,
    recorded_by BIGINT UNSIGNED NOT NULL,
    occurred_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    note VARCHAR(500) NULL,
    KEY idx_asset_movements_asset_time (asset_id, occurred_at),
    KEY idx_asset_movements_trip_stop (trip_stop_id),
    CONSTRAINT fk_asset_movements_asset
        FOREIGN KEY (asset_id) REFERENCES returnable_assets(asset_id),
    CONSTRAINT fk_asset_movements_trip_stop
        FOREIGN KEY (trip_stop_id) REFERENCES trip_stops(trip_stop_id) ON DELETE SET NULL,
    CONSTRAINT fk_asset_movements_from_org
        FOREIGN KEY (from_organization_id) REFERENCES organizations(organization_id) ON DELETE SET NULL,
    CONSTRAINT fk_asset_movements_to_org
        FOREIGN KEY (to_organization_id) REFERENCES organizations(organization_id) ON DELETE SET NULL,
    CONSTRAINT fk_asset_movements_from_address
        FOREIGN KEY (from_address_id) REFERENCES addresses(address_id) ON DELETE SET NULL,
    CONSTRAINT fk_asset_movements_to_address
        FOREIGN KEY (to_address_id) REFERENCES addresses(address_id) ON DELETE SET NULL,
    CONSTRAINT fk_asset_movements_recorder
        FOREIGN KEY (recorded_by) REFERENCES users(user_id)
) ENGINE=InnoDB;

CREATE TABLE cleaning_records (
    cleaning_record_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    asset_id BIGINT UNSIGNED NOT NULL,
    cleaning_method ENUM('PRESSURE_WASH', 'FOOD_SAFE_SANITIZER', 'WIPE_AND_DRY', 'OTHER') NOT NULL,
    sanitizer_name VARCHAR(150) NULL,
    drying_method VARCHAR(150) NULL,
    result ENUM('PASS', 'REPEAT_REQUIRED', 'REJECT') NOT NULL,
    performed_by BIGINT UNSIGNED NOT NULL,
    performed_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    note VARCHAR(500) NULL,
    KEY idx_cleaning_asset_time (asset_id, performed_at),
    CONSTRAINT fk_cleaning_asset
        FOREIGN KEY (asset_id) REFERENCES returnable_assets(asset_id),
    CONSTRAINT fk_cleaning_user
        FOREIGN KEY (performed_by) REFERENCES users(user_id)
) ENGINE=InnoDB;

-- ============================================================
-- 9. QR, NOTIFICATION AND AUDIT LOG
-- ============================================================

CREATE TABLE qr_codes (
    qr_code_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    public_code CHAR(36) NOT NULL,
    entity_type ENUM('BATCH', 'DELIVERY_PACKAGE', 'RETURNABLE_ASSET') NOT NULL,
    entity_id BIGINT UNSIGNED NOT NULL,
    status ENUM('ACTIVE', 'REVOKED', 'EXPIRED') NOT NULL DEFAULT 'ACTIVE',
    expires_at DATETIME(3) NULL,
    created_by BIGINT UNSIGNED NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    UNIQUE KEY uk_qr_public_code (public_code),
    UNIQUE KEY uk_qr_entity (entity_type, entity_id),
    KEY idx_qr_status_expiry (status, expires_at),
    CONSTRAINT fk_qr_creator
        FOREIGN KEY (created_by) REFERENCES users(user_id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE notifications (
    notification_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT UNSIGNED NOT NULL,
    notification_type VARCHAR(50) NOT NULL,
    title VARCHAR(200) NOT NULL,
    message VARCHAR(1000) NOT NULL,
    related_entity_type VARCHAR(50) NULL,
    related_entity_id BIGINT UNSIGNED NULL,
    read_at DATETIME(3) NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    KEY idx_notifications_user_read (user_id, read_at, created_at),
    CONSTRAINT fk_notifications_user
        FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE audit_logs (
    audit_log_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    actor_user_id BIGINT UNSIGNED NULL,
    organization_id BIGINT UNSIGNED NULL,
    action_code VARCHAR(80) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id BIGINT UNSIGNED NULL,
    old_data JSON NULL,
    new_data JSON NULL,
    ip_address VARCHAR(45) NULL,
    request_id VARCHAR(80) NULL,
    occurred_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    KEY idx_audit_entity (entity_type, entity_id, occurred_at),
    KEY idx_audit_actor_time (actor_user_id, occurred_at),
    KEY idx_audit_request (request_id),
    CONSTRAINT fk_audit_actor
        FOREIGN KEY (actor_user_id) REFERENCES users(user_id) ON DELETE SET NULL,
    CONSTRAINT fk_audit_organization
        FOREIGN KEY (organization_id) REFERENCES organizations(organization_id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ============================================================
-- 10. REPORTING AND TRACEABILITY VIEWS
-- ============================================================

CREATE OR REPLACE VIEW v_order_financial_summary AS
SELECT
    o.order_id,
    o.order_code,
    o.restaurant_id,
    o.delivery_date,
    o.order_status,
    o.payment_status,
    o.total_amount,
    COALESCE(SUM(CASE
        WHEN p.status = 'CONFIRMED' AND p.payment_type = 'CUSTOMER_PAYMENT' THEN p.amount
        WHEN p.status = 'CONFIRMED' AND p.payment_type = 'REFUND' THEN -p.amount
        ELSE 0
    END), 0) AS net_paid_amount,
    o.total_amount - COALESCE(SUM(CASE
        WHEN p.status = 'CONFIRMED' AND p.payment_type = 'CUSTOMER_PAYMENT' THEN p.amount
        WHEN p.status = 'CONFIRMED' AND p.payment_type = 'REFUND' THEN -p.amount
        ELSE 0
    END), 0) AS outstanding_amount
FROM customer_orders o
LEFT JOIN payments p ON p.order_id = o.order_id
GROUP BY
    o.order_id, o.order_code, o.restaurant_id, o.delivery_date,
    o.order_status, o.payment_status, o.total_amount;

CREATE OR REPLACE VIEW v_batch_traceability AS
SELECT
    b.batch_id,
    b.batch_code,
    b.batch_status,
    b.supplier_id,
    supplier_org.organization_name AS supplier_name,
    b.sku_id,
    sku.sku_code,
    sku.sku_name,
    b.harvest_at,
    b.packed_at,
    b.expiry_at,
    b.received_at,
    b.accepted_quantity,
    ba.allocated_quantity,
    o.order_id,
    o.order_code,
    o.restaurant_id,
    restaurant_org.organization_name AS restaurant_name,
    o.delivery_date,
    ba.allocation_status
FROM batches b
JOIN organizations supplier_org ON supplier_org.organization_id = b.supplier_id
JOIN product_skus sku ON sku.sku_id = b.sku_id
LEFT JOIN batch_allocations ba ON ba.batch_id = b.batch_id
LEFT JOIN order_items oi ON oi.order_item_id = ba.order_item_id
LEFT JOIN customer_orders o ON o.order_id = oi.order_id
LEFT JOIN organizations restaurant_org ON restaurant_org.organization_id = o.restaurant_id;

CREATE OR REPLACE VIEW v_crate_balance_by_restaurant AS
SELECT
    a.current_organization_id AS restaurant_id,
    org.organization_name AS restaurant_name,
    COUNT(*) AS assets_held,
    SUM(a.condition_status = 'GOOD') AS assets_good,
    SUM(a.condition_status IN ('MINOR_DAMAGE', 'MAJOR_DAMAGE', 'UNUSABLE')) AS assets_damaged
FROM returnable_assets a
JOIN organizations org ON org.organization_id = a.current_organization_id
WHERE a.status = 'AT_RESTAURANT'
  AND org.organization_type = 'RESTAURANT'
GROUP BY a.current_organization_id, org.organization_name;

-- ============================================================
-- 11. INITIAL REFERENCE DATA
-- ============================================================

INSERT INTO roles (role_code, role_name, description) VALUES
('SYSTEM_ADMIN', 'Quản trị hệ thống', 'Quản lý toàn bộ hệ thống FreshLink'),
('OPERATIONS_COORDINATOR', 'Điều phối viên', 'Phân bổ nguồn, chia hàng và tạo chuyến'),
('QUALITY_INSPECTOR', 'Nhân viên kiểm hàng', 'Kiểm nhận lô tại FreshLink Gate'),
('ACCOUNTANT', 'Kế toán', 'Quản lý thanh toán và đối soát'),
('CUSTOMER_SUPPORT', 'Chăm sóc khách hàng', 'Tiếp nhận và xử lý khiếu nại'),
('RESTAURANT_MANAGER', 'Quản lý nhà hàng', 'Quản lý đơn, thành viên và thanh toán'),
('RESTAURANT_PURCHASER', 'Nhân viên thu mua', 'Tạo kế hoạch và đặt hàng'),
('RESTAURANT_RECEIVER', 'Nhân viên nhận hàng', 'Xác nhận hàng và phản hồi chất lượng'),
('SUPPLIER_MANAGER', 'Quản lý nhà cung cấp', 'Quản lý hồ sơ và năng lực cung ứng'),
('SUPPLIER_STAFF', 'Nhân viên nhà cung cấp', 'Xác nhận cung ứng và tạo lô'),
('DRIVER', 'Tài xế', 'Thực hiện chuyến giao và thu hồi thùng');

INSERT INTO product_categories (category_code, category_name, description) VALUES
('LEAFY_GREENS', 'Rau lá ăn lẩu', 'Nhóm rau lá tươi phục vụ nhà hàng lẩu và nướng'),
('FRESH_MUSHROOMS', 'Nấm tươi', 'Nhóm nấm tươi đóng gói');

INSERT INTO returnable_asset_types
    (asset_type_code, asset_type_name, deposit_amount, cleaning_required)
VALUES
('PP_CRATE', 'Thùng nhựa PP cứng', 150000, TRUE),
('THERMAL_BAG', 'Túi giữ nhiệt chuyên dụng', 200000, TRUE);

-- Sample catalogue data. Replace prices and specifications with verified data.
INSERT INTO products
    (category_id, product_code, product_name, description, storage_temperature_note, shelf_life_hours)
VALUES
((SELECT category_id FROM product_categories WHERE category_code = 'LEAFY_GREENS'),
 'CAI_THAO', 'Cải thảo', 'Cải thảo tươi dùng cho lẩu', 'Bảo quản mát, tránh dập nát', 48),
((SELECT category_id FROM product_categories WHERE category_code = 'LEAFY_GREENS'),
 'RAU_MUONG', 'Rau muống', 'Rau muống tươi dùng cho lẩu', 'Bảo quản mát, tránh mất nước', 24),
((SELECT category_id FROM product_categories WHERE category_code = 'FRESH_MUSHROOMS'),
 'NAM_KIM_CHAM', 'Nấm kim châm', 'Nấm kim châm đóng gói', 'Bảo quản lạnh theo hướng dẫn nhà cung cấp', 72),
((SELECT category_id FROM product_categories WHERE category_code = 'FRESH_MUSHROOMS'),
 'NAM_DUI_GA', 'Nấm đùi gà', 'Nấm đùi gà đóng gói', 'Bảo quản lạnh theo hướng dẫn nhà cung cấp', 96);

INSERT INTO product_skus
    (product_id, sku_code, sku_name, base_unit, pack_size, pack_description,
     minimum_order_quantity, quantity_step)
VALUES
((SELECT product_id FROM products WHERE product_code = 'CAI_THAO'),
 'CAI_THAO_KG', 'Cải thảo theo kg', 'KG', 1, 'Đóng theo khối lượng', 1, 0.5),
((SELECT product_id FROM products WHERE product_code = 'RAU_MUONG'),
 'RAU_MUONG_KG', 'Rau muống theo kg', 'KG', 1, 'Đóng theo khối lượng', 1, 0.5),
((SELECT product_id FROM products WHERE product_code = 'NAM_KIM_CHAM'),
 'NAM_KIM_CHAM_200G', 'Nấm kim châm gói 200 g', 'PACK', 0.2, 'Gói 200 g', 5, 1),
((SELECT product_id FROM products WHERE product_code = 'NAM_DUI_GA'),
 'NAM_DUI_GA_500G', 'Nấm đùi gà gói 500 g', 'PACK', 0.5, 'Gói 500 g', 2, 1);

-- No default user is inserted because users.password_hash must contain a real
-- BCrypt hash generated by the Spring Boot application.

-- ============================================================
-- 12. EXAMPLE REPORT QUERIES (COMMENTED OUT)
-- ============================================================

-- Orders that must be delivered today:
-- SELECT * FROM customer_orders
-- WHERE delivery_date = CURRENT_DATE()
-- ORDER BY receiving_start_time;

-- Batches waiting for FreshLink Gate inspection:
-- SELECT b.batch_code, s.sku_name, o.organization_name AS supplier_name,
--        b.received_quantity, b.received_at
-- FROM batches b
-- JOIN product_skus s ON s.sku_id = b.sku_id
-- JOIN organizations o ON o.organization_id = b.supplier_id
-- WHERE b.batch_status IN ('RECEIVED', 'WAITING_INSPECTION')
-- ORDER BY b.received_at;

-- Find every restaurant that received a batch:
-- SELECT * FROM v_batch_traceability WHERE batch_code = 'LO-20260909-001';

-- KPI: on-time delivery rate for a date range:
-- SELECT
--   ROUND(100 * AVG(ts.completed_at <= TIMESTAMP(o.delivery_date, o.receiving_end_time)), 2)
--       AS on_time_rate_percent
-- FROM trip_stops ts
-- JOIN customer_orders o ON o.order_id = ts.order_id
-- WHERE ts.status IN ('DELIVERED', 'PARTIALLY_DELIVERED')
--   AND o.delivery_date BETWEEN '2026-09-01' AND '2026-09-30';
