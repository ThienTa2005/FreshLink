package vn.freshlink.common;

import java.time.Instant;
import java.util.*;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.web.server.ResponseStatusException;
import vn.freshlink.identity.Actor;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class MediaControllerTest {
    private final JdbcTemplate jdbc=mock(JdbcTemplate.class);
    private final Sql sql=mock(Sql.class);
    private final MediaStorage storage=mock(MediaStorage.class);
    private final MediaController controller=new MediaController(jdbc,sql,storage,300);
    private final Actor owner=new Actor(7,"owner@test.invalid","Owner",List.of());
    private final MediaStorage.Stored stored=new MediaStorage.Stored("asset","freshlink/evidence/id","image","authenticated","png",1,9);

    @Test void validPngIsUploadedAndMetadataIsStored() throws Exception {
        byte[] png={(byte)0x89,'P','N','G',13,10,26,10,0};
        when(storage.upload(eq(png),anyString())).thenReturn(stored);
        when(sql.insert(anyString(),any(Object[].class))).thenReturn(42L);
        var response=controller.upload(owner,new MockMultipartFile("file","proof.png","image/png",png));
        assertEquals(42L,((Number)((Map<?,?>)response.data()).get("id")).longValue());
        verify(storage).upload(eq(png),anyString());
        verify(storage,never()).delete(any());
    }

    @Test void invalidSignatureNeverReachesCloudinary() {
        var file=new MockMultipartFile("file","fake.png","image/png","not-png".getBytes());
        assertThrows(IllegalArgumentException.class,()->controller.upload(owner,file));
        verifyNoInteractions(storage);
    }

    @Test void jpegAndPdfSignaturesAreAccepted() throws Exception {
        byte[] jpeg={(byte)0xff,(byte)0xd8,(byte)0xff,0};
        byte[] pdf="%PDF-test".getBytes(java.nio.charset.StandardCharsets.US_ASCII);
        when(storage.upload(any(byte[].class),anyString())).thenAnswer(call -> {
            byte[] bytes=call.getArgument(0);
            String format=bytes[0]=='%' ? "pdf" : "jpg";
            return new MediaStorage.Stored(UUID.randomUUID().toString(),UUID.randomUUID().toString(),"image","authenticated",format,1,bytes.length);
        });
        when(sql.insert(anyString(),any(Object[].class))).thenReturn(1L,2L);
        assertEquals(1L,((Number)((Map<?,?>)controller.upload(owner,new MockMultipartFile("file","proof.jpg","image/jpeg",jpeg)).data()).get("id")).longValue());
        assertEquals(2L,((Number)((Map<?,?>)controller.upload(owner,new MockMultipartFile("file","proof.pdf","application/pdf",pdf)).data()).get("id")).longValue());
    }

    @Test void emptyAndOversizedFilesAreRejectedBeforeUpload() {
        assertThrows(IllegalArgumentException.class,()->controller.upload(owner,new MockMultipartFile("file","empty.pdf","application/pdf",new byte[0])));
        assertThrows(IllegalArgumentException.class,()->controller.upload(owner,new MockMultipartFile("file","large.pdf","application/pdf",new byte[10*1024*1024+1])));
        verifyNoInteractions(storage);
    }

    @Test void cloudinaryFailureDoesNotWriteMetadata() {
        byte[] pdf="%PDF-test".getBytes(java.nio.charset.StandardCharsets.US_ASCII);
        when(storage.upload(eq(pdf),anyString())).thenThrow(new IllegalStateException("cloudinary unavailable"));
        assertThrows(IllegalStateException.class,()->controller.upload(owner,new MockMultipartFile("file","proof.pdf","application/pdf",pdf)));
        verifyNoInteractions(sql);
    }

    @Test void cloudinaryAssetIsDeletedWhenDatabaseInsertFails() {
        byte[] pdf="%PDF-test".getBytes(java.nio.charset.StandardCharsets.US_ASCII);
        when(storage.upload(eq(pdf),anyString())).thenReturn(new MediaStorage.Stored("asset","id","raw","authenticated","pdf",1,pdf.length));
        when(sql.insert(anyString(),any(Object[].class))).thenThrow(new IllegalStateException("database down"));
        assertThrows(IllegalStateException.class,()->controller.upload(owner,new MockMultipartFile("file","proof.pdf","application/pdf",pdf)));
        verify(storage).delete(any(MediaStorage.Stored.class));
    }

    @Test void authorizedOwnerReceivesFiveMinuteAccessUrl() {
        Map<String,Object> row=cloudinaryRow(7L);
        when(jdbc.queryForMap(anyString(),eq(9L))).thenReturn(row);
        when(storage.createAccessUrl(any(),any())).thenAnswer(invocation -> {
            Instant expiry=invocation.getArgument(1);
            return new MediaStorage.Access("https://cloudinary.test/signed",expiry);
        });
        Instant before=Instant.now().plusSeconds(299);
        var access=controller.access(owner,9).data();
        assertEquals("https://cloudinary.test/signed",access.url());
        assertTrue(access.expiresAt().isAfter(before));
        assertTrue(access.expiresAt().isBefore(Instant.now().plusSeconds(301)));
    }

    @Test void unrelatedUserCannotAccessPrivateMediaAndLegacyIsGone() {
        when(jdbc.queryForMap(anyString(),eq(9L))).thenReturn(cloudinaryRow(99L));
        assertThrows(org.springframework.security.access.AccessDeniedException.class,()->controller.access(owner,9));
        Map<String,Object> legacy=cloudinaryRow(7L);legacy.put("storage_provider","LOCAL");
        when(jdbc.queryForMap(anyString(),eq(10L))).thenReturn(legacy);
        ResponseStatusException error=assertThrows(ResponseStatusException.class,()->controller.access(owner,10));
        assertEquals(410,error.getStatusCode().value());
    }

    private Map<String,Object> cloudinaryRow(long uploader) {
        Map<String,Object> row=new HashMap<>();
        row.put("original_name","proof.png");row.put("storage_provider","CLOUDINARY");
        row.put("storage_key",stored.publicId());row.put("cloudinary_asset_id",stored.assetId());
        row.put("cloudinary_resource_type",stored.resourceType());row.put("cloudinary_delivery_type",stored.deliveryType());
        row.put("cloudinary_format",stored.format());row.put("cloudinary_version",stored.version());
        row.put("mime_type","image/png");row.put("uploaded_by",uploader);row.put("file_size_bytes",stored.bytes());
        return row;
    }
}
