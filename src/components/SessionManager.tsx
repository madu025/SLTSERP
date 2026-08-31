"use client";

import { useEffect, useCallback, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';

const INACTIVITY_LIMIT = 30 * 60 * 1000; // 30 minutes in milliseconds

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
    const router = useRouter();
    const pathname = usePathname();
    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const fetchPatchedRef = useRef(false);

    const handleLogout = useCallback(async () => {
        try {
            const isContractor = pathname.startsWith('/contractor');
            const targetLogin = isContractor ? '/contractor/login' : '/login';

            // 1. Call Logout API to clear cookies
            await fetch('/api/logout', { method: 'POST' });

            // 2. Clear local storage
            localStorage.removeItem('user');
            localStorage.removeItem('token');
            if (isContractor) {
                localStorage.removeItem('contractor_user');
                localStorage.removeItem('contractor_token');
            }

            // 3. Redirect to appropriate login page
            router.push(targetLogin);
            router.refresh();
        } catch (error) {
            console.error('[SESSION-MANAGER] Logout failed:', error);
            const isContractor = pathname.startsWith('/contractor');
            router.push(isContractor ? '/contractor/login' : '/login');
        }
    }, [pathname, router]);

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
                    const publicPages = ['/login', '/contractor/login', '/privacy'];
                    if (!publicPages.some(p => window.location.pathname === p || window.location.pathname.startsWith(p + '/'))) {
                        // Attempt token refresh before giving up
                        try {
                            const refreshRes = await originalFetch('/api/auth/refresh', { method: 'POST' });
                            if (refreshRes.ok) {
                                const refreshData = await refreshRes.json();
                                if (refreshData.token) {
                                    // Update localStorage with new token
                                    localStorage.setItem('token', refreshData.token);
                                    const isProd = window.location.protocol === 'https:';
                                    document.cookie = `token=${refreshData.token}; Max-Age=900; Path=/; SameSite=Lax${isProd ? '; Secure' : ''}`;
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
                        localStorage.removeItem('user');
                        localStorage.removeItem('token');
                        const isContractor = window.location.pathname.startsWith('/contractor');
                        const sessionParam = hadSession ? '?session=expired' : '';
                        const targetLogin = isContractor ? `/contractor/login${sessionParam}` : `/login${sessionParam}`;
                        window.location.href = targetLogin;
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

        // Don't set timer if we are already on a login page
        if (pathname === '/login' || pathname === '/contractor/login') return;

        timerRef.current = setTimeout(() => {
            console.log('[SESSION-MANAGER] User inactive for 30 minutes. Logging out...');
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

        // Cleanup
        return () => {
            if (timerRef.current) clearTimeout(timerRef.current);
            events.forEach(event => {
                window.removeEventListener(event, handleActivity);
            });
        };
    }, [resetTimer]);

    return null; // This component doesn't render anything
}
