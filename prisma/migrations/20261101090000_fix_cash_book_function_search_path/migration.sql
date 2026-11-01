-- The cash-book function references Prisma's quoted public tables. Keep the
-- function's search path explicit so production calls resolve those relations.
ALTER FUNCTION public.fn_cash_book_report(text, timestamp without time zone, timestamp without time zone)
SET search_path = public;
