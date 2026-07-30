"use client";
import { ROLE_GROUPS } from '@/config/roles';

import React from 'react';
import RoleGuard from '@/components/RoleGuard';

interface HelpdeskLayoutProps {
    children: React.ReactNode;
}

export default function HelpdeskLayout({ children }: HelpdeskLayoutProps) {
    return (
        <RoleGuard 
            allowedRoles={ROLE_GROUPS.OFFICE_ADMINS}
        >
            {children}
        </RoleGuard>
    );
}
