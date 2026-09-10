# API quản lý bổ sung

Prefix `/api`, envelope `{success,data,message,timestamp}` như API cũ. Các API bên dưới cần `Authorization: Bearer <token>`. DTO ghi dùng camelCase; dữ liệu SQL đọc dùng snake_case. Swagger là mô tả trường/validation chi tiết.

## Tài khoản, nhân viên và đối tác

| Method / path | Quyền và nội dung |
|---|---|
| `PATCH /auth/profile` | Người đăng nhập: `{fullName,phone}`; phone rỗng được lưu NULL |
| `POST /auth/change-password` | `{currentPassword,newPassword}`; mật khẩu mới 12–72 ký tự và tối đa 72 byte UTF-8; thu hồi mọi token, frontend phải đăng nhập lại |
| `GET /admin/staff` | SYSTEM_ADMIN: nhân viên thuộc tổ chức quản trị, kèm mảng `roles`, không trả password hash |
| `PUT /admin/staff/{userId}` | SYSTEM_ADMIN: `{fullName,status,roles}`; status ACTIVE/DISABLED; thu hồi token khi thay đổi |
| `GET /admin/partners` | SYSTEM_ADMIN: danh sách nhà hàng/nhà cung cấp mọi trạng thái |
| `GET /admin/partners/{organizationId}` | SYSTEM_ADMIN: thông tin tổ chức và members không chứa mật khẩu |
| `PATCH /admin/partners/{organizationId}/status` | SYSTEM_ADMIN: `{status,reason}`; lưu audit và thu hồi phiên thành viên |

Vai trò nhân viên cho phép: OPERATIONS_COORDINATOR, QUALITY_INSPECTOR, ACCOUNTANT, CUSTOMER_SUPPORT, DRIVER. Không thay đổi quản trị viên hoặc tài khoản thuộc nhiều tổ chức qua API nhân viên này.

Chuyển trạng thái đối tác cho phép: PENDING → REJECTED, ACTIVE → SUSPENDED, SUSPENDED → ACTIVE. Duyệt PENDING → ACTIVE vẫn dùng `POST /admin/partners/{id}/approve` để kích hoạt cả tài khoản và membership. Không nâng quyền bằng cách đổi status.

## Danh mục (OPERATIONS_COORDINATOR hoặc SYSTEM_ADMIN)

| Method / path | Nội dung |
|---|---|
| `GET /operations/categories` | Mọi nhóm, kể cả ngừng hoạt động |
| `POST /operations/categories` | Tạo nhóm, trả ID |
| `PUT /operations/categories/{id}` | Thay thông tin nhóm |
| `DELETE /operations/categories/{id}` | `active=false`; giữ sản phẩm và lịch sử |
| `GET /operations/products` | Sản phẩm và tên nhóm |
| `POST /operations/products` | Tạo sản phẩm, trả ID |
| `PUT /operations/products/{id}` | Thay thông tin sản phẩm |
| `DELETE /operations/products/{id}` | Ngừng bán sản phẩm |
| `GET /operations/catalog` | SKU, sản phẩm/nhóm và trạng thái từng cấp |
| `POST /operations/skus` | Thêm SKU vào sản phẩm có sẵn, trả ID |
| `PUT /operations/skus/{id}` | Sửa tên, mô tả quy cách, minimum, step, active |
| `DELETE /operations/skus/{id}` | Ngừng bán SKU |
| `GET /operations/prices?skuId=...` | Lịch sử giá theo SKU |

Payload nhóm:

```json
{"code":"VEGETABLES","name":"Rau tươi","description":"Rau theo mùa","active":true}
```

Payload sản phẩm (categoryId dùng ID thật):

```json
{"categoryId":1,"code":"CAI_XANH","name":"Cải xanh","description":"Rau tươi","storageNote":"Bảo quản mát","shelfLifeHours":48,"active":true}
```

Payload tạo SKU:

```json
{"productId":1,"code":"CAI_XANH_KG","name":"Cải xanh theo kg","unit":"KG","packSize":1,"packDescription":"Theo kg","minimum":1,"step":0.5}
```

Payload sửa SKU:

```json
{"name":"Cải xanh theo kg","packDescription":"Theo kg","minimum":1,"step":0.5,"active":true}
```

Mã SKU, productId, đơn vị và packSize không sửa qua API update để tránh diễn giải lại dữ liệu lịch sử; muốn quy cách khác thì tạo SKU mới. Khôi phục bằng PUT với active=true ở cấp cần thiết. Ngừng nhóm/sản phẩm không thay active từng SKU, nhưng API công khai và tạo đơn kiểm tra cả ba cấp. Giá đơn cũ giữ nguyên.

`POST /operations/catalog` tạo sản phẩm+SKU và `POST /operations/prices` của MVP vẫn hoạt động. Public catalog bổ sung `product_id`, `category_id`, `pack_size` mà không bỏ trường cũ.

## Địa chỉ

- `PUT /addresses/{id}`: `{name,address,district,city,contactName,phone}`; không đổi tổ chức hoặc loại địa chỉ. Chỉ sửa địa chỉ chưa có tham chiếu nghiệp vụ; địa chỉ đã dùng trả 409 và phải tạo mới.
- `DELETE /addresses/{id}`: ngừng hoạt động, bỏ is_default; không xóa địa chỉ khỏi đơn cũ.
- Quyền: manager nhà hàng/nhà cung cấp hoặc điều phối thuộc tổ chức đó; SYSTEM_ADMIN có quyền như quy ước hiện có. Người thuộc tổ chức khác trả 403.

## Nguồn cung

- `GET /supplier/offers?supplierId=...&date=YYYY-MM-DD`: date tùy chọn, gồm nguồn đã đóng.
- `PUT /supplier/offers/{id}`: `{quantity,price}`. Quantity không thấp hơn reserved_quantity; giá không thay khi đang có lượng giữ chỗ. Không sửa nguồn CLOSED hoặc ngày đã qua.
- `DELETE /supplier/offers/{id}`: chuyển CLOSED khi reserved_quantity=0, không xóa bản ghi.
- Quyền: SUPPLIER_MANAGER/SUPPLIER_STAFF trong đúng tổ chức, hoặc SYSTEM_ADMIN.
- Tạo nguồn bằng API MVP nay kiểm tra ngày không ở quá khứ và cả SKU/sản phẩm/nhóm đang hoạt động.

## Trang chi tiết và bằng chứng

| Method / path | Dữ liệu và quyền |
|---|---|
| `GET /batches/{batchId}` | Lô + inspections/items; nhà cung cấp chỉ xem lô mình; điều phối/kiểm hàng/admin xem thêm allocations |
| `GET /supplier/requests/{supplyRequestId}` | Header yêu cầu + items + delivery_address; nhà cung cấp đúng tổ chức hoặc điều phối/admin |
| `GET /claims/{complaintId}` | Khiếu nại + items với SKU/mã lô; manager/receiver đúng nhà hàng hoặc CSKH/admin |
| `PUT /claims/{complaintId}/evidence` | `{itemId,evidenceId}`; item thuộc khiếu nại, file thuộc người gửi; chỉ khi NEW/VERIFYING/WAITING_PARTNER |
| `GET /assets/{assetId}/history` | Lịch sử di chuyển; điều phối/admin |

Lưu ý ID: chi tiết yêu cầu dùng **supply_request_id**; endpoint phản hồi MVP `/supplier/requests/{id}/respond` vẫn dùng **supply_request_item_id**. Không thay hợp đồng cũ khi frontend tích hợp.

Gắn bằng chứng: upload qua `POST /media` trước, dùng `data.id` làm evidenceId. ItemId lấy `data.items[].complaint_item_id` từ chi tiết khiếu nại. Gắn lại cùng bằng chứng là thao tác PUT, không tạo khiếu nại mới. Khiếu nại đã kết thúc trả 409.

## Lỗi

- 400: validation, thiếu tham số/header, JSON sai, định dạng ngày/ID sai, quy tắc dữ liệu không hợp lệ.
- 401: chưa đăng nhập hoặc token hết hạn/đã thu hồi.
- 403: không có quyền.
- 404: bản ghi/đường dẫn không tồn tại.
- 405: method không hỗ trợ.
- 409: trùng dữ liệu, trạng thái không cho phép hoặc có tham chiếu cần bảo toàn.
- 413: upload vượt giới hạn.
- 415: content type không hỗ trợ.
- 500: phản hồi chung, không trả stack trace/SQL cho client; xem log backend để chẩn đoán.

Các API mới không yêu cầu Idempotency-Key trừ khi gọi các endpoint nghiệp vụ MVP vốn đã yêu cầu header đó. Không tự retry POST tạo nhóm/sản phẩm/SKU/nhân viên khi chưa xác định kết quả; mã/email unique sẽ chặn trùng và trả 409.
