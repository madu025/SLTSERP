-- Approval email buttons wrapped ("Approv/e") on narrow mobile screens: shrink padding and forbid wrapping.
-- Only touches rows that still contain the old button style, so customised templates stay intact.
UPDATE "NotificationTemplate"
SET "htmlBody" = replace(
      replace(
        "htmlBody",
        'padding:12px 32px;text-decoration:none;border-radius:6px;font-weight:600',
        'padding:12px 22px;white-space:nowrap;text-align:center;text-decoration:none;border-radius:6px;font-weight:600'
      ),
      '<td style="padding:0 8px;">',
      '<td style="padding:0 6px;white-space:nowrap;">'
    )
WHERE "htmlBody" LIKE '%padding:12px 32px;text-decoration:none;border-radius:6px;font-weight:600%';
