-- CreateEnum
CREATE TYPE "Role" AS ENUM ('TERRITORY_HEAD', 'BRANCH_MANAGER', 'AGENCY_MANAGER', 'VIEWER');

-- CreateEnum
CREATE TYPE "SnapshotStatus" AS ENUM ('PROCESSING', 'READY', 'FAILED');

-- CreateTable
CREATE TABLE "Tenant" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "settings" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'TERRITORY_HEAD',
    "branchScope" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "waPhone" TEXT,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReportSnapshot" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileHash" TEXT NOT NULL,
    "reportType" TEXT NOT NULL DEFAULT 'NB_REPORT',
    "periodStart" TIMESTAMP(3),
    "periodEnd" TIMESTAMP(3),
    "rowCount" INTEGER NOT NULL,
    "status" "SnapshotStatus" NOT NULL DEFAULT 'PROCESSING',
    "uploadedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReportSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NbCase" (
    "id" TEXT NOT NULL,
    "snapshotId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "applicationNo" TEXT NOT NULL,
    "policyNo" TEXT,
    "customerId" TEXT,
    "customerName" TEXT NOT NULL,
    "customerCity" TEXT,
    "customerState" TEXT,
    "planType" TEXT,
    "productGenre" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "planName" TEXT,
    "insuredLives" INTEGER,
    "sumAssured" DECIMAL(14,2),
    "isUnlimitedSi" BOOLEAN NOT NULL DEFAULT false,
    "loggedPremium" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "issuedPremium" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "loadingPremium" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "loginBranch" TEXT NOT NULL,
    "channel" TEXT,
    "agentCode" TEXT,
    "agentName" TEXT NOT NULL DEFAULT 'UNASSIGNED',
    "amId" TEXT,
    "amName" TEXT,
    "salesStatusRaw" TEXT,
    "leadStatusRaw" TEXT,
    "funnelStage" TEXT NOT NULL,
    "discrepancy" BOOLEAN NOT NULL DEFAULT false,
    "statusAgeing" INTEGER,
    "loginAgeing" INTEGER,
    "isPortability" BOOLEAN NOT NULL DEFAULT false,
    "tenureYears" INTEGER,
    "loggedDate" TIMESTAMP(3),
    "issuedDate" TIMESTAMP(3),
    "policyStart" TIMESTAMP(3),
    "policyEnd" TIMESTAMP(3),
    "riders" JSONB NOT NULL DEFAULT '{}',
    "raw" JSONB NOT NULL,

    CONSTRAINT "NbCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IngestionIssue" (
    "id" TEXT NOT NULL,
    "snapshotId" TEXT NOT NULL,
    "rowNumber" INTEGER,
    "severity" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "rawRow" JSONB,

    CONSTRAINT "IngestionIssue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatMessage" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "snapshotId" TEXT,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "toolTrace" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NudgeLog" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "channel" TEXT NOT NULL DEFAULT 'WHATSAPP',
    "toName" TEXT NOT NULL,
    "toPhone" TEXT,
    "message" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NudgeLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ReportSnapshot_tenantId_createdAt_idx" ON "ReportSnapshot"("tenantId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ReportSnapshot_tenantId_fileHash_key" ON "ReportSnapshot"("tenantId", "fileHash");

-- CreateIndex
CREATE INDEX "NbCase_snapshotId_loginBranch_idx" ON "NbCase"("snapshotId", "loginBranch");

-- CreateIndex
CREATE INDEX "NbCase_snapshotId_funnelStage_idx" ON "NbCase"("snapshotId", "funnelStage");

-- CreateIndex
CREATE INDEX "NbCase_snapshotId_agentName_idx" ON "NbCase"("snapshotId", "agentName");

-- CreateIndex
CREATE INDEX "NbCase_tenantId_applicationNo_idx" ON "NbCase"("tenantId", "applicationNo");

-- CreateIndex
CREATE INDEX "ChatMessage_tenantId_userId_createdAt_idx" ON "ChatMessage"("tenantId", "userId", "createdAt");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportSnapshot" ADD CONSTRAINT "ReportSnapshot_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NbCase" ADD CONSTRAINT "NbCase_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "ReportSnapshot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IngestionIssue" ADD CONSTRAINT "IngestionIssue_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "ReportSnapshot"("id") ON DELETE CASCADE ON UPDATE CASCADE;
