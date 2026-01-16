"use client";

import React, { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Activity, Clock, RefreshCw, AlertCircle } from 'lucide-react';

interface SyncData {
    lastSync: string | null;
    nextSync: string | null;
    stats: {
        created: number;
        updated: number;
        failed: number;
        patUpdated: number;
    } | null;
    isStale: boolean;
}

export default function SyncStatus({ isCollapsed }: { isCollapsed: boolean }) {
    const { data, isLoading, isError, refetch } = useQuery<SyncData>({
        queryKey: ['sync-status'],
        queryFn: async () => {
            const res = await fetch('/api/admin/sync-status');
            if (!res.ok) throw new Error('Failed to fetch sync status');
            return res.json();
        },
        refetchInterval: 60000, // Refresh every minute
    });

    const [timeLeft, setTimeLeft] = useState<string>('');

    useEffect(() => {
        if (!data?.nextSync) return;

        const updateTimer = () => {
            const now = new Date().getTime();
            const next = new Date(data.nextSync!).getTime();
            const diff = next - now;

            if (diff <= 0) {
                setTimeLeft('Synced');
                return;
            }

            const mins = Math.floor(diff / 60000);
            const secs = Math.floor((diff % 60000) / 1000);
            setTimeLeft(`${mins}m ${secs}s`);
        };

        const timer = setInterval(updateTimer, 1000);
        updateTimer();

        return () => clearInterval(timer);
    }, [data?.nextSync]);

    const [isSyncing, setIsSyncing] = useState(false);

    const handleManualSync = async () => {
        if (isSyncing) return;
        setIsSyncing(true);
        try {
            await fetch('/api/admin/sync-trigger', { method: 'POST' });
            refetch();
        } catch (e) {
            console.error(e);
        } finally {
            setIsSyncing(false);
        }
    };

    if (isCollapsed) {
        return (
            <div className="flex justify-center p-3 border-t border-white/5">
                <div className={`w-2 h-2 rounded-full ${isSyncing ? 'bg-sky-500 animate-pulse' : data?.isStale ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'}`} />
            </div>
        );
    }

    if (isLoading) return null; // Keep it clean while loading
    if (isError) return <div className="mx-4 my-2 p-2 bg-rose-500/10 rounded-lg text-[10px] text-rose-500">Sync Error</div>;

    const lastSyncTime = data?.lastSync ? new Date(data.lastSync).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Never';

    return (
        <div className="mx-2 my-2 px-3 py-2 bg-slate-900/40 rounded-xl border border-white/5 shadow-inner group">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 overflow-hidden">
                    <Activity className={`w-3.5 h-3.5 flex-shrink-0 ${isSyncing ? 'text-sky-500 animate-pulse' : data?.isStale ? 'text-amber-500' : 'text-emerald-500'}`} />
                    <div className="flex flex-col min-w-0">
                        <span className="text-[10px] font-bold text-slate-300 uppercase tracking-tighter truncate">Sync status</span>
                        <span className="text-[8px] text-slate-500 font-medium truncate">Last: {lastSyncTime}</span>
                    </div>
                </div>

                <div className="flex items-center gap-1.5">
                    <span className="text-[9px] font-mono text-sky-400/80 bg-sky-500/5 px-1 rounded-sm border border-sky-500/10">
                        {data?.isStale ? 'STALE' : timeLeft}
                    </span>
                    <button
                        onClick={handleManualSync}
                        disabled={isSyncing}
                        className="p-1.5 hover:bg-white/10 rounded-lg bg-white/5 transition-all active:scale-95 disabled:opacity-50"
                        title="Sync Now"
                    >
                        <RefreshCw className={`w-3 h-3 text-slate-400 group-hover:text-slate-200 ${isSyncing ? 'animate-spin text-sky-500' : ''}`} />
                    </button>
                </div>
            </div>

            {data?.stats && (data.stats.created > 0 || data.stats.updated > 0) && (
                <div className="mt-1.5 pt-1.5 border-t border-white/5 flex gap-3">
                    <div className="flex items-baseline gap-1">
                        <span className="text-[8px] text-slate-500 font-bold uppercase">New:</span>
                        <span className="text-[10px] font-bold text-emerald-500">+{data.stats.created}</span>
                    </div>
                    <div className="flex items-baseline gap-1">
                        <span className="text-[8px] text-slate-500 font-bold uppercase">Upd:</span>
                        <span className="text-[10px] font-bold text-sky-500">{data.stats.updated}</span>
                    </div>
                </div>
            )}
        </div>
    );
}
