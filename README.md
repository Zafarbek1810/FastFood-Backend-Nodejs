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

## 4) Render.com ga deploy

Build muvaffaqiyatli bo‘lsa ham, **Environment Variables** bo‘lmasa server ishga tushmaydi.

### Render sozlamalari

| Maydon | Qiymat |
|--------|--------|
| **Root Directory** | *(bo‘sh qoldiring — repo o‘zi backend)* |
| **Build Command** | `npm install` |
| **Start Command** | `npm start` |

### Environment Variables (majburiy)

Render dashboard → Web Service → **Environment** → **Add Environment Variable**:

| Key | Qiymat |
|-----|--------|
| `DATABASE_URL` | Neon (yoki boshqa PostgreSQL) connection string. Masalan: `postgresql://user:pass@ep-xxx.neon.tech/neondb?sslmode=require` |
| `JWT_SECRET` | Uzun, tasodifiy maxfiy kalit (masalan: `openssl rand -hex 32` natijasi) |

`PORT` ni Render o‘zi beradi — qo‘lda yozish shart emas.

> Logda `injected env (0) from .env` ko‘rinsa — hech qanday env o‘rnatilmagan. `.env` fayl GitHubga kirmaydi; barcha qiymatlar Render panelida bo‘lishi kerak.

### Bazani tayyorlash

Mahalliy kompyuterdan bir marta (production `DATABASE_URL` bilan):

```bash
cd backend
# .env ichida production DATABASE_URL bo‘lsin
npm run db:init
npm run db:seed
```

Yoki Neon SQL Editor orqali `db/schema.sql` va `db/seed.sql` ni ishga tushiring.

### Tekshirish

Deploydan keyin brauzerda **to'g'ri URL** ni oching:

| URL | Natija |
|-----|--------|
| `https://SIZNING-SERVIS.onrender.com/` | API haqida qisqa ma'lumot |
| `https://SIZNING-SERVIS.onrender.com/api/health` | `{"ok":true,"message":"API ishlayapti"}` |

Agar `{"message":"Endpoint topilmadi"}` chiqsa — noto'g'ri yo'l (masalan `/health` o'rniga `/api/health` ishlating).

### Frontend (Vercel / Netlify / mahalliy)

`VITE_API_URL` oxirida **`/api`** bo'lishi shart:

```env
# To'g'ri
VITE_API_URL=https://SIZNING-SERVIS.onrender.com/api

# Noto'g'ri (404 beradi)
VITE_API_URL=https://SIZNING-SERVIS.onrender.com
```

Frontend deploy qilganda env o'zgaruvchini **build vaqtida** qo'shing, keyin qayta build qiling.

## 5) Asosiy endpointlar

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
