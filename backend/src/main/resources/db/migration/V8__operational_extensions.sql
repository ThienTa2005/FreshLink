-- Self-contained operational features. External providers remain optional.
CREATE TABLE saved_views (
    saved_view_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT UNSIGNED NOT NULL,
    view_key VARCHAR(60) NOT NULL,
    name VARCHAR(100) NOT NULL,
    filters JSON NOT NULL,
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    UNIQUE KEY uk_saved_view_user_key_name (user_id,view_key,name),
    KEY idx_saved_view_user_key (user_id,view_key),
    CONSTRAINT fk_saved_view_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE delivery_failure_reasons (
    reason_code VARCHAR(40) PRIMARY KEY,
    label VARCHAR(150) NOT NULL,
    description VARCHAR(500) NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    display_order SMALLINT UNSIGNED NOT NULL DEFAULT 0
) ENGINE=InnoDB;

INSERT INTO delivery_failure_reasons(reason_code,label,description,display_order) VALUES
 ('RECEIVER_UNAVAILABLE','Không liên hệ được người nhận','Đã gọi nhưng người nhận không có mặt hoặc không phản hồi',10),
 ('ADDRESS_NOT_FOUND','Không tìm thấy địa chỉ','Địa chỉ hoặc chỉ dẫn giao hàng không đầy đủ',20),
 ('RESTAURANT_CLOSED','Nhà hàng đóng cửa','Điểm nhận đóng cửa ngoài kế hoạch',30),
 ('CUSTOMER_REFUSED','Khách từ chối nhận','Người nhận từ chối toàn bộ chuyến giao',40),
 ('VEHICLE_BREAKDOWN','Phương tiện gặp sự cố','Xe hỏng hoặc không thể tiếp tục hành trình',50),
 ('PRODUCT_DAMAGED','Hàng hư hỏng trên đường','Không thể bàn giao vì chất lượng hoặc bao bì',60),
 ('OTHER','Lý do khác','Bắt buộc nhập ghi chú chi tiết',99);

ALTER TABLE trip_stops
    ADD COLUMN failure_reason_code VARCHAR(40) NULL AFTER failure_reason,
    ADD COLUMN late_alerted_at DATETIME(3) NULL AFTER location_updated_at,
    ADD CONSTRAINT fk_stop_failure_reason FOREIGN KEY (failure_reason_code) REFERENCES delivery_failure_reasons(reason_code);

CREATE TABLE batch_document_requests (
    document_request_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    batch_id BIGINT UNSIGNED NOT NULL,
    document_type ENUM('BUSINESS_LICENSE','FOOD_SAFETY','VIETGAP','ORIGIN_PROOF','OTHER') NOT NULL,
    message VARCHAR(1000) NOT NULL,
    due_at DATETIME(3) NULL,
    status ENUM('OPEN','SUBMITTED','ACCEPTED','REJECTED','CANCELLED') NOT NULL DEFAULT 'OPEN',
    requested_by BIGINT UNSIGNED NOT NULL,
    submitted_file_id BIGINT UNSIGNED NULL,
    supplier_note VARCHAR(1000) NULL,
    reviewed_by BIGINT UNSIGNED NULL,
    reviewed_at DATETIME(3) NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    KEY idx_document_request_batch_status (batch_id,status),
    CONSTRAINT fk_document_request_batch FOREIGN KEY (batch_id) REFERENCES batches(batch_id) ON DELETE CASCADE,
    CONSTRAINT fk_document_request_creator FOREIGN KEY (requested_by) REFERENCES users(user_id),
    CONSTRAINT fk_document_request_file FOREIGN KEY (submitted_file_id) REFERENCES media_files(file_id) ON DELETE SET NULL,
    CONSTRAINT fk_document_request_reviewer FOREIGN KEY (reviewed_by) REFERENCES users(user_id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE trip_telemetry (
    telemetry_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    trip_id BIGINT UNSIGNED NOT NULL,
    driver_user_id BIGINT UNSIGNED NOT NULL,
    latitude DECIMAL(10,7) NOT NULL,
    longitude DECIMAL(10,7) NOT NULL,
    temperature_c DECIMAL(5,2) NULL,
    recorded_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    KEY idx_telemetry_trip_time (trip_id,recorded_at),
    CONSTRAINT chk_telemetry_geo CHECK(latitude BETWEEN -90 AND 90 AND longitude BETWEEN -180 AND 180),
    CONSTRAINT chk_telemetry_temperature CHECK(temperature_c IS NULL OR temperature_c BETWEEN -50 AND 80),
    CONSTRAINT fk_telemetry_trip FOREIGN KEY (trip_id) REFERENCES delivery_trips(trip_id) ON DELETE CASCADE,
    CONSTRAINT fk_telemetry_driver FOREIGN KEY (driver_user_id) REFERENCES users(user_id)
) ENGINE=InnoDB;

CREATE TABLE email_outbox (
    email_outbox_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    recipient VARCHAR(150) NOT NULL,
    template_code VARCHAR(60) NOT NULL,
    payload JSON NOT NULL,
    status ENUM('PENDING','SENT','FAILED','SKIPPED') NOT NULL DEFAULT 'PENDING',
    attempts SMALLINT UNSIGNED NOT NULL DEFAULT 0,
    next_attempt_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    last_error VARCHAR(1000) NULL,
    sent_at DATETIME(3) NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    KEY idx_email_outbox_status_time (status,next_attempt_at)
) ENGINE=InnoDB;
