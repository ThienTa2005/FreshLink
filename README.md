# FreshLink

FreshLink là nền tảng điều phối thực phẩm tươi B2B cho nhà hàng, nhà cung cấp, điều phối viên và tài xế.

## Công nghệ

- Frontend: React, TypeScript, Vite, React Router, TanStack Query.
- Backend: Java 17, Spring Boot, Spring Security, Spring Data JPA, Flyway.
- Database: MySQL 8.4, InnoDB, utf8mb4.
- API testing: Postman.
- Local: Docker Compose.
- Deploy dự kiến: Vercel (frontend), Render (backend), Aiven for MySQL (database).

## Cấu trúc

```text
FreshLink/
├── backend/       Spring Boot REST API
├── frontend/      React web
├── database/      MySQL schema
├── postman/       Collection kiểm thử API
├── docs/          Tài liệu kỹ thuật
└── docker-compose.yml
```

## Chạy bằng Docker

```bash
cp .env.example .env
docker compose up --build
```

- Frontend: http://localhost:5173
- API health: http://localhost:8080/api/public/health
- Swagger UI: http://localhost:8080/swagger-ui.html
- MySQL: localhost:3306

## Chạy khi lập trình

Backend:

```bash
cd backend
mvn spring-boot:run
```

Frontend:

```bash
cd frontend
npm install
npm run dev
```

## Biến môi trường backend

```text
SPRING_DATASOURCE_URL
SPRING_DATASOURCE_USERNAME
SPRING_DATASOURCE_PASSWORD
CORS_ALLOWED_ORIGINS
CLOUDINARY_URL
```

Không commit mật khẩu thật vào GitHub.

## Postman

Import `postman/FreshLink-MVP.postman_collection.json` và environment Local. Điền email/mật khẩu trong biến cục bộ của Postman, chạy Login để lưu accessToken, rồi chọn các request theo vai trò. Collection cũ chỉ giữ health check ban đầu.

## Deploy không có tên miền riêng

- Vercel cấp URL `https://fresh-link-eight.vercel.app`.
- Render cấp URL `https://freshlink-1-4c1h.onrender.com`.

- [Phân công nhóm 2 người](docs/TEAM_TASKS.md)
- [Khởi tạo tài khoản, dữ liệu demo và kiểm thử](docs/DEMO.md)
- [Hợp đồng API](docs/API.md)
- [Triển khai và lưu tệp bền vững](docs/DEPLOYMENT.md)
- [Khởi tạo MySQL local/cloud bằng một file SQL](database/README.md)

