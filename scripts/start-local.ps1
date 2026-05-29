# FiveM Attendance - Local startup (Docker Postgres + Backend + Frontend)
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot

Write-Host "=== Starting PostgreSQL (Docker) ===" -ForegroundColor Cyan
Set-Location $root
docker compose up -d postgres

Write-Host "Waiting for database..." -ForegroundColor Yellow
$max = 30
for ($i = 0; $i -lt $max; $i++) {
  $ok = docker compose exec -T postgres pg_isready -U postgres -d attendance_fivem 2>$null
  if ($LASTEXITCODE -eq 0) { break }
  Start-Sleep -Seconds 2
}

Write-Host "=== Database migrate & seed ===" -ForegroundColor Cyan
Set-Location "$root\backend"
if (-not (Test-Path "node_modules")) { npm install }
npx prisma migrate deploy
npm run db:seed

Write-Host ""
Write-Host "=== Ready ===" -ForegroundColor Green
Write-Host "Run in 2 terminals:"
Write-Host "  1) cd backend  ; npm run dev"
Write-Host "  2) cd frontend ; npm run dev"
Write-Host ""
Write-Host "Login: admin / 001 / admin123"
Write-Host "URL:   http://localhost:5173"
