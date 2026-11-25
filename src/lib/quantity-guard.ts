import { AppError } from '@/lib/error';

/**
 * A quantity typed by a person must be a real number greater than zero. Without this check a line of 0, a negative number or text
 * became a document (issue note, return note, material request) that is shown as pending although nothing can move, and used up a number.
 * Returns the quantity as a number.
 */
export function assertPositiveQuantity(value: unknown, what: string): number {
    const q = Number(String(value ?? '').trim());
    if (!Number.isFinite(q) || q <= 0) {
        throw AppError.badRequest(`INVALID_QUANTITY: the quantity of ${what} must be a number greater than zero`);
    }
    return q;
}

/** The same check for every line of a document; there must be at least one line. */
export function assertPositiveLines(lines: unknown, quantityKey: string, label: (line: Record<string, unknown>) => string): void {
    if (!Array.isArray(lines) || lines.length === 0) throw AppError.badRequest('At least one item is required');
    for (const line of lines as Array<Record<string, unknown>>) assertPositiveQuantity(line[quantityKey], label(line));
}
