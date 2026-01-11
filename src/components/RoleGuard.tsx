"use client";

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { hasAccess } from '@/config/sidebar-menu';
import { Loader2, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface RoleGuardProps {
    children: React.ReactNode;
    allowedRoles: string[];
}

export default function RoleGuard({ children, allowedRoles }: RoleGuardProps) {
    const router = useRouter();
    const [user, setUser] = useState<any>(null);
    const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);

    useEffect(() => {
        const storedUser = localStorage.getItem('user');
        if (storedUser) {
            const parsedUser = JSON.parse(storedUser);
            setUser(parsedUser);

            if (hasAccess(parsedUser.role, allowedRoles)) {
                setIsAuthorized(true);
            } else {
                setIsAuthorized(false);
            }
        } else {
            // No user found, redirect to login
            router.push('/login');
        }
    }, [allowedRoles, router]);

    if (isAuthorized === null) {
        return (
            <div className="h-screen w-full flex items-center justify-center bg-slate-50">
                <div className="text-center">
                    <Loader2 className="w-10 h-10 animate-spin text-blue-600 mx-auto mb-4" />
                    <p className="text-slate-500 font-medium">Verifying access rights...</p>
                </div>
            </div>
        );
    }

    if (isAuthorized === false) {
        return (
            <div className="h-screen w-full flex items-center justify-center bg-slate-50 p-6">
                <div className="max-w-md w-full bg-white rounded-3xl shadow-xl border border-red-100 p-10 text-center">
                    <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6">
                        <ShieldAlert className="w-10 h-10 text-red-500" />
                    </div>
                    <h1 className="text-2xl font-bold text-slate-900 mb-2">Access Denied</h1>
                    <p className="text-slate-500 mb-8">
                        You do not have permission to view this page. This incident may be logged for security purposes.
                    </p>
                    <div className="space-y-3">
                        <Button
                            className="w-full bg-slate-900"
                            onClick={() => router.push('/dashboard')}
                        >
                            Back to Dashboard
                        </Button>
                        <Button
                            variant="ghost"
                            className="text-slate-400 text-xs"
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
