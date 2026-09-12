# Các điểm giao diện chưa có backend hoàn chỉnh

## Đã hoàn thành trong đợt V8

- Tìm kiếm hợp nhất có lọc quyền: `GET /api/search`.
- Saved views: đọc, tạo và xóa bộ lọc cá nhân.
- Danh mục lý do giao thất bại và lưu `reasonCode` chuẩn hóa.
- Manifest chuyến dạng CSV có kiểm tra quyền.
- Tối ưu thứ tự điểm bằng heuristic nearest-neighbor; hoạt động không cần API key bản đồ.
- Telemetry GPS/nhiệt độ và vị trí chuyến mới nhất.
- Scheduler cảnh báo trễ, chống gửi trùng bằng `late_alerted_at`.
- Workflow yêu cầu, nộp và duyệt hồ sơ bổ sung cho lô.
- System check an toàn cho database, media, email và maps.
- Chuỗi dữ liệu KPI theo ngày.
- Email outbox đã có schema để tích hợp provider mà không làm hỏng transaction nghiệp vụ.

Các dòng bên dưới chỉ còn là phần cần nhà cung cấp bên ngoài hoặc phần nâng cấp tiếp theo.

Tài liệu này phân biệt rõ phần giao diện lấy từ Stitch với chức năng backend thực tế. Frontend không gọi API giả cho các mục dưới đây.

| Giao diện/ý tưởng trong bản Stitch | Tình trạng backend | Việc backend cần bổ sung sau |
|---|---|---|
| Ô tìm kiếm toàn hệ thống trên PortalHeader | Chưa có API search hợp nhất | `GET /api/search?q=&types=` kèm kiểm tra quyền theo organization |
| Trạng thái “Cold-Chain IoT Active” và nhiệt độ xe | Chưa có telemetry thiết bị | Bảng telemetry, ingestion API, API nhiệt độ mới nhất và cảnh báo vượt ngưỡng |
| Bản đồ điều phối, tự tối ưu tuyến | Chưa có map/route engine | Tích hợp Maps/route provider, geocoding, ETA và endpoint optimize route |
| Cảnh báo chuyến trễ tự động | Có ETA/vị trí nhưng chưa có scheduler cảnh báo | Job định kỳ so ETA với kế hoạch, tạo notification cho điều phối |
| Gửi email lời mời thành viên | Backend mới tạo token lời mời | Email provider, template, retry/outbox và revoke/resend invitation |
| Email khi trạng thái nghiệp vụ thay đổi | Có bảng/API notification nội bộ, chưa có email/outbox đầy đủ | Notification service theo domain event và email outbox |
| Notification realtime | Hiện tải bằng REST | SSE hoặc WebSocket có kiểm tra bearer token và reconnect policy |
| Xuất manifest chuyến | Chưa có endpoint | CSV/PDF manifest theo trip, quyền điều phối/tài xế |
| Hóa đơn PDF và số hóa đơn thuế | Có hóa đơn/công nợ/CSV, chưa có PDF hoặc tích hợp hóa đơn điện tử | Render PDF, chữ ký/số hóa đơn, tích hợp nhà cung cấp e-invoice |
| Saved views cho bộ lọc | Chưa có lưu cấu hình người dùng | CRUD user preferences/saved filters |
| Trung tâm trợ giúp | Chưa có module nội dung/ticket hỗ trợ riêng | API knowledge base hoặc support ticket nếu cần |
| Trang System Check chi tiết | Mới có health tổng quát | Readiness cho DB/storage/email/maps, chỉ admin được xem chi tiết |
| Thiết lập hệ thống trên UI | Chưa có config management API | API cấu hình có schema, version và audit; không cho sửa secrets từ frontend |
| Báo cáo so sánh kỳ trước và biểu đồ time-series | KPI hiện chủ yếu là tổng hợp một khoảng | Endpoint time-series và previous-period breakdown |
| Chuẩn hóa danh mục lý do giao thất bại | Backend nhận chuỗi reason | Bảng/code list lý do để frontend không phải hard-code |
| Yêu cầu nhà cung cấp bổ sung hồ sơ cho lô bị từ chối | Có lịch sử kiểm lô nhưng chưa có workflow yêu cầu hồ sơ riêng | Entity document request, deadline, status và phản hồi supplier |

## Quy tắc frontend hiện tại

- Các mục chưa có backend chỉ được trình bày như thông tin hoặc điều hướng không gửi mutation.
- Không đưa mock data vào production build.
- Mọi request nghiệp vụ tiếp tục dùng `VITE_API_URL`, Bearer token và envelope `{success,data,message,timestamp}`.
- Route portal được bảo vệ theo role ở UI; backend vẫn là nguồn kiểm soát quyền cuối cùng.
