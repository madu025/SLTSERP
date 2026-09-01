-- One-off (2026-09-01): repair 9 SODs whose bridge scraper captured adjacent
-- portal labels as values (voiceNumber='STATUS', orderType='LINE TYPE').
-- Real values live in the raw payloads under PRIMARY (voice) and
-- V-VOICE_FTTH / clean ORDER_TYPE (order type). The bridgeSync sanitizer
-- prevents recurrence; this fixes the existing rows only.
WITH raw_keys AS (
    SELECT s."soNum" AS so, m.key, m.val
    FROM "ServiceOrder" s
    JOIN "ExtensionRawData" e ON e."soNum" = s."soNum",
    jsonb_each_text(e."scrapedData"->'allTabs') t(tab, obj),
    LATERAL (SELECT CASE WHEN jsonb_typeof(obj::jsonb) = 'object' THEN obj::jsonb ELSE '{}'::jsonb END AS o) x,
    jsonb_each_text(x.o) m(key, val)
    WHERE s."voiceNumber" = 'STATUS'
),
voice_pick AS (
    SELECT DISTINCT ON (so) so, val AS voice
    FROM raw_keys
    WHERE key IN ('PRIMARY', 'VOICENUMBER', 'VOICE NUMBER', 'CIRCUIT')
      AND val ~ '^0[0-9]{8,9}$'
    ORDER BY so, (key = 'PRIMARY') DESC
),
type_pick AS (
    SELECT DISTINCT ON (so) so, val AS otype
    FROM raw_keys
    WHERE (key = 'ORDER_TYPE' AND val NOT IN ('STATUS', 'LINE TYPE', 'ORDER TYPE', 'SERVICE TYPE', 'SERVICE', 'TYPE', 'TEST TYPE'))
       OR (key ~* 'V-VOICE' AND val ~ '^[A-Z][A-Z0-9 /-]{2,29}$')
    ORDER BY so, (key = 'ORDER_TYPE') DESC, (key ~* 'V-VOICE') DESC
)
UPDATE "ServiceOrder" s
SET "voiceNumber" = v.voice,
    "orderType" = t.otype,
    "updatedAt" = now()
FROM voice_pick v
LEFT JOIN type_pick t ON t.so = v.so
WHERE s."soNum" = v.so;
