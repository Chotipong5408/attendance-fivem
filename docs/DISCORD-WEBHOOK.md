# ตั้งค่า Discord Webhook แจ้งเตือนเมื่อมีคำขอลา

## ขั้นตอนสร้าง Webhook

1. เปิด Discord Server ของ FiveM Community
2. คลิกขวาที่ช่องที่ต้องการรับแจ้งเตือน (เช่น `#leave-requests`)
3. **Edit Channel** → **Integrations** → **Webhooks** → **New Webhook**
4. ตั้งชื่อ เช่น `Attendance Bot` → **Copy Webhook URL**

## ใส่ในโปรเจกต์

### รันแบบ Local (npm run dev)

แก้ไฟล์ `backend/.env`:

```env
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/XXXX/YYYY
```

แล้ว restart backend

### รันแบบ Docker Compose

แก้ไฟล์ `.env` ที่ root โปรเจกต์:

```env
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/XXXX/YYYY
```

```powershell
docker compose up -d --build backend
```

### Production (Railway / Render)

เพิ่ม Environment Variable:

| Key | Value |
|-----|-------|
| `DISCORD_WEBHOOK_URL` | URL ที่ copy จาก Discord |

## ทดสอบ

1. Login เป็น user ปกติ
2. ไปหน้า **แจ้งลา** ส่งคำขอลา
3. ช่อง Discord ควรได้ embed แจ้งเตือน:
   - ผู้ใช้ / รหัสประจำตัว
   - วันที่ลา / ช่วงเวลา
   - เหตุผล

ถ้าไม่มี webhook URL ระบบยังทำงานปกติ แค่ไม่ส่ง Discord
