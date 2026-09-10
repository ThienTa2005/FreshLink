CREATE TABLE api_tokens (
    token_hash CHAR(64) PRIMARY KEY,
    user_id BIGINT UNSIGNED NOT NULL,
    expires_at DATETIME(3) NOT NULL,
    CONSTRAINT fk_api_token_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    KEY idx_api_token_expiry (expires_at)
) ENGINE=InnoDB;
