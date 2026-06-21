"use client";

import React, { useEffect, useState } from "react";
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Package, AlertTriangle, ClipboardList, PackageMinus, Warehouse } from "lucide-react";

interface StockMovement { date: string; item: string; type: string; qty: number; ref: string; status: string; }
interface LowStockAlert { item: string; current: number; min: number; unit: string; }
interface LogisticsData { totalItems: number; lowStockCount: number; pendingGRNs: number; activeStockIssues: number; stockMovements: StockMovement[]; lowStockAlerts: LowStockAlert[]; }

export default function LogisticsDashboardPage() {
    const [data, setData] = useState<LogisticsData | null>(null);
    const [loading, setLoading] = useState(true);
    useEffect(() => {
        (async () => {
            try { const r = await fetch("/api/dashboard/project-stats"); if (r.ok) { const j = await r.json(); setData(j.logistics); } }
            catch (e) { console.error(e); }
            finally { setLoading(false); }
        })();
    }, []);

    return (
        <div className="min-h-screen flex bg-background text-foreground">
            <Sidebar />
            <main className="flex-1 flex flex-col min-w-0 h-full">
                <Header />
                <div className="flex-1 overflow-y-auto p-3 md:p-4 lg:p-5 space-y-4">
                    <div className="max-w-7xl mx-auto w-full">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
                            <div><h1 className="text-lg font-bold">Logistics Dashboard</h1><p className="text-xs text-muted-foreground mt-0.5">Inventory, stock movements & procurement</p></div>
                            <Button variant="outline" size="sm" className="gap-1.5 h-7 text-xs"><Warehouse className="w-3.5 h-3.5" />Updated: Today</Button>
                        </div>
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 md:gap-3 mb-4">
                            <Card><CardContent className="flex items-center gap-3 py-3"><div className="w-9 h-9 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0"><Package className="w-4 h-4 text-blue-600" /></div><div><p className="text-[10px] font-semibold text-muted-foreground uppercase">Total Items</p><p className="text-lg font-bold mt-0.5">{data ? data.totalItems.toLocaleString() : "-"}</p><p className="text-[10px] text-muted-foreground">All stores</p></div></CardContent></Card>
                            <Card><CardContent className="flex items-center gap-3 py-3"><div className="w-9 h-9 rounded-lg bg-rose-500/10 flex items-center justify-center shrink-0"><AlertTriangle className="w-4 h-4 text-rose-600" /></div><div><p className="text-[10px] font-semibold text-muted-foreground uppercase">Low Stock</p><p className="text-lg font-bold text-rose-600 mt-0.5">{data ? data.lowStockCount : "-"}</p><p className="text-[10px] text-rose-600 font-medium">Reorder needed</p></div></CardContent></Card>
                            <Card><CardContent className="flex items-center gap-3 py-3"><div className="w-9 h-9 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0"><ClipboardList className="w-4 h-4 text-amber-600" /></div><div><p className="text-[10px] font-semibold text-muted-foreground uppercase">Pending GRNs</p><p className="text-lg font-bold mt-0.5">{data ? data.pendingGRNs : "-"}</p><p className="text-[10px] text-amber-600 font-medium">Awaiting</p></div></CardContent></Card>
                            <Card><CardContent className="flex items-center gap-3 py-3"><div className="w-9 h-9 rounded-lg bg-indigo-500/10 flex items-center justify-center shrink-0"><PackageMinus className="w-4 h-4 text-indigo-600" /></div><div><p className="text-[10px] font-semibold text-muted-foreground uppercase">Active Issues</p><p className="text-lg font-bold mt-0.5">{data ? data.activeStockIssues : "-"}</p><p className="text-[10px] text-muted-foreground">In progress</p></div></CardContent></Card>
                        </div>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            <Card>
                                <CardHeader className="pb-2"><CardTitle className="text-xs font-bold flex items-center gap-1.5"><span className="w-1.5 h-3 bg-blue-500 rounded-full" />Stock Movements</CardTitle></CardHeader>
                                <CardContent className="p-0">
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-xs">
                                            <thead><tr className="border-b border-border/40 text-left text-[10px] font-semibold text-muted-foreground uppercase"><th className="px-3 py-2">Date</th><th className="px-3 py-2">Item</th><th className="px-3 py-2">Type</th><th className="px-3 py-2 text-right">Qty</th><th className="px-3 py-2">Status</th></tr></thead>
                                            <tbody className="divide-y divide-border/20">
                                                {loading ? <tr><td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">Loading...</td></tr> :
                                                    data?.stockMovements?.length ? data.stockMovements.map((m, i) => (
                                                        <tr key={i} className="hover:bg-muted/30 transition-colors"><td className="px-3 py-2 text-muted-foreground">{m.date}</td><td className="px-3 py-2 font-medium">{m.item}</td><td className="px-3 py-2"><Badge variant="outline" className="text-[10px]">{m.type}</Badge></td><td className="px-3 py-2 text-right font-semibold">{m.qty}</td><td className="px-3 py-2"><Badge variant={m.status === 'COMPLETED' ? 'default' : m.status === 'ISSUED' ? 'secondary' : 'outline'} className="text-[10px]">{m.status}</Badge></td></tr>
                                                    )) : <tr><td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">No movements</td></tr>}
                                            </tbody>
                                        </table>
                                    </div>
                                </CardContent>
                            </Card>
                            <Card>
                                <CardHeader className="pb-2"><CardTitle className="text-xs font-bold flex items-center gap-1.5"><span className="w-1.5 h-3 bg-rose-500 rounded-full" />Low Stock Alerts</CardTitle></CardHeader>
                                <CardContent>
                                    <div className="space-y-2">
                                        {loading ? <p className="text-xs">Loading...</p> :
                                            data?.lowStockAlerts?.length ? data.lowStockAlerts.map((item, i) => (
                                                <div key={i} className="flex items-center justify-between p-2 rounded bg-muted/50 border border-border/40">
                                                    <div className="flex-1 min-w-0"><p className="text-xs font-semibold truncate">{item.item}</p><p className="text-[10px] text-muted-foreground mt-0.5">Current: {item.current} {item.unit} / Min: {item.min} {item.unit}</p></div>
                                                    <div className="flex items-center gap-1.5 ml-3"><div className="w-14 h-1.5 bg-muted rounded-full overflow-hidden"><div className="h-full bg-rose-500 rounded-full" style={{ width: `${item.min > 0 ? Math.min(100, (item.current / item.min) * 100) : 0}%` }} /></div><span className="text-[10px] font-bold text-rose-600">{item.min > 0 ? Math.round((item.current / item.min) * 100) : 0}%</span></div>
                                                </div>
                                            )) : <p className="text-xs text-muted-foreground">No alerts</p>}
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}