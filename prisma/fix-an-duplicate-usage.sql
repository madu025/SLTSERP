-- One-off data fix for the AN202607230049085 duplicate material race (2026-09-01).
-- A bridge push and an ERP-side sync interleaved: two identical PORTAL_SYNC rows
-- (52m Drop Wire, batchId null) were created and OPMC store summary stock was
-- deducted twice (-104 instead of -52). Ledger was untouched (cost 0.00).
-- Restore the extra 52m and drop one of the twin rows (keep the earliest).
UPDATE "InventoryStock"
SET "quantity" = "quantity" + 52
WHERE id = '019fdcc5-3cc0-56c0-696d-18c0a0f40a62';

DELETE FROM "SODMaterialUsage"
WHERE id = '01a05ba6-a16d-427e-a837-2ec54a18e176';
