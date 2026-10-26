-- Existing ledger rows were written by the application checksum writer before
-- the database trigger became authoritative. The application used ISO-8601
-- timestamps and Decimal.toString(), while PostgreSQL text casts use a space
-- timezone format and preserve scale. Verify both immutable formats without
-- rewriting historical ledger rows.
CREATE OR REPLACE FUNCTION public.fn_verify_ledger_integrity(
    p_store_id uuid DEFAULT NULL,
    p_item_id uuid DEFAULT NULL
)
RETURNS TABLE(
    total_checked integer,
    tampered_count integer,
    legacy_count integer,
    is_integral boolean
)
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $function$
BEGIN
    RETURN QUERY
    WITH ledger_entries AS (
        SELECT
            l.id,
            l."storeId",
            l."itemId",
            l."quantityAfter",
            l."createdAt",
            l."previousChecksum",
            l.checksum,
            LAG(l.checksum) OVER (
                PARTITION BY l."storeId", l."itemId"
                ORDER BY l."createdAt"
            ) AS prev_db_checksum
        FROM "InventoryLedger" l
        WHERE (p_store_id IS NULL OR l."storeId" = p_store_id)
          AND (p_item_id IS NULL OR l."itemId" = p_item_id)
    ),
    verified AS (
        SELECT
            le.*,
            encode(digest(
                le."storeId"::text || ':' || le."itemId"::text || ':' ||
                le."quantityAfter"::text || ':' || le."createdAt"::text || ':' ||
                COALESCE(le."previousChecksum", 'GENESIS'),
                'sha256'
            ), 'hex') AS expected_db_checksum,
            encode(digest(
                le."storeId"::text || ':' || le."itemId"::text || ':' ||
                trim(trailing '.' from trim(trailing '0' from le."quantityAfter"::text)) || ':' ||
                to_char(le."createdAt" AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') || ':' ||
                COALESCE(le."previousChecksum", 'GENESIS'),
                'sha256'
            ), 'hex') AS expected_application_checksum
        FROM ledger_entries le
    )
    SELECT
        COUNT(*)::integer,
        COUNT(*) FILTER (
            WHERE checksum NOT IN (expected_db_checksum, expected_application_checksum)
               OR ("previousChecksum" IS NOT NULL
                   AND prev_db_checksum IS NOT NULL
                   AND "previousChecksum" <> prev_db_checksum)
        )::integer,
        COUNT(*) FILTER (WHERE "previousChecksum" IS NULL)::integer,
        COUNT(*) FILTER (
            WHERE checksum NOT IN (expected_db_checksum, expected_application_checksum)
               OR ("previousChecksum" IS NOT NULL
                   AND prev_db_checksum IS NOT NULL
                   AND "previousChecksum" <> prev_db_checksum)
        ) = 0
    FROM verified;
END;
$function$;
