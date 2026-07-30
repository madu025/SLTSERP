"use client";
import { ROLE_GROUPS } from '@/config/roles';

import React, { useEffect, useState, useCallback } from "react";
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import RoleGuard from "@/components/RoleGuard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Trash2,
  CheckCircle2,
  XCircle,
  Clock,
  DollarSign,
  AlertTriangle,
  ShieldCheck,
  Plus,
  RefreshCw,
  Search,
  Filter,
  Package
} from "lucide-react";
import { toast } from "sonner";

interface AssetSummary {
  id: string;
  assetTag: string;
  serialNumber: string;
  deviceName: string;
  deviceType: string;
  purchaseCost?: number | null;
  status: string;
}

interface UserSummary {
  id: string;
  name: string;
  email: string;
  role?: string;
}

interface DisposalRequest {
  id: string;
  assetId: string;
  requestedById: string;
  approvedById?: string | null;
  reason: "EXPIRED" | "DAMAGED" | "OBSOLETE" | "LOST";
  salvageValue: number;
  status: "PENDING" | "APPROVED" | "REJECTED";
  createdAt: string;
  updatedAt: string;
  asset: AssetSummary;
  requestedBy: UserSummary;
  approvedBy?: UserSummary | null;
}

interface StatsSummary {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  totalSalvage: number;
}

export default function AssetDisposalsPage() {
  const [mounted, setMounted] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const [requests, setRequests] = useState<DisposalRequest[]>([]);
  const [stats, setStats] = useState<StatsSummary>({
    total: 0,
    pending: 0,
    approved: 0,
    rejected: 0,
    totalSalvage: 0
  });

  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  // Modal State
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [availableAssets, setAvailableAssets] = useState<AssetSummary[]>([]);
  const [selectedAssetId, setSelectedAssetId] = useState("");
  const [reason, setReason] = useState<"EXPIRED" | "DAMAGED" | "OBSOLETE" | "LOST">("DAMAGED");
  const [salvageValue, setSalvageValue] = useState<number>(0);
  const [submitting, setSubmitting] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
    const storedUser = localStorage.getItem("user");
    if (storedUser) {
      try {
        const u = JSON.parse(storedUser);
        setCurrentUserId(u.id);
      } catch (e) {
        console.error("Failed to parse stored user", e);
      }
    }
  }, []);

  const fetchDisposalRequests = useCallback(async () => {
    setLoading(true);
    try {
      const query = new URLSearchParams();
      if (statusFilter !== "ALL") query.append("status", statusFilter);
      if (search) query.append("search", search);
      query.append("_t", Date.now().toString());

      const res = await fetch(`/api/helpdesk/disposal?${query.toString()}`, {
        cache: "no-store",
        headers: {
          "Pragma": "no-cache",
          "Cache-Control": "no-cache"
        }
      });

      if (!res.ok) throw new Error("Failed to load disposal records");
      const json = await res.json();
      if (json.success) {
        setRequests(json.data.requests || []);
        setStats(json.data.stats || { total: 0, pending: 0, approved: 0, rejected: 0, totalSalvage: 0 });
      }
    } catch (err) {
      console.error(err);
      toast.error("Error loading disposal requests");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, search]);

  const fetchAvailableAssets = async () => {
    try {
      const res = await fetch(`/api/helpdesk/assets?limit=100&status=ACTIVE&_t=${Date.now()}`);
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data.assets) {
          setAvailableAssets(json.data.assets);
        }
      }
    } catch (err) {
      console.error("Error fetching assets for disposal modal", err);
    }
  };

  useEffect(() => {
    if (mounted) {
      fetchDisposalRequests();
    }
  }, [mounted, fetchDisposalRequests]);

  const handleOpenCreateModal = () => {
    fetchAvailableAssets();
    setIsCreateOpen(true);
  };

  const handleCreateRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAssetId) {
      toast.error("Please select an asset to dispose");
      return;
    }
    if (!currentUserId) {
      toast.error("Session expired. Please log in again.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/helpdesk/disposal", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": currentUserId
        },
        body: JSON.stringify({
          assetId: selectedAssetId,
          reason,
          salvageValue: Number(salvageValue) || 0
        })
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || "Failed to create request");
      }

      toast.success("Disposal request submitted for approval");
      setIsCreateOpen(false);
      setSelectedAssetId("");
      setSalvageValue(0);
      fetchDisposalRequests();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to submit request";
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleApproveOrReject = async (requestId: string, action: "APPROVE" | "REJECT") => {
    if (!currentUserId) {
      toast.error("Session expired. Please log in again.");
      return;
    }

    setProcessingId(requestId);
    try {
      const res = await fetch("/api/helpdesk/disposal", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": currentUserId
        },
        body: JSON.stringify({ requestId, action })
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || `Failed to ${action.toLowerCase()} request`);
      }

      toast.success(`Request successfully ${action === "APPROVE" ? "Approved" : "Rejected"}`);
      fetchDisposalRequests();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Action failed";
      toast.error(message);
    } finally {
      setProcessingId(null);
    }
  };

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
              <div>
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-rose-500/10 text-rose-600 rounded-xl">
                    <Trash2 className="w-6 h-6" />
                  </div>
                  <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                      IT Asset Disposal & Write-Offs
                    </h1>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                      Enterprise Maker-Checker dual signature authorization workflow
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Button
                  onClick={fetchDisposalRequests}
                  variant="outline"
                  size="sm"
                  className="gap-2 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700"
                >
                  <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
                  Refresh
                </Button>

                <Button
                  onClick={handleOpenCreateModal}
                  size="sm"
                  className="gap-2 bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-700 hover:to-red-700 text-white shadow-md shadow-rose-500/20"
                >
                  <Plus className="w-4 h-4" />
                  Request Disposal (Maker)
                </Button>
              </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 shadow-sm relative overflow-hidden">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Pending Approvals
                    </p>
                    <h3 className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1">
                      {stats.pending}
                    </h3>
                  </div>
                  <div className="p-2 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-xl">
                    <Clock className="w-5 h-5" />
                  </div>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-3 flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-amber-500" />
                  Checker review required
                </p>
              </div>

              <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 shadow-sm">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Approved Disposals
                    </p>
                    <h3 className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                      {stats.approved}
                    </h3>
                  </div>
                  <div className="p-2 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-xl">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-3">
                  Status set to DISPOSED
                </p>
              </div>

              <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 shadow-sm">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Rejected Requests
                    </p>
                    <h3 className="text-2xl font-bold text-rose-600 dark:text-rose-400 mt-1">
                      {stats.rejected}
                    </h3>
                  </div>
                  <div className="p-2 bg-rose-500/10 text-rose-600 dark:text-rose-400 rounded-xl">
                    <XCircle className="w-5 h-5" />
                  </div>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-3">
                  Returned to asset pool
                </p>
              </div>

              <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 shadow-sm">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Total Salvage Recovered
                    </p>
                    <h3 className="text-2xl font-bold text-indigo-600 dark:text-indigo-400 mt-1">
                      LKR {stats.totalSalvage.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </h3>
                  </div>
                  <div className="p-2 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-xl">
                    <DollarSign className="w-5 h-5" />
                  </div>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-3">
                  Approved write-off revenue
                </p>
              </div>
            </div>

            {/* Filter & Search Bar */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 shadow-sm">
              <div className="relative w-full sm:w-80">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search tag, serial, requester..."
                  className="pl-9 bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700"
                />
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <Filter className="w-4 h-4 text-slate-400" />
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl font-medium text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-500/20"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="PENDING">Pending (Checker Queue)</option>
                  <option value="APPROVED">Approved</option>
                  <option value="REJECTED">Rejected</option>
                </select>
              </div>
            </div>

            {/* Disposal Requests Table */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-600 dark:text-slate-300">
                  <thead className="bg-slate-50 dark:bg-slate-900/50 text-xs uppercase font-semibold text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
                    <tr>
                      <th className="px-6 py-4">Asset Details</th>
                      <th className="px-6 py-4">Reason</th>
                      <th className="px-6 py-4">Salvage Value</th>
                      <th className="px-6 py-4">Requested By (Maker)</th>
                      <th className="px-6 py-4">Approver (Checker)</th>
                      <th className="px-6 py-4">Status</th>
                      <th className="px-6 py-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-700/60">
                    {loading ? (
                      <tr>
                        <td colSpan={7} className="px-6 py-12 text-center text-slate-400">
                          <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-rose-500" />
                          Loading disposal logs...
                        </td>
                      </tr>
                    ) : requests.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-6 py-12 text-center text-slate-400">
                          <Package className="w-10 h-10 mx-auto mb-2 opacity-40" />
                          No disposal requests found.
                        </td>
                      </tr>
                    ) : (
                      requests.map((req) => {
                        const isMaker = currentUserId === req.requestedById;
                        const isPending = req.status === "PENDING";

                        return (
                          <tr key={req.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/60 transition-colors">
                            <td className="px-6 py-4">
                              <div className="font-semibold text-slate-900 dark:text-white">
                                {req.asset?.deviceName || "Unnamed Asset"}
                              </div>
                              <div className="text-xs text-slate-500 dark:text-slate-400 font-mono mt-0.5">
                                {req.asset?.assetTag} • S/N: {req.asset?.serialNumber}
                              </div>
                            </td>

                            <td className="px-6 py-4">
                              <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-600">
                                {req.reason}
                              </span>
                            </td>

                            <td className="px-6 py-4 font-medium text-slate-900 dark:text-white font-mono">
                              LKR {(req.salvageValue || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </td>

                            <td className="px-6 py-4">
                              <div className="font-medium text-slate-800 dark:text-slate-200">
                                {req.requestedBy?.name}
                              </div>
                              <div className="text-xs text-slate-400">
                                {new Date(req.createdAt).toLocaleDateString()}
                              </div>
                            </td>

                            <td className="px-6 py-4">
                              {req.approvedBy ? (
                                <div>
                                  <div className="font-medium text-slate-800 dark:text-slate-200">
                                    {req.approvedBy.name}
                                  </div>
                                  <div className="text-xs text-emerald-500 flex items-center gap-1">
                                    <ShieldCheck className="w-3 h-3" /> Signed
                                  </div>
                                </div>
                              ) : (
                                <span className="text-xs text-slate-400 italic">Pending Checker</span>
                              )}
                            </td>

                            <td className="px-6 py-4">
                              {req.status === "PENDING" && (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                                  <Clock className="w-3.5 h-3.5" /> PENDING
                                </span>
                              )}
                              {req.status === "APPROVED" && (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                                  <CheckCircle2 className="w-3.5 h-3.5" /> APPROVED
                                </span>
                              )}
                              {req.status === "REJECTED" && (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                                  <XCircle className="w-3.5 h-3.5" /> REJECTED
                                </span>
                              )}
                            </td>

                            <td className="px-6 py-4 text-right">
                              {isPending ? (
                                isMaker ? (
                                  <div className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 dark:bg-slate-800 text-slate-400 text-xs rounded-lg border border-slate-200 dark:border-slate-700">
                                    <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                                    <span>Maker (Self-Approve Blocked)</span>
                                  </div>
                                ) : (
                                  <div className="flex items-center justify-end gap-2">
                                    <Button
                                      size="sm"
                                      onClick={() => handleApproveOrReject(req.id, "APPROVE")}
                                      disabled={processingId === req.id}
                                      className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-8 px-3"
                                    >
                                      {processingId === req.id ? "Processing..." : "Approve"}
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => handleApproveOrReject(req.id, "REJECT")}
                                      disabled={processingId === req.id}
                                      className="border-rose-200 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/30 text-xs h-8 px-3"
                                    >
                                      Reject
                                    </Button>
                                  </div>
                                )
                              ) : (
                                <span className="text-xs text-slate-400">Completed</span>
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

            {/* Create Disposal Request Modal */}
            {isCreateOpen && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
                <div className="bg-white dark:bg-slate-800 w-full max-w-lg rounded-2xl p-6 border border-slate-200 dark:border-slate-700 shadow-2xl space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 pb-3">
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <Trash2 className="w-5 h-5 text-rose-500" />
                      Request IT Asset Disposal (Maker)
                    </h3>
                    <button
                      onClick={() => setIsCreateOpen(false)}
                      className="text-slate-400 hover:text-slate-600 text-lg font-bold"
                    >
                      ×
                    </button>
                  </div>

                  <form onSubmit={handleCreateRequest} className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold uppercase text-slate-500 dark:text-slate-400 mb-1">
                        Select Asset
                      </label>
                      <select
                        value={selectedAssetId}
                        onChange={(e) => setSelectedAssetId(e.target.value)}
                        required
                        className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl font-medium text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-rose-500/20"
                      >
                        <option value="">-- Choose active asset --</option>
                        {availableAssets.map((ast) => (
                          <option key={ast.id} value={ast.id}>
                            {ast.deviceName} [{ast.assetTag}] - S/N: {ast.serialNumber}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold uppercase text-slate-500 dark:text-slate-400 mb-1">
                        Disposal Reason
                      </label>
                      <select
                        value={reason}
                        onChange={(e) => setReason(e.target.value as "EXPIRED" | "DAMAGED" | "OBSOLETE" | "LOST")}
                        className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl font-medium text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-rose-500/20"
                      >
                        <option value="DAMAGED">DAMAGED (Hardware failure)</option>
                        <option value="EXPIRED">EXPIRED (End of useful life)</option>
                        <option value="OBSOLETE">OBSOLETE (Legacy hardware)</option>
                        <option value="LOST">LOST / STOLEN</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold uppercase text-slate-500 dark:text-slate-400 mb-1">
                        Estimated Salvage Value (LKR)
                      </label>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={salvageValue}
                        onChange={(e) => setSalvageValue(parseFloat(e.target.value) || 0)}
                        placeholder="0.00"
                        className="bg-slate-50 dark:bg-slate-900"
                      />
                    </div>

                    <div className="p-3 bg-amber-500/10 text-amber-800 dark:text-amber-300 rounded-xl text-xs flex items-start gap-2 border border-amber-500/20">
                      <AlertTriangle className="w-4 h-4 shrink-0 text-amber-500 mt-0.5" />
                      <span>
                        <strong>Maker-Checker Policy:</strong> You are submitting this request as the <em>Maker</em>.
                        You will not be permitted to approve this request yourself. A separate Checker must approve it.
                      </span>
                    </div>

                    <div className="flex justify-end gap-3 pt-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setIsCreateOpen(false)}
                        className="border-slate-200 dark:border-slate-700"
                      >
                        Cancel
                      </Button>
                      <Button
                        type="submit"
                        disabled={submitting}
                        className="bg-rose-600 hover:bg-rose-700 text-white"
                      >
                        {submitting ? "Submitting..." : "Submit for Approval"}
                      </Button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </main>
        </div>
      </div>
    </RoleGuard>
  );
}
