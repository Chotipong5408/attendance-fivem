# คู่มือติดตั้งด่วน (ทุกอย่างที่คุณต้องการ)

## สถานะบนเครื่องคุณ

- **Docker:** ยังไม่พบใน PATH → ติดตั้ง [Docker Desktop](https://www.docker.com/products/docker-desktop/) แล้วรัน `scripts\start-local.ps1`
- **ไม่มี Docker:** ใช้ **Supabase** (แนะนำ ฟรี ไม่ต้องติดตั้ง DB ในเครื่อง)

---

## วิธี A: Database ด้วย Supabase (แนะนำถ้าไม่มี Docker)

### 1. สร้าง Database

1. ไป https://supabase.com → สมัคร/Login → **New Project**
2. ตั้งรหัส Database password → รอสร้างเสร็จ
3. **Project Settings** → **Database** → **Connection string** → เลือก **URI**
4. Copy URL แบบนี้:
   ```
   postgresql://postgres.[ref]:[PASSWORD]@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres
   ```

### 2. ใส่ใน backend/.env

```env
DATABASE_URL="postgresql://postgres.xxxx:รหัสผ่าน@....supabase.com:6543/postgres?schema=public"
```

### 3. Migrate + Seed + รัน

```powershell
cd c:\Users\PC\Desktop\Attendance-Fivem\backend
npx prisma migrate deploy
npm run db:seed

# Terminal 1
npm run dev

# Terminal 2
cd ..\frontend
npm run dev
```

เปิด http://localhost:5173  
Login: **admin** / **001** / **admin123**

---

## วิธี B: Docker (เมื่อติดตั้ง Docker Desktop แล้ว)

```powershell
cd c:\Users\PC\Desktop\Attendance-Fivem
.\scripts\start-local.ps1

# จากนั้น 2 terminal
cd backend; npm run dev
cd frontend; npm run dev
```

หรือรันทั้ง stack:

```powershell
docker compose up -d --build
docker compose --profile dev up -d   # รวม frontend
```

---

## Discord Webhook

ดูรายละเอียด: [DISCORD-WEBHOOK.md](./DISCORD-WEBHOOK.md)

สรุป: Copy Webhook URL จาก Discord → ใส่ใน `backend/.env`:

```env
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/...
```

Restart backend แล้วทดสอบส่งคำขอลาจากหน้า **แจ้งลา**

---

## Deploy Production

### 1) Database — Supabase

ใช้ `DATABASE_URL` เดียวกับด้านบน (Production)

### 2) Backend — Render

1. Push โค้ดขึ้น GitHub
2. Render → **New** → **Blueprint** หรือ **Web Service** จาก repo
3. ใช้ `render.yaml` ใน repo หรือตั้งค่าเอง:
   - **Root Directory:** `backend`
   - **Dockerfile Path:** `backend/Dockerfile`
4. Environment Variables:
   | Key | Value |
   |-----|-------|
   | `DATABASE_URL` | จาก Supabase |
   | `JWT_SECRET` | สุ่มยาว 32+ ตัวอักษร |
   | `CORS_ORIGIN` | URL frontend บน Vercel |
   | `DISCORD_WEBHOOK_URL` | (optional) |
5. Deploy → คัดลอก URL เช่น `https://attendance-fivem-api.onrender.com`

**Railway:** เหมือนกัน — New Project → Deploy from GitHub → โฟลเดอร์ `backend` → ใส่ env เดียวกัน

### 3) Frontend — Vercel

1. https://vercel.com → Import GitHub repo
2. **Root Directory:** `frontend`
3. Environment:
   ```
   VITE_API_URL=https://attendance-fivem-api.onrender.com
   ```
4. Deploy

### 4) หลัง Deploy

```bash
# รันครั้งเดียวบน Render Shell หรือเครื่อง local ชี้ไป production DB
cd backend
npx prisma migrate deploy
npm run db:seed
```

---

## Checklist

- [ ] `backend/.env` มี `DATABASE_URL` ถูกต้อง
- [ ] `npx prisma migrate deploy` สำเร็จ
- [ ] `npm run db:seed` สร้าง admin แล้ว
- [ ] Backend `npm run dev` → http://localhost:5000/health ได้ `{"status":"ok"}`
- [ ] Frontend `npm run dev` → Login ได้
- [ ] (Optional) Discord webhook ใน `.env`
- [ ] Production: `CORS_ORIGIN` = URL Vercel, `VITE_API_URL` = URL Render
