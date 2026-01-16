-- NEXES ERP: DATABASE PARTITIONING & ARCHIVING STRATEGY (SQL)
-- This script provides the foundation for partitioning the ServiceOrder table by Year.
-- Note: Partitioning must be done on the initial table creation or via a migration that recreates the table.

/* 
STEP 1: Rename the current table to a temporary name
ALTER TABLE "ServiceOrder" RENAME TO "ServiceOrder_Old";
*/

/*
STEP 2: Create the Partitioned Master Table
(This must match the current schema but include the PARTITION BY clause)

CREATE TABLE "ServiceOrder" (
    "id" TEXT NOT NULL,
    "rtom" TEXT NOT NULL,
    "soNum" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "sltsStatus" TEXT NOT NULL DEFAULT 'INPROGRESS',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedDate" TIMESTAMP(3),
    -- ... (all other columns from schema.prisma)
    
    CONSTRAINT "ServiceOrder_pkey" PRIMARY KEY ("id", "createdAt") -- Primary key must include partition key
) PARTITION BY RANGE ("createdAt");
*/

/*
STEP 3: Create Partitions for different time ranges
*/

-- 2024 Data
CREATE TABLE "ServiceOrder_y2024" PARTITION OF "ServiceOrder"
    FOR VALUES FROM ('2024-01-01') TO ('2025-01-01');

-- 2025 Data
CREATE TABLE "ServiceOrder_y2025" PARTITION OF "ServiceOrder"
    FOR VALUES FROM ('2025-01-01') TO ('2026-01-01');

-- 2026 Data (Active)
CREATE TABLE "ServiceOrder_y2026" PARTITION OF "ServiceOrder"
    FOR VALUES FROM ('2026-01-01') TO ('2027-01-01');

-- Default Partition for future/unexpected data
CREATE TABLE "ServiceOrder_default" PARTITION OF "ServiceOrder" DEFAULT;

/*
STEP 4: Archiving Strategy
To archive old data (e.g., 2024), we can simply "Detach" the partition.
This keeps the data in the DB but moves it out of the main table indexes, 
drastically improving performance for current operations.

ALTER TABLE "ServiceOrder" DETACH PARTITION "ServiceOrder_y2024";

-- You can then move this detached table to a different "Tablespace" (e.g., slower, cheaper HDD)
-- ALTER TABLE "ServiceOrder_y2024" SET TABLESPACE "cold_storage_disk";
*/

-- RECOMMENDATION: Use pg_partman extension for automated partition management.
