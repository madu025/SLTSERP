'use client';
import { useEffect, useState } from 'react';

/** UI convenience only; server capabilities and data scope stay authoritative. */
export function useCanonicalPermissions() {
    const [permissions, setPermissions] = useState<string[]>([]);
    useEffect(() => {
        const refresh = () => {
            try {
                const user = JSON.parse(localStorage.getItem('user') || 'null');
                setPermissions(Array.isArray(user?.permissions) ? user.permissions.filter((code: unknown) => typeof code === 'string') : []);
            } catch { setPermissions([]); }
        };
        refresh();
        window.addEventListener('storage', refresh);
        return () => window.removeEventListener('storage', refresh);
    }, []);
    return permissions;
}
