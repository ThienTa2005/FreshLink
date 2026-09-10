# Triển khai FreshLink

## Backend và database

- Dùng database MySQL riêng. Spring Boot chạy Flyway V1–V6; không import lại file schema vào database đã chạy migration. Nếu muốn khởi tạo bằng một file SQL trên database rỗng, dùng `database/freshlink_mysql_database.sql` rồi baseline Flyway V6 một lần theo [hướng dẫn import](../database/README.md).
- Cấu hình `SPRING_DATASOURCE_URL`, `SPRING_DATASOURCE_USERNAME`, `SPRING_DATASOURCE_PASSWORD` bằng secret của môi trường. Với Aiven, URL JDBC phải bật TLS, ví dụ `?sslMode=REQUIRED&serverTimezone=UTC`; không dùng URL tắt SSL từ bản local.
- Render dùng Dockerfile trong `backend`, health check trong `render.yaml`. Cấu hình `CORS_ALLOWED_ORIGINS` và `FRONTEND_URL` bằng URL Vercel thực tế.
- Đặt `CLOUDINARY_URL=cloudinary://api_key:api_secret@cloud_name` bằng Render secret. Không đặt secret này ở Vercel hoặc biến `VITE_*`. Ảnh/PDF được upload dạng `authenticated` và chỉ tải qua URL ký có thời hạn.
- Bootstrap quản trị qua biến môi trường trong lần đầu, sau đó tắt cờ. Demo tắt mặc định. Không đặt password vào Git hoặc biến `VITE_*`.

## Frontend

- Vercel Root Directory: `frontend`; install `npm ci`; build `npm run build`; output `dist`.
- `VITE_API_URL=https://<backend>/api`; `vercel.json` có rewrite cho React Router.
- Sau khi đổi URL frontend/backend phải build lại và cập nhật CORS, FRONTEND_URL để QR trỏ đúng nơi.

## Nghiệm thu sau triển khai

1. Kiểm tra health, đăng nhập/đăng xuất và chặn API riêng khi không có token.
2. Tạo đối tác chờ duyệt, xác nhận không tự cấp quyền nội bộ.
3. Chạy kịch bản DEMO.md trên database demo riêng.
4. Upload ảnh, khởi động lại service, kiểm tra tệp vẫn đọc được.
5. Mở đường dẫn sâu `/portal` và `/trace/<code>` trực tiếp.
6. Sao lưu database và tệp, kiểm tra quy trình phục hồi trước khi chạy thật.

## Gói miễn phí và cold start

- Đặt Render và Aiven ở khu vực địa lý gần nhau nhất. Giữ pool nhỏ với `DB_MAX_POOL_SIZE=3`, `DB_MIN_IDLE=0`.
- Render Free có thể ngủ sau thời gian không có truy cập. Mở `/api/public/health` trước buổi demo 1–2 phút; frontend cũng tự đánh thức backend khi mở trang đăng nhập.
- Monitor bên ngoài chỉ hỗ trợ demo và không thay thế cam kết uptime. Nếu cần phản hồi ổn định, ưu tiên nâng riêng backend Render lên gói không sleep; Vercel và Aiven có thể giữ free trước.

Repository cung cấp cấu hình, chưa tự triển khai lên tài khoản cloud. Cần kiểm tra gói dịch vụ/quota đang áp dụng và xác nhận tài khoản đích trước khi tạo tài nguyên có phí.
