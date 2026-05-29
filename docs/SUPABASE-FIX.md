# แก้ P1001 Can't reach Supabase (Windows)

## สาเหตุ

1. **รหัสผ่านมี `[` `]`** — ใน Supabase UI บางทีแสดงเป็น `[password]` แต่ใน `.env` **ห้ามใส่วงเล็บ**
2. **ใช้ Direct host** `db.xxx.supabase.co:5432` — บน Windows หลายเครื่องเชื่อมไม่ได้ (IPv4) ต้องใช้ **Session pooler**
3. **ไม่มี SSL** — ต้องมี `?sslmode=require` ท้าย URL

## วิธีแก้ (ทำตามนี้)

### 1. เปิด Supabase Dashboard

โปรเจกต์ → **Project Settings** (ไอคอนเฟือง) → **Database**

### 2. เลือก Connection string

- **Type:** URI  
- **Method:** **Session pooler** (ไม่ใช่ Direct connection)

จะได้ URL ประมาณ (REGION ต้องตรงกับโปรเจกต์ — โปรเจกต์นี้อยู่ `ap-northeast-1`):

```
postgresql://postgres.pfwxcvzgblygnwvmgxlt:[YOUR-PASSWORD]@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres
```

### 3. แก้ `backend/.env`

- ลบ `[` และ `]` ออกจากรหัสผ่าน
- เพิ่มท้าย URL: `?sslmode=require`

ตัวอย่างรูปแบบที่ถูก:

```env
DATABASE_URL="postgresql://postgres.pfwxcvzgblygnwvmgxlt:รหัสผ่านจริง@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres?sslmode=require"
```

**REGION** ต้องตรงกับที่แสดงใน Dashboard (โปรเจกต์นี้ใช้ `aws-1-ap-northeast-1`)

### Windows + SSL error

รันด้วย (ชั่วคราวสำหรับ dev):

```powershell
$env:NODE_TLS_REJECT_UNAUTHORIZED='0'
npx prisma migrate deploy
npm run db:seed
```

หรือ: `npm run db:deploy:win` และ `npm run db:seed:win`

### 4. ตรวจว่าโปรเจกต์ไม่ Pause

Supabase Free tier หยุดเมื่อไม่ใช้งาน → เปิด Dashboard รอ restore ก่อน migrate

### 5. รันใหม่

```powershell
cd backend
npx prisma migrate deploy
npm run db:seed
```

## ถ้ายังไม่ได้

- ลอง **Transaction pooler** port **6543** + `?pgbouncer=true` สำหรับแอปรัน (migrate อาจต้องใช้ Session 5432)
- ปิด VPN/Firewall ชั่วคราว
- Reset database password ใน Supabase แล้ว copy URI ใหม่
