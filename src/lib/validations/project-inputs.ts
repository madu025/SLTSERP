import { z } from 'zod';

/** Money or quantity sent as number or numeric string: finite, non-negative, inside the database range, rounded. */
export function amountInput(decimals = 2, max = 999_999_999_999) {
    return z.union([z.number(), z.string().trim().min(1)])
        .transform((v, ctx) => {
            const n = typeof v === 'number' ? v : Number(v);
            if (!Number.isFinite(n) || n < 0 || n > max) {
                ctx.addIssue({ code: 'custom', message: `must be a number between 0 and ${max}` });
                return z.NEVER;
            }
            const f = 10 ** decimals;
            return Math.round(n * f) / f;
        });
}

/** ISO/date string or Date that parses to a real date. */
export const validDateInput = z.union([z.string(), z.date()]).refine(
    (v) => !Number.isNaN(new Date(v as string | Date).getTime()),
    { message: 'must be a valid date' },
);
