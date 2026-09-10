# FreshLink backend

Java 17, Spring Boot, MySQL 8.4. Đọc [API MVP](../docs/API.md) cho các luồng đặt hàng, cung ứng, kiểm nhận, giao nhận và tài chính đã có. Các API bổ sung trong đợt này được mô tả ở [API-MANAGEMENT.md](API-MANAGEMENT.md).

## Chạy local

Yêu cầu JDK 17+, Maven 3.9 và MySQL 8.4. Trong thư mục `backend`, cấu hình biến môi trường rồi chạy:

```powershell
$env:SPRING_DATASOURCE_URL = 'jdbc:mysql://localhost:3306/freshlink_db?useSSL=false&allowPublicKeyRetrieval=true&serverTimezone=UTC'
$env:SPRING_DATASOURCE_USERNAME = 'freshlink'
$env:SPRING_DATASOURCE_PASSWORD = '<mat-khau-local>'
mvn spring-boot:run
```

File `.env` ở gốc được Docker Compose đọc; Maven không tự đọc file đó. Nếu MySQL local dùng cổng khác, sửa URL tương ứng.

- Health có kiểm tra datasource: `/actuator/health`.
- Health API công khai: `/api/public/health`.
- Swagger: `/swagger-ui.html`.
- OpenAPI: `/v3/api-docs`.

## Deploy cập nhật lên Render

Chỉ cần push các commit và deploy lại service backend hiện có. Các API cũ giữ nguyên method/path; không cần frontend mới để các API cũ tiếp tục hoạt động.

Đợt thay đổi này không có migration mới, không import lại SQL và không thay đổi lịch sử V1–V5. Giữ Flyway bật. Dữ liệu trên Aiven không bị reset khi redeploy backend.

`SPRING_DATASOURCE_URL` phải có dạng `jdbc:mysql://HOST:PORT/DATABASE?...`, username/password đặt riêng. Giữ TLS theo môi trường Aiven. Không dùng URL `localhost` hoặc tham số tắt TLS của local trên cloud.

`BOOTSTRAP_ENABLED` và `DEMO_ENABLED` chỉ bật lúc khởi tạo; đổi các biến password bootstrap/demo không đặt lại mật khẩu người dùng đã có. API đổi mật khẩu mới yêu cầu mật khẩu hiện tại và thu hồi mọi phiên đăng nhập của tài khoản.

Dockerfile đã tạo `/app/uploads` với quyền ghi cho user chạy Java. Render Free vẫn chỉ lưu file tạm; dùng `MEDIA_DIRECTORY=/tmp/freshlink-uploads` khi test, persistent disk/object storage khi cần giữ file qua redeploy. Việc sửa quyền thư mục không biến filesystem tạm thành lưu trữ bền vững.

## Kiểm thử

```powershell
mvn test
```

Lệnh trên chạy kiểm thử không cần DB; các test tích hợp chỉ bật khi `FRESHLINK_INTEGRATION=true`.

Để chạy đầy đủ, dùng database kiểm thử **riêng**, không dùng Aiven hoặc dữ liệu đang vận hành:

```powershell
docker run -d --name freshlink-api-test -p 127.0.0.1:13316:3306 -e MYSQL_ROOT_PASSWORD=local_test_only -e MYSQL_DATABASE=freshlink_test mysql:8.4
```

Chờ MySQL sẵn sàng trong `docker logs freshlink-api-test`, rồi trong thư mục `backend`:

```powershell
$env:FRESHLINK_INTEGRATION = 'true'
$env:SPRING_DATASOURCE_URL = 'jdbc:mysql://127.0.0.1:13316/freshlink_test?useSSL=false&allowPublicKeyRetrieval=true&serverTimezone=UTC'
$env:SPRING_DATASOURCE_USERNAME = 'root'
$env:SPRING_DATASOURCE_PASSWORD = 'local_test_only'
mvn verify
```

Test tạo fixture có mã riêng và giữ dữ liệu trong database test. Dùng database test mới khi cần kiểm tra migration từ đầu. Báo cáo nằm ở `target/surefire-reports`. Dừng container test sau khi dùng: `docker stop freshlink-api-test`.

## Phạm vi và giới hạn

- CRUD danh mục dùng ngừng hoạt động, không xóa cứng lịch sử.
- Địa chỉ đã được tham chiếu không sửa tại chỗ; tạo địa chỉ mới rồi ngừng dùng địa chỉ cũ.
- Nhân viên có nhiều tổ chức và tài khoản quản trị không được sửa bằng API nhân viên thông thường.
- Chưa có reset mật khẩu qua email, refresh token, tích hợp chuyển khoản, GPS realtime hoặc object storage.
- Các danh sách quản lý mới trả mảng đầy đủ, chưa có phân trang phía server; một số danh sách MVP cũ giới hạn 200/700 dòng như trước. Cần thêm hợp đồng phân trang trước khi dữ liệu lớn.
- Tệp riêng vẫn dùng quy tắc truy cập hiện có (người upload hoặc vai trò nội bộ được phép); không biến các ID bằng chứng thành URL công khai.
- Không xóa migration hoặc các module đang được Spring sử dụng. Dependency devtools không cần cho deployment đã được bỏ; thư mục `target` là build output và không commit.
- `CatalogAdminController.java` đã được gộp vào `CatalogController.java` và xóa file cũ; các endpoint công khai và tạo sản phẩm+SKU cũ vẫn giữ nguyên.
