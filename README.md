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
```

Không commit mật khẩu thật vào GitHub.

## Postman

Import hai file trong thư mục `postman`, chọn environment Local rồi chạy request `Public > Health check`.

## Deploy không có tên miền riêng

- Vercel cấp URL `https://<project>.vercel.app`.
- Render cấp URL `https://<service>.onrender.com`.
- Trên Vercel, đặt `VITE_API_URL=https://<service>.onrender.com/api`.
- Trên Render, đặt `CORS_ALLOWED_ORIGINS=https://<project>.vercel.app`.

Đây là nền dự án. Các use case đặt hàng, phân nguồn, kiểm lô và giao nhận sẽ phát triển trên cấu trúc này.
