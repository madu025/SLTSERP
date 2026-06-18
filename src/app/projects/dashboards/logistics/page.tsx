"use client";

import React, { useEffect, useState } from "react";
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Package, AlertTriangle, ClipboardList, PackageMinus,
  Warehouse,
} from "lucide-react";

interface StockMovement {
  date: string;
  item: string;
  type: string;
  qty: number;
  ref: string;
  status: string;
}

interface LowStockAlert {
  item: string;
  current: number;
  min: number;
  unit: string;
}

interface LogisticsData {
  totalItems: number;
  lowStockCount: number;
  pendingGRNs: number;
  activeStockIssues: number;
  stockMovements: StockMovement[];
  lowStockAlerts: LowStockAlert[];
}

const statusVariant = (s: string) => {
  const m: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
    PENDING: "outline",
    ISSUED: "secondary",
    COMPLETED: "default",
    APPROVED: "secondary",
    RECEIVED: "default",
    PARTIAL: "secondary",
  };
  return { v: m[s] || "outline" as const, l: s };
};

export default function LogisticsDashboardPage() {
  const [data, setData] = useState<LogisticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch("/api/dashboard/project-stats");
        if (!res.ok) throw new Error("Failed to load stats");
        const json = await res.json();
        setData(json.logistics);
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
                <h1 className="text-xl md:text-2xl font-bold text-foreground">Logistics & Warehouse Dashboard</h1>
                <p className="text-sm text-muted-foreground mt-1">Inventory, stock movements & procurement overview</p>
              </div>
              <Button variant="outline" size="sm" className="gap-2">
                <Warehouse className="w-4 h-4" />
                Last updated: Today
              </Button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-6 md:mb-8">
              <Card><CardContent className="flex items-center gap-4 py-5"><div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center shrink-0"><Package className="w-6 h-6 text-blue-600" /></div><div><p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Total Items</p><p className="text-2xl font-bold text-foreground mt-0.5">{data ? data.totalItems.toLocaleString() : "-"}</p><p className="text-xs text-muted-foreground mt-0.5">Across all stores</p></div></CardContent></Card>
              <Card><CardContent className="flex items-center gap-4 py-5"><div className="w-12 h-12 rounded-xl bg-rose-500/10 flex items-center justify-center shrink-0"><AlertTriangle className="w-6 h-6 text-rose-600" /></div><div><p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Low Stock Items</p><p className="text-2xl font-bold text-rose-600 mt-0.5">{data ? data.lowStockCount : "-"}</p><p className="text-xs text-rose-600 font-medium mt-0.5">Requires reorder</p></div></CardContent></Card>
              <Card><CardContent className="flex items-center gap-4 py-5"><div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center shrink-0"><ClipboardList className="w-6 h-6 text-amber-600" /></div><div><p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Pending GRNs</p><p className="text-2xl font-bold text-foreground mt-0.5">{data ? data.pendingGRNs : "-"}</p><p className="text-xs text-amber-600 font-medium mt-0.5">Awaiting receipt</p></div></CardContent></Card>
              <Card><CardContent className="flex items-center gap-4 py-5"><div className="w-12 h-12 rounded-xl bg-indigo-500/10 flex items-center justify-center shrink-0"><PackageMinus className="w-6 h-6 text-indigo-600" /></div><div><p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Active Stock Issues</p><p className="text-2xl font-bold text-foreground mt-0.5">{data ? data.activeStockIssues : "-"}</p><p className="text-xs text-muted-foreground mt-0.5">In progress</p></div></CardContent></Card>
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
                        {loading ? (
                          <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">Loading...</td></tr>
                        ) : data?.stockMovements?.length ? data.stockMovements.map((m, i) => {
                          const sv = statusVariant(m.status);
                          return (
                            <tr key={i} className="hover:bg-muted/30 transition-colors">
                              <td className="px-4 py-3 text-muted-foreground text-xs">{m.date}</td>
                              <td className="px-4 py-3 font-medium text-foreground">{m.item}</td>
                              <td className="px-4 py-3"><Badge variant="outline" className="text-xs">{m.type}</Badge></td>
                              <td className="px-4 py-3 text-right font-semibold">{m.qty}</td>
                              <td className="px-4 py-3"><Badge variant={sv.v}>{sv.l}</Badge></td>
                            </tr>
                          );
                        }) : <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">No recent movements</td></tr>}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle className="text-sm font-bold flex items-center gap-2"><span className="w-1.5 h-4 bg-rose-500 rounded-full" /> Low Stock Alerts</CardTitle></CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {loading ? "Loading..." : data?.lowStockAlerts?.length ? data.lowStockAlerts.map((item, i) => (
                      <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border border-border/40">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-foreground truncate">{item.item}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">Current: {item.current} {item.unit} / Min: {item.min} {item.unit}</p>
                        </div>
                        <div className="flex items-center gap-2 ml-4">
                          <div className="w-20 h-2 bg-muted rounded-full overflow-hidden">
                            <div className="h-full bg-rose-500 rounded-full" style={{ width: `${item.min > 0 ? Math.min(100, (item.current / item.min) * 100) : 0}%` }} />
                          </div>
                          <span className="text-xs font-bold text-rose-600">{item.min > 0 ? Math.round((item.current / item.min) * 100) : 0}%</span>
                        </div>
                      </div>
                    )) : <p className="text-sm text-muted-foreground">No low stock alerts</p>}
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