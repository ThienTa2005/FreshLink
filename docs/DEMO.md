# Chạy và nghiệm thu FreshLink MVP

## Chuẩn bị

1. Sao chép `.env.example` thành `.env` tại gốc dự án.
2. Điền mật khẩu MySQL; đặt `BOOTSTRAP_ENABLED=true`, email quản trị và `BOOTSTRAP_PASSWORD` riêng, ít nhất 12 ký tự và tối đa 72 byte UTF-8.
3. Muốn có dữ liệu minh họa: đặt `DEMO_ENABLED=true` và `DEMO_PASSWORD` riêng đáp ứng điều kiện trên.
4. Chạy `docker compose up --build`. Mở `http://localhost:5173`.
5. Sau khởi tạo, tắt hai cờ bootstrap/demo. Không dùng dữ liệu demo trong vận hành thật.

Bootstrap chỉ tạo quản trị khi chưa có vai trò SYSTEM_ADMIN; không nâng quyền tài khoản có sẵn. Demo chỉ khởi tạo một lần, không đặt lại mật khẩu mỗi lần chạy.

| Tài khoản minh họa | Vai trò |
|---|---|
| Email trong `BOOTSTRAP_EMAIL` | Quản trị |
| `restaurant@demo.freshlink` | Nhà hàng |
| `supplier1@demo.freshlink` | Nhà cung cấp 1 |
| `supplier2@demo.freshlink` | Nhà cung cấp 2 |
| `operations@demo.freshlink` | Điều phối, kiểm hàng, kế toán, CSKH |
| `driver@demo.freshlink` | Tài xế |

Các tài khoản minh họa dùng `DEMO_PASSWORD` do nhóm tự cấu hình. Dữ liệu gồm địa chỉ minh họa, giá SKU và năng lực 14 ngày kể từ ngày khởi tạo. Thay địa chỉ và chính sách giá trước khi chạy thật.

## Kịch bản xuyên suốt

1. Nhà hàng chọn ngày giao ít nhất 2 ngày tới, đặt 10 kg cải thảo và chọn địa chỉ.
2. Điều phối chọn đúng ngày, phân 7 kg cho nguồn 1 và 3 kg cho nguồn 2; chọn điểm tập kết và giờ đến.
3. Mỗi nhà cung cấp nhận yêu cầu và tạo lô đúng lượng đã nhận cung ứng.
4. Gate kiểm lô 1: 6 kg đạt, 1 kg từ chối; lô 2: 3 kg đạt. Nhập checklist, ghi chú và ảnh.
5. Điều phối yêu cầu bổ sung 1 kg từ nguồn 2; nguồn 2 xác nhận, tạo lô bổ sung và Gate duyệt.
6. Chia 6 + 3 + 1 kg vào dòng đơn. Thử chia quá lượng đạt phải bị từ chối.
7. Tạo chuyến cho tài xế, chọn đơn theo thứ tự giao. Cấp thùng cho điểm giao, in QR lô/kiện/thùng.
8. Tài xế nhận hàng, bắt đầu chuyến và nhập lượng giao từng dòng, người nhận, ghi chú/ảnh. Khi giao thiếu hoặc thất bại phải ghi nơi giữ hàng và hướng xử lý.
9. Nhà hàng mở chi tiết đơn, xem lô và xác nhận số thực nhận. Xác nhận này có thời điểm riêng.
10. Tài xế ghi giao/thu thùng. Điều phối vệ sinh trước khi cấp lại; thử cấp thùng bẩn phải bị từ chối.
11. Kế toán ghi nhận khoản thu; chốt đối soát từng lô và ghi chi trả. Nếu cần hoàn/giảm tiền đã thu: ghi hoàn tiền trước rồi điều chỉnh tổng đơn với lý do.
12. Quét QR trên cửa sổ chưa đăng nhập: không lộ nhà hàng, địa chỉ giao, đơn giá mua hoặc tệp riêng.

## Chính sách MVP đang áp dụng

- Giá theo ngày giao, giữ trên dòng đơn khi xác nhận; chưa tự bảo đảm đủ nguồn chỉ nhờ đặt đơn.
- Phí dịch vụ/giao hàng: 0. Giá bán áp dụng chung, chưa có bảng giá theo vùng.
- Giờ chốt: 17:00 ngày trước giao tại Asia/Ho_Chi_Minh; cấu hình `app.order.cutoff` khi chạy backend.
- Kế hoạch tuần lưu nháp theo ngày; chuẩn bị giỏ hàng rồi xác nhận đơn mới chuyển ngày đó sang đã chốt.
- Một dòng yêu cầu cung ứng gắn một dòng đơn; một đơn được nhận từ nhiều nguồn/lô.
- Kiểm nhận một lần cho mỗi lô. Lượng giữ lại chưa được xuất và chưa có màn hình tái kiểm.
- Đối soát nhà cung cấp theo lượng đạt tại Gate, trừ hoa hồng lưu trên yêu cầu và cộng điều chỉnh đã thống nhất. Mỗi lô chốt đối soát một lần.
- Thanh toán/hoàn tiền/chi trả là ghi nhận thủ công, không thực hiện chuyển tiền qua ngân hàng.
- Bearer token chỉ giữ trong bộ nhớ trình duyệt, hết hạn sau 8 giờ. Tải lại trang cần đăng nhập lại. Đăng xuất thu hồi token trên server.
- 5 lần đăng nhập sai tạm khóa 15 phút. Đăng ký công khai chỉ tạo nhà hàng/nhà cung cấp chờ duyệt.

## Kiểm thử

Frontend: `npm ci`, `npm run lint`, `npm run build` trong `frontend`.

Backend: `mvn test` trong `backend`. Kiểm thử tích hợp chỉ bật với `FRESHLINK_INTEGRATION=true`; cấu hình `SPRING_DATASOURCE_URL`, `SPRING_DATASOURCE_USERNAME`, `SPRING_DATASOURCE_PASSWORD` trỏ tới database kiểm thử riêng. Flyway khởi tạo schema; test thêm dữ liệu duy nhất, không xóa database có sẵn.

GitHub Actions khởi tạo MySQL 8.4 riêng và bật kiểm thử tích hợp. Test kiểm tra toàn luồng, quyền tài khoản/đối tác, token thu hồi, không lộ dữ liệu QR, chống ghi trùng và hai luồng phân bổ cạnh tranh.

Kiểm tra thủ công thêm: điện thoại, ảnh upload, lỗi mạng, cửa sổ nhận hàng, các vai trò nhân viên chuyên biệt và quy trình triển khai cloud.
