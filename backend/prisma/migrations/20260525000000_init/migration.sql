-- CreateEnum
CREATE TYPE "public"."Role" AS ENUM ('user', 'admin');

-- CreateEnum
CREATE TYPE "public"."AttendanceStatus" AS ENUM ('present', 'absent', 'leave');

-- CreateEnum
CREATE TYPE "public"."LeaveType" AS ENUM ('full_day', 'morning', 'afternoon');

-- CreateEnum
CREATE TYPE "public"."LeaveStatus" AS ENUM ('pending', 'approved', 'rejected');

-- CreateTable
CREATE TABLE "public"."users"  (
    "id"        TEXT NOT NULL,
    "username"  TEXT NOT NULL,
    "number"    TEXT NOT NULL,
    "password"  TEXT NOT NULL,
    "role"      "public"."Role" NOT NULL DEFAULT 'user',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
  );

-- CreateTable
CREATE TABLE "public"."attendance"
  (
    "id"        TEXT NOT NULL,
    "userId"    TEXT NOT NULL,
    "status"    "public"."AttendanceStatus" NOT NULL,
    "note"      TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "attendance_pkey" PRIMARY KEY ("id")
  );

-- CreateTable
CREATE TABLE "public"."leave_requests"
  (
    "id"        TEXT NOT NULL,
    "userId"    TEXT NOT NULL,
    "leaveDate" DATE NOT NULL,
    "leaveType" "public"."LeaveType" NOT NULL,
    "reason"    TEXT NOT NULL,
    "image"     TEXT,
    "status"    "public"."LeaveStatus" NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "leave_requests_pkey" PRIMARY KEY ("id")
  );

-- CreateTable
CREATE TABLE "public"."activity_logs"
  (
    "id"        TEXT NOT NULL,
    "userId"    TEXT,
    "action"    TEXT NOT NULL,
    "details"   TEXT,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "activity_logs_pkey" PRIMARY KEY ("id")
  );

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "public"."users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "users_number_key" ON "public"."users"("number");

-- CreateIndex
CREATE INDEX "attendance_userId_createdAt_idx" ON "public"."attendance"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "leave_requests_userId_leaveDate_idx" ON "public"."leave_requests"("userId", "leaveDate");

-- CreateIndex
CREATE INDEX "activity_logs_createdAt_idx" ON "public"."activity_logs"("createdAt");

-- AddForeignKey
ALTER TABLE "public"."attendance"
  ADD CONSTRAINT "attendance_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."leave_requests"
  ADD CONSTRAINT "leave_requests_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."activity_logs"
  ADD CONSTRAINT "activity_logs_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
