-- CreateTable
CREATE TABLE "CodingSnapshot" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileHash" TEXT NOT NULL,
    "missionTarget" INTEGER NOT NULL DEFAULT 300,
    "targets" JSONB NOT NULL DEFAULT '{}',
    "rowCount" INTEGER NOT NULL,
    "status" "SnapshotStatus" NOT NULL DEFAULT 'PROCESSING',
    "uploadedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CodingSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CodingLead" (
    "id" TEXT NOT NULL,
    "snapshotId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "date" TIMESTAMP(3),
    "th" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "branch" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "bdm" TEXT,
    "agentName" TEXT NOT NULL,
    "mobile" TEXT,
    "competitor" TEXT,
    "city" TEXT,
    "experience" TEXT,
    "source" TEXT,
    "status" TEXT NOT NULL DEFAULT 'IDENTIFIED',
    "remarks" TEXT,
    "isDuplicate" BOOLEAN NOT NULL DEFAULT false,
    "raw" JSONB NOT NULL,

    CONSTRAINT "CodingLead_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CodingSnapshot_tenantId_createdAt_idx" ON "CodingSnapshot"("tenantId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "CodingSnapshot_tenantId_fileHash_key" ON "CodingSnapshot"("tenantId", "fileHash");

-- CreateIndex
CREATE INDEX "CodingLead_snapshotId_th_idx" ON "CodingLead"("snapshotId", "th");

-- CreateIndex
CREATE INDEX "CodingLead_snapshotId_branch_idx" ON "CodingLead"("snapshotId", "branch");

-- CreateIndex
CREATE INDEX "CodingLead_snapshotId_status_idx" ON "CodingLead"("snapshotId", "status");

-- CreateIndex
CREATE INDEX "CodingLead_tenantId_idx" ON "CodingLead"("tenantId");

-- AddForeignKey
ALTER TABLE "CodingLead" ADD CONSTRAINT "CodingLead_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "CodingSnapshot"("id") ON DELETE CASCADE ON UPDATE CASCADE;
