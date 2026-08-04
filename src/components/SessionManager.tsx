"use client";

import { useEffect, useCallback, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';

const INACTIVITY_LIMIT = 30 * 60 * 1000; // 30 minutes in milliseconds

export default function SessionManager() {
    const router = useRouter();
    const pathname = usePathname();
    const timerRef = useRef<NodeJS.Timeout | null>(null);

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
