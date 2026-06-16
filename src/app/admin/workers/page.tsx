"use client";

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { LayoutDashboard, RefreshCw, AlertCircle, Clock, PlayCircle, CheckCircle2 } from 'lucide-react';

interface QueueStat {
    name: string;
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
    repeatableCount: number;
    repeatable: Array<{
        key: string;
        name: string;
        next: string;
    }>;
}

export default function WorkerDashboard() {
    const [stats, setStats] = useState<QueueStat[]>([]);
    const [loading, setLoading] = useState(true);
    const [lastUpdated, setLastUpdated] = useState<string>('');

    const fetchStats = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/admin/workers');
            const data = await res.json();
            if (data.success) {
                setStats(data.queues);
                setLastUpdated(new Date().toLocaleTimeString());
            }
        } catch (error) {
            console.error('Failed to fetch stats', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchStats();
        const interval = setInterval(fetchStats, 10000); // 10s refresh
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="p-6 space-y-6 bg-slate-50/30 min-h-screen">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg">
                        <LayoutDashboard className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">System Workers</h1>
                        <p className="text-sm text-slate-500">Live monitoring of background tasks and queues</p>
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    <div className="text-right hidden sm:block">
                        <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Last Sync</p>
                        <p className="text-sm font-medium">{lastUpdated || 'Waiting...'}</p>
                    </div>
                    <button 
                        onClick={fetchStats}
                        disabled={loading}
                        className="p-2 hover:bg-white rounded-full transition-all border border-slate-200 disabled:opacity-50 shadow-sm"
                    >
                        <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin text-primary' : 'text-slate-600'}`} />
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {stats.map((queue) => (
                    <Card key={queue.name} className="overflow-hidden border-slate-200/60 shadow-md hover:shadow-lg transition-all">
                        <CardHeader className="bg-slate-50/50 border-b border-slate-100 py-4">
                            <div className="flex items-center justify-between">
                                <CardTitle className="text-lg font-bold text-slate-800">{queue.name}</CardTitle>
                                <Badge variant={queue.active > 0 ? "default" : "secondary"}>
                                    {queue.active > 0 ? "Active" : "Idle"}
                                </Badge>
                            </div>
                        </CardHeader>
                        <CardContent className="pt-6">
                            <div className="grid grid-cols-2 gap-4">
                                <StatItem icon={<PlayCircle className="w-4 h-4 text-blue-500"/>} label="Active" value={queue.active} color="text-blue-600" />
                                <StatItem icon={<Clock className="w-4 h-4 text-amber-500"/>} label="Waiting" value={queue.waiting} color="text-amber-600" />
                                <StatItem icon={<CheckCircle2 className="w-4 h-4 text-emerald-500"/>} label="Completed" value={queue.completed} color="text-emerald-600" />
                                <StatItem icon={<AlertCircle className="w-4 h-4 text-rose-500"/>} label="Failed" value={queue.failed} color="text-rose-600" />
                            </div>

                            {queue.repeatable.length > 0 && (
                                <div className="mt-6 pt-6 border-t border-slate-100">
                                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Scheduled Tasks</h4>
                                    <div className="space-y-3">
                                        {queue.repeatable.map((rj) => (
                                            <div key={rj.key} className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                                                <div className="text-sm font-semibold text-slate-700 truncate">{rj.name}</div>
                                                <div className="text-[10px] text-slate-400 mt-1 flex items-center gap-1">
                                                    <Clock className="w-3 h-3" />
                                                    Next: {rj.next}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                ))}
            </div>

            {stats.length === 0 && !loading && (
                <div className="text-center py-20 bg-white rounded-2xl border-2 border-dashed border-slate-200">
                    <AlertCircle className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                    <h3 className="text-xl font-bold text-slate-700">No Workers Found</h3>
                    <p className="text-slate-500">The background worker system may not be initialized.</p>
                </div>
            )}
        </div>
    );
}

function StatItem({ icon, label, value, color }: { icon: React.ReactNode, label: string, value: number, color: string }) {
    return (
        <div className="flex items-center gap-3">
            <div className="p-2 bg-slate-50 rounded-lg border border-slate-100">
                {icon}
            </div>
            <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">{label}</p>
                <p className={`text-xl font-black ${color}`}>{value}</p>
            </div>
        </div>
    );
}
