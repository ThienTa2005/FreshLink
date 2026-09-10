package vn.freshlink.common;

import java.time.Instant;
import java.util.Map;
import com.cloudinary.Cloudinary;
import com.cloudinary.utils.ObjectUtils;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

@Service
public class CloudinaryMediaStorage implements MediaStorage {
    private final Cloudinary cloudinary;
    private final String folder;
    private final boolean configured;

    public CloudinaryMediaStorage(@Value("${app.cloudinary.url:}") String url,
                                  @Value("${app.cloudinary.folder:freshlink/evidence}") String folder) {
        this.configured = url != null && !url.isBlank();
        this.cloudinary = configured ? new Cloudinary(url) : new Cloudinary(ObjectUtils.asMap("secure", true));
        this.cloudinary.config.secure = true;
        this.folder = folder.replaceAll("^/+|/+$", "");
    }

    private void requireConfigured() {
        if (!configured) throw new IllegalStateException("Cloudinary chưa được cấu hình. Hãy đặt CLOUDINARY_URL");
    }

    @Override
    public Stored upload(byte[] content, String publicId) {
        requireConfigured();
        String fullPublicId = folder.isBlank() ? publicId : folder + "/" + publicId;
        try {
            Map<?,?> result = cloudinary.uploader().upload(content, ObjectUtils.asMap(
                "resource_type", "auto", "type", "authenticated", "public_id", fullPublicId,
                "overwrite", false, "use_filename", false, "unique_filename", false));
            return new Stored(String.valueOf(result.get("asset_id")), String.valueOf(result.get("public_id")),
                String.valueOf(result.get("resource_type")), String.valueOf(result.get("type")),
                String.valueOf(result.get("format")), ((Number)result.get("version")).longValue(),
                ((Number)result.get("bytes")).longValue());
        } catch (Exception e) {
            throw new IllegalStateException("Không thể lưu tệp lên Cloudinary", e);
        }
    }

    @Override
    public Access createAccessUrl(Stored stored, Instant expiresAt) {
        requireConfigured();
        try {
            String url = cloudinary.privateDownload(stored.publicId(), stored.format(), ObjectUtils.asMap(
                "resource_type", stored.resourceType(), "type", stored.deliveryType(),
                "expires_at", expiresAt.getEpochSecond(), "attachment", true));
            return new Access(url, expiresAt);
        } catch (Exception e) {
            throw new IllegalStateException("Không thể tạo liên kết tải tệp", e);
        }
    }

    @Override
    public void delete(Stored stored) {
        requireConfigured();
        try {
            cloudinary.uploader().destroy(stored.publicId(), ObjectUtils.asMap(
                "resource_type", stored.resourceType(), "type", stored.deliveryType(), "invalidate", true));
        } catch (Exception ignored) {
            // Cleanup is best-effort; the original database failure remains the useful error.
        }
    }
}
