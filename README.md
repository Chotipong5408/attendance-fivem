# Attendance FiveM / ระบบเช็คชื่อ FiveM Community

**EN:** Web-based attendance management system for FiveM community staff — check-ins, leave requests, user management, CSV exports, and Discord notifications.

**TH:** ระบบจัดการเช็คชื่อสำหรับทีมงาน FiveM Community รองรับการเช็คชื่อ ขอลา จัดการผู้ใช้ ส่งออก CSV และแจ้งเตือน Discord

---

## Features / ฟีเจอร์

| Feature | คำอธิบาย |
|---------|----------|
| Check-in & leave | เช็คชื่อ / ขอลา |
| Admin dashboard | แดชบอร์ดแอดมิน |
| Discord webhooks | แจ้งเตือน Discord |
| CSV export | ส่งออกข้อมูล |

## Project Structure / โครงสร้างโปรเจกต์

```
Attendance-Fivem/
├── backend/                  # Express API + Prisma
│   ├── prisma/
│   │   ├── schema.prisma
│   │   ├── migrations/
│   │   └── seed.js
│   ├── src/
│   │   ├── index.js
│   │   ├── config.js
│   │   ├── middleware/
│   │   ├── routes/
│   │   └── utils/
│   ├── Dockerfile
│   └── package.json
├── frontend/                 # React + Vite + Tailwind
│   ├── src/
│   │   ├── api/client.js
│   │   ├── components/
│   │   ├── context/
│   │   └── pages/
│   ├── vercel.json
│   └── package.json
├── docker-compose.yml        # Local Postgres + API (+ optional frontend)
├── DEPLOYMENT.md             # Production deploy guide
└── .env.example              # Docker Compose variable reference
```

## Prerequisites / สิ่งที่ต้องมี

- **Node.js** 20+
- **PostgreSQL** 16+ (or use Docker Compose postgres service)
- **npm** 10+

## Local Setup / ติดตั้งในเครื่อง

### 1. Clone & install dependencies

```bash
cd backend && npm install
cd ../frontend && npm install
```

### 2. Configure environment

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

Edit `backend/.env` — set `DATABASE_URL` to your local Postgres instance:

```
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/attendance_fivem?schema=public"
```

### 3. Database setup

```bash
cd backend
npx prisma migrate dev --name init   # skip if migrations/ already exists
npx prisma generate
npm run db:seed
```

### 4. Start development servers

Terminal 1 — API:

```bash
cd backend && npm run dev
```

Terminal 2 — Frontend:

```bash
cd frontend && npm run dev
```

Open **http://localhost:5173** — the Vite dev server proxies `/api` requests to port 5000.

### Default Admin Account / บัญชีแอดมินเริ่มต้น

| Field | Value |
|-------|-------|
| Username | `admin` |
| Number | `001` |
| Password | `admin123` |

> Change this password immediately after first login in production.

## Docker Compose (optional)

Run Postgres + backend without installing PostgreSQL locally:

```bash
cp .env.example .env          # optional — customize JWT_SECRET
docker compose up --build
```

API available at **http://localhost:5000**. Include the frontend dev server:

```bash
docker compose --profile dev up --build
```

Then run migrations and seed inside the backend container on first boot:

```bash
docker compose exec backend npx prisma migrate deploy
docker compose exec backend npm run db:seed
```

## Production Deployment

See **[DEPLOYMENT.md](./DEPLOYMENT.md)** for Supabase, Railway/Render, and Vercel instructions.

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 19, Vite 6, Tailwind CSS 4, React Router 7 |
| Backend | Express 5, Prisma 6, JWT, bcrypt |
| Database | PostgreSQL 16 |
| Deploy | Docker, Railway/Render, Vercel, Supabase |
