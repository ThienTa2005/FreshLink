ALTER TABLE delivery_items ADD COLUMN received_quantity DECIMAL(12,3) NULL,
    ADD CONSTRAINT chk_delivery_received CHECK (received_quantity IS NULL OR (received_quantity >= 0 AND received_quantity <= loaded_quantity));
ALTER TABLE trip_stops ADD COLUMN restaurant_confirmed_at DATETIME(3) NULL;
