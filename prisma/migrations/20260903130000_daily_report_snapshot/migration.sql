-- CreateTable
CREATE TABLE "DailyReportSnapshot" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
    "snapshotDate" DATE NOT NULL,
    "orderIndex" INTEGER NOT NULL,
    "rtom" TEXT NOT NULL,
    "region" TEXT NOT NULL,
    "province" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DailyReportSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DailyReportSnapshot_snapshotDate_rtom_key" ON "DailyReportSnapshot"("snapshotDate", "rtom");

-- CreateIndex
CREATE INDEX "DailyReportSnapshot_snapshotDate_idx" ON "DailyReportSnapshot"("snapshotDate");
