"use client";

import React, { useEffect, useState } from "react";
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ClipboardCheck, CheckCircle, XCircle, AlertTriangle,
  Activity,
} from "lucide-react";

interface Inspection {
  date: string;
  project: string;
  inspector: string;
  result: string;
  notes: string;
}

interface QualityTrend {
  month: string;
  passRate: number;
  inspections: number;
}

interface QaqcData {
  totalInspections: number;
  passedInspections: number;
  failedInspections: number;
  passRate: number;
  openNCRs: number;
  pendingReviews: number;
  recentInspections: Inspection[];
  qualityTrend: QualityTrend[];
}

const resultBadge = (r: string) => {
  if (r === "PASS") return <Badge variant="default" className="bg-emerald-500/10 text-emerald-600 border-emerald-200">Pass</Badge>;
  return <Badge variant="destructive">Fail</Badge>;
};

export default function QAQCDashboardPage() {
  const [data, setData] = useState<QaqcData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch("/api/dashboard/project-stats");
        if (!res.ok) throw new Error("Failed to load stats");
        const json = await res.json();
        setData(json.qaqc);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const avgPassRate = data?.qualityTrend?.length
    ? +(data.qualityTrend.reduce((sum, t) => sum + t.passRate, 0) / data.qualityTrend.length).toFixed(1)
    : 0;

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
                <p className="text-sm text-muted-foreground mt-1">Quality inspections, NCR tracking & compliance</p>
              </div>
              <Button variant="outline" size="sm" className="gap-2">
                <Activity className="w-4 h-4" />
                Last updated: Today
              </Button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-6 md:mb-8">
              <Card><CardContent className="flex items-center gap-4 py-5"><div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center shrink-0"><ClipboardCheck className="w-6 h-6 text-blue-600" /></div><div><p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Total Inspections</p><p className="text-2xl font-bold text-foreground mt-0.5">{data ? data.totalInspections : "-"}</p><p className="text-xs text-muted-foreground mt-0.5">This year</p></div></CardContent></Card>
              <Card><CardContent className="flex items-center gap-4 py-5"><div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0"><CheckCircle className="w-6 h-6 text-emerald-600" /></div><div><p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Pass Rate</p><p className="text-2xl font-bold text-foreground mt-0.5">{data ? `${data.passRate}%` : "-"}</p><p className="text-xs text-emerald-600 font-medium mt-0.5">{data && data.passRate >= 90 ? "Above target" : "Needs attention"}</p></div></CardContent></Card>
              <Card><CardContent className="flex items-center gap-4 py-5"><div className="w-12 h-12 rounded-xl bg-rose-500/10 flex items-center justify-center shrink-0"><XCircle className="w-6 h-6 text-rose-600" /></div><div><p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Open NCRs</p><p className="text-2xl font-bold text-rose-600 mt-0.5">{data ? data.openNCRs : "-"}</p><p className="text-xs text-rose-600 font-medium mt-0.5">Requires action</p></div></CardContent></Card>
              <Card><CardContent className="flex items-center gap-4 py-5"><div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center shrink-0"><AlertTriangle className="w-6 h-6 text-amber-600" /></div><div><p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Pending Reviews</p><p className="text-2xl font-bold text-foreground mt-0.5">{data ? data.pendingReviews : "-"}</p><p className="text-xs text-amber-600 font-medium mt-0.5">Awaiting QC sign-off</p></div></CardContent></Card>
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
                        {loading ? (
                          <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">Loading...</td></tr>
                        ) : data?.recentInspections?.length ? data.recentInspections.map((ins, i) => (
                          <tr key={i} className="hover:bg-muted/30 transition-colors">
                            <td className="px-4 py-3 text-muted-foreground text-xs">{ins.date}</td>
                            <td className="px-4 py-3 font-medium text-foreground">{ins.project}</td>
                            <td className="px-4 py-3 text-muted-foreground text-xs">{ins.inspector}</td>
                            <td className="px-4 py-3">{resultBadge(ins.result)}</td>
                            <td className="px-4 py-3 text-muted-foreground text-xs max-w-[120px] truncate">{ins.notes}</td>
                          </tr>
                        )) : <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">No recent inspections</td></tr>}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle className="text-sm font-bold flex items-center gap-2"><span className="w-1.5 h-4 bg-emerald-500 rounded-full" /> Quality Trend</CardTitle></CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {loading ? "Loading..." : data?.qualityTrend?.length ? data.qualityTrend.map((item, i) => (
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
                    )) : <p className="text-sm text-muted-foreground">No trend data available</p>}
                  </div>
                  {data?.qualityTrend && data.qualityTrend.length > 0 && (
                    <div className="mt-6 p-4 rounded-lg bg-muted/50 border border-border/40">
                      <p className="text-xs font-semibold text-muted-foreground uppercase">Quality Summary</p>
                      <p className="text-sm text-foreground mt-1">
                        Average pass rate across all projects is <span className="font-bold text-emerald-600">{avgPassRate}%</span>.
                        {data.qualityTrend[data.qualityTrend.length - 1]!.passRate < 90 ? " Recent trend shows decline requiring attention." : " Quality standards are being maintained."}
                      </p>
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