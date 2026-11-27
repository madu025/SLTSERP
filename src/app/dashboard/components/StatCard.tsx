'use client';

import type { ReactNode } from 'react';
import { formatSmartNumber } from '@/lib/utils';
import { DashFigure } from './dash-ui';

export interface StatCardProps {
    label: string;
    value: number;
    icon: ReactNode;
    /** kept for callers; the route-board style does not colour figures by category */
    color: string;
    sub?: string;
    subTone?: 'positive' | 'neutral' | 'warning';
    href?: string;
}

/** A dashboard figure in the shared route-board style (src/app/dashboard/dashboard.css). */
export function StatCard({ label, value, icon, sub, subTone = 'positive', href }: StatCardProps) {
    return (
        <DashFigure
            label={label}
            value={formatSmartNumber(value, 0)}
            hint={sub}
            href={href}
            icon={icon}
            tone={subTone === 'warning' ? 'wait' : 'neutral'}
        />
    );
}

export default StatCard;
