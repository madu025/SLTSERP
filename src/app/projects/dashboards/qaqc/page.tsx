"use client";

import React from "react";
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ClipboardCheck, CheckCircle, XCircle, AlertTriangle,
  FileText, TrendingUp, Clock, Activity,
} from "lucide-react";

const recentInspections = [
  { date: "2025-04-08", project: "FTTH Zone A - Phase 2", inspector: "Priya Rajapaksa", result: "Pass", notes: "All criteria met" },
  { date: "2025-04-08", project: "Fiber Backbone - Sector 7", inspector: "Amila Gunawardena", result: "Fail", notes: "Cable tension exceeds spec" },
  { date: "2025-04-07", project: "Tower Installation - Site 12", inspector: "Saman Silva", result: "Pass", notes: "Structural integrity verified" },
  { date: "2025-04-07", project: "OSP Copper - Area 4", inspector: "Priya Rajapaksa", result: "Pass", notes: "Joint closure OK" },
  { date: "2025-04-06", project: "Building Indoor - Block C", inspector: "Amila Gunawardena", result: "Pass", notes: "Cabling routed correctly" },
];

const qualityTrend = [
  { month: "Dec", passRate: 92, inspections: 45 },
  { month: "Jan", passRate: 88, inspections: 52 },
  { month: "Feb", passRate: 94, inspections: 48 },
  { month: "Mar", passRate: 91, inspections: 55 },
  { month: "Apr", passRate: 86, inspections: 38 },
];

const resultBadge = (r: string) => {
  if (r === "Pass") return React.createElement(Badge, { variant: "default", className: "bg-emerald-500/10 text-emerald-600 border-emerald-200" }, r);
  return React.createElement(Badge, { variant: "destructive" }, r);
};

export default function QAQCDashboardPage() {
  return (
    <div className="min-h-screen flex bg-background text-foreground">
      <Sidebar />
      <main className="flex-1 flex flex-col min-w-0 h-full">
        <Header />
        <div className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 space-y-6 md:space-y-8">
          <div className="max-w-7xl mx-auto w-full">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
              <div>
                <h1 className="text-xl md:text-2xl font-bold text-foreground">QA/QC Quality Dashboard</h1>
                <p className="text-sm text-muted-foreground mt-1">Quality inspections, NCR tracking &amp; compliance</p>
              </div>
              <Button variant="outline" size="sm" className="gap-2">
                <Activity className="w-4 h-4" />
                Last updated: Today
              </Button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-6 md:mb-8">
              <Card><CardContent className="flex items-center gap-4 py-5"><div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center shrink-0"><ClipboardCheck className="w-6 h-6 text-blue-600" /></div><div><p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Total Inspections</p><p className="text-2xl font-bold text-foreground mt-0.5">238</p><p className="text-xs text-muted-foreground mt-0.5">This year</p></div></CardContent></Card>
              <Card><CardContent className="flex items-center gap-4 py-5"><div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0"><CheckCircle className="w-6 h-6 text-emerald-600" /></div><div><p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Pass Rate</p><p className="text-2xl font-bold text-foreground mt-0.5">91.2%</p><p className="text-xs text-emerald-600 font-medium mt-0.5">Above target</p></div></CardContent></Card>
              <Card><CardContent className="flex items-center gap-4 py-5"><div className="w-12 h-12 rounded-xl bg-rose-500/10 flex items-center justify-center shrink-0"><XCircle className="w-6 h-6 text-rose-600" /></div><div><p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Open NCRs</p><p className="text-2xl font-bold text-rose-600 mt-0.5">7</p><p className="text-xs text-rose-600 font-medium mt-0.5">Requires action</p></div></CardContent></Card>
              <Card><CardContent className="flex items-center gap-4 py-5"><div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center shrink-0"><AlertTriangle className="w-6 h-6 text-amber-600" /></div><div><p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Pending Reviews</p><p className="text-2xl font-bold text-foreground mt-0.5">12</p><p className="text-xs text-amber-600 font-medium mt-0.5">Awaiting QC sign-off</p></div></CardContent></Card>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6 md:mb-8">
              <Card>
                <CardHeader><CardTitle className="text-sm font-bold flex items-center gap-2"><span className="w-1.5 h-4 bg-blue-500 rounded-full" /> Recent Inspections</CardTitle></CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border/40 text-left text-xs font-semibold text-muted-foreground uppercase">
                          <th className="px-4 py-3">Date</th>
                          <th className="px-4 py-3">Project</th>
                          <th className="px-4 py-3">Inspector</th>
                          <th className="px-4 py-3">Result</th>
                          <th className="px-4 py-3">Notes</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/20">
                        {recentInspections.map((ins, i) => (
                          <tr key={i} className="hover:bg-muted/30 transition-colors">
                            <td className="px-4 py-3 text-muted-foreground text-xs">{ins.date}</td>
                            <td className="px-4 py-3 font-medium text-foreground">{ins.project}</td>
                            <td className="px-4 py-3 text-muted-foreground text-xs">{ins.inspector}</td>
                            <td className="px-4 py-3">{resultBadge(ins.result)}</td>
                            <td className="px-4 py-3 text-muted-foreground text-xs max-w-[120px] truncate">{ins.notes}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle className="text-sm font-bold flex items-center gap-2"><span className="w-1.5 h-4 bg-emerald-500 rounded-full" /> Quality Trend</CardTitle></CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {qualityTrend.map((item, i) => (
                      <div key={i}>
                        <div className="flex items-center justify-between text-sm mb-1">
                          <span className="font-medium text-foreground">{item.month}</span>
                          <span className="text-muted-foreground">{item.inspections} inspections</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="flex-1 h-3 bg-muted rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${item.passRate >= 90 ? "bg-emerald-500" : "bg-amber-500"} transition-all duration-700`}
                              style={{ width: item.passRate + '%' }}
                            />
                          </div>
                          <span className={`text-xs font-bold ${item.passRate >= 90 ? "text-emerald-600" : "text-amber-600"}`}>
                            {item.passRate}%
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-6 p-4 rounded-lg bg-muted/50 border border-border/40">
                    <p className="text-xs font-semibold text-muted-foreground uppercase">Quality Summary</p>
                    <p className="text-sm text-foreground mt-1">
                      Average pass rate across all projects is <span className="font-bold text-emerald-600">90.2%</span>.
                      {qualityTrend[qualityTrend.length-1].passRate < 90 ? " Recent trend shows decline requiring attention." : " Quality standards are being maintained."}
                    </p>
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
