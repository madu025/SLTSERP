"use client";

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { hasAccess } from '@/config/sidebar-menu';
import { ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface RoleGuardProps {
    children: React.ReactNode;
    allowedRoles: string[];
    permissionId?: string;
    fallbackLoginPath?: string;
}

interface GuardUser {
    role: string;
    permissions?: string[];
}

export default function RoleGuard({ children, allowedRoles, permissionId, fallbackLoginPath = '/login' }: RoleGuardProps) {
    const router = useRouter();
    const [mounted, setMounted] = useState(false);
    const [user, setUser] = useState<GuardUser | null>(null);

    useEffect(() => {
        const timer = setTimeout(() => {
            if (typeof window !== 'undefined') {
                const storedUser = localStorage.getItem('user');
                if (storedUser) {
                    try {
                        setUser(JSON.parse(storedUser));
                    } catch {
                        setUser(null);
                    }
                } else {
                    router.push(fallbackLoginPath);
                }
            }
            setMounted(true);
        }, 0);
        return () => clearTimeout(timer);
    }, [router, fallbackLoginPath]);

    // During SSR and initial client hydration, render children to ensure 100% matching DOM tree (prevents hydration mismatch)
    if (!mounted) {
        return <>{children}</>;
    }

    const isAuthorized = user ? hasAccess(user.role, allowedRoles, true, undefined, permissionId, user.permissions) : false;

    if (!isAuthorized) {
        return (
            <div className="h-screen w-full flex items-center justify-center bg-slate-900/5 dark:bg-background text-foreground p-6">
                <div className="max-w-md w-full bg-white dark:bg-card rounded-3xl shadow-xl border border-red-100 dark:border-red-900/40 p-10 text-center">
                    <div className="w-20 h-20 bg-red-50 dark:bg-red-950/60 rounded-full flex items-center justify-center mx-auto mb-6">
                        <ShieldAlert className="w-10 h-10 text-red-500" />
                    </div>
                    <h1 className="text-2xl font-bold text-foreground mb-2">Access Denied</h1>
                    <p className="text-muted-foreground text-xs mb-8">
                        You do not have permission to view this page. This incident may be logged for security purposes.
                    </p>
                    <div className="space-y-3">
                        <Button
                            className="w-full bg-primary text-primary-foreground font-bold"
                            onClick={() => router.push('/dashboard')}
                        >
                            Back to Dashboard
                        </Button>
                        <Button
                            variant="ghost"
                            className="text-muted-foreground text-xs"
                            onClick={() => router.back()}
                        >
                            Return to Previous Page
                        </Button>
                    </div>
                </div>
            </div>
        );
    }

    return <>{children}</>;
}
