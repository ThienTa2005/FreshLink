# Hợp đồng API MVP

Prefix `/api`. Response thành công: `{success:true,data,message,timestamp}`. Lỗi nghiệp vụ dùng 400/409, chưa đăng nhập 401, sai quyền 403, không tìm thấy 404. Chi tiết DTO xem Swagger tại `/swagger-ui.html`.

Đăng nhập trả `{token,expiresAt,user}`. Các API riêng dùng `Authorization: Bearer <token>`. Backend không dùng cookie hoặc HTTP Basic để xác thực. Tổ chức/vai trò luôn đọc lại từ dữ liệu đang hoạt động.

`Idempotency-Key`: chuỗi 16–80 ký tự `[A-Za-z0-9_-]`; bắt buộc cho tạo đơn, yêu cầu cung ứng, lô, kiểm nhận, phân bổ, chuyến, giao/nhận, khiếu nại và tài chính. Gửi lại cùng key/nội dung trả cùng kết quả; đổi nội dung cùng key trả 409. Client phải giữ key khi thử lại cùng thao tác.

| Nhóm | Endpoint chính |
|---|---|
| Công khai | `GET /public/catalog?date=YYYY-MM-DD`, `GET /public/categories`, `POST /public/partners`, `GET /public/trace/{code}` |
| Tài khoản | `POST /public/auth/login`, `GET /auth/me`, `POST /auth/logout` |
| Quản trị | `GET /admin/partners/pending`, `POST /admin/partners/{id}/approve`, `POST /admin/staff` |
| Danh mục/địa chỉ | `POST /operations/catalog`, `POST /operations/prices`, `GET/POST /addresses` |
| Đặt hàng | `GET/POST /orders`, `GET /orders/{id}`, `GET/POST /weekly-plans` |
| Cung ứng | `POST /supplier/offers`, `GET /supplier/requests`, `POST /supplier/requests/{id}/respond`, `GET/POST /supplier/passport` |
| Điều phối | `GET /operations/lookup`, `/operations/demand`, `/operations/offers`, `/operations/orders`, `/operations/stops`, `/operations/dashboard`; `POST /operations/supply-requests` |
| Chất lượng | `GET/POST /batches`, `POST /batches/{id}/inspect`, `POST /allocations` |
| Giao nhận | `GET/POST /trips`, `GET /trips/{id}`, `POST /trips/{id}/start`, `POST /stops/{id}/deliver`, `POST /stops/{id}/receive` |
| Bằng chứng | `POST /media` multipart với trường `file`; `GET /media/{id}/access` trả URL Cloudinary riêng tư có chữ ký, hiệu lực 5 phút |
| QR | `POST /qr/{type}/{id}` với BATCH, DELIVERY_PACKAGE (điểm giao) hoặc RETURNABLE_ASSET |
| Khiếu nại | `GET/POST /claims`, `POST /claims/{id}/resolve` |
| Thùng | `GET/POST /assets`, `POST /assets/{id}/move` |
| Tài chính | `GET /billing/orders`, `/billing/suppliers`, `GET/POST /billing/settlements`, `POST /billing/payments`, `/billing/settlements/{id}/pay`, `/billing/orders/{id}/adjust`, `/billing/orders/{id}/refund` |

Danh sách theo đối tác nhận `restaurantId` hoặc `supplierId` và luôn kiểm tra quyền tổ chức. Danh mục, nhu cầu và dashboard nhận `date`. Chi tiết đơn trả dòng đơn, phân bổ lô và các điểm giao để nhà hàng xác nhận.

Tiền dùng BigDecimal/DECIMAL (2 chữ số thập phân); lượng tối đa 3 chữ số thập phân. Thời điểm lưu UTC; ngày nghiệp vụ/giờ chốt xử lý theo Việt Nam. GET trả tên trường snake_case cho các bản ghi đọc bằng SQL, DTO ghi dùng camelCase; frontend đã ánh xạ theo hợp đồng hiện tại.

JPA/Hibernate quản lý entity tài khoản; các truy vấn nghiệp vụ nhiều bảng dùng JdbcTemplate trên cùng datasource và transaction Spring. `FOR UPDATE` khóa nguồn/lô/đơn; khóa duy nhất chống trùng yêu cầu và đối soát lô.
