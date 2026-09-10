ALTER TABLE media_files
    ADD COLUMN storage_provider VARCHAR(20) NOT NULL DEFAULT 'LOCAL' AFTER original_name,
    ADD COLUMN cloudinary_asset_id VARCHAR(255) NULL AFTER storage_key,
    ADD COLUMN cloudinary_resource_type VARCHAR(20) NULL AFTER cloudinary_asset_id,
    ADD COLUMN cloudinary_delivery_type VARCHAR(20) NULL AFTER cloudinary_resource_type,
    ADD COLUMN cloudinary_format VARCHAR(20) NULL AFTER cloudinary_delivery_type,
    ADD COLUMN cloudinary_version BIGINT NULL AFTER cloudinary_format,
    ADD UNIQUE KEY uk_media_cloudinary_asset (cloudinary_asset_id);
