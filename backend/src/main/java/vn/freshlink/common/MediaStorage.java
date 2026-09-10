package vn.freshlink.common;

import java.time.Instant;

public interface MediaStorage {
    record Stored(String assetId, String publicId, String resourceType, String deliveryType,
                  String format, long version, long bytes) {}
    record Access(String url, Instant expiresAt) {}

    Stored upload(byte[] content, String publicId);
    Access createAccessUrl(Stored stored, Instant expiresAt);
    void delete(Stored stored);
}
