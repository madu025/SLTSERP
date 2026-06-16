"use client";

import React from "react";
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DollarSign, TrendingUp, Receipt, Clock,
  PieChart, Banknote, ArrowUpRight, ArrowDownRight,
} from "lucide-react";

const topExpenses = [
  { category: "Material Procurement", amount: 142000000, percentage: 38, color: "bg-blue-500" },
  { category: "Contractor Payments", amount: 98000000, percentage: 26, color: "bg-indigo-500" },
  { category: "Logistics and Transport", amount: 52000000, percentage: 14, color: "bg-violet-500" },
  { category: "Labor and Staff", amount: 41000000, percentage: 11, color: "bg-emerald-500" },
  { category: "Equipment Rental", amount: 25000000, percentage: 7, color: "bg-amber-500" },
  { category: "Other", amount: 15000000, percentage: 4, color: "bg-slate-400" },
];

const paymentStatus = [
  { label: "Paid", count: 145, color: "bg-emerald-500", width: "58%" },
  { label: "Pending", count: 52, color: "bg-amber-500", width: "20.8%" },
  { label: "Overdue", count: 18, color: "bg-rose-500", width: "7.2%" },
  { label: "Draft", count: 35, color: "bg-slate-400", width: "14%" },
];

const recentTransactions = [
  { date: "2025-04-08", desc: "GRN-2025-0421 - Material Procurement", type: "Payment", amount: 2500000, status: "Completed" },
  { date: "2025-04-07", desc: "Contractor Milestone - FTTH Zone A", type: "Invoice", amount: 5800000, status: "Pending" },
  { date: "2025-04-07", desc: "Office Supplies - April", type: "Payment", amount: 85000, status: "Completed" },
  { date: "2025-04-06", desc: "Equipment Rental - Tower Site 12", type: "Payment", amount: 750000, status: "Completed" },
  { date: "2025-04-05", desc: "Transport - Fiber Backbone", type: "Payment", amount: 320000, status: "Overdue" },
  { date: "2025-04-04", desc: "BOQ Claim - OSP Copper Area 4", type: "Invoice", amount: 12500000, status: "Pending" },
];

const fmt = (n: number) => "LKR " + (n / 1000000).toFixed(1) + "M";

const txBadge = (s: string) => {
  const m: Record<string, { v: string; l: string }> = { Completed: { v: "default", l: "Completed" }, Pending: { v: "secondary", l: "Pending" }, Overdue: { v: "destructive", l: "Overdue" } };
  const t = m[s] || m.Pending;
  return React.createElement(Badge, { variant: t.v as any }, t.l);
};

export default function FinancialsDashboardPage() {
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
                <p className="text-sm text-muted-foreground mt-1">Budget tracking, expenses &amp; payment overview</p>
              </div>
              <Button variant="outline" size="sm" className="gap-2">
                <Banknote className="w-4 h-4" />
                Last updated: Today
              </Button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-6 md:mb-8">
              <Card><CardContent className="flex items-center gap-4 py-5"><div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center shrink-0"><DollarSign className="w-6 h-6 text-blue-600" /></div><div><p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Total Budget</p><p className="text-2xl font-bold text-foreground mt-0.5">LKR 485M</p><p className="text-xs text-muted-foreground mt-0.5">All projects</p></div></CardContent></Card>
              <Card><CardContent className="flex items-center gap-4 py-5"><div className="w-12 h-12 rounded-xl bg-indigo-500/10 flex items-center justify-center shrink-0"><TrendingUp className="w-6 h-6 text-indigo-600" /></div><div><p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Total Invoiced</p><p className="text-2xl font-bold text-foreground mt-0.5">LKR 178M</p><p className="text-xs text-muted-foreground mt-0.5">To clients</p></div></CardContent></Card>
              <Card><CardContent className="flex items-center gap-4 py-5"><div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0"><Receipt className="w-6 h-6 text-emerald-600" /></div><div><p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Total Paid</p><p className="text-2xl font-bold text-foreground mt-0.5">LKR 134M</p><p className="text-xs text-muted-foreground mt-0.5">Settled</p></div></CardContent></Card>
              <Card><CardContent className="flex items-center gap-4 py-5"><div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center shrink-0"><Clock className="w-6 h-6 text-amber-600" /></div><div><p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Outstanding</p><p className="text-2xl font-bold text-foreground mt-0.5">LKR 44M</p><p className="text-xs text-amber-600 font-medium mt-0.5">Awaiting payment</p></div></CardContent></Card>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6 md:mb-8">
              <Card>
                <CardHeader><CardTitle className="text-sm font-bold flex items-center gap-2"><span className="w-1.5 h-4 bg-blue-500 rounded-full" /> Top Expenses by Category</CardTitle></CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {topExpenses.map((item, i) => (
                      <div key={i}>
                        <div className="flex items-center justify-between text-sm mb-1">
                          <span className="font-medium text-foreground">{item.category}</span>
                          <span className="text-muted-foreground">{fmt(item.amount)}</span>
                        </div>
                        <div className="w-full h-2.5 bg-muted rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${item.color} transition-all duration-700`} style={{ width: item.percentage + "%" }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle className="text-sm font-bold flex items-center gap-2"><span className="w-1.5 h-4 bg-emerald-500 rounded-full" /> Payment Voucher Status</CardTitle></CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {paymentStatus.map((item, i) => (
                      <div key={i}>
                        <div className="flex items-center justify-between text-sm mb-1">
                          <span className="font-medium text-foreground">{item.label}</span>
                          <span className="text-muted-foreground">{item.count} vouchers</span>
                        </div>
                        <div className="w-full h-2.5 bg-muted rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${item.color} transition-all duration-700`} style={{ width: item.width }} />
                        </div>
                      </div>
                    ))}
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
                      {recentTransactions.map((tx, i) => (
                        <tr key={i} className="hover:bg-muted/30 transition-colors">
                          <td className="px-4 py-3 text-muted-foreground text-xs">{tx.date}</td>
                          <td className="px-4 py-3 font-medium text-foreground">{tx.desc}</td>
                          <td className="px-4 py-3"><Badge variant="outline" className="text-xs">{tx.type}</Badge></td>
                          <td className="px-4 py-3 text-right font-semibold">{fmt(tx.amount)}</td>
                          <td className="px-4 py-3">{txBadge(tx.status)}</td>
                        </tr>
                      ))}
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
