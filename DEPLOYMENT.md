# Deployment Guide / คู่มือการ Deploy

Production deployment for **Attendance FiveM** — Supabase PostgreSQL, Railway or Render backend, Vercel frontend.

---

## Architecture Overview

```
┌─────────────┐     HTTPS      ┌──────────────┐     HTTPS      ┌─────────────────┐
│   Vercel    │ ──────────────▶│ Railway /    │ ──────────────▶│ Supabase        │
│  (Frontend) │  VITE_API_URL  │ Render (API) │  DATABASE_URL  │ (PostgreSQL)    │
└─────────────┘                └──────────────┘                └─────────────────┘
```

---

## 1. Supabase PostgreSQL Setup

### Create project

1. Go to [supabase.com](https://supabase.com) and create a new project.
2. Choose a region close to your backend host.
3. Save the database password securely.

### Get `DATABASE_URL`

1. Open **Project Settings → Database → Connection string**.
2. Select **URI** mode.
3. Copy the connection string. Use the **Transaction pooler** (port `6543`) for serverless/Railway, or **Direct** (port `5432`) for long-running containers.

Example (direct):

```
postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:5432/postgres?schema=public
```

Example (pooler — recommended for Railway/Render):

```
postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1
```

> For Prisma with PgBouncer, append `?pgbouncer=true` and use `directUrl` in `schema.prisma` if you need migrations on the direct connection. For this project, run migrations locally or via CI against the direct URL, then deploy with the pooler URL.

### Apply schema

From your machine (with `backend/.env` pointing at Supabase direct URL):

```bash
cd backend
npm install
npx prisma migrate deploy
npx prisma generate
npm run db:seed
```

If no migrations exist yet, create the initial migration first:

```bash
npx prisma migrate dev --name init
```

---

## 2. Backend Deploy (Railway or Render)

The backend includes a `Dockerfile` that runs migrations on startup:

```dockerfile
CMD ["sh", "-c", "npx prisma migrate deploy && node src/index.js"]
```

### Railway

1. Create a new project at [railway.app](https://railway.app).
2. **New → GitHub Repo** — select this repository.
3. Set **Root Directory** to `backend`.
4. Railway auto-detects the Dockerfile.
5. Add environment variables (see [Environment Variables](#environment-variables)).
6. Deploy. Note the public URL (e.g. `https://attendance-api.up.railway.app`).
7. Verify: `GET https://your-api-url/health` → `{ "status": "ok" }`.

### Render

1. Create a **Web Service** at [render.com](https://render.com).
2. Connect the GitHub repo.
3. **Root Directory:** `backend`
4. **Environment:** Docker
5. **Health Check Path:** `/health`
6. Add environment variables.
7. Deploy and copy the service URL.

### Manual Docker build (any VPS)

```bash
cd backend
docker build -t attendance-fivem-api .
docker run -p 5000:5000 \
  -e DATABASE_URL="postgresql://..." \
  -e JWT_SECRET="..." \
  -e CORS_ORIGIN="https://your-app.vercel.app" \
  -e NODE_ENV=production \
  attendance-fivem-api
```

### Backend build & start commands (non-Docker)

```bash
cd backend
npm install
npx prisma migrate deploy
npx prisma generate
npm run build          # runs prisma generate
npm start              # node src/index.js
```

---

## 3. Frontend Deploy (Vercel)

1. Import the repo at [vercel.com](https://vercel.com).
2. Set **Root Directory** to `frontend`.
3. **Framework Preset:** Vite
4. **Build Command:** `npm run build`
5. **Output Directory:** `dist`
6. Add environment variable:

| Variable | Value |
|----------|-------|
| `VITE_API_URL` | `https://your-backend-url.railway.app` (no trailing slash) |

7. Deploy. The included `vercel.json` rewrites all routes to `index.html` for React Router.

### Frontend build commands

```bash
cd frontend
npm install
VITE_API_URL=https://your-api.example.com npm run build
npm run preview   # optional local preview of production build
```

### Update backend CORS

After Vercel deploy, set backend `CORS_ORIGIN` to your Vercel URL:

```
CORS_ORIGIN=https://your-app.vercel.app
```

For preview deployments, comma-separate multiple origins:

```
CORS_ORIGIN=https://your-app.vercel.app,https://your-app-git-main.vercel.app
```

---

## Environment Variables

### Backend (`backend/.env` / Railway / Render)

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `PORT` | No | HTTP port (platform may override) | `5000` |
| `NODE_ENV` | Yes | Environment | `production` |
| `DATABASE_URL` | Yes | PostgreSQL connection string | `postgresql://...` |
| `JWT_SECRET` | Yes | Secret for signing JWT tokens | long random string |
| `JWT_EXPIRES_IN` | No | Token lifetime | `7d` |
| `CORS_ORIGIN` | Yes | Allowed frontend origin(s), comma-separated | `https://app.vercel.app` |
| `DISCORD_WEBHOOK_URL` | No | Discord webhook for leave alerts | `https://discord.com/api/webhooks/...` |
| `LOGIN_RATE_LIMIT_WINDOW_MS` | No | Login rate limit window (ms) | `900000` |
| `LOGIN_RATE_LIMIT_MAX` | No | Max login attempts per window | `10` |

### Frontend (Vercel)

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `VITE_API_URL` | Yes | Backend API base URL | `https://api.example.com` |

### Docker Compose (root `.env`)

| Variable | Required | Description |
|----------|----------|-------------|
| `JWT_SECRET` | Recommended | JWT secret for local Docker backend |
| `DISCORD_WEBHOOK_URL` | No | Optional Discord webhook |

---

## Post-Deploy Checklist

- [ ] `GET /health` returns `200`
- [ ] Database migrations applied (`prisma migrate deploy`)
- [ ] Seed run once (`npm run db:seed`) — creates admin user
- [ ] Login works with default admin (`admin` / `001` / `admin123`) then **change password**
- [ ] Frontend `VITE_API_URL` points to backend
- [ ] Backend `CORS_ORIGIN` includes frontend URL
- [ ] `JWT_SECRET` is a strong unique value (not the example default)

---

## Local Docker (full stack)

```bash
cp .env.example .env
docker compose up --build -d
docker compose exec backend npx prisma migrate deploy
docker compose exec backend npm run db:seed
```

Optional frontend dev container:

```bash
docker compose --profile dev up --build
```

---

## Troubleshooting

### Prisma migration errors on Supabase

- Use the **direct** connection (port 5432) for `prisma migrate deploy`.
- Use the **pooler** URL (port 6543) for runtime `DATABASE_URL` in production if needed.

### CORS errors in browser

- Ensure `CORS_ORIGIN` exactly matches the frontend origin (scheme + host, no trailing slash).
- Redeploy backend after changing CORS.

### 401 on all API calls

- Check `JWT_SECRET` is set and consistent across deploys.
- Clear browser `localStorage` and log in again.

### Vercel SPA 404 on refresh

- Confirm `frontend/vercel.json` is committed and deployed.

---

## Default Admin (first seed only)

| Field | Value |
|-------|-------|
| Username | `admin` |
| Number | `001` |
| Password | `admin123` |

Run seed once after first deploy:

```bash
npm run db:seed
```
