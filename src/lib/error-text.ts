/**
 * API errors arrive as `{ error: { code, message } }` (or a plain string in older routes). Passing the
 * object to `toast.error()` makes React throw "Objects are not valid as a React child" and blanks the page,
 * so always reduce an error payload to text first.
 */
export function toErrorText(value: unknown): string | undefined {
    if (typeof value === 'string') return value || undefined;
    if (value && typeof value === 'object') {
        const message = (value as { message?: unknown }).message;
        if (typeof message === 'string' && message) return message;
        const code = (value as { code?: unknown }).code;
        if (typeof code === 'string' && code) return code;
    }
    return undefined;
}
