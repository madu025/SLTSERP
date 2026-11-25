"use client";

import { useEffect, useCallback, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { toast } from 'sonner';
import { performClientLogout } from '@/lib/client-logout';
import { SESSION_POLICY, IDLE_SECONDS_HEADER, isIdle } from '@/config/session-policy';

// The limits are in one place: src/config/session-policy.ts (the server enforces them too)
const INACTIVITY_LIMIT = SESSION_POLICY.idleTimeoutSeconds * 1000;
const WARN_BEFORE = SESSION_POLICY.warnBeforeIdleSeconds * 1000;
const WARNING_TOAST_ID = 'session-idle-warning';

// Endpoints secured by AGENT auth (x-api-key / agent JWT), NOT the session
// cookie. A 401 from them means the caller lacks agent credentials — it says
// NOTHING about the user's session, so it must never trigger a logout.
const AGENT_AUTH_PATHS = [
    '/api/helpdesk/agent/telemetry',
    '/api/assets/sync',
    '/api/assets/register',
    '/api/agent/version',
    '/api/auth/agent-login',
];

export default function SessionManager() {
    const pathname = usePathname();
    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const warnRef = useRef<NodeJS.Timeout | null>(null);
    const lastActivityRef = useRef<number>(0); // set by resetTimer when the page opens and at every activity
    const fetchPatchedRef = useRef(false);

    const handleLogout = useCallback(async () => {
        const isContractor = pathname.startsWith('/contractor');
        const targetLogin = isContractor ? '/contractor/login' : '/login';
        await performClientLogout(targetLogin);
    }, [pathname]);

    // ── Global 401 Fetch Interceptor with Token Refresh ──────────────────────
    // When the backend returns 401, first attempt to refresh the access token
    // using the refresh token cookie. Only redirect to login if refresh fails.
    // Patched once per page load via ref guard.
    useEffect(() => {
        if (fetchPatchedRef.current) return;
        fetchPatchedRef.current = true;

        const originalFetch = window.fetch.bind(window);
        window.fetch = async function patchedFetch(...args: Parameters<typeof fetch>) {
            const response = await originalFetch(...args);

            if (response.status === 401) {
                const requestUrl = typeof args[0] === 'string' ? args[0] : args[0] instanceof URL ? args[0].href : args[0]?.url ?? '';
                const isAgentAuthEndpoint = AGENT_AUTH_PATHS.some((p) => requestUrl.includes(p));
                // Only intercept API 401s, not login/auth endpoint responses
                if (requestUrl.includes('/api/') && !isAgentAuthEndpoint && !requestUrl.includes('/api/login') && !requestUrl.includes('/api/contractor-portal/auth') && !requestUrl.includes('/api/auth/refresh')) {
                    // Avoid redirect loops if already on login page or public pages
                    // The tokenised onboarding links are opened by people with no session: a 401 there must never trigger a refresh/logout loop
                    const publicPages = ['/login', '/contractor/login', '/privacy', '/public', '/contractor-registration', '/contractor-upload', '/team-upload'];
                    if (!publicPages.some(p => window.location.pathname === p || window.location.pathname.startsWith(p + '/'))) {
                        // Attempt token refresh before giving up
                        try {
                            // Say how long the person has really been inactive: the page's own background polling is not activity, so it must not renew the session
                            const idleSeconds = lastActivityRef.current > 0 ? Math.max(0, Math.floor((Date.now() - lastActivityRef.current) / 1000)) : 0;
                            const refreshRes = await originalFetch('/api/auth/refresh', { method: 'POST', headers: { [IDLE_SECONDS_HEADER]: String(idleSeconds) } });
                            if (refreshRes.ok) {
                                const refreshData = await refreshRes.json();
                                if (refreshData.token) {
                                    // Update localStorage with new token
                                    localStorage.setItem('token', refreshData.token);
                                    // The refresh endpoint owns the HttpOnly token cookie.
                                    // Do not create a second client-readable cookie with the
                                    // same name: duplicate token cookies can make middleware
                                    // select a stale value and bounce the user back to login.
                                    // Retry the original request
                                    return originalFetch(...args);
                                }
                            }
                        } catch {
                            // Refresh failed — fall through to logout
                        }

                        // Refresh failed — redirect to login
                        const hadSession = !!localStorage.getItem('token');
                        console.warn('[SESSION-MANAGER] 401 intercepted, refresh failed — redirecting to login');
                        const isContractor = window.location.pathname.startsWith('/contractor');
                        const sessionParam = hadSession ? '?session=expired' : '';
                        const targetLogin = isContractor ? `/contractor/login${sessionParam}` : `/login${sessionParam}`;
                        performClientLogout(targetLogin);
                        return new Promise(() => {});
                    }
                }
            }

            return response;
        };
    }, []);

    // Detect browser back/forward cache (bfcache) restoration
    // If the token cookie was cleared (user logged out), force redirect to login
    useEffect(() => {
        const handlePageShow = (event: PageTransitionEvent) => {
            if (event.persisted) {
                // Page was restored from bfcache - check if session is still valid
                const hasUser = localStorage.getItem('user');
                if (!hasUser) {
                    // No user data means they logged out - force full reload
                    console.log('[SESSION-MANAGER] bfcache restore detected after logout, redirecting to login');
                    const isContractor = window.location.pathname.startsWith('/contractor');
                    window.location.href = isContractor ? '/contractor/login' : '/login';
                }
            }
        };

        window.addEventListener('pageshow', handlePageShow);
        return () => window.removeEventListener('pageshow', handlePageShow);
    }, []);

    const resetTimer = useCallback(() => {
        if (timerRef.current) clearTimeout(timerRef.current);
        if (warnRef.current) clearTimeout(warnRef.current);
        toast.dismiss(WARNING_TOAST_ID);
        lastActivityRef.current = Date.now();

        // Don't set timer if we are already on a login page
        if (pathname === '/login' || pathname === '/contractor/login' || /^\/(contractor-registration|contractor-upload|team-upload)(\/|$)/.test(pathname)) return;

        // A warning before the sign-out, with a way to stay signed in
        warnRef.current = setTimeout(() => {
            toast.warning(`You will be signed out in ${Math.round(WARN_BEFORE / 60000)} minutes because there has been no activity.`, {
                id: WARNING_TOAST_ID,
                duration: WARN_BEFORE,
                // the click on this button is itself activity (the window listens to every click), so it restarts the timer
                action: { label: 'Stay signed in', onClick: () => undefined },
            });
        }, Math.max(0, INACTIVITY_LIMIT - WARN_BEFORE));

        timerRef.current = setTimeout(() => {
            console.log('[SESSION-MANAGER] User inactive. Logging out...');
            handleLogout();
        }, INACTIVITY_LIMIT);
    }, [handleLogout, pathname]);

    useEffect(() => {
        // Events to watch for user activity
        const events = [
            'mousedown',
            'mousemove',
            'keypress',
            'scroll',
            'touchstart',
            'click'
        ];

        // Reset timer on any of these events
        const handleActivity = () => resetTimer();

        // Initial set
        resetTimer();

        // Add event listeners
        events.forEach(event => {
            window.addEventListener(event, handleActivity);
        });

        // A tab that was asleep (computer asleep, tab frozen) cannot run its timer: when it wakes, check the time since the last activity
        const handleWake = () => {
            if (document.visibilityState === 'hidden') return;
            if (window.location.pathname === '/login' || window.location.pathname === '/contractor/login') return;
            if (lastActivityRef.current > 0 && isIdle(lastActivityRef.current, Date.now())) handleLogout();
        };
        document.addEventListener('visibilitychange', handleWake);
        window.addEventListener('focus', handleWake);

        // Cleanup
        return () => {
            if (timerRef.current) clearTimeout(timerRef.current);
            if (warnRef.current) clearTimeout(warnRef.current);
            toast.dismiss(WARNING_TOAST_ID);
            events.forEach(event => {
                window.removeEventListener(event, handleActivity);
            });
            document.removeEventListener('visibilitychange', handleWake);
            window.removeEventListener('focus', handleWake);
        };
    }, [resetTimer, handleLogout]);

    return null; // This component doesn't render anything
}
