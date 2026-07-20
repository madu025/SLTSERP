'use client';

/**
 * DashboardError – full-width error state shown when the dashboard stats
 * query fails. Renders a centred glass-panel with an AlertCircle icon,
 * the error message (if any), and a “Try Again” button that triggers
 * {@link onRetry} (typically a React Query `refetch`).
 */

import { AlertCircle, RefreshCw } from 'lucide-react';

export interface DashboardErrorProps {
    error: Error | null;
    onRetry: () => void;
}

export function DashboardError({ error, onRetry }: DashboardErrorProps) {
    const message = error?.message?.trim() || 'Something went wrong while fetching your performance data.';

    return (
        <div
            role="alert"
            aria-live="assertive"
            className="glass-panel rounded-2xl border border-border/40 p-10 flex flex-col items-center justify-center text-center space-y-4"
        >
            <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center">
                <AlertCircle className="w-7 h-7 text-rose-500" />
            </div>
            <div className="space-y-1">
                <h3 className="font-bold text-foreground">Failed to load dashboard</h3>
                <p className="text-sm text-muted-foreground max-w-md">{message}</p>
            </div>
            <button
                onClick={onRetry}
                className="inline-flex items-center gap-2 h-9 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-bold hover:opacity-90 transition-opacity"
            >
                <RefreshCw className="w-4 h-4" />
                Try Again
            </button>
        </div>
    );
}

export default DashboardError;
