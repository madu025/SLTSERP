/**
 * The session policy: ONE place for every time limit of a sign-in. The server (tokens and cookies), the sign-in routes and the browser
 * (the inactivity timer and its warning) all read it, so they cannot disagree.
 *
 * It follows the usual rules for business web applications (SaaS):
 *  - NIST SP 800-63B, assurance level 2: sign out after 30 minutes of inactivity, and require a new sign-in at least every 12 hours.
 *  - OWASP Session Management: an idle timeout AND an absolute timeout, both enforced by the server, not only by the page; the session
 *    renews while the person works (sliding), never past the absolute limit.
 *  - OAuth 2.0 security best practice: a short-lived access token (15 minutes) and a refresh token that is replaced at every refresh
 *    (rotation). Reuse detection of a stolen refresh token is not done yet (it needs a store of issued tokens).
 *  - Revocation: a password change, a role change or a deactivation invalidates the session at once (the token version in the database).
 */
export const SESSION_POLICY = {
    /** How long an access token lives. */
    accessTokenSeconds: 15 * 60,
    /** No activity for this long and the session ends (browser timer, and the server refuses to renew an idle session). */
    idleTimeoutSeconds: 30 * 60,
    /** Whatever the activity, a new sign-in is required this long after the person signed in. */
    absoluteLifetimeSeconds: 12 * 60 * 60,
    /** The browser warns this long before an inactivity sign-out and offers to stay signed in. */
    warnBeforeIdleSeconds: 2 * 60,
} as const;

/** The expiry of the refresh token issued now: the idle window, but never past the absolute limit. 0 or less means the session is over. */
export function refreshLifetimeSeconds(authTimeSec: number, nowSec: number): number {
    const untilAbsolute = authTimeSec + SESSION_POLICY.absoluteLifetimeSeconds - nowSec;
    return Math.min(SESSION_POLICY.idleTimeoutSeconds, untilAbsolute);
}

/** Has the person been signed in for longer than the absolute limit? */
export function absoluteLimitReached(authTimeSec: number, nowSec: number): boolean {
    return refreshLifetimeSeconds(authTimeSec, nowSec) <= 0;
}

/** Did the browser see no activity for the idle time? `lastActivityMs` and `nowMs` are milliseconds. */
export function isIdle(lastActivityMs: number, nowMs: number): boolean {
    return nowMs - lastActivityMs >= SESSION_POLICY.idleTimeoutSeconds * 1000;
}

/** The text of the access token expiry for the token library, from the policy (for example "15m"). */
export const ACCESS_TOKEN_EXPIRY_TEXT = `${SESSION_POLICY.accessTokenSeconds / 60}m`;
