"use client";

import React, { useEffect, useState } from "react";
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ClipboardCheck, CheckCircle, XCircle, AlertTriangle, Activity } from "lucide-react";

import { Suspense } from "react";

interface Inspection { date: string; project: string; inspector: string; result: string; notes: string; }
interface QualityTrend { month: string; passRate: number; inspections: number; }
interface QaqcData { totalInspections: number; passedInspections: number; failedInspections: number; passRate: number; openNCRs: number; pendingReviews: number; recentInspections: Inspection[]; qualityTrend: QualityTrend[]; }

function QAQCDashboard() {
    const [data, setData] = useState<QaqcData | null>(null);
    const [loading, setLoading] = useState(true);
    useEffect(() => {
        (async () => {
            try { const r = await fetch("/api/dashboard/project-stats"); if (r.ok) { const j = await r.json(); setData(j.qaqc); } }
            catch (e) { console.error(e); }
            finally { setLoading(false); }
        })();
    }, []);

    const avgPassRate = data?.qualityTrend?.length ? +(data.qualityTrend.reduce((s, t) => s + t.passRate, 0) / data.qualityTrend.length).toFixed(1) : 0;

    return (
        <div className="min-h-screen flex bg-background text-foreground">
            <Sidebar />
            <main className="flex-1 flex flex-col min-w-0 h-full">
                <Header />
                <div className="flex-1 overflow-y-auto p-3 md:p-4 lg:p-5 space-y-4">
                    <div className="max-w-7xl mx-auto w-full">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
                            <div><h1 className="text-lg font-bold">QA/QC Dashboard</h1><p className="text-xs text-muted-foreground mt-0.5">Quality inspections & compliance</p></div>
                            <Button variant="outline" size="sm" className="gap-1.5 h-7 text-xs"><Activity className="w-3.5 h-3.5" />Updated: Today</Button>
                        </div>
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 md:gap-3 mb-4">
                            <Card><CardContent className="flex items-center gap-3 py-3"><div className="w-9 h-9 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0"><ClipboardCheck className="w-4 h-4 text-blue-600" /></div><div><p className="text-[10px] font-semibold text-muted-foreground uppercase">Total Inspections</p><p className="text-lg font-bold mt-0.5">{data ? data.totalInspections : "-"}</p><p className="text-[10px] text-muted-foreground">This year</p></div></CardContent></Card>
                            <Card><CardContent className="flex items-center gap-3 py-3"><div className="w-9 h-9 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0"><CheckCircle className="w-4 h-4 text-emerald-600" /></div><div><p className="text-[10px] font-semibold text-muted-foreground uppercase">Pass Rate</p><p className="text-lg font-bold mt-0.5">{data ? `${data.passRate}%` : "-"}</p><p className="text-[10px] text-emerald-600 font-medium">{data && data.passRate >= 90 ? "Above target" : "Needs attention"}</p></div></CardContent></Card>
                            <Card><CardContent className="flex items-center gap-3 py-3"><div className="w-9 h-9 rounded-lg bg-rose-500/10 flex items-center justify-center shrink-0"><XCircle className="w-4 h-4 text-rose-600" /></div><div><p className="text-[10px] font-semibold text-muted-foreground uppercase">Open NCRs</p><p className="text-lg font-bold text-rose-600 mt-0.5">{data ? data.openNCRs : "-"}</p><p className="text-[10px] text-rose-600 font-medium">Action required</p></div></CardContent></Card>
                            <Card><CardContent className="flex items-center gap-3 py-3"><div className="w-9 h-9 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0"><AlertTriangle className="w-4 h-4 text-amber-600" /></div><div><p className="text-[10px] font-semibold text-muted-foreground uppercase">Pending Reviews</p><p className="text-lg font-bold mt-0.5">{data ? data.pendingReviews : "-"}</p><p className="text-[10px] text-amber-600 font-medium">Awaiting sign-off</p></div></CardContent></Card>
                        </div>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            <Card>
                                <CardHeader className="pb-2"><CardTitle className="text-xs font-bold flex items-center gap-1.5"><span className="w-1.5 h-3 bg-blue-500 rounded-full" />Recent Inspections</CardTitle></CardHeader>
                                <CardContent className="p-0">
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-xs">
                                            <thead><tr className="border-b border-border/40 text-left text-[10px] font-semibold text-muted-foreground uppercase"><th className="px-3 py-2">Date</th><th className="px-3 py-2">Project</th><th className="px-3 py-2">Inspector</th><th className="px-3 py-2">Result</th><th className="px-3 py-2">Notes</th></tr></thead>
                                            <tbody className="divide-y divide-border/20">
                                                {loading ? <tr><td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">Loading...</td></tr> :
                                                    data?.recentInspections?.length ? data.recentInspections.map((ins, i) => (
                                                        <tr key={i} className="hover:bg-muted/30 transition-colors"><td className="px-3 py-2 text-muted-foreground">{ins.date}</td><td className="px-3 py-2 font-medium">{ins.project}</td><td className="px-3 py-2 text-muted-foreground">{ins.inspector}</td><td className="px-3 py-2"><Badge variant={ins.result === "PASS" ? "default" : "destructive"} className={`text-[10px] ${ins.result === "PASS" ? "bg-emerald-500/10 text-emerald-600 border-emerald-200" : ""}`}>{ins.result === "PASS" ? "Pass" : "Fail"}</Badge></td><td className="px-3 py-2 text-muted-foreground max-w-[100px] truncate">{ins.notes}</td></tr>
                                                    )) : <tr><td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">No inspections</td></tr>}
                                            </tbody>
                                        </table>
                                    </div>
                                </CardContent>
                            </Card>
                            <Card>
                                <CardHeader className="pb-2"><CardTitle className="text-xs font-bold flex items-center gap-1.5"><span className="w-1.5 h-3 bg-emerald-500 rounded-full" />Quality Trend</CardTitle></CardHeader>
                                <CardContent>
                                    <div className="space-y-3">
                                        {loading ? <p className="text-xs">Loading...</p> :
                                            data?.qualityTrend?.length ? data.qualityTrend.map((item, i) => (
                                                <div key={i}>
                                                    <div className="flex items-center justify-between text-xs mb-0.5"><span className="font-medium">{item.month}</span><span className="text-muted-foreground">{item.inspections}</span></div>
                                                    <div className="flex items-center gap-2"><div className="flex-1 h-2 bg-muted rounded-full overflow-hidden"><div className={`h-full rounded-full ${item.passRate >= 90 ? "bg-emerald-500" : "bg-amber-500"}`} style={{ width: item.passRate + '%' }} /></div><span className={`text-[10px] font-bold ${item.passRate >= 90 ? "text-emerald-600" : "text-amber-600"}`}>{item.passRate}%</span></div>
                                                </div>
                                            )) : <p className="text-xs text-muted-foreground">No trend data</p>}
                                    </div>
                                    {data?.qualityTrend && data.qualityTrend.length > 0 && (
                                        <div className="mt-4 p-2 rounded bg-muted/50 border border-border/40 text-xs">
                                            <span className="font-semibold">Quality Summary: </span>
                                            Avg pass rate: <span className="font-bold text-emerald-600">{avgPassRate}%</span>.
                                            {data.qualityTrend[data.qualityTrend.length - 1]!.passRate < 90 ? " Recent decline needs attention." : " Standards maintained."}
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}

export default function QAQCDashboardPage() {
    return (
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-background text-foreground text-xs font-medium">Loading Dashboard...</div>}>
            <QAQCDashboard />
        </Suspense>
    );
}