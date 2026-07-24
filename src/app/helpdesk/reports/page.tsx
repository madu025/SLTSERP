"use client";

import React, { useEffect, useState } from "react";
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid
} from 'recharts';
import { BarChart3, TrendingUp, AlertTriangle, ShieldCheck, Clock } from "lucide-react";
import { toast } from "sonner";

interface HelpdeskReports {
  counts: {
    open: number;
    inProgress: number;
    waiting: number;
    resolved: number;
    critical: number;
    total: number;
  };
  engineerWorkload: Array<{
    engineerId: string;
    engineerName: string;
    activeTickets: number;
  }>;
  failureFrequency: Array<{
    brand: string;
    model: string;
    deviceType: string;
    failures: number;
  }>;
  ticketsByDepartment: Array<{
    name: string;
    value: number;
  }>;
  commonIssues: Array<{
    category: string;
    count: number;
  }>;
}

export default function HelpdeskReportsPage() {
  const [mounted, setMounted] = useState(false);
  const [reportData, setReportData] = useState<HelpdeskReports | null>(null);
  const [loading, setLoading] = useState(true);

  const COLORS = ['#6366f1', '#a855f7', '#ec4899', '#f43f5e', '#eab308', '#22c55e', '#06b6d4', '#3b82f6'];

  useEffect(() => {
    setMounted(true);
  }, []);

  const fetchReports = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/helpdesk/reports?_t=${Date.now()}`);
      if (!res.ok) throw new Error("Failed to fetch reports");
      const json = await res.json();
      if (json.success) {
        setReportData(json.data);
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to load helpdesk metrics");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (mounted) {
      fetchReports();
    }
  }, [mounted]);

  if (!mounted) return null;

  const ticketsByDept = reportData?.ticketsByDepartment || [];
  const engineerWorkload = reportData?.engineerWorkload || [];
  const failureFrequency = reportData?.failureFrequency || [];
  const commonIssues = reportData?.commonIssues || [];
  const counts = reportData?.counts || { open: 0, inProgress: 0, waiting: 0, resolved: 0, critical: 0, total: 0 };

  return (
    <div className="min-h-screen flex bg-background text-foreground animate-fade-in">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Header />
        <main className="flex-grow p-4 md:p-6 overflow-y-auto max-w-[1600px] mx-auto w-full space-y-6">
          {/* Header */}
          <div className="bg-card/70 backdrop-blur-md p-4 rounded-xl border border-border/50 shadow-sm flex items-center gap-3">
            <div className="bg-primary/10 text-primary p-2.5 rounded-lg">
              <BarChart3 className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-base font-extrabold text-foreground">ITSM Analytics & Performance Reports</h1>
              <p className="text-[10px] text-muted-foreground">Monitor equipment fail-rates, IT support caseloads, and response speed KPIs.</p>
            </div>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-80 bg-card rounded-xl animate-pulse border border-border/30" />
              ))}
            </div>
          ) : (
            <div className="space-y-6 text-xs">
              
              {/* Summary KPIs Row */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card className="bg-card/75 border-border/40">
                  <CardHeader className="p-4 pb-1">
                    <CardDescription className="text-[9px] uppercase font-bold tracking-wider flex items-center gap-1">
                      <TrendingUp className="h-3.5 w-3.5 text-indigo-500" />
                      Total Tickets Raised
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-4 pt-0">
                    <div className="text-2xl font-black text-foreground">{counts.total}</div>
                  </CardContent>
                </Card>

                <Card className="bg-card/75 border-border/40">
                  <CardHeader className="p-4 pb-1">
                    <CardDescription className="text-[9px] uppercase font-bold tracking-wider flex items-center gap-1 text-red-500">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      Critical Blockers
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-4 pt-0">
                    <div className="text-2xl font-black text-red-500">{counts.critical}</div>
                  </CardContent>
                </Card>

                <Card className="bg-card/75 border-border/40">
                  <CardHeader className="p-4 pb-1">
                    <CardDescription className="text-[9px] uppercase font-bold tracking-wider flex items-center gap-1 text-emerald-500">
                      <ShieldCheck className="h-3.5 w-3.5" />
                      Resolved Tickets
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-4 pt-0">
                    <div className="text-2xl font-black text-emerald-500">{counts.resolved}</div>
                  </CardContent>
                </Card>

                <Card className="bg-card/75 border-border/40">
                  <CardHeader className="p-4 pb-1">
                    <CardDescription className="text-[9px] uppercase font-bold tracking-wider flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5 text-sky-500" />
                      Active Queue Size
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-4 pt-0">
                    <div className="text-2xl font-black text-sky-500">
                      {counts.open + counts.inProgress + counts.waiting}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Charts Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* 1. Incident Breakdown by Department */}
                <Card className="bg-card/85 backdrop-blur-md border-border/40 shadow-md">
                  <CardHeader className="p-4 pb-2 border-b border-border/30">
                    <CardTitle className="text-xs font-bold uppercase tracking-wider text-foreground">Incident Volume by Department</CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 flex items-center justify-center h-72 w-full min-w-0">
                    {ticketsByDept.length === 0 ? (
                      <span className="text-muted-foreground italic">No data logged.</span>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                        <PieChart>
                          <Pie
                            data={ticketsByDept}
                            cx="50%"
                            cy="50%"
                            innerRadius={50}
                            outerRadius={80}
                            paddingAngle={3}
                            dataKey="value"
                          >
                            {ticketsByDept.map((entry: { name: string; value: number }, index: number) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip contentStyle={{ fontSize: '10px', borderRadius: '4px', backgroundColor: 'var(--card)' }} />
                          <Legend wrapperStyle={{ fontSize: '10px' }} />
                        </PieChart>
                      </ResponsiveContainer>
                    )}
                  </CardContent>
                </Card>

                {/* 2. Device Failure Frequency */}
                <Card className="bg-card/85 backdrop-blur-md border-border/40 shadow-md">
                  <CardHeader className="p-4 pb-2 border-b border-border/30">
                    <CardTitle className="text-xs font-bold uppercase tracking-wider text-foreground">Top Failing Hardware Models</CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 h-72 w-full min-w-0">
                    {failureFrequency.length === 0 ? (
                      <div className="h-full flex items-center justify-center text-muted-foreground italic">No hardware failures logged.</div>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                        <BarChart data={failureFrequency}>
                          <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                          <XAxis dataKey="model" tick={{ fontSize: 9 }} />
                          <YAxis tick={{ fontSize: 9 }} allowDecimals={false} />
                          <Tooltip contentStyle={{ fontSize: '10px', borderRadius: '4px', backgroundColor: 'var(--card)' }} />
                          <Bar dataKey="failures" fill="#8884d8" radius={[4, 4, 0, 0]}>
                            {failureFrequency.map((entry: { brand: string; model: string; deviceType: string; failures: number }, index: number) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </CardContent>
                </Card>

                {/* 3. Engineer Active Workloads */}
                <Card className="bg-card/85 backdrop-blur-md border-border/40 shadow-md">
                  <CardHeader className="p-4 pb-2 border-b border-border/30">
                    <CardTitle className="text-xs font-bold uppercase tracking-wider text-foreground">Engineer Caseload Workload</CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 h-72 w-full min-w-0">
                    {engineerWorkload.length === 0 ? (
                      <div className="h-full flex items-center justify-center text-muted-foreground italic">No active support agents assigned.</div>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                        <BarChart data={engineerWorkload} layout="vertical">
                          <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                          <XAxis type="number" tick={{ fontSize: 9 }} allowDecimals={false} />
                          <YAxis dataKey="engineerName" type="category" tick={{ fontSize: 9 }} width={80} />
                          <Tooltip contentStyle={{ fontSize: '10px', borderRadius: '4px', backgroundColor: 'var(--card)' }} />
                          <Bar dataKey="activeTickets" fill="#10b981" radius={[0, 4, 4, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </CardContent>
                </Card>

                {/* 4. Common Issues */}
                <Card className="bg-card/85 backdrop-blur-md border-border/40 shadow-md">
                  <CardHeader className="p-4 pb-2 border-b border-border/30">
                    <CardTitle className="text-xs font-bold uppercase tracking-wider text-foreground">Incidents Category Breakdown</CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 h-72 w-full min-w-0">
                    {commonIssues.length === 0 ? (
                      <div className="h-full flex items-center justify-center text-muted-foreground italic">No category metrics available.</div>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                        <BarChart data={commonIssues}>
                          <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                          <XAxis dataKey="category" tick={{ fontSize: 8 }} />
                          <YAxis tick={{ fontSize: 9 }} allowDecimals={false} />
                          <Tooltip contentStyle={{ fontSize: '10px', borderRadius: '4px', backgroundColor: 'var(--card)' }} />
                          <Bar dataKey="count" fill="#ec4899" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </CardContent>
                </Card>

              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
