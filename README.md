# Fast Food Backend (Neon PostgreSQL)

## 1) Neon bazaga ulash

1. [Neon](https://neon.com/) saytida yangi project oching.
2. Project ichidan connection string (`DATABASE_URL`) ni oling.
3. `backend/.env.example` dan nusxa olib `backend/.env` yarating.
4. `.env` ichida quyidagilarni to'ldiring:

```env
PORT=4000
JWT_SECRET=your_strong_secret
DATABASE_URL=postgresql://USER:PASSWORD@HOST.neon.tech/DB_NAME?sslmode=require
```

## 2) Ishga tushirish

```bash
cd backend
npm install
npm run db:init
npm run db:seed
npm run dev
```

## 3) Test loginlar

- `superadmin` / `123456` (`super_admin`)
- `admin1` / `123456` (`admin`)
- `cashier1` / `123456` (`cashier`)
- `kitchen1` / `123456` (`kitchen`)
- `tv1` / `123456` (`tv_display`)

## 4) Asosiy endpointlar

- `GET /api/health`
- `POST /api/auth/login`
- `GET|POST|DELETE /api/categories`
- `GET|POST|DELETE /api/products`
- `GET|POST /api/orders`
- `GET /api/orders/history` (admin, filter + pagination)
- `GET /api/orders/export` (admin, Excel)
- `PATCH /api/orders/:id/status`
- `PATCH /api/orders/:id/cancel`
- `GET /api/restaurants/me` (admin, cashier, kitchen, tv_display)
- `GET|POST|PATCH|DELETE /api/restaurants` (super_admin)
