CREATE TABLE request_deduplication (
    user_id BIGINT UNSIGNED NOT NULL,
    request_key VARCHAR(80) NOT NULL,
    operation VARCHAR(80) NOT NULL,
    request_hash CHAR(64) NOT NULL,
    result_id BIGINT UNSIGNED NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (user_id, request_key),
    FOREIGN KEY (user_id) REFERENCES users(user_id)
) ENGINE=InnoDB;
