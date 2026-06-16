"use client";

import React from "react";
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  FolderKanban, DollarSign, TrendingDown, Clock,
  AlertTriangle, CheckCircle2, Activity, ArrowUpRight, ArrowDownRight,
} from "lucide-react";

const statusData = [
  { label: "Planning", count: 8, color: "bg-yellow-500", width: "20%" },
  { label: "In Progress", count: 15, color: "bg-blue-500", width: "37.5%" },
  { label: "On Hold", count: 4, color: "bg-orange-500", width: "10%" },
  { label: "Completed", count: 11, color: "bg-emerald-500", width: "27.5%" },
  { label: "Cancelled", count: 2, color: "bg-red-500", width: "5%" },
];

const delayedProjects = [
  { name: "FTTH Zone A - Phase 2", delay: 45, status: "Critical", progress: 55 },
  { name: "Fiber Backbone - Sector 7", delay: 28, status: "Warning", progress: 40 },
  { name: "Tower Installation - Site 12", delay: 14, status: "Warning", progress: 65 },
  { name: "OSP Copper - Area 4", delay: 7, status: "Normal", progress: 80 },
  { name: "Building Indoor - Block C", delay: 3, status: "Normal", progress: 90 },
];

const recentActivities = [
  { user: "Kamal Perera", action: "approved milestone", target: "FTTH Zone A", time: "10 min ago", type: "approval" },
  { user: "Saman Silva", action: "submitted BOQ revision for", target: "Fiber Backbone", time: "35 min ago", type: "submission" },
  { user: "Nuwan Jayawardena", action: "flagged delay on", target: "Tower Site 12", time: "1 hr ago", type: "alert" },
  { user: "Priya Rajapaksa", action: "completed inspection for", target: "OSP Copper Area 4", time: "2 hrs ago", type: "completion" },
  { user: "Rohan Fernando", action: "uploaded documents for", target: "Building Block C", time: "3 hrs ago", type: "upload" },
  { user: "Dinesh Wickrama", action: "created new project", target: "FTTH Zone B", time: "5 hrs ago", type: "creation" },
];

const delayBadge = (s: string) => {
  const m: Record<string, { v: string; l: string }> = { Critical: { v: "destructive", l: "Critical" }, Warning: { v: "secondary", l: "Warning" }, Normal: { v: "outline", l: "On Track" } };
  const c = m[s] || m.Normal;
  return React.createElement(Badge, { variant: c.v as any }, c.l);
};

const activityIcon = (t: string) => {
  switch (t) {
    case "approval": return React.createElement(CheckCircle2, { className: "w-4 h-4 text-emerald-500" });
    case "alert": return React.createElement(AlertTriangle, { className: "w-4 h-4 text-red-500" });
    case "completion": return React.createElement(CheckCircle2, { className: "w-4 h-4 text-blue-500" });
    case "upload": return React.createElement(ArrowUpRight, { className: "w-4 h-4 text-purple-500" });
    case "creation": return React.createElement(FolderKanban, { className: "w-4 h-4 text-indigo-500" });
    default: return React.createElement(Activity, { className: "w-4 h-4 text-slate-400" });
  }
};

export default function PMDashboardPage() {
  return (
    <div className="min-h-screen flex bg-background text-foreground">
      <Sidebar />
      <main className="flex-1 flex flex-col min-w-0 h-full">
        <Header />
        <div className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 space-y-6 md:space-y-8">
          <div className="max-w-7xl mx-auto w-full">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
              <div>
                <h1 className="text-xl md:text-2xl font-bold text-foreground">Project Manager Dashboard</h1>
                <p className="text-sm text-muted-foreground mt-1">OSP project oversight &amp; performance summary</p>
              </div>
              <Button variant="outline" size="sm" className="gap-2">
                <Clock className="w-4 h-4" />
                Last updated: Today
              </Button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-6 md:mb-8">
              <Card><CardContent className="flex items-center gap-4 py-5"><div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center shrink-0"><FolderKanban className="w-6 h-6 text-blue-600" /></div><div><p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Active Projects</p><p className="text-2xl font-bold text-foreground mt-0.5">23</p><p className="text-xs text-emerald-600 font-medium mt-0.5 flex items-center gap-1"><ArrowUpRight className="w-3 h-3" /> +3 this quarter</p></div></CardContent></Card>
              <Card><CardContent className="flex items-center gap-4 py-5"><div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0"><DollarSign className="w-6 h-6 text-emerald-600" /></div><div><p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Total Budget</p><p className="text-2xl font-bold text-foreground mt-0.5">LKR 485M</p><p className="text-xs text-muted-foreground mt-0.5">Across all active projects</p></div></CardContent></Card>
              <Card><CardContent className="flex items-center gap-4 py-5"><div className="w-12 h-12 rounded-xl bg-rose-500/10 flex items-center justify-center shrink-0"><TrendingDown className="w-6 h-6 text-rose-600" /></div><div><p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Actual Spend</p><p className="text-2xl font-bold text-foreground mt-0.5">LKR 312M</p><p className="text-xs text-rose-600 font-medium mt-0.5 flex items-center gap-1"><ArrowDownRight className="w-3 h-3" /> 64.3% utilized</p></div></CardContent></Card>
              <Card><CardContent className="flex items-center gap-4 py-5"><div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center shrink-0"><Clock className="w-6 h-6 text-amber-600" /></div><div><p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Schedule Variance</p><p className="text-2xl font-bold text-foreground mt-0.5">-8.2%</p><p className="text-xs text-amber-600 font-medium mt-0.5">5 projects delayed</p></div></CardContent></Card>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6 md:mb-8">
              <Card>
                <CardHeader><CardTitle className="text-sm font-bold flex items-center gap-2"><span className="w-1.5 h-4 bg-blue-500 rounded-full" /> Project Status Distribution</CardTitle></CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {statusData.map((item) => (
                      <div key={item.label}>
                        <div className="flex items-center justify-between text-sm mb-1">
                          <span className="font-medium text-foreground">{item.label}</span>
                          <span className="text-muted-foreground">{item.count} projects</span>
                        </div>
                        <div className="w-full h-2.5 bg-muted rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${item.color} transition-all duration-700`} style={{ width: item.width }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle className="text-sm font-bold flex items-center gap-2"><span className="w-1.5 h-4 bg-rose-500 rounded-full" /> Top Delayed Projects</CardTitle></CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {delayedProjects.map((project, i) => (
                      <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border border-border/40">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-foreground truncate">{project.name}</p>
                          <div className="flex items-center gap-3 mt-1">
                            <span className="text-xs text-muted-foreground"><Clock className="w-3 h-3 inline mr-1" />{project.delay} days delayed</span>
                            <span className="text-xs text-muted-foreground">{project.progress}% complete</span>
                          </div>
                        </div>
                        {delayBadge(project.status)}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
            <Card>
              <CardHeader><CardTitle className="text-sm font-bold flex items-center gap-2"><span className="w-1.5 h-4 bg-indigo-500 rounded-full" /> Recent Activities</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-1">
                  {recentActivities.map((activity, i) => (
                    <div key={i} className="flex items-start gap-3 py-3 border-b border-border/40 last:border-0">
                      <div className="mt-0.5 shrink-0">{activityIcon(activity.type)}</div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-foreground"><span className="font-semibold">{activity.user}</span> {activity.action} <span className="font-medium text-primary">{activity.target}</span></p>
                        <p className="text-xs text-muted-foreground mt-0.5">{activity.time}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
