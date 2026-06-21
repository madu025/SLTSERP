"use client";

import React, { useEffect, useState } from "react";
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DollarSign, TrendingUp, Receipt, Clock, Banknote } from "lucide-react";

interface ExpenseItem { category: string; amount: number; percentage: number; color: string; }
interface VoucherStatus { label: string; count: number; color: string; width: string; }
interface Transaction { date: string; desc: string; type: string; amount: number; status: string; }
interface FinancialsData { totalBudget: number; totalInvoiced: number; totalPaid: number; totalOutstanding: number; topExpenses: ExpenseItem[]; paymentStatus: VoucherStatus[]; recentTransactions: Transaction[]; }

const fmt = (n: number) => {
    if (!n) return "LKR 0";
    if (n >= 100000000) return "LKR " + (n / 1000000).toFixed(1) + "M";
    if (n >= 1000000) return "LKR " + (n / 1000000).toFixed(2) + "M";
    return "LKR " + n.toLocaleString();
};
const txBadge = (s: string) => {
    const m: Record<string, { v: "default" | "secondary" | "destructive" | "outline"; l: string }> = {
        PAID: { v: "default", l: "Paid" }, COMPLETED: { v: "default", l: "Completed" },
        PENDING: { v: "secondary", l: "Pending" }, OVERDUE: { v: "destructive", l: "Overdue" },
        SENT: { v: "secondary", l: "Sent" }, DRAFT: { v: "outline", l: "Draft" },
    };
    const t = m[s] || { v: "outline" as const, l: s };
    return <Badge variant={t.v} className="text-[10px]">{t.l}</Badge>;
};

export default function FinancialsDashboardPage() {
    const [data, setData] = useState<FinancialsData | null>(null);
    const [loading, setLoading] = useState(true);
    useEffect(() => {
        (async () => {
            try { const r = await fetch("/api/dashboard/project-stats"); if (r.ok) { const j = await r.json(); setData(j.financials); } }
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
                            <div><h1 className="text-lg font-bold">Financials Dashboard</h1><p className="text-xs text-muted-foreground mt-0.5">Budget tracking, expenses & payment overview</p></div>
                            <Button variant="outline" size="sm" className="gap-1.5 h-7 text-xs"><Banknote className="w-3.5 h-3.5" />Updated: Today</Button>
                        </div>
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 md:gap-3 mb-4">
                            <Card><CardContent className="flex items-center gap-3 py-3"><div className="w-9 h-9 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0"><DollarSign className="w-4 h-4 text-blue-600" /></div><div><p className="text-[10px] font-semibold text-muted-foreground uppercase">Total Budget</p><p className="text-lg font-bold mt-0.5">{data ? fmt(data.totalBudget) : "-"}</p><p className="text-[10px] text-muted-foreground">All projects</p></div></CardContent></Card>
                            <Card><CardContent className="flex items-center gap-3 py-3"><div className="w-9 h-9 rounded-lg bg-indigo-500/10 flex items-center justify-center shrink-0"><TrendingUp className="w-4 h-4 text-indigo-600" /></div><div><p className="text-[10px] font-semibold text-muted-foreground uppercase">Total Invoiced</p><p className="text-lg font-bold mt-0.5">{data ? fmt(data.totalInvoiced) : "-"}</p><p className="text-[10px] text-muted-foreground">To clients</p></div></CardContent></Card>
                            <Card><CardContent className="flex items-center gap-3 py-3"><div className="w-9 h-9 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0"><Receipt className="w-4 h-4 text-emerald-600" /></div><div><p className="text-[10px] font-semibold text-muted-foreground uppercase">Total Paid</p><p className="text-lg font-bold mt-0.5">{data ? fmt(data.totalPaid) : "-"}</p><p className="text-[10px] text-muted-foreground">Settled</p></div></CardContent></Card>
                            <Card><CardContent className="flex items-center gap-3 py-3"><div className="w-9 h-9 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0"><Clock className="w-4 h-4 text-amber-600" /></div><div><p className="text-[10px] font-semibold text-muted-foreground uppercase">Outstanding</p><p className="text-lg font-bold mt-0.5">{data ? fmt(data.totalOutstanding) : "-"}</p><p className="text-[10px] text-amber-600 font-medium">Awaiting payment</p></div></CardContent></Card>
                        </div>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
                            <Card><CardHeader className="pb-2"><CardTitle className="text-xs font-bold flex items-center gap-1.5"><span className="w-1.5 h-3 bg-blue-500 rounded-full" />Top Expenses</CardTitle></CardHeader><CardContent><div className="space-y-3">{loading ? <p className="text-xs">Loading...</p> : data?.topExpenses?.length ? data.topExpenses.map((item, i) => (<div key={i}><div className="flex items-center justify-between text-xs mb-0.5"><span className="font-medium">{item.category}</span><span className="text-muted-foreground">{fmt(item.amount)}</span></div><div className="w-full h-2 bg-muted rounded-full overflow-hidden"><div className={`h-full rounded-full ${item.color}`} style={{ width: item.percentage + "%" }} /></div></div>)) : <p className="text-xs text-muted-foreground">No expenses</p>}</div></CardContent></Card>
                            <Card><CardHeader className="pb-2"><CardTitle className="text-xs font-bold flex items-center gap-1.5"><span className="w-1.5 h-3 bg-emerald-500 rounded-full" />Payment Vouchers</CardTitle></CardHeader><CardContent><div className="space-y-3">{loading ? <p className="text-xs">Loading...</p> : data?.paymentStatus?.length ? data.paymentStatus.map((item, i) => (<div key={i}><div className="flex items-center justify-between text-xs mb-0.5"><span className="font-medium">{item.label}</span><span className="text-muted-foreground">{item.count}</span></div><div className="w-full h-2 bg-muted rounded-full overflow-hidden"><div className={`h-full rounded-full ${item.color}`} style={{ width: item.width }} /></div></div>)) : <p className="text-xs text-muted-foreground">No vouchers</p>}</div></CardContent></Card>
                        </div>
                        <Card>
                            <CardHeader className="pb-2"><CardTitle className="text-xs font-bold flex items-center gap-1.5"><span className="w-1.5 h-3 bg-indigo-500 rounded-full" />Recent Transactions</CardTitle></CardHeader>
                            <CardContent className="p-0">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-xs">
                                        <thead><tr className="border-b border-border/40 text-left text-[10px] font-semibold text-muted-foreground uppercase"><th className="px-3 py-2">Date</th><th className="px-3 py-2">Description</th><th className="px-3 py-2">Type</th><th className="px-3 py-2 text-right">Amount</th><th className="px-3 py-2">Status</th></tr></thead>
                                        <tbody className="divide-y divide-border/20">
                                            {loading ? <tr><td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">Loading...</td></tr> :
                                                data?.recentTransactions?.length ? data.recentTransactions.map((tx, i) => (
                                                    <tr key={i} className="hover:bg-muted/30 transition-colors"><td className="px-3 py-2 text-muted-foreground">{tx.date}</td><td className="px-3 py-2 font-medium">{tx.desc}</td><td className="px-3 py-2"><Badge variant="outline" className="text-[10px]">{tx.type}</Badge></td><td className="px-3 py-2 text-right font-semibold">{fmt(tx.amount)}</td><td className="px-3 py-2">{txBadge(tx.status)}</td></tr>
                                                )) : <tr><td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">No transactions</td></tr>}
                                        </tbody>
                                    </table>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </main>
        </div>
    );
}