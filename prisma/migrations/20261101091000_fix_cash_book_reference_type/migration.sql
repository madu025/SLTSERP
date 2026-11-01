-- Keep the cash-book function return contract stable when JournalEntry.referenceId
-- is UUID-backed in production. The API exposes this field as text.
DROP FUNCTION IF EXISTS public.fn_cash_book_report(text, timestamp without time zone, timestamp without time zone);

CREATE FUNCTION public.fn_cash_book_report(
    p_gl_account_code TEXT,
    p_from TIMESTAMP DEFAULT NULL,
    p_to TIMESTAMP DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    entry_id UUID,
    entry_date TIMESTAMP,
    reference_type TEXT,
    reference_id TEXT,
    description TEXT,
    debit DECIMAL,
    credit DECIMAL,
    running_balance DECIMAL
) AS $$
DECLARE
    v_opening_balance DECIMAL := 0;
BEGIN
    IF p_from IS NOT NULL THEN
        SELECT COALESCE(SUM(jl.debit - jl.credit), 0)
        INTO v_opening_balance
        FROM public."JournalLine" jl
        JOIN public."JournalEntry" je ON jl."entryId" = je.id
        WHERE jl."accountCode" = p_gl_account_code
          AND je.status != 'REVERSED'
          AND je.date < p_from;
    END IF;

    RETURN QUERY
    WITH period_lines AS (
        SELECT
            jl.id,
            jl."entryId",
            je.date AS entry_date,
            je."referenceType",
            je."referenceId"::TEXT AS "referenceId",
            COALESCE(jl.description, je.description) AS description,
            jl.debit,
            jl.credit,
            SUM(jl.debit - jl.credit) OVER (ORDER BY je.date ASC, jl.id ASC) AS cum_balance
        FROM public."JournalLine" jl
        JOIN public."JournalEntry" je ON jl."entryId" = je.id
        WHERE jl."accountCode" = p_gl_account_code
          AND je.status != 'REVERSED'
          AND (p_from IS NULL OR je.date >= p_from)
          AND (p_to IS NULL OR je.date <= p_to)
        ORDER BY je.date ASC, jl.id ASC
    )
    SELECT
        pl.id,
        pl."entryId",
        pl.entry_date,
        pl."referenceType",
        pl."referenceId",
        pl.description,
        pl.debit,
        pl.credit,
        v_opening_balance + pl.cum_balance AS running_balance
    FROM period_lines pl;
END;
$$ LANGUAGE plpgsql
SET search_path = public;
