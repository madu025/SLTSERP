-- Migration: Add text_pattern_ops index on Notification.link for LIKE prefix queries
-- Fixes 25,758 COUNT + 1,782 UPDATE slow queries using startsWith on link column
-- B-tree with text_pattern_ops allows index scans for LIKE 'prefix%' patterns

CREATE INDEX IF NOT EXISTS "Notification_link_pattern_idx" 
ON "Notification" (link text_pattern_ops);
