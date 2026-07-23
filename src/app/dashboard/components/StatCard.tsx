'use client';

import type { ReactNode } from 'react';
import { TrendingUp, ArrowUpRight } from 'lucide-react';

const TONE_STYLES: Record<string, { bg: string; text: string; border: string; glow: string }> = {
    blue: {
        bg: 'bg-blue-500/10 dark:bg-blue-500/15',
        text: 'text-blue-500',
        border: 'border-blue-500/20',
        glow: 'from-blue-500/5 to-transparent'
    },
    indigo: {
        bg: 'bg-indigo-500/10 dark:bg-indigo-500/15',
        text: 'text-indigo-500',
        border: 'border-indigo-500/20',
        glow: 'from-indigo-500/5 to-transparent'
    },
    emerald: {
        bg: 'bg-emerald-500/10 dark:bg-emerald-500/15',
        text: 'text-emerald-500',
        border: 'border-emerald-500/20',
        glow: 'from-emerald-500/5 to-transparent'
    },
    rose: {
        bg: 'bg-rose-500/10 dark:bg-rose-500/15',
        text: 'text-rose-500',
        border: 'border-rose-500/20',
        glow: 'from-rose-500/5 to-transparent'
    },
};

export interface StatCardProps {
    label: string;
    value: number;
    icon: ReactNode;
    color: string;
    sub?: string;
}

export function StatCard({ label, value, icon, color, sub }: StatCardProps) {
    const t = TONE_STYLES[color] ?? TONE_STYLES.blue;
    return (
        <div className={`glass-panel p-5 rounded-3xl border ${t.border} bg-gradient-to-br ${t.glow} shadow-sm hover:shadow-xl hover:-translate-y-1.5 transition-all duration-300 relative overflow-hidden group`}>
            <div className="flex items-start justify-between gap-3">
                <div className={`w-12 h-12 rounded-2xl border ${t.border} flex items-center justify-center shrink-0 ${t.bg} ${t.text} shadow-sm group-hover:scale-110 transition-transform duration-300`}>
                    {icon}
                </div>
                <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                    <ArrowUpRight className={`w-4 h-4 ${t.text}`} />
                </div>
            </div>
            
            <div className="mt-4">
                <p className="text-[10px] md:text-xs font-black text-muted-foreground uppercase tracking-widest">{label}</p>
                <p className="text-2xl md:text-3xl font-black tracking-tight text-foreground mt-1 font-mono">{value.toLocaleString()}</p>
                {sub && (
                    <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-[10px] font-extrabold mt-2">
                        <TrendingUp className="w-3 h-3" />
                        {sub}
                    </div>
                )}
            </div>
        </div>
    );
}

export default StatCard;
