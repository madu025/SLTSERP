-- Add composite indexes for category-based notification upsert
-- These indexes support the replaceUnreadByCategory() lookup pattern:
--   findFirst WHERE userId = ? AND type = ? AND link = ? AND isRead = false

CREATE INDEX IF NOT EXISTS "Notification_userId_type_isRead_idx"
    ON "Notification" ("userId", "type", "isRead");

CREATE INDEX IF NOT EXISTS "Notification_userId_type_link_isRead_idx"
    ON "Notification" ("userId", "type", "link", "isRead");
