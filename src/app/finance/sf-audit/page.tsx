"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function AdminSFAuditRedirect() {
    const router = useRouter();
    useEffect(() => {
        router.replace('/sf-audit/governance');
    }, [router]);

    return (
        <div className="flex items-center justify-center h-screen bg-slate-900 text-white font-mono text-xs">
            Redirecting to Standalone SF Audit Division Governance Cockpit...
        </div>
    );
}
