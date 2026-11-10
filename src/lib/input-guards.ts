import { AppError } from '@/lib/error';
import { isValidUuid } from '@/lib/uuid';

// Bidi override/isolate and zero-width controls are used to spoof names in lists and file names.
const BIDI_AND_CONTROL = /[\u202A-\u202E\u2066-\u2069\u200B-\u200F\u0000-\u0008\u000B\u000C\u000E-\u001F]/g;

/** Required, trimmed, control-character-free string with a length cap. */
export function requireText(value: unknown, field: string, max: number): string {
    if (typeof value !== 'string') throw AppError.badRequest(`${field} must be text`);
    const clean = value.replace(BIDI_AND_CONTROL, '').trim();
    if (!clean) throw AppError.badRequest(`${field} is required`);
    if (clean.length > max) throw AppError.badRequest(`${field} must be at most ${max} characters`);
    return clean;
}

/** Optional text: undefined/null/'' -> undefined, otherwise same rules as requireText. */
export function optionalText(value: unknown, field: string, max: number): string | undefined {
    if (value === undefined || value === null || value === '') return undefined;
    return requireText(value, field, max);
}

/** Identifier that must be a uuid (400 instead of a database error). */
export function requireUuid(value: unknown, field: string): string {
    if (!isValidUuid(value)) throw AppError.badRequest(`${field} must be a valid id`);
    return value;
}

export function optionalUuid(value: unknown, field: string): string | undefined {
    if (value === undefined || value === null || value === '') return undefined;
    return requireUuid(value, field);
}

/** page/limit from a query string: integers, page >= 1, 1 <= limit <= maxLimit. Invalid input falls back to defaults. */
export function parsePaging(rawPage: string | null, rawLimit: string | null, defaults = { page: 1, limit: 50 }, maxLimit = 200) {
    const page = Number.parseInt(rawPage ?? '', 10);
    const limit = Number.parseInt(rawLimit ?? '', 10);
    return {
        page: Number.isInteger(page) && page >= 1 ? Math.min(page, 100000) : defaults.page,
        limit: Number.isInteger(limit) && limit >= 1 ? Math.min(limit, maxLimit) : defaults.limit,
    };
}

/** Finite money/quantity amount within the database range, rounded to 2 decimals (4 for quantities). */
export function requireAmount(value: unknown, field: string, opts: { min?: number; max?: number; decimals?: number } = {}): number {
    const { min = 0, max = 999_999_999_999, decimals = 2 } = opts;
    const n = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
    if (typeof n !== 'number' || !Number.isFinite(n)) throw AppError.badRequest(`${field} must be a number`);
    if (n < min || n > max) throw AppError.badRequest(`${field} must be between ${min} and ${max}`);
    const f = 10 ** decimals;
    return Math.round(n * f) / f;
}

/** Only http(s) and app-relative URLs may be stored as a clickable file link. */
export function requireSafeUrl(value: unknown, field: string, max = 2048): string {
    if (typeof value !== 'string') throw AppError.badRequest(`${field} must be text`);
    const url = value.trim();
    if (!url || url.length > max || /[\u0000-\u001F\u007F]/.test(url)) throw AppError.badRequest(`${field} is not a valid link`);
    if (url.startsWith('/') && !url.startsWith('//') && !url.includes(String.fromCharCode(92))) return url;
    try {
        const parsed = new URL(url);
        if (parsed.protocol === 'http:' || parsed.protocol === 'https:') return url;
    } catch { /* fall through */ }
    throw AppError.badRequest(`${field} must be an http(s) or app-relative link`);
}

/** Valid calendar date or throws 400. */
export function requireDate(value: unknown, field: string): Date {
    const d = value instanceof Date ? value : new Date(String(value));
    if (typeof value === 'undefined' || value === null || Number.isNaN(d.getTime())) throw AppError.badRequest(`${field} is not a valid date`);
    return d;
}
