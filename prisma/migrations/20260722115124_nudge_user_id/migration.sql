-- AlterTable
ALTER TABLE "NudgeLog" ADD COLUMN     "userId" TEXT;

-- CreateIndex
CREATE INDEX "NudgeLog_tenantId_userId_createdAt_idx" ON "NudgeLog"("tenantId", "userId", "createdAt");
