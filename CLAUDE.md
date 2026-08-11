# Your Shelve — Project Context

## Mục tiêu
Web quản lý tủ sách manga/Light Novel theo số tập cho người sưu tầm.
Xem chi tiết kế hoạch tại Your_Shelve_Ke_hoach_Sprint.xlsx (sheet Ke_hoach_Sprint, DB_Schema, Security_Cases).

## Tech stack
- Frontend: Next.js (App Router) + TypeScript + TailwindCSS + Framer Motion
- Backend: Next.js API Routes
- DB: PostgreSQL + Prisma ORM
- Auth: JWT (access token ngắn hạn + refresh token có rotate), bcrypt hash password
- Ảnh: Cloudinary
- Dữ liệu manga/LN trending: AniList GraphQL API

## Coding conventions
- TypeScript strict mode, không dùng `any` trừ khi bắt buộc
- API routes trong /app/api, mỗi route validate input bằng Zod trước khi xử lý
- Component UI trong /components, logic tách riêng /lib

## QUY TẮC BẢO MẬT BẮT BUỘC (không được bỏ qua)
- MỌI API đọc/sửa/xoá dữ liệu cá nhân (UserCollections, Series do user tạo) PHẢI kiểm tra
  owner_id/user_id khớp với user trong JWT token đang đăng nhập trước khi trả dữ liệu.
  Đây là chống IDOR/BOLA — xem sheet Security_Cases, Case 1.
- API login PHẢI có rate-limit theo IP/email — xem Security_Cases, Case 2.
- PATCH /api/users/me chỉ được whitelist đúng field cho phép sửa, không nhận field lạ (chống Mass Assignment).
- Không lưu password plaintext, luôn hash bằng bcrypt.
- File upload phải kiểm tra type/size, không tin đuôi file.

## Database schema
(dán nguyên bảng DB_Schema từ file sheet vào đây)