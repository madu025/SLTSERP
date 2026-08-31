-- Migration: Add composite index for ServiceOrder pending queries
-- Fixes 485s slow query: WHERE sltsStatus NOT IN (...) AND status IN (...) AND receivedDate < ...

CREATE INDEX IF NOT EXISTS "ServiceOrder_status_sltsStatus_receivedDate_idx" 
ON "ServiceOrder" (status, sltsStatus, receivedDate);
