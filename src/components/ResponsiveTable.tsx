"use client";

import React from 'react';

interface ResponsiveTableProps {
    children: React.ReactNode;
    className?: string;
}

/**
 * Responsive Table Wrapper
 * Handles table overflow on mobile devices with horizontal scroll
 */
export default function ResponsiveTable({ children, className = '' }: ResponsiveTableProps) {
    return (
        <div className={`w-full overflow-x-auto -mx-4 sm:mx-0 ${className}`}>
            <div className="inline-block min-w-full align-middle">
                <div className="overflow-hidden shadow-sm ring-1 ring-black ring-opacity-5 sm:rounded-lg">
                    {children}
                </div>
            </div>
        </div>
    );
}

/**
 * Mobile Card View for Tables
 * Alternative mobile-friendly view for table data
 */
interface MobileCardProps {
    data: Array<Record<string, any>>;
    renderCard: (item: any, index: number) => React.ReactNode;
    className?: string;
}

export function MobileCardView({ data, renderCard, className = '' }: MobileCardProps) {
    return (
        <div className={`space-y-3 ${className}`}>
            {data.map((item, index) => (
                <div key={index}>
                    {renderCard(item, index)}
                </div>
            ))}
        </div>
    );
}
