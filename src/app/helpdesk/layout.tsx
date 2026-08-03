"use client";
import React from 'react';

interface HelpdeskLayoutProps {
    children: React.ReactNode;
}

export default function HelpdeskLayout({ children }: HelpdeskLayoutProps) {
    return (
        <>
            {children}
        </>
    );
}
