-- AlterTable: users password optional
ALTER TABLE "users" ALTER COLUMN "password" DROP NOT NULL;

-- AlterTable: attendance add attendanceDate
ALTER TABLE "attendance" ADD COLUMN "attendanceDate" DATE;

UPDATE "attendance" SET "attendanceDate" = ("createdAt" AT TIME ZONE 'UTC')::date WHERE "attendanceDate" IS NULL;

ALTER TABLE "attendance" ALTER COLUMN "attendanceDate" SET NOT NULL;

CREATE UNIQUE INDEX "attendance_userId_attendanceDate_key" ON "attendance"("userId", "attendanceDate");
CREATE INDEX "attendance_attendanceDate_idx" ON "attendance"("attendanceDate");

-- LeaveType enum migration
ALTER TYPE "LeaveType" RENAME TO "LeaveType_old";
CREATE TYPE "LeaveType" AS ENUM ('full_day', 'partial');
ALTER TABLE "leave_requests" ALTER COLUMN "leaveType" TYPE "LeaveType" USING (
  CASE
    WHEN "leaveType"::text = 'full_day' THEN 'full_day'::"LeaveType"
    ELSE 'partial'::"LeaveType"
  END
);
DROP TYPE "LeaveType_old";

ALTER TABLE "leave_requests" ADD COLUMN "leaveTimeSlot" TEXT;
ALTER TABLE "leave_requests" ALTER COLUMN "reason" DROP NOT NULL;

ALTER TYPE "LeaveStatus" RENAME TO "LeaveStatus_old";
CREATE TYPE "LeaveStatus" AS ENUM ('approved', 'rejected');
ALTER TABLE "leave_requests" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "leave_requests" ALTER COLUMN "status" TYPE "LeaveStatus" USING (
  CASE
    WHEN "status"::text = 'rejected' THEN 'rejected'::"LeaveStatus"
    ELSE 'approved'::"LeaveStatus"
  END
);
ALTER TABLE "leave_requests" ALTER COLUMN "status" SET DEFAULT 'approved';
DROP TYPE "LeaveStatus_old";

CREATE UNIQUE INDEX "leave_requests_userId_leaveDate_key" ON "leave_requests"("userId", "leaveDate");
