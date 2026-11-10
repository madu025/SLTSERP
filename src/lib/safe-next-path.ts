/**
 * Same-origin path used as a post-refresh redirect target. Anything that could leave the site (absolute URL,
 * protocol-relative //host, backslash tricks, header-splitting characters) falls back to the dashboard.
 */
export function safeNextPath(next: string | null | undefined): string {
    if (!next || !next.startsWith('/') || next.startsWith('//') || next.includes('\\') || /[\r\n\0]/.test(next)) return '/dashboard';
    return next;
}
