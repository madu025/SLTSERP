'use client';

/**
 * StatCard – single KPI tile used in the Monthly KPI grid.
 *
 * Extracted verbatim from `src/app/dashboard/page.tsx` (originally the
 * `StatCard` function + `TONE_STYLES` map) so the exact glass-panel
 * styling, hover lift, and tone-based colouring are preserved.
 */

import type { ReactNode } from 'react';
import { TrendingUp } from 'lucide-react';

const TONE_STYLES: Record<string, { bg: string; text: string }> = {
    blue: { bg: 'bg-blue-500/10 border-blue-500/20', text: 'text-blue-500' },
    indigo: { bg: 'bg-indigo-500/10 border-indigo-500/20', text: 'text-indigo-500' },
    emerald: { bg: 'bg-emerald-500/10 border-emerald-500/20', text: 'text-emerald-500' },
    rose: { bg: 'bg-rose-500/10 border-rose-500/20', text: 'text-rose-500' },
};

export interface StatCardProps {
    label: string;
    value: number;
    icon: ReactNode;
    /** Tone key — must match a key in {@link TONE_STYLES}. */
    color: string;
    sub?: string;
}

export function StatCard({ label, value, icon, color, sub }: StatCardProps) {
    const t = TONE_STYLES[color] ?? TONE_STYLES.blue;
    return (
        <div className="glass-panel p-4 md:p-5 rounded-2xl border border-border/40 shadow-sm flex items-center gap-4 hover:-translate-y-1 hover:border-primary/20 hover:shadow-lg transition-all duration-300">
            <div className={`w-11 h-11 rounded-xl border flex items-center justify-center shrink-0 ${t.bg} ${t.text}`}>
                {icon}
            </div>
            <div className="min-w-0 flex-1">
                <p className="text-[10px] md:text-xs font-bold text-muted-foreground uppercase tracking-widest truncate">{label}</p>
                <p className="text-xl md:text-2xl font-black text-foreground mt-0.5">{value.toLocaleString()}</p>
                {sub && (
                    <p className="text-[10px] font-semibold text-emerald-500 flex items-center gap-1 mt-0.5">
                        <TrendingUp className="w-3 h-3" />
                        {sub}
                    </p>
                )}
            </div>
        </div>
    );
}

export default StatCard;
