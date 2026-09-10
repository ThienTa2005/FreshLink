# Khởi tạo MySQL bằng một file

`freshlink_mysql_database.sql` gồm tạo database `freshlink_db`, toàn bộ bảng/view và cập nhật V1–V6, cùng dữ liệu khởi tạo: 11 vai trò, 2 nhóm sản phẩm, 4 sản phẩm, 4 SKU và 2 loại tài sản tái sử dụng. File không chứa mật khẩu, tài khoản đăng nhập, đơn hàng hoặc dữ liệu đang có trong MySQL local. Đây là bộ khởi tạo, không phải bản sao lưu.

Chỉ chạy một lần trên database mới/rỗng, trước khi khởi động backend. Không import vào database đã chạy Flyway hoặc có dữ liệu. Không dùng tùy chọn tiếp tục khi lỗi (`--force`): MySQL DDL không rollback toàn bộ file; nếu import lỗi phải xử lý database khởi tạo dở trước khi thử lại. Không xóa database đang có dữ liệu để chạy file này.

## MySQL local / Workbench

Mở file SQL trong MySQL Workbench, kết nối MySQL 8.4 và chạy toàn bộ script. Tài khoản import cần quyền tạo database, bảng, view và ghi dữ liệu. Nếu database mang tên khác, sửa phần `CREATE DATABASE` và `USE` trong bản dùng để import.

Hoặc từ thư mục gốc dự án, mở MySQL CLI (phải cài mysql và thêm vào PATH):

```powershell
mysql --default-character-set=utf8mb4 -h localhost -P 3306 -u root -p
```

Trong MySQL CLI:

```sql
SOURCE database/freshlink_mysql_database.sql;
SHOW TABLES;
SELECT * FROM product_categories;
SELECT * FROM product_skus;
```

## MySQL qua Docker Compose

Mở Docker Desktop. Với database mới, chỉ khởi động MySQL trước:

```powershell
docker compose up -d mysql
docker compose cp database/freshlink_mysql_database.sql mysql:/tmp/freshlink_mysql_database.sql
docker compose exec mysql mysql --default-character-set=utf8mb4 -u root -p
```

Nhập `MYSQL_ROOT_PASSWORD` trong `.env`, sau đó chạy trong MySQL CLI:

```sql
SOURCE /tmp/freshlink_mysql_database.sql;
exit
```

Nếu `.env` đổi `MYSQL_DATABASE`, sửa tên database trong bản SQL dùng để import cho khớp. Không chạy backend trước bước import; backend có thể tự tạo schema bằng Flyway.

## Kết nối backend sau khi import: baseline V6

File đã chứa V1–V6 nhưng chưa có lịch sử Flyway. Chỉ sau khi import hoàn tất thành công, khởi động backend lần đầu với hai biến sau, bên cạnh thông tin datasource trỏ đúng database vừa import:

```text
SPRING_FLYWAY_BASELINE_ON_MIGRATE=true
SPRING_FLYWAY_BASELINE_VERSION=6
```

Với backend chạy Maven trong PowerShell:

```powershell
$env:SPRING_FLYWAY_BASELINE_ON_MIGRATE = 'true'
$env:SPRING_FLYWAY_BASELINE_VERSION = '6'
cd backend
mvn spring-boot:run
```

Với Docker Compose, tạo file `docker-compose.import.yml` tại gốc dự án:

```yaml
services:
  backend:
    environment:
      SPRING_FLYWAY_BASELINE_ON_MIGRATE: "true"
      SPRING_FLYWAY_BASELINE_VERSION: "6"
```

Rồi chạy:

```powershell
docker compose -f docker-compose.yml -f docker-compose.import.yml up -d --build
docker compose logs --tail=100 backend
```

Kiểm tra backend health và `SELECT * FROM flyway_schema_history;` có baseline phiên bản 6 thành công. Sau đó bỏ hai biến baseline (Maven: `Remove-Item Env:SPRING_FLYWAY_BASELINE_ON_MIGRATE, Env:SPRING_FLYWAY_BASELINE_VERSION` sau khi dừng tiến trình; cloud: bỏ trong dashboard). Với Docker, chạy lại `docker compose up -d` không dùng file override. Các migration V7 trở đi vẫn được Flyway chạy bình thường. Không bật baseline cho database khác chưa được kiểm tra.

Nếu để backend tự tạo database schema bằng Flyway như quy trình cũ thì không import file SQL và không bật baseline.

## Database deploy / cloud

Chọn database MySQL rỗng do nhà cung cấp cấp. Nếu không có quyền `CREATE DATABASE`, bỏ khối `CREATE DATABASE ...;` và `USE freshlink_db;` trong bản SQL dùng để import, rồi chọn database đích trong công cụ SQL. Giữ nguyên phần còn lại, dùng kết nối TLS theo cấu hình của dịch vụ. Không tự tạo MySQL user hoặc cấp quyền toàn cục trong script.

Import thành công rồi cấu hình datasource backend trỏ tới database đó và baseline V6 một lần như trên. Không dùng thông tin kết nối local cho cloud. Deploy backend không tự chuyển dữ liệu local lên cloud.

## Tài khoản và dữ liệu demo nghiệp vụ

Dữ liệu danh mục đã có ngay sau import. Để đăng nhập, bật `BOOTSTRAP_ENABLED=true`, đặt `BOOTSTRAP_EMAIL` và `BOOTSTRAP_PASSWORD` riêng khi khởi động backend lần đầu. Để có nhà hàng, hai nhà cung cấp, nhân viên, địa chỉ, giá và năng lực cung ứng 14 ngày, bật thêm `DEMO_ENABLED=true` và đặt `DEMO_PASSWORD`. Sau khởi tạo tắt hai cờ. Xem [hướng dẫn demo](../docs/DEMO.md). Không cần bật demo khi deploy vận hành thật.

## Cập nhật file tổng hợp

Migration backend là nguồn chuẩn. Khi thêm migration, chạy từ gốc dự án:

```powershell
python database/build_sql.py
```

Nếu phiên bản schema tăng, cập nhật hướng dẫn baseline theo phiên bản ghi ở đầu file SQL. Không chỉnh trực tiếp file tổng hợp hoặc sửa migration đã được áp dụng.
