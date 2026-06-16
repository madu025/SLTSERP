"use client";

import React, { useEffect, useMemo, useState } from "react";
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowDownRight, ArrowUpRight, Activity, AlertTriangle, CheckCircle2, Clock, DollarSign, FolderKanban, TrendingDown } from "lucide-react";

type StatusEntry = {
  status: string;
  count: number;
};

type ProjectOverview = {
  activeProjects: number;
  totalBudget: number;
  actualSpend: number;
  scheduleVariance: number;
  delayedCount: number;
};

type DelayedProject = {
  name: string;
  delay: number;
  progress: number;
  status: string;
};

type ActivityEntry = {
  user: string;
  action: string;
  target: string;
  time: string;
  type: "approval" | "alert" | "completion" | "upload" | "creation";
};

const STATUS_COLOR_MAP: Record<string, string> = {
  PLANNING: "bg-yellow-500",
  APPROVED: "bg-blue-500",
  IN_PROGRESS: "bg-emerald-500",
  ON_HOLD: "bg-orange-500",
  COMPLETED: "bg-emerald-500",
  CANCELLED: "bg-red-500"
};

const statusLabel = (status: string) => status.replace("_", " ");

const activityIcon = (type: ActivityEntry["type"]) => {
  switch (type) {
    case "approval":
      return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
    case "alert":
      return <AlertTriangle className="w-4 h-4 text-red-500" />;
    case "completion":
      return <CheckCircle2 className="w-4 h-4 text-blue-500" />;
    case "upload":
      return <ArrowUpRight className="w-4 h-4 text-purple-500" />;
    case "creation":
      return <FolderKanban className="w-4 h-4 text-indigo-500" />;
    default:
      return <Activity className="w-4 h-4 text-slate-400" />;
  }
};

const delayBadge = (status: string) => {
  const map: Record<string, { variant: "destructive" | "secondary" | "outline"; label: string }> = {
    Critical: { variant: "destructive", label: "Critical" },
    Warning: { variant: "secondary", label: "Warning" },
    Normal: { variant: "outline", label: "On Track" }
  };
  return <Badge variant={map[status]?.variant || "outline"}>{map[status]?.label || status}</Badge>;
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("en-LK", { style: "currency", currency: "LKR", minimumFractionDigits: 0 }).format(value);

export default function PMDashboardPage() {
  const [overview, setOverview] = useState<ProjectOverview | null>(null);
  const [statusBreakdown, setStatusBreakdown] = useState<StatusEntry[]>([]);
  const [delayedProjects, setDelayedProjects] = useState<DelayedProject[]>([]);
  const [recentActivities, setRecentActivities] = useState<ActivityEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/dashboard/projects");
        if (!res.ok) throw new Error("Failed to load stats");
        const data = await res.json();
        setOverview(data.overview);
        setStatusBreakdown(data.statusBreakdown ?? []);
        setDelayedProjects(data.delayedProjects ?? []);
        setRecentActivities(data.recentActivities ?? []);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  const totalStatusCount = useMemo(() => statusBreakdown.reduce((sum, entry) => sum + entry.count, 0) || 1, [statusBreakdown]);

  const statusCards = statusBreakdown.map((entry) => {
    const width = Math.min(100, (entry.count / totalStatusCount) * 100);
    return {
      label: statusLabel(entry.status),
      count: entry.count,
      width,
      color: STATUS_COLOR_MAP[entry.status] || "bg-slate-400"
    };
  });

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
                <p className="text-sm text-muted-foreground mt-1">Live project oversight & performance summary</p>
              </div>
              <Button variant="outline" size="sm" className="gap-2" disabled>
                <Clock className="w-4 h-4" />
                Last updated: Today
              </Button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-6 md:mb-8">
              <Card>
                <CardContent className="flex items-center gap-4 py-5">
                  <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center shrink-0">
                    <FolderKanban className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Active Projects</p>
                    <p className="text-2xl font-bold text-foreground mt-0.5">{overview ? overview.activeProjects : '-'}</p>
                    <p className="text-xs text-emerald-600 font-medium mt-0.5 flex items-center gap-1">
                      <ArrowUpRight className="w-3 h-3" />
                      {overview ? `${overview.delayedCount} delayed` : 'Loading...'}
                    </p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="flex items-center gap-4 py-5">
                  <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0">
                    <DollarSign className="w-6 h-6 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Total Budget</p>
                    <p className="text-2xl font-bold text-foreground mt-0.5">{overview ? formatCurrency(overview.totalBudget) : '-'}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Across all projects</p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="flex items-center gap-4 py-5">
                  <div className="w-12 h-12 rounded-xl bg-rose-500/10 flex items-center justify-center shrink-0">
                    <TrendingDown className="w-6 h-6 text-rose-600" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Actual Spend</p>
                    <p className="text-2xl font-bold text-foreground mt-0.5">{overview ? formatCurrency(overview.actualSpend) : '-'}</p>
                    <p className="text-xs text-rose-600 font-medium mt-0.5 flex items-center gap-1">
                      <ArrowDownRight className="w-3 h-3" />
                      {overview ? `${Math.round((overview.actualSpend / Math.max(1, overview.totalBudget)) * 100)}% utilized` : 'Loading...'}
                    </p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="flex items-center gap-4 py-5">
                  <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center shrink-0">
                    <Clock className="w-6 h-6 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Schedule Variance</p>
                    <p className="text-2xl font-bold text-foreground mt-0.5">{overview ? `${overview.scheduleVariance}%` : '-'}</p>
                    <p className="text-xs text-amber-600 font-medium mt-0.5">{overview ? `${overview.delayedCount} delayed` : 'Loading...'}</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6 md:mb-8">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-bold flex items-center gap-2">
                    <span className="w-1.5 h-4 bg-blue-500 rounded-full" /> Project Status Distribution
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {statusCards.map((item) => (
                      <div key={item.label}>
                        <div className="flex items-center justify-between text-sm mb-1">
                          <span className="font-medium text-foreground">{item.label}</span>
                          <span className="text-muted-foreground">{item.count} projects</span>
                        </div>
                        <div className="w-full h-2.5 bg-muted rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${item.color} transition-all duration-700`} style={{ width: `${item.width}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-bold flex items-center gap-2">
                    <span className="w-1.5 h-4 bg-rose-500 rounded-full" /> Top Delayed Projects
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {loading
                      ? "Loading delayed projects..."
                      : delayedProjects.length === 0
                        ? "No delayed projects"
                        : delayedProjects.map((project, i) => (
                            <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border border-border/40">
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-semibold text-foreground truncate">{project.name}</p>
                                <div className="flex items-center gap-3 mt-1">
                                  <span className="text-xs text-muted-foreground">
                                    <Clock className="w-3 h-3 inline mr-1" />
                                    {project.delay} days delayed
                                  </span>
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
              <CardHeader>
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <span className="w-1.5 h-4 bg-indigo-500 rounded-full" /> Recent Activities
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-1">
                  {loading
                    ? "Loading activities..."
                    : recentActivities.map((activity, i) => (
                        <div key={i} className="flex items-start gap-3 py-3 border-b border-border/40 last:border-0">
                          <div className="mt-0.5 shrink-0">{activityIcon(activity.type)}</div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-foreground">
                              <span className="font-semibold">{activity.user}</span> {activity.action}{' '}
                              <span className="font-medium text-primary">{activity.target}</span>
                            </p>
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
