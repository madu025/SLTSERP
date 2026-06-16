"use client";

import React from "react";
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Package, AlertTriangle, ClipboardList, ArrowUpDown,
  PackageMinus, Truck, Warehouse, Clock,
} from "lucide-react";

const stockMovements = [
  { date: "2025-04-08", item: "FTTH Drop Cable 50m", type: "GRN", qty: 500, ref: "GRN-2025-0421", status: "Completed" },
  { date: "2025-04-08", item: "Splice Tray 12 Port", type: "Issue", qty: 25, ref: "SI-2025-0312", status: "Approved" },
  { date: "2025-04-07", item: "Optical Splitter 1:8", type: "GRN", qty: 100, ref: "GRN-2025-0419", status: "Pending" },
  { date: "2025-04-07", item: "Fusion Sleeve 60mm", type: "Issue", qty: 500, ref: "SI-2025-0311", status: "Approved" },
  { date: "2025-04-06", item: "Closure Joint 24 Port", type: "Return", qty: 10, ref: "MRN-2025-008", status: "Completed" },
  { date: "2025-04-06", item: "Wall Mount Bracket", type: "Issue", qty: 60, ref: "SI-2025-0310", status: "Pending" },
];

const lowStockAlerts = [
  { item: "Fusion Sleeve 60mm", current: 250, min: 500, unit: "pcs" },
  { item: "Optical Splitter 1:16", current: 12, min: 50, unit: "pcs" },
  { item: "Closure Joint 24 Port", current: 8, min: 20, unit: "pcs" },
  { item: "FTTH Drop Cable 50m", current: 150, min: 300, unit: "m" },
  { item: "Splice Tray 12 Port", current: 30, min: 100, unit: "pcs" },
];

const statusVariant = (s: string) => {
  const m: Record<string, "default" | "secondary" | "outline"> = { Completed: "default", Approved: "secondary", Pending: "outline" };
  return { v: m[s] || "outline", l: s };
};

export default function LogisticsDashboardPage() {
  return (
    <div className="min-h-screen flex bg-background text-foreground">
      <Sidebar />
      <main className="flex-1 flex flex-col min-w-0 h-full">
        <Header />
        <div className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 space-y-6 md:space-y-8">
          <div className="max-w-7xl mx-auto w-full">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
              <div>
                <h1 className="text-xl md:text-2xl font-bold text-foreground">Logistics &amp; Warehouse Dashboard</h1>
                <p className="text-sm text-muted-foreground mt-1">Inventory, stock movements &amp; procurement overview</p>
              </div>
              <Button variant="outline" size="sm" className="gap-2">
                <Warehouse className="w-4 h-4" />
                Last updated: Today
              </Button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-6 md:mb-8">
              <Card><CardContent className="flex items-center gap-4 py-5"><div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center shrink-0"><Package className="w-6 h-6 text-blue-600" /></div><div><p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Total Items</p><p className="text-2xl font-bold text-foreground mt-0.5">1,284</p><p className="text-xs text-muted-foreground mt-0.5">Across all stores</p></div></CardContent></Card>
              <Card><CardContent className="flex items-center gap-4 py-5"><div className="w-12 h-12 rounded-xl bg-rose-500/10 flex items-center justify-center shrink-0"><AlertTriangle className="w-6 h-6 text-rose-600" /></div><div><p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Low Stock Items</p><p className="text-2xl font-bold text-rose-600 mt-0.5">5</p><p className="text-xs text-rose-600 font-medium mt-0.5">Requires reorder</p></div></CardContent></Card>
              <Card><CardContent className="flex items-center gap-4 py-5"><div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center shrink-0"><ClipboardList className="w-6 h-6 text-amber-600" /></div><div><p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Pending GRNs</p><p className="text-2xl font-bold text-foreground mt-0.5">12</p><p className="text-xs text-amber-600 font-medium mt-0.5">Awaiting receipt</p></div></CardContent></Card>
              <Card><CardContent className="flex items-center gap-4 py-5"><div className="w-12 h-12 rounded-xl bg-indigo-500/10 flex items-center justify-center shrink-0"><PackageMinus className="w-6 h-6 text-indigo-600" /></div><div><p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Active Stock Issues</p><p className="text-2xl font-bold text-foreground mt-0.5">8</p><p className="text-xs text-muted-foreground mt-0.5">In progress</p></div></CardContent></Card>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6 md:mb-8">
              <Card className="lg:col-span-1">
                <CardHeader><CardTitle className="text-sm font-bold flex items-center gap-2"><span className="w-1.5 h-4 bg-blue-500 rounded-full" /> Recent Stock Movements</CardTitle></CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border/40 text-left text-xs font-semibold text-muted-foreground uppercase">
                          <th className="px-4 py-3">Date</th>
                          <th className="px-4 py-3">Item</th>
                          <th className="px-4 py-3">Type</th>
                          <th className="px-4 py-3 text-right">Qty</th>
                          <th className="px-4 py-3">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/20">
                        {stockMovements.map((m, i) => {
                          const sv = statusVariant(m.status);
                          return (
                            <tr key={i} className="hover:bg-muted/30 transition-colors">
                              <td className="px-4 py-3 text-muted-foreground text-xs">{m.date}</td>
                              <td className="px-4 py-3 font-medium text-foreground">{m.item}</td>
                              <td className="px-4 py-3"><Badge variant="outline" className="text-xs">{m.type}</Badge></td>
                              <td className="px-4 py-3 text-right font-semibold">{m.qty}</td>
                              <td className="px-4 py-3">
                                <Badge variant={sv.v}>{sv.l}</Badge>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle className="text-sm font-bold flex items-center gap-2"><span className="w-1.5 h-4 bg-rose-500 rounded-full" /> Low Stock Alerts</CardTitle></CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {lowStockAlerts.map((item, i) => (
                      <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border border-border/40">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-foreground truncate">{item.item}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">Current: {item.current} {item.unit} / Min: {item.min} {item.unit}</p>
                        </div>
                        <div className="flex items-center gap-2 ml-4">
                          <div className="w-20 h-2 bg-muted rounded-full overflow-hidden">
                            <div className="h-full bg-rose-500 rounded-full" style={{ width: `${(item.current/item.min)*100}%` }} />
                          </div>
                          <span className="text-xs font-bold text-rose-600">{Math.round((item.current/item.min)*100)}%</span>
                        </div>
                      </div>
                    ))}
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
