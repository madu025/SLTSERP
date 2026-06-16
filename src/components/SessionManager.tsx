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
            // 1. Call Logout API to clear cookies
            await fetch('/api/logout', { method: 'POST' });

            // 2. Clear local storage
            localStorage.removeItem('user');

            // 3. Redirect to login
            router.push('/login');
            router.refresh();
        } catch (error) {
            console.error('[SESSION-MANAGER] Logout failed:', error);
            // Fallback redirect
            router.push('/login');
        }
    }, [router]);

    const resetTimer = useCallback(() => {
        if (timerRef.current) clearTimeout(timerRef.current);

        // Don't set timer if we are already on the login page
        if (pathname === '/login') return;

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
