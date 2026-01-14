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
            <div className="flex justify-center p-3 border-t border-white/5 opacity-50">
                <div className={`w-2 h-2 rounded-full ${isSyncing ? 'bg-sky-500 animate-spin' : data?.isStale ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'}`} />
            </div>
        );
    }

    if (isLoading) return <div className="p-4 text-xs text-slate-500 animate-pulse">Checking sync...</div>;
    if (isError) return <div className="p-4 text-xs text-rose-500 flex items-center gap-2"><AlertCircle className="w-3 h-3" /> Sync Error</div>;

    const lastSyncTime = data?.lastSync ? new Date(data.lastSync).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Never';

    return (
        <div className="px-4 py-3 border-t border-white/5 bg-black/20">
            <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                    <Activity className={`w-3 h-3 ${isSyncing ? 'text-sky-500 animate-spin' : data?.isStale ? 'text-amber-500' : 'text-emerald-500'}`} />
                    Background Sync
                </span>
                <div className="flex items-center gap-1">
                    <button
                        onClick={handleManualSync}
                        disabled={isSyncing}
                        className={`text-[9px] px-1.5 py-0.5 rounded border border-slate-700 hover:bg-white/5 text-slate-400 transition-colors ${isSyncing ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                        {isSyncing ? 'Running...' : 'Sync Now'}
                    </button>
                    <button
                        onClick={() => refetch()}
                        className="p-1 hover:bg-white/5 rounded transition-colors"
                    >
                        <RefreshCw className={`w-2.5 h-2.5 text-slate-500 ${isSyncing ? 'animate-spin' : ''}`} />
                    </button>
                </div>
            </div>

            <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                    <span className="text-[11px] text-slate-400">Last Sync:</span>
                    <span className="text-[11px] font-medium text-slate-300">{lastSyncTime}</span>
                </div>
                <div className="flex items-center justify-between">
                    <span className="text-[11px] text-slate-400">Next Sync:</span>
                    <span className={`text-[11px] font-medium ${data?.isStale ? 'text-amber-400 animate-pulse' : 'text-sky-400'}`}>
                        {data?.isStale ? 'Searching...' : timeLeft}
                    </span>
                </div>

                {data?.stats && (data.stats.created > 0 || data.stats.updated > 0) && (
                    <div className="mt-2 pt-2 border-t border-white/5 flex gap-3">
                        <div className="flex flex-col">
                            <span className="text-[9px] text-slate-500 uppercase">New</span>
                            <span className="text-xs font-bold text-emerald-500">+{data.stats.created}</span>
                        </div>
                        <div className="flex flex-col">
                            <span className="text-[9px] text-slate-500 uppercase">Upd</span>
                            <span className="text-xs font-bold text-sky-500">{data.stats.updated}</span>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
