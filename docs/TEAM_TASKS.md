# FreshLink — bảng phân công nhóm 2 người

A sở hữu frontend; B sở hữu backend và MySQL. Người còn lại review PR và kiểm tra luồng liên quan. Mỗi chặng chỉ nghiệm thu khi giao diện gọi API thật và kiểm tra quyền truy cập thành công.

| Chặng | Bạn A | Bạn B | Điều kiện bàn giao |
|---|---|---|---|
| 1. Nền tảng | Ant Design, đăng nhập, đăng ký, bố cục 4 cổng | Token, BCrypt, tổ chức/vai trò, duyệt đối tác, tài khoản nhân viên | Đăng nhập và vào đúng cổng |
| 2. Đặt hàng | Danh mục, giỏ hàng, địa chỉ, đơn, kế hoạch tuần | SKU/giá, giờ chốt, giá cố định trên đơn, chuyển kế hoạch ngày, chống trùng | Tạo đơn và đọc lại từ MySQL |
| 3. Cung ứng | Passport, năng lực, phản hồi và phân nguồn | Năng lực/ngày, yêu cầu đủ/một phần/từ chối, khóa lượng giữ | Hai nguồn cho cùng một đơn |
| 4. Gate và QR | Tạo lô, checklist, ảnh, phân bổ và in QR | Kiểm nhận theo lượng, khóa phân bổ, QR có mã khó đoán | Lượng không đạt không được xuất |
| 5. Giao nhận | Chuyến/điểm giao, màn hình tài xế, xác nhận nhận | Gán tài xế, khóa chuyến, lượng giao/nhận và hai sự kiện riêng | Nhà hàng xác nhận sau tài xế |
| 6. Sau giao | Khiếu nại, thùng, thu/chi và điều chỉnh | Quyền tổ chức, thu/vệ sinh thùng, thanh toán/đối soát có chống trùng | Đối chiếu được hàng, tiền và thùng |
| 7. Tích hợp | Kiểm tra desktop/điện thoại, lỗi mạng, tài liệu người dùng | Kiểm thử MySQL, giao dịch đồng thời, phân quyền và audit | Kịch bản trong DEMO.md qua |
| 8. Bàn giao | Vercel, URL API, kịch bản thuyết trình | Render, Aiven, TLS, nơi lưu tệp bền vững, sao lưu | Kiểm tra trên môi trường triển khai |

## Quy trình phối hợp

- B cập nhật DTO/Swagger và Postman trước khi thay hợp đồng; A xác nhận đủ trường cho màn hình.
- Nhánh `feat/<module>-<task>`; PR có mục tiêu, thay đổi hành vi và cách kiểm tra. Không gộp khi CI thất bại.
- B dùng Flyway cho mọi thay đổi schema. Không sửa migration đã chạy.
- A kiểm tra trạng thái trống, lỗi API, thao tác gửi lại và màn hình nhỏ. B kiểm tra quyền và cạnh tranh dữ liệu bằng test.
- Hai bạn cùng chạy demo cuối mỗi chặng; theo dõi việc chưa đạt bằng issue có người phụ trách và điều kiện nghiệm thu.

## Phần đã triển khai và giới hạn

Repository có code cho các luồng cơ bản chặng 1–6, dữ liệu demo tùy chọn, kiểm thử tích hợp MySQL và CI. Bảng này phân công người tiếp nhận, review và hoàn thiện; không đồng nghĩa mọi yêu cầu vận hành thực tế đã nghiệm thu.

Phiên bản hiện tại cố định phí đơn bằng 0, giờ chốt mặc định 17:00 ngày trước giao; sắp tuyến thủ công. Lô giữ lại chưa có quy trình tái kiểm; sửa/hủy đơn sau phân nguồn, thay thế SKU, tái giao sau thất bại và báo cáo nâng cao cần bổ sung. Cần xác nhận chính sách nghiệp vụ trước khi mở cho người dùng thực tế.

Chặng 8 cần tài khoản Vercel/Render/Aiven, cấu hình kết nối và nơi lưu tệp bền vững. Các file cấu hình không tự tạo một môi trường đã triển khai.
