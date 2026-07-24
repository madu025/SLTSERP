"use client";

import React from 'react';
import RoleGuard from '@/components/RoleGuard';

interface HelpdeskLayoutProps {
    children: React.ReactNode;
}

export default function HelpdeskLayout({ children }: HelpdeskLayoutProps) {
    return (
        <RoleGuard 
            allowedRoles={[
                'SUPER_ADMIN', 
                'ADMIN', 
                'MANAGER', 
                'OSP_MANAGER', 
                'AREA_MANAGER', 
                'ENGINEER', 
                'ASSISTANT_ENGINEER', 
                'AREA_COORDINATOR', 
                'QC_OFFICER', 
                'OFFICE_ADMIN', 
                'OFFICE_ADMIN_ASSISTANT', 
                'SITE_OFFICE_STAFF', 
                'FINANCE_MANAGER', 
                'FINANCE_ASSISTANT', 
                'STORES_MANAGER', 
                'STORES_ASSISTANT', 
                'SA_MANAGER', 
                'SA_ASSISTANT', 
                'PROCUREMENT_OFFICER'
            ]}
        >
            {children}
        </RoleGuard>
    );
}
