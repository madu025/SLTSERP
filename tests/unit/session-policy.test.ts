import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { SESSION_POLICY, absoluteLimitReached, isIdle, refreshLifetimeSeconds } from '../../src/config/session-policy';

/**
 * The session policy (src/config/session-policy.ts), after NIST SP 800-63B AAL2 and OWASP session management:
 * 30 minutes of inactivity, 12 hours at most between sign-ins, a 15 minute access token, a refresh token replaced at every refresh.
 */
const read = (f: string) => fs.readFileSync(f, 'utf8');

test('the limits are the usual ones for a business application, and consistent with each other', () => {
    assert.equal(SESSION_POLICY.accessTokenSeconds, 15 * 60);
    assert.ok(SESSION_POLICY.idleTimeoutSeconds <= 30 * 60, 'idle timeout: 30 minutes at most');
    assert.ok(SESSION_POLICY.absoluteLifetimeSeconds <= 12 * 3600, 'a new sign-in at least every 12 hours');
    assert.ok(SESSION_POLICY.accessTokenSeconds < SESSION_POLICY.idleTimeoutSeconds, 'the access token renews while the person is still inside the idle window');
    assert.ok(SESSION_POLICY.warnBeforeIdleSeconds > 0 && SESSION_POLICY.warnBeforeIdleSeconds < SESSION_POLICY.idleTimeoutSeconds);
    assert.ok(SESSION_POLICY.idleTimeoutSeconds < SESSION_POLICY.absoluteLifetimeSeconds);
});

test('a refresh token lives for the idle window, and never past the absolute limit', () => {
    const t0 = 1_000_000;
    assert.equal(refreshLifetimeSeconds(t0, t0), SESSION_POLICY.idleTimeoutSeconds, 'right after the sign-in: the idle window');
    assert.equal(refreshLifetimeSeconds(t0, t0 + 3 * 3600), SESSION_POLICY.idleTimeoutSeconds, 'hours later while active: the idle window again (sliding)');
    const last = t0 + SESSION_POLICY.absoluteLifetimeSeconds - 600;
    assert.equal(refreshLifetimeSeconds(t0, last), 600, 'ten minutes before the absolute limit: only ten minutes are left');
    assert.ok(refreshLifetimeSeconds(t0, t0 + SESSION_POLICY.absoluteLifetimeSeconds) <= 0, 'at the absolute limit nothing is left');
    assert.ok(absoluteLimitReached(t0, t0 + SESSION_POLICY.absoluteLifetimeSeconds + 1));
    assert.ok(!absoluteLimitReached(t0, t0 + SESSION_POLICY.absoluteLifetimeSeconds - 1));
});

test('the browser: idle after the idle time, not before', () => {
    const t = 5_000_000;
    const idle = SESSION_POLICY.idleTimeoutSeconds * 1000;
    assert.ok(!isIdle(t, t + idle - 1));
    assert.ok(isIdle(t, t + idle));
    assert.ok(isIdle(t, t + 3 * 3600 * 1000), 'a tab that slept for three hours');
});

test('real tokens: the refresh token carries the sign-in time and expires with the idle window; an idle session cannot be renewed', async () => {
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'unit-test-secret-not-used-anywhere-else-0123456789';
    const { signRefreshToken, verifyRefreshToken } = await import('../../src/lib/auth');
    const claims = { userId: 'u1', role: 'ENGINEER', tokenVersion: 3 };
    const now = Math.floor(Date.now() / 1000);

    const fresh = await verifyRefreshToken(await signRefreshToken(claims));
    assert.ok(fresh, 'a refresh token issued now is valid');
    assert.equal(fresh!.exp! - fresh!.iat!, SESSION_POLICY.idleTimeoutSeconds, 'it lives for the idle window, not for days');
    assert.ok(Math.abs((fresh!.authTime as number) - now) <= 2, 'it records when the person signed in');

    const idle = await signRefreshToken(claims, { nowSec: now - SESSION_POLICY.idleTimeoutSeconds - 60, authTime: now - SESSION_POLICY.idleTimeoutSeconds - 60 });
    assert.equal(await verifyRefreshToken(idle), null, 'issued 31 minutes ago and never renewed: expired');

    const active = await signRefreshToken(claims, { nowSec: now - 10 * 60, authTime: now - 5 * 3600 });
    const activePayload = await verifyRefreshToken(active);
    assert.ok(activePayload, 'renewed ten minutes ago, signed in five hours ago: still valid');
    assert.equal(activePayload!.authTime, now - 5 * 3600, 'the sign-in time is kept as the token is replaced');

    const nearLimit = await signRefreshToken(claims, { nowSec: now - 60, authTime: now - SESSION_POLICY.absoluteLifetimeSeconds + 300 });
    const nl = await verifyRefreshToken(nearLimit);
    assert.ok(nl && nl.exp! - nl.iat! === 360, 'issued 60 seconds ago with 300 seconds left at the time of the test: it lives until the absolute limit, 360 seconds from its issue');
});

test('the sign-in routes, the refresh route and the browser all use the policy', () => {
    for (const f of ['src/app/api/login/route.ts', 'src/app/api/contractor-portal/auth/login/route.ts']) {
        const text = read(f);
        assert.ok(text.includes('SESSION_POLICY.idleTimeoutSeconds') && text.includes('SESSION_POLICY.accessTokenSeconds'), f);
        assert.ok(!text.includes('604800'), f + ': no 7 day cookie');
    }
    const refresh = read('src/app/api/auth/refresh/route.ts');
    assert.ok(refresh.includes('absoluteLimitReached(authTime, nowSec)') && refresh.includes('signRefreshToken(') && refresh.includes("refresh_token=${newRefreshToken}"), 'the refresh route rotates the token and enforces the absolute limit');
    assert.ok(!refresh.includes('Max-Age=900'), 'no copy of the access token time');
    const manager = read('src/components/SessionManager.tsx');
    assert.ok(manager.includes('SESSION_POLICY') && manager.includes("document.addEventListener('visibilitychange'") && manager.includes('Stay signed in'), 'the browser uses the policy, warns before the sign-out and checks when the tab wakes');
    assert.ok(!manager.includes('30 * 60 * 1000'), 'no copy of the idle time in the browser code');
    assert.ok(!read('src/lib/auth.ts').includes("'7d'") && !read('src/lib/auth.ts').includes("'15m'"), 'the token library has no time limit of its own');
});
