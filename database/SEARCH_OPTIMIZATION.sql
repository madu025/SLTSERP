-- NEXES ERP: DATABASE SEARCH OPTIMIZATION (PG_TRGM)
-- This script enables super-fast 'LIKE' and 'ILIKE' searches on the ServiceOrder table.
-- Without this, searching across 10M+ records will be extremely slow.

-- 1. Enable the pg_trgm extension
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 2. Create GIST Trigram Indexes for searched columns
-- These indexes are much faster than full table scans for partial string matches.

-- Index for SO Number
CREATE INDEX IF NOT EXISTS "idx_serviceorder_sonum_trgm" ON "ServiceOrder" USING GIST ("soNum" gist_trgm_ops);

-- Index for Customer Name
CREATE INDEX IF NOT EXISTS "idx_serviceorder_customername_trgm" ON "ServiceOrder" USING GIST ("customerName" gist_trgm_ops);

-- Index for Voice Number
CREATE INDEX IF NOT EXISTS "idx_serviceorder_voicenumber_trgm" ON "ServiceOrder" USING GIST ("voiceNumber" gist_trgm_ops);

/*
WHY GIST/TRGM?
- Standard B-Tree indexes ONLY work for prefix searches (column LIKE 'abc%').
- Trigram indexes work for ANY partial match (column LIKE '%abc%').
- For 10M records, a trigram search can return results in milliseconds vs seconds for a scan.
*/
