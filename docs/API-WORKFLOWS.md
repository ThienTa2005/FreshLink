# API workflow mở rộng (V7)

Tất cả endpoint bên dưới giữ envelope chuẩn `{success,data,message,timestamp}` và yêu cầu Bearer token, trừ endpoint có prefix `/api/public`. DTO ghi dùng `camelCase`; dữ liệu đọc trực tiếp từ SQL dùng `snake_case`. Lỗi validation trả `400`, sai quyền `403`, không tìm thấy `404`, và xung đột trạng thái/giờ chốt trả `409`.

## Đơn nhà hàng

- `PUT /api/orders/{id}` — sửa địa chỉ, ngày/khung giờ, ghi chú và toàn bộ `items` trước giờ chốt.
- `POST /api/orders/{id}/submit-approval` — thu mua gửi đơn cho quản lý.
- `POST /api/orders/{id}/approve` — body `{approved,reason}`; quản lý duyệt hoặc từ chối.
- `POST /api/orders/{id}/cancel` — body `{reason}`; hủy trước giờ chốt và giải phóng allocation đang giữ.

Không retry thao tác ghi một cách mù quáng sau lỗi `409`. Sau mọi mutation thành công, frontend nên dùng `GET /api/orders/{id}` để lấy snapshot mới.

## Cung ứng, lô và kiểm hàng

- `PUT /api/operations/supply-requests/{id}` — body `{arrivalTime,quantity,commissionRate}`.
- `POST /api/operations/supply-requests/{id}/cancel` — body `{reason}`; hoàn lượng đã giữ vào offer.
- `PUT /api/batches/{id}` và `POST /api/batches/{id}/cancel` — chỉ trước khi Gate tiếp nhận.
- `POST /api/batches/{id}/reinspect` — body `{accepted,rejected,note}`, bắt buộc `accepted + rejected` bằng lượng cách ly; cần `Idempotency-Key`.
- `GET /api/public/suppliers/{id}/certificates` — chỉ trả chứng nhận còn hạn đã được xác minh, không trả file riêng tư.

## Giao nhận

- `PUT /api/trips/{id}` — body `{driverId,originId,stopIds,note}`; `stopIds` phải chứa đúng toàn bộ điểm hiện tại theo thứ tự mới.
- `POST /api/trips/{id}/cancel` — body `{reason}`.
- `POST /api/stops/{id}/location` — body `{latitude,longitude,eta}`; `eta` là ISO-8601 UTC.
- `POST /api/stops/{id}/arrive` — cùng payload vị trí; tạo sự kiện `DRIVER_ARRIVED`.
- `POST /api/stops/{id}/fail` — body `{reason}` với lý do chuẩn hóa ở frontend.

Chỉ chuyến `PLANNED/LOADING` được sửa hoặc hủy. Vị trí chỉ nhận khi chuyến `IN_PROGRESS`.

## CSKH và kế toán

- `PATCH /api/claims/{id}/status` — `{status,assigneeId,note}`. Trạng thái: `VERIFYING`, `WAITING_PARTNER`, `REJECTED`, `CLOSED`; backend kiểm tra đồ thị chuyển trạng thái.
- `POST /api/billing/invoices` — `{orderId,dueDate,taxAmount,note}`.
- `GET /api/billing/invoices?restaurantId=&overdue=` — số đã trả và dư nợ được tính từ payment đã xác nhận.
- `POST /api/billing/invoices/refresh-overdue` — đánh dấu quá hạn.
- `GET /api/billing/invoices/report?from=YYYY-MM-DD&to=YYYY-MM-DD` — tải CSV, tối đa 366 ngày.

## Thành viên, audit, thông báo và KPI

- `GET /api/organizations/{org}/members`, `POST /api/organizations/{org}/invitations`, `PUT /api/organizations/{org}/members/{member}/roles`, `DELETE /api/organizations/{org}/members/{member}`.
- `POST /api/public/invitations/accept` — `{token,fullName,phone,password}`. Token chỉ được trả một lần lúc tạo lời mời và chỉ lưu dạng SHA-256 trong DB.
- `GET /api/notifications?unreadOnly=&limit=`, `POST /api/notifications/{id}/read`, `POST /api/notifications/read-all`.
- `GET /api/admin/audit-logs`, `GET /api/admin/login-history`.
- `GET /api/analytics/kpis?from=&to=` — KPI đơn, giao hàng, kiểm hàng, khiếu nại và công nợ.
- `POST /api/supplier-ratings` và `GET /api/suppliers/{id}/ratings`.
- `GET /api/assets/inventory`, `POST /api/assets/{id}/incidents`.

## Tích hợp frontend an toàn

Frontend cần vô hiệu hóa nút gửi trong lúc request đang chạy, giữ nguyên `Idempotency-Key` khi retry các endpoint yêu cầu key, đọc `message` khi `success=false`, và tải lại resource sau mutation. Không suy diễn trạng thái mới ở client. Các timestamp là UTC; ngày nghiệp vụ và giờ chốt dùng múi giờ `Asia/Ho_Chi_Minh`.
