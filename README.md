# Your Shelve

## Mô tả project

Web quản lý tủ sách manga/Light Novel theo số tập, dành cho người sưu tầm.
Xem chi tiết kế hoạch tại `Your_Shelve_Ke_hoach_Sprint.xlsx` (sheet `Ke_hoach_Sprint`, `DB_Schema`, `Security_Cases`).

## Tech stack

- **Frontend:** Next.js (App Router) + TypeScript + TailwindCSS + Framer Motion
- **Backend:** Next.js API Routes
- **Database:** PostgreSQL + Prisma ORM
- **Auth:** JWT (access token ngắn hạn + refresh token có rotate), bcrypt hash password
- **Ảnh:** Cloudinary
- **Dữ liệu manga/LN trending:** AniList GraphQL API

## Cách cài đặt local

1. Clone repo và cài dependencies:

   ```bash
   git clone <repo-url>
   cd your-shelve
   npm install
   ```

2. Tạo file `.env` từ `.env.example` và điền giá trị thật:

   ```bash
   cp .env.example .env
   ```

3. Sinh Prisma client và chạy migration:

   ```bash
   npx prisma generate
   npx prisma migrate dev
   ```

4. Chạy dev server:

   ```bash
   npm run dev
   ```

5. Mở [http://localhost:3000](http://localhost:3000).

## Security Testing

<!-- TODO: điền ngày 18 -->
