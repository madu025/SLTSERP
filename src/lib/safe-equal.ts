import crypto from 'crypto';

/** Compares two secrets in constant time (a plain `===` leaks, by its timing, how many leading characters were right). */
export function safeEqual(supplied: string | null | undefined, expected: string | null | undefined): boolean {
    if (!supplied || !expected) return false;
    const a = crypto.createHash('sha256').update(supplied).digest();
    const b = crypto.createHash('sha256').update(expected).digest();
    return crypto.timingSafeEqual(a, b);
}
