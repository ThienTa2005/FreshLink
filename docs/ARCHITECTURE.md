# Kiến trúc FreshLink

FreshLink dùng một backend Spring Boot chia theo module nghiệp vụ và một cơ sở dữ liệu MySQL thống nhất.

| Module | Phạm vi |
|---|---|
| identity | Tài khoản, tổ chức, vai trò |
| catalog | Sản phẩm, SKU, giá |
| ordering | Kế hoạch tuần và đơn ngày |
| sourcing | Năng lực và phân bổ nguồn |
| quality | Lô hàng và FreshLink Gate |
| delivery | Chuyến và xác nhận giao |
| traceability | QR và truy xuất lô |
| claims | Khiếu nại |
| billing | Thanh toán, đối soát |
| assets | Thùng, thu hồi, vệ sinh |

MVP triển khai theo modular monolith: một ứng dụng backend nhưng code được chia rõ theo nghiệp vụ.
