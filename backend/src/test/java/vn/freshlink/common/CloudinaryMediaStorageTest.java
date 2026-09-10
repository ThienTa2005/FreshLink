package vn.freshlink.common;

import java.time.Instant;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class CloudinaryMediaStorageTest {
    @Test void signedAuthenticatedDownloadContainsExpiryWithoutExposingSecret() {
        var storage=new CloudinaryMediaStorage("cloudinary://123456:top-secret@test-cloud","freshlink/evidence");
        Instant expiry=Instant.now().plusSeconds(300);
        var access=storage.createAccessUrl(new MediaStorage.Stored("asset","freshlink/evidence/id","image","authenticated","png",1,9),expiry);
        assertEquals(expiry,access.expiresAt());
        assertTrue(access.url().startsWith("https://api.cloudinary.com/v1_1/test-cloud/image/download?"));
        assertTrue(access.url().contains("type=authenticated"));
        assertTrue(access.url().contains("expires_at="+expiry.getEpochSecond()));
        assertFalse(access.url().contains("top-secret"));
    }

    @Test void missingCloudinaryConfigurationFailsBeforeUpload() {
        var storage=new CloudinaryMediaStorage("","freshlink/evidence");
        assertThrows(IllegalStateException.class,()->storage.upload(new byte[]{1},"id"));
    }
}
