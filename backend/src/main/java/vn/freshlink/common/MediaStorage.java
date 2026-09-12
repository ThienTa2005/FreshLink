package vn.freshlink.common;

import java.time.Instant;

public interface MediaStorage {
    record Stored(String assetId, String publicId, String resourceType, String deliveryType,
                  String format, long version, long bytes, String secureUrl) {
        public Stored(String assetId, String publicId, String resourceType, String deliveryType,
                      String format, long version, long bytes) {
            this(assetId, publicId, resourceType, deliveryType, format, version, bytes, null);
        }
    }
    record Access(String url, Instant expiresAt) {}

    Stored upload(byte[] content, String publicId);
    default Stored upload(byte[] content, String publicId, boolean isPublic) {
        return upload(content, publicId);
    }
    Access createAccessUrl(Stored stored, Instant expiresAt);
    void delete(Stored stored);
}
