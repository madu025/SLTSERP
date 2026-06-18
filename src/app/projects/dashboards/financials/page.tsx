"use client";

import React, { useEffect, useState } from "react";
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DollarSign, TrendingUp, Receipt, Clock,
  Banknote,
} from "lucide-react";

interface ExpenseItem {
  category: string;
  amount: number;
  percentage: number;
  color: string;
}

interface VoucherStatus {
  label: string;
  count: number;
  color: string;
  width: string;
}

interface Transaction {
  date: string;
  desc: string;
  type: string;
  amount: number;
  status: string;
}

interface FinancialsData {
  totalBudget: number;
  totalInvoiced: number;
  totalPaid: number;
  totalOutstanding: number;
  topExpenses: ExpenseItem[];
  paymentStatus: VoucherStatus[];
  recentTransactions: Transaction[];
}

const fmt = (n: number) => {
  if (!n) return "LKR 0";
  if (n >= 100000000) return "LKR " + (n / 1000000).toFixed(1) + "M";
  if (n >= 1000000) return "LKR " + (n / 1000000).toFixed(2) + "M";
  return "LKR " + n.toLocaleString();
};

const txBadge = (s: string) => {
  const m: Record<string, { v: "default" | "secondary" | "destructive" | "outline"; l: string }> = {
    PAID: { v: "default", l: "Paid" },
    COMPLETED: { v: "default", l: "Completed" },
    PENDING: { v: "secondary", l: "Pending" },
    OVERDUE: { v: "destructive", l: "Overdue" },
    SENT: { v: "secondary", l: "Sent" },
    DRAFT: { v: "outline", l: "Draft" },
  };
  const t = m[s] || { v: "outline" as const, l: s };
  return <Badge variant={t.v}>{t.l}</Badge>;
};

export default function FinancialsDashboardPage() {
  const [data, setData] = useState<FinancialsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch("/api/dashboard/project-stats");
        if (!res.ok) throw new Error("Failed to load stats");
        const json = await res.json();
        setData(json.financials);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  return (
    <div className="min-h-screen flex bg-background text-foreground">
      <Sidebar />
      <main className="flex-1 flex flex-col min-w-0 h-full">
        <Header />
        <div className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 space-y-6 md:space-y-8">
          <div className="max-w-7xl mx-auto w-full">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
              <div>
                <h1 className="text-xl md:text-2xl font-bold text-foreground">Financials Dashboard</h1>
                <p className="text-sm text-muted-foreground mt-1">Budget tracking, expenses & payment overview</p>
              </div>
              <Button variant="outline" size="sm" className="gap-2">
                <Banknote className="w-4 h-4" />
                Last updated: Today
              </Button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-6 md:mb-8">
              <Card><CardContent className="flex items-center gap-4 py-5"><div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center shrink-0"><DollarSign className="w-6 h-6 text-blue-600" /></div><div><p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Total Budget</p><p className="text-2xl font-bold text-foreground mt-0.5">{data ? fmt(data.totalBudget) : "-"}</p><p className="text-xs text-muted-foreground mt-0.5">All projects</p></div></CardContent></Card>
              <Card><CardContent className="flex items-center gap-4 py-5"><div className="w-12 h-12 rounded-xl bg-indigo-500/10 flex items-center justify-center shrink-0"><TrendingUp className="w-6 h-6 text-indigo-600" /></div><div><p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Total Invoiced</p><p className="text-2xl font-bold text-foreground mt-0.5">{data ? fmt(data.totalInvoiced) : "-"}</p><p className="text-xs text-muted-foreground mt-0.5">To clients</p></div></CardContent></Card>
              <Card><CardContent className="flex items-center gap-4 py-5"><div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0"><Receipt className="w-6 h-6 text-emerald-600" /></div><div><p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Total Paid</p><p className="text-2xl font-bold text-foreground mt-0.5">{data ? fmt(data.totalPaid) : "-"}</p><p className="text-xs text-muted-foreground mt-0.5">Settled</p></div></CardContent></Card>
              <Card><CardContent className="flex items-center gap-4 py-5"><div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center shrink-0"><Clock className="w-6 h-6 text-amber-600" /></div><div><p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Outstanding</p><p className="text-2xl font-bold text-foreground mt-0.5">{data ? fmt(data.totalOutstanding) : "-"}</p><p className="text-xs text-amber-600 font-medium mt-0.5">Awaiting payment</p></div></CardContent></Card>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6 md:mb-8">
              <Card>
                <CardHeader><CardTitle className="text-sm font-bold flex items-center gap-2"><span className="w-1.5 h-4 bg-blue-500 rounded-full" /> Top Expenses by Category</CardTitle></CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {loading ? "Loading..." : data?.topExpenses?.length ? data.topExpenses.map((item, i) => (
                      <div key={i}>
                        <div className="flex items-center justify-between text-sm mb-1">
                          <span className="font-medium text-foreground">{item.category}</span>
                          <span className="text-muted-foreground">{fmt(item.amount)}</span>
                        </div>
                        <div className="w-full h-2.5 bg-muted rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${item.color} transition-all duration-700`} style={{ width: item.percentage + "%" }} />
                        </div>
                      </div>
                    )) : <p className="text-sm text-muted-foreground">No expenses recorded</p>}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle className="text-sm font-bold flex items-center gap-2"><span className="w-1.5 h-4 bg-emerald-500 rounded-full" /> Payment Voucher Status</CardTitle></CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {loading ? "Loading..." : data?.paymentStatus?.length ? data.paymentStatus.map((item, i) => (
                      <div key={i}>
                        <div className="flex items-center justify-between text-sm mb-1">
                          <span className="font-medium text-foreground">{item.label}</span>
                          <span className="text-muted-foreground">{item.count} vouchers</span>
                        </div>
                        <div className="w-full h-2.5 bg-muted rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${item.color} transition-all duration-700`} style={{ width: item.width }} />
                        </div>
                      </div>
                    )) : <p className="text-sm text-muted-foreground">No vouchers found</p>}
                  </div>
                </CardContent>
              </Card>
            </div>
            <Card>
              <CardHeader><CardTitle className="text-sm font-bold flex items-center gap-2"><span className="w-1.5 h-4 bg-indigo-500 rounded-full" /> Recent Transactions</CardTitle></CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border/40 text-left text-xs font-semibold text-muted-foreground uppercase">
                        <th className="px-4 py-3">Date</th>
                        <th className="px-4 py-3">Description</th>
                        <th className="px-4 py-3">Type</th>
                        <th className="px-4 py-3 text-right">Amount</th>
                        <th className="px-4 py-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/20">
                      {loading ? (
                        <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">Loading...</td></tr>
                      ) : data?.recentTransactions?.length ? data.recentTransactions.map((tx, i) => (
                        <tr key={i} className="hover:bg-muted/30 transition-colors">
                          <td className="px-4 py-3 text-muted-foreground text-xs">{tx.date}</td>
                          <td className="px-4 py-3 font-medium text-foreground">{tx.desc}</td>
                          <td className="px-4 py-3"><Badge variant="outline" className="text-xs">{tx.type}</Badge></td>
                          <td className="px-4 py-3 text-right font-semibold">{fmt(tx.amount)}</td>
                          <td className="px-4 py-3">{txBadge(tx.status)}</td>
                        </tr>
                      )) : <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">No recent transactions</td></tr>}
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