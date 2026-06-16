"use client";

import React, { useState, useEffect } from 'react';
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
    RefreshCw,
    CheckCircle2,
    XCircle,
    Clock,
    Activity,
    AlertCircle,
    ChevronRight,
    Search
} from "lucide-react";
import { toast } from "sonner";

interface JobFailure {
    id: string;
    name: string;
    data: any;
    failedReason: string;
    processedOn: number;
    finishedOn: number;
}

interface QueueStat {
    name: string;
    active: number;
    waiting: number;
    completed: number;
    failed: number;
    delayed: number;
    recentFailures: JobFailure[];
}

export default function JobsMonitoringPage() {
    const [stats, setStats] = useState<QueueStat[]>([]);
    const [loading, setLoading] = useState(true);
    const [lastUpdated, setLastUpdated] = useState<string>('');

    const fetchStats = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/admin/jobs');
            if (res.ok) {
                const data = await res.json();
                setStats(data.queues);
                setLastUpdated(data.timestamp);
            } else {
                toast.error("Failed to fetch job stats");
            }
        } catch (error) {
            console.error(error);
            toast.error("An error occurred while fetching job stats");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchStats();
        const interval = setInterval(fetchStats, 10000); // Poll every 10 seconds
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="flex h-screen bg-slate-50 overflow-hidden text-slate-900">
            <Sidebar />
            <main className="flex-1 flex flex-col min-w-0 h-full overflow-y-auto">
                <Header />
                <div className="p-8 space-y-8 max-w-7xl mx-auto w-full">
                    <div className="flex justify-between items-center">
                        <div>
                            <h1 className="text-3xl font-bold tracking-tight">System Background Jobs</h1>
                            <p className="text-slate-500 mt-1">Monitor real-time status of background workers and queues.</p>
                        </div>
                        <div className="flex items-center gap-4">
                            <div className="text-right">
                                <p className="text-xs text-slate-400">Last updated</p>
                                <p className="text-sm font-medium">{lastUpdated ? new Date(lastUpdated).toLocaleTimeString() : 'Never'}</p>
                            </div>
                            <Button variant="outline" onClick={fetchStats} disabled={loading} className="gap-2">
                                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                                Refresh
                            </Button>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        {stats.map((q) => (
                            <Card key={q.name} className="overflow-hidden border-none shadow-sm bg-white">
                                <CardHeader className="pb-2 border-b border-slate-50">
                                    <div className="flex justify-between items-center">
                                        <CardTitle className="text-lg font-semibold">{q.name}</CardTitle>
                                        <div className={`h-2.5 w-2.5 rounded-full ${q.active > 0 ? 'bg-emerald-500 animate-pulse' : 'bg-slate-200'}`} />
                                    </div>
                                </CardHeader>
                                <CardContent className="pt-4 grid grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                        <p className="text-xs text-slate-400 uppercase font-bold tracking-wider">Active</p>
                                        <div className="flex items-center gap-2">
                                            <Activity className="h-4 w-4 text-blue-500" />
                                            <span className="text-2xl font-bold">{q.active}</span>
                                        </div>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-xs text-slate-400 uppercase font-bold tracking-wider">Waiting</p>
                                        <div className="flex items-center gap-2">
                                            <Clock className="h-4 w-4 text-amber-500" />
                                            <span className="text-2xl font-bold">{q.waiting}</span>
                                        </div>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-xs text-slate-400 uppercase font-bold tracking-wider">Done</p>
                                        <div className="flex items-center gap-2">
                                            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                                            <span className="text-2xl font-bold">{q.completed}</span>
                                        </div>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-xs text-slate-400 uppercase font-bold tracking-wider">Failed</p>
                                        <div className="flex items-center gap-2">
                                            <XCircle className="h-4 w-4 text-rose-500" />
                                            <span className="text-2xl font-bold">{q.failed}</span>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>

                    <div className="space-y-6">
                        <div className="flex items-center gap-2">
                            <AlertCircle className="h-5 w-5 text-rose-500" />
                            <h2 className="text-xl font-bold">Recent Failures & Errors</h2>
                        </div>

                        <div className="space-y-4">
                            {stats.every(q => q.recentFailures.length === 0) ? (
                                <Card className="border-dashed border-2 border-slate-200 bg-slate-50/50">
                                    <CardContent className="py-12 flex flex-col items-center justify-center text-slate-400">
                                        <CheckCircle2 className="h-12 w-12 mb-4 text-emerald-100" />
                                        <p className="text-lg font-medium">No recent job failures found!</p>
                                        <p className="text-sm">System is running healthily.</p>
                                    </CardContent>
                                </Card>
                            ) : (
                                stats.map(q => q.recentFailures.length > 0 && (
                                    <div key={q.name} className="space-y-3">
                                        <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest pl-1">{q.name} Failures</h3>
                                        {q.recentFailures.map((job) => (
                                            <Card key={job.id} className="border-l-4 border-l-rose-500 shadow-sm overflow-hidden">
                                                <CardContent className="p-4">
                                                    <div className="flex justify-between items-start gap-4">
                                                        <div className="space-y-2 flex-1">
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-sm font-mono bg-slate-100 px-2 py-0.5 rounded text-slate-600">{job.id}</span>
                                                                <span className="font-bold">{job.name}</span>
                                                            </div>
                                                            <p className="text-sm text-rose-600 font-medium bg-rose-50 p-3 rounded border border-rose-100 flex gap-2 items-start">
                                                                <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                                                                {job.failedReason}
                                                            </p>
                                                            <div className="flex gap-4 text-xs text-slate-400">
                                                                <span>Data: {JSON.stringify(job.data)}</span>
                                                                <span>Finished: {new Date(job.finishedOn).toLocaleString()}</span>
                                                            </div>
                                                        </div>
                                                        <Button variant="ghost" size="sm" className="text-slate-400 hover:text-slate-900">
                                                            Details <ChevronRight className="h-4 w-4 ml-1" />
                                                        </Button>
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        ))}
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
