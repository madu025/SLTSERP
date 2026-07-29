import { ROLE_GROUPS } from '@/config/roles';
"use client";

import React, { useEffect, useState, useCallback } from "react";
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import RoleGuard from "@/components/RoleGuard";
import { Button } from "@/components/ui/button";
import {
  Activity,
  Laptop,
  ShieldCheck,
  Zap,
  RefreshCw,
  Search,
  Wifi,
  HardDrive
} from "lucide-react";
import { toast } from "sonner";

interface TelemetryDevice {
  id: string;
  assetTag: string;
  serialNumber: string;
  deviceName: string;
  deviceType: string;
  mdmDeviceId?: string | null;
  dataPlanLimit?: number | null;
  updatedAt: string;
  assignedUser?: { id: string; name: string; email: string } | null;
  siteOffice?: { id: string; name: string; code: string } | null;
}

interface TelemetryStats {
  totalRegistered: number;
  mdmActive: number;
  unregistered: number;
}

export default function TelemetryDashboardPage() {
  const [mounted, setMounted] = useState(false);
  const [devices, setDevices] = useState<TelemetryDevice[]>([]);
  const [stats, setStats] = useState<TelemetryStats>({
    totalRegistered: 0,
    mdmActive: 0,
    unregistered: 0
  });

  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    setMounted(true);
  }, []);

  const fetchTelemetry = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/helpdesk/agent/telemetry?_t=${Date.now()}`, {
        cache: "no-store",
        headers: {
          "Pragma": "no-cache",
          "Cache-Control": "no-cache"
        }
      });
      if (!res.ok) throw new Error("Failed to load telemetry");
      const json = await res.json();
      if (json.success) {
        setDevices(json.data.devices || []);
        setStats(json.data.stats || { totalRegistered: 0, mdmActive: 0, unregistered: 0 });
      }
    } catch (err) {
      console.error(err);
      toast.error("Error loading agent telemetry");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (mounted) {
      fetchTelemetry();
    }
  }, [mounted, fetchTelemetry]);

  const filteredDevices = devices.filter(
    (d) =>
      d.deviceName.toLowerCase().includes(search.toLowerCase()) ||
      d.serialNumber.toLowerCase().includes(search.toLowerCase()) ||
      d.assetTag.toLowerCase().includes(search.toLowerCase()) ||
      (d.assignedUser?.name || "").toLowerCase().includes(search.toLowerCase())
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
                <div className="p-2.5 bg-emerald-500/10 text-emerald-600 rounded-xl">
                  <Activity className="w-6 h-6" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                    Live Device Telemetry & MDM Agent
                  </h1>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                    High-speed Redis buffered telemetry ingestion feed & hardware health monitor
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Button
                  onClick={fetchTelemetry}
                  variant="outline"
                  size="sm"
                  className="gap-2 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700"
                >
                  <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
                  Refresh Agent Feed
                </Button>
              </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 shadow-sm">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Total Active IT Hardware
                    </p>
                    <h3 className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                      {stats.totalRegistered}
                    </h3>
                  </div>
                  <div className="p-2 bg-slate-500/10 text-slate-600 dark:text-slate-300 rounded-xl">
                    <Laptop className="w-5 h-5" />
                  </div>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-3">
                  Laptops, Desktops & Mobile Units
                </p>
              </div>

              <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 shadow-sm">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      MDM Agent Enrolled
                    </p>
                    <h3 className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                      {stats.mdmActive}
                    </h3>
                  </div>
                  <div className="p-2 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-xl">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-3">
                  Secured & Monitored Active Pings
                </p>
              </div>

              <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 shadow-sm">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Redis Pipeline Buffer
                    </p>
                    <h3 className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-1">
                      ACTIVE (O(1))
                    </h3>
                  </div>
                  <div className="p-2 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-xl">
                    <Zap className="w-5 h-5" />
                  </div>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-3">
                  Zero Postgres write-load lag
                </p>
              </div>
            </div>

            {/* Search */}
            <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 shadow-sm">
              <div className="relative w-full sm:w-80">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search device, S/N, or assigned staff..."
                  className="w-full pl-9 pr-4 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>
            </div>

            {/* Telemetry Devices Table */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-600 dark:text-slate-300">
                  <thead className="bg-slate-50 dark:bg-slate-900/50 text-xs uppercase font-semibold text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
                    <tr>
                      <th className="px-6 py-4">Hardware Device</th>
                      <th className="px-6 py-4">Assigned User</th>
                      <th className="px-6 py-4">MDM Device ID</th>
                      <th className="px-6 py-4">Data Plan Limit</th>
                      <th className="px-6 py-4">Site Office</th>
                      <th className="px-6 py-4 text-right">Last Telemetry Ping</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-700/60">
                    {loading ? (
                      <tr>
                        <td colSpan={6} className="px-6 py-12 text-center text-slate-400">
                          <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-500" />
                          Ingesting active telemetry data...
                        </td>
                      </tr>
                    ) : filteredDevices.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-6 py-12 text-center text-slate-400">
                          No hardware devices matched your search.
                        </td>
                      </tr>
                    ) : (
                      filteredDevices.map((dev) => (
                        <tr key={dev.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/60 transition-colors">
                          <td className="px-6 py-4">
                            <div className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                              <Laptop className="w-4 h-4 text-slate-400" />
                              {dev.deviceName}
                            </div>
                            <div className="text-xs text-slate-500 font-mono mt-0.5">
                              {dev.assetTag} • S/N: {dev.serialNumber}
                            </div>
                          </td>

                          <td className="px-6 py-4">
                            {dev.assignedUser ? (
                              <div>
                                <div className="font-medium text-slate-800 dark:text-slate-200">
                                  {dev.assignedUser.name}
                                </div>
                                <div className="text-xs text-slate-400">{dev.assignedUser.email}</div>
                              </div>
                            ) : (
                              <span className="text-xs text-slate-400 italic">Unassigned (Spare)</span>
                            )}
                          </td>

                          <td className="px-6 py-4 font-mono text-xs">
                            {dev.mdmDeviceId ? (
                              <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">
                                <ShieldCheck className="w-3 h-3" />
                                {dev.mdmDeviceId}
                              </span>
                            ) : (
                              <span className="text-slate-400 italic">Unenrolled</span>
                            )}
                          </td>

                          <td className="px-6 py-4 text-xs font-mono">
                            {dev.dataPlanLimit ? (
                              <span className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 font-medium">
                                <Wifi className="w-3 h-3" /> {dev.dataPlanLimit} GB / mo
                              </span>
                            ) : (
                              <span className="text-slate-400">Unlimited / Local</span>
                            )}
                          </td>

                          <td className="px-6 py-4 text-xs">
                            {dev.siteOffice ? (
                              <span className="font-medium text-slate-700 dark:text-slate-300">
                                {dev.siteOffice.name} ({dev.siteOffice.code})
                              </span>
                            ) : (
                              <span className="text-slate-400">HQ / Central</span>
                            )}
                          </td>

                          <td className="px-6 py-4 text-right text-xs font-mono text-slate-500">
                            {new Date(dev.updatedAt).toLocaleString()}
                          </td>
                        </tr>
                      ))
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
