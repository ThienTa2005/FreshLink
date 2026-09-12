ALTER TABLE restaurant_profiles ADD COLUMN approval_required BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE customer_orders ADD COLUMN approval_required BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE organizations ADD COLUMN review_note VARCHAR(1000) NULL;
CREATE TABLE password_reset_tokens (
 token_hash CHAR(64) PRIMARY KEY,
 user_id BIGINT UNSIGNED NOT NULL,
 expires_at DATETIME(3) NOT NULL,
 used_at DATETIME(3) NULL,
 created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 KEY idx_reset_user (user_id,created_at),
 CONSTRAINT fk_reset_user FOREIGN KEY (user_id) REFERENCES users(user_id)
);
CREATE TABLE restaurant_saved_orders (
 saved_order_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 restaurant_id BIGINT UNSIGNED NOT NULL,
 user_id BIGINT UNSIGNED NOT NULL,
 name VARCHAR(150) NOT NULL,
 kind ENUM('TEMPLATE','CART','FAVORITES') NOT NULL,
 payload JSON NOT NULL,
 updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
 CONSTRAINT fk_saved_restaurant FOREIGN KEY (restaurant_id) REFERENCES restaurant_profiles(restaurant_id),
 CONSTRAINT fk_saved_user FOREIGN KEY (user_id) REFERENCES users(user_id),
 UNIQUE KEY uk_saved_order (restaurant_id,user_id,kind,name)
);
