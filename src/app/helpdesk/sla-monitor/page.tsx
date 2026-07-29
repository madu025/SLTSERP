import { ROLE_GROUPS } from '@/config/roles';
"use client";

import React, { useEffect, useState, useCallback } from "react";
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import RoleGuard from "@/components/RoleGuard";
import { Button } from "@/components/ui/button";
import {
  Clock,
  AlertOctagon,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Search,
  ShieldAlert,
  Flame,
  LifeBuoy
} from "lucide-react";
import { toast } from "sonner";

interface SLATicket {
  id: string;
  ticketNumber: string;
  subject: string;
  priority: string;
  status: string;
  slaResponseDeadline?: string | null;
  slaResolutionDeadline?: string | null;
  slaResponseBreached: boolean;
  slaResolutionBreached: boolean;
  createdAt: string;
  assignedTo?: { id: string; name: string; email: string } | null;
  createdForUser?: { id: string; name: string; email: string } | null;
}

interface SLAStats {
  totalActive: number;
  responseBreaches: number;
  resolutionBreaches: number;
  complianceRate: number;
}

export default function SLAMonitoringPage() {
  const [mounted, setMounted] = useState(false);
  const [tickets, setTickets] = useState<SLATicket[]>([]);
  const [stats, setStats] = useState<SLAStats>({
    totalActive: 0,
    responseBreaches: 0,
    resolutionBreaches: 0,
    complianceRate: 100
  });

  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    setMounted(true);
  }, []);

  const fetchSLAMonitorData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/helpdesk/sla?_t=${Date.now()}`, {
        cache: "no-store",
        headers: {
          "Pragma": "no-cache",
          "Cache-Control": "no-cache"
        }
      });
      if (!res.ok) throw new Error("Failed to fetch SLA data");
      const json = await res.json();
      if (json.success) {
        setTickets(json.data.tickets || []);
        setStats(json.data.stats || {
          totalActive: 0,
          responseBreaches: 0,
          resolutionBreaches: 0,
          complianceRate: 100
        });
      }
    } catch (err) {
      console.error(err);
      toast.error("Error loading SLA monitoring feed");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (mounted) {
      fetchSLAMonitorData();
    }
  }, [mounted, fetchSLAMonitorData]);

  const filteredTickets = tickets.filter(
    (t) =>
      t.ticketNumber.toLowerCase().includes(search.toLowerCase()) ||
      t.subject.toLowerCase().includes(search.toLowerCase()) ||
      (t.assignedTo?.name || "").toLowerCase().includes(search.toLowerCase())
  );

  if (!mounted) return null;

  return (
    <RoleGuard allowedRoles={ROLE_GROUPS.PROJECT_MANAGERS}>
      <div className="flex h-screen bg-slate-50 dark:bg-slate-900 overflow-hidden font-sans">
        <Sidebar />
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <Header />
          <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 space-y-6">
            {/* Header Banner */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-amber-500/10 text-amber-600 rounded-xl">
                  <Clock className="w-6 h-6" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                    SLA Compliance & Breach Monitoring
                  </h1>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                    Real-time Response & Resolution deadline tracker backed by BullMQ background workers
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Button
                  onClick={fetchSLAMonitorData}
                  variant="outline"
                  size="sm"
                  className="gap-2 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700"
                >
                  <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
                  Refresh Queue
                </Button>
              </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 shadow-sm">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Active SLA Tickets
                    </p>
                    <h3 className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                      {stats.totalActive}
                    </h3>
                  </div>
                  <div className="p-2 bg-slate-500/10 text-slate-600 dark:text-slate-300 rounded-xl">
                    <LifeBuoy className="w-5 h-5" />
                  </div>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-3">
                  OPEN & IN_PROGRESS status
                </p>
              </div>

              <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 shadow-sm">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Response Breaches
                    </p>
                    <h3 className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1">
                      {stats.responseBreaches}
                    </h3>
                  </div>
                  <div className="p-2 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-xl">
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-3">
                  Initial response deadline missed
                </p>
              </div>

              <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 shadow-sm">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Resolution Breaches
                    </p>
                    <h3 className="text-2xl font-bold text-rose-600 dark:text-rose-400 mt-1">
                      {stats.resolutionBreaches}
                    </h3>
                  </div>
                  <div className="p-2 bg-rose-500/10 text-rose-600 dark:text-rose-400 rounded-xl">
                    <AlertOctagon className="w-5 h-5" />
                  </div>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-3">
                  Resolution deadline exceeded
                </p>
              </div>

              <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 shadow-sm">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      SLA Compliance Rate
                    </p>
                    <h3 className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                      {stats.complianceRate}%
                    </h3>
                  </div>
                  <div className="p-2 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-xl">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-3">
                  Target SLA Benchmark: &gt; 95%
                </p>
              </div>
            </div>

            {/* Search Bar */}
            <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 shadow-sm">
              <div className="relative w-full sm:w-80">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search ticket #, subject, assignee..."
                  className="w-full pl-9 pr-4 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                />
              </div>
            </div>

            {/* SLA Table */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-600 dark:text-slate-300">
                  <thead className="bg-slate-50 dark:bg-slate-900/50 text-xs uppercase font-semibold text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
                    <tr>
                      <th className="px-6 py-4">Ticket</th>
                      <th className="px-6 py-4">Priority</th>
                      <th className="px-6 py-4">Assignee</th>
                      <th className="px-6 py-4">Response SLA</th>
                      <th className="px-6 py-4">Resolution SLA</th>
                      <th className="px-6 py-4 text-right">Escalation Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-700/60">
                    {loading ? (
                      <tr>
                        <td colSpan={6} className="px-6 py-12 text-center text-slate-400">
                          <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-amber-500" />
                          Checking active SLA queues...
                        </td>
                      </tr>
                    ) : filteredTickets.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-6 py-12 text-center text-slate-400">
                          No active tickets in SLA queue.
                        </td>
                      </tr>
                    ) : (
                      filteredTickets.map((t) => {
                        const isRespBreached = t.slaResponseBreached;
                        const isResBreached = t.slaResolutionBreached;

                        return (
                          <tr key={t.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/60 transition-colors">
                            <td className="px-6 py-4">
                              <div className="font-semibold text-slate-900 dark:text-white font-mono">
                                #{t.ticketNumber}
                              </div>
                              <div className="text-xs text-slate-500 line-clamp-1 mt-0.5">
                                {t.subject}
                              </div>
                            </td>

                            <td className="px-6 py-4">
                              <span
                                className={`inline-flex items-center px-2.5 py-0.5 rounded text-xs font-bold ${
                                  t.priority === "URGENT" || t.priority === "HIGH"
                                    ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20"
                                    : "bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300"
                                }`}
                              >
                                {t.priority}
                              </span>
                            </td>

                            <td className="px-6 py-4">
                              {t.assignedTo ? (
                                <div className="font-medium text-slate-800 dark:text-slate-200">
                                  {t.assignedTo.name}
                                </div>
                              ) : (
                                <span className="text-xs text-amber-500 italic font-semibold">Unassigned</span>
                              )}
                            </td>

                            <td className="px-6 py-4 text-xs font-mono">
                              {isRespBreached ? (
                                <span className="inline-flex items-center gap-1 text-rose-600 dark:text-rose-400 font-bold bg-rose-50 dark:bg-rose-950/40 px-2 py-0.5 rounded border border-rose-200 dark:border-rose-800">
                                  <AlertTriangle className="w-3 h-3" /> BREACHED
                                </span>
                              ) : (
                                <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                                  {t.slaResponseDeadline ? new Date(t.slaResponseDeadline).toLocaleTimeString() : "OK"}
                                </span>
                              )}
                            </td>

                            <td className="px-6 py-4 text-xs font-mono">
                              {isResBreached ? (
                                <span className="inline-flex items-center gap-1 text-rose-600 dark:text-rose-400 font-bold bg-rose-50 dark:bg-rose-950/40 px-2 py-0.5 rounded border border-rose-200 dark:border-rose-800">
                                  <AlertOctagon className="w-3 h-3" /> BREACHED
                                </span>
                              ) : (
                                <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                                  {t.slaResolutionDeadline ? new Date(t.slaResolutionDeadline).toLocaleTimeString() : "OK"}
                                </span>
                              )}
                            </td>

                            <td className="px-6 py-4 text-right text-xs">
                              {isRespBreached || isResBreached ? (
                                <span className="inline-flex items-center gap-1 text-rose-600 dark:text-rose-400 font-bold">
                                  <Flame className="w-3.5 h-3.5 text-rose-500 animate-pulse" />
                                  L2 Escalated
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                                  <CheckCircle2 className="w-3 h-3" /> Healthy
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </main>
        </div>
      </div>
    </RoleGuard>
  );
}
