-- CreateTableIndex: OPMC region, name, province indexes for query optimization
-- Fixes 196,507 sequential scans on 43-row OPMC table

-- CreateIndex
CREATE INDEX "OPMC_region_idx" ON "OPMC"("region");

-- CreateIndex
CREATE INDEX "OPMC_name_idx" ON "OPMC"("name");

-- CreateIndex
CREATE INDEX "OPMC_province_idx" ON "OPMC"("province");
