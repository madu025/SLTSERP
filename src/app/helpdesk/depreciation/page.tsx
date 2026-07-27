"use client";

import React, { useEffect, useState, useCallback } from "react";
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import RoleGuard from "@/components/RoleGuard";
import { Button } from "@/components/ui/button";
import {
  TrendingDown,
  Calculator,
  Building,
  RefreshCw,
  Search,
  BookOpen,
  DollarSign,
  FileCheck
} from "lucide-react";
import { toast } from "sonner";

interface DepreciationAsset {
  id: string;
  assetTag: string;
  serialNumber: string;
  deviceName: string;
  deviceType: string;
  purchaseDate: string;
  purchaseCost: number;
  status: string;
  usefulLifeMonths: number;
  monthsInUse: number;
  salvageValue: number;
  monthlyDepreciation: number;
  accumulatedDepreciation: number;
  netBookValue: number;
}

interface SummaryData {
  totalAssetCount: number;
  totalCost: number;
  totalAccumulated: number;
  totalNetBookValue: number;
  estMonthlyPosting: number;
}

export default function ITAssetDepreciationPage() {
  const [mounted, setMounted] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const [assets, setAssets] = useState<DepreciationAsset[]>([]);
  const [summary, setSummary] = useState<SummaryData>({
    totalAssetCount: 0,
    totalCost: 0,
    totalAccumulated: 0,
    totalNetBookValue: 0,
    estMonthlyPosting: 0
  });

  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    setMounted(true);
    const storedUser = localStorage.getItem("user");
    if (storedUser) {
      try {
        const u = JSON.parse(storedUser);
        setCurrentUserId(u.id);
      } catch (e) {
        console.error("Failed to parse user", e);
      }
    }
  }, []);

  const fetchDepreciationData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/helpdesk/depreciation?_t=${Date.now()}`, {
        cache: "no-store",
        headers: {
          "Pragma": "no-cache",
          "Cache-Control": "no-cache"
        }
      });
      if (!res.ok) throw new Error("Failed to fetch depreciation data");
      const json = await res.json();
      if (json.success) {
        setAssets(json.data.assets || []);
        setSummary(json.data.summary || {
          totalAssetCount: 0,
          totalCost: 0,
          totalAccumulated: 0,
          totalNetBookValue: 0,
          estMonthlyPosting: 0
        });
      }
    } catch (err) {
      console.error(err);
      toast.error("Error loading depreciation schedules");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (mounted) {
      fetchDepreciationData();
    }
  }, [mounted, fetchDepreciationData]);

  const handlePostGLDepreciation = async () => {
    if (!currentUserId) {
      toast.error("Session expired. Please log in.");
      return;
    }

    if (!confirm("Are you sure you want to post the monthly IT Asset Depreciation Journal Voucher to General Ledger?")) {
      return;
    }

    setPosting(true);
    try {
      const res = await fetch("/api/helpdesk/depreciation", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": currentUserId
        },
        body: JSON.stringify({
          period: new Date().toISOString().substring(0, 7)
        })
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || "Failed to post depreciation JV");
      }

      toast.success(
        `Journal Voucher Posted! Processed ${json.data.processed} assets totaling LKR ${json.data.totalDepreciation.toLocaleString(undefined, { minimumFractionDigits: 2 })}`
      );
      fetchDepreciationData();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "GL posting failed";
      toast.error(message);
    } finally {
      setPosting(false);
    }
  };

  const filteredAssets = assets.filter(
    (a) =>
      a.deviceName.toLowerCase().includes(search.toLowerCase()) ||
      a.assetTag.toLowerCase().includes(search.toLowerCase()) ||
      a.serialNumber.toLowerCase().includes(search.toLowerCase())
  );

  if (!mounted) return null;

  return (
    <RoleGuard allowedRoles={['SUPER_ADMIN', 'ADMIN', 'FINANCE_MANAGER', 'OSP_MANAGER', 'ENGINEER']}>
      <div className="flex h-screen bg-slate-50 dark:bg-slate-900 overflow-hidden font-sans">
        <Sidebar />
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <Header />
          <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 space-y-6">
            {/* Page Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-blue-500/10 text-blue-600 rounded-xl">
                  <Calculator className="w-6 h-6" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                    IT Asset Depreciation & GL Valuation
                  </h1>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                    Straight-line CapEx depreciation schedules & automated General Ledger JV posting
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Button
                  onClick={fetchDepreciationData}
                  variant="outline"
                  size="sm"
                  className="gap-2 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700"
                >
                  <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
                  Refresh
                </Button>

                <Button
                  onClick={handlePostGLDepreciation}
                  disabled={posting}
                  size="sm"
                  className="gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-md shadow-blue-500/20"
                >
                  <FileCheck className="w-4 h-4" />
                  {posting ? "Posting JV..." : "Post Monthly Depreciation (GL)"}
                </Button>
              </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 shadow-sm">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Total CapEx Cost
                    </p>
                    <h3 className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                      LKR {summary.totalCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </h3>
                  </div>
                  <div className="p-2 bg-slate-500/10 text-slate-600 dark:text-slate-300 rounded-xl">
                    <Building className="w-5 h-5" />
                  </div>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-3">
                  {summary.totalAssetCount} IT Assets Tracked
                </p>
              </div>

              <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 shadow-sm">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Accumulated Depreciation
                    </p>
                    <h3 className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1">
                      LKR {summary.totalAccumulated.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </h3>
                  </div>
                  <div className="p-2 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-xl">
                    <TrendingDown className="w-5 h-5" />
                  </div>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-3">
                  Account 1700 Balance
                </p>
              </div>

              <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 shadow-sm">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Net Book Value (NBV)
                    </p>
                    <h3 className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                      LKR {summary.totalNetBookValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </h3>
                  </div>
                  <div className="p-2 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-xl">
                    <DollarSign className="w-5 h-5" />
                  </div>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-3">
                  Current Net Financial Value
                </p>
              </div>

              <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 shadow-sm">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Est. Monthly JV Posting
                    </p>
                    <h3 className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-1">
                      LKR {summary.estMonthlyPosting.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </h3>
                  </div>
                  <div className="p-2 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-xl">
                    <BookOpen className="w-5 h-5" />
                  </div>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-3">
                  Account 6500 Monthly Charge
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
                  placeholder="Search asset, tag, or serial..."
                  className="w-full pl-9 pr-4 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>
            </div>

            {/* Depreciation Table */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-600 dark:text-slate-300">
                  <thead className="bg-slate-50 dark:bg-slate-900/50 text-xs uppercase font-semibold text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
                    <tr>
                      <th className="px-6 py-4">Asset Info</th>
                      <th className="px-6 py-4">Purchase Date</th>
                      <th className="px-6 py-4 text-right">Original Cost</th>
                      <th className="px-6 py-4 text-center">Life (Months)</th>
                      <th className="px-6 py-4 text-right">Monthly Depr.</th>
                      <th className="px-6 py-4 text-right">Accumulated Depr.</th>
                      <th className="px-6 py-4 text-right font-bold text-slate-900 dark:text-white">Net Book Value</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-700/60">
                    {loading ? (
                      <tr>
                        <td colSpan={7} className="px-6 py-12 text-center text-slate-400">
                          <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-500" />
                          Calculating depreciation schedules...
                        </td>
                      </tr>
                    ) : filteredAssets.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-6 py-12 text-center text-slate-400">
                          No asset depreciation records found.
                        </td>
                      </tr>
                    ) : (
                      filteredAssets.map((ast) => (
                        <tr key={ast.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/60 transition-colors">
                          <td className="px-6 py-4">
                            <div className="font-semibold text-slate-900 dark:text-white">
                              {ast.deviceName}
                            </div>
                            <div className="text-xs text-slate-500 font-mono mt-0.5">
                              {ast.assetTag} • {ast.serialNumber}
                            </div>
                          </td>

                          <td className="px-6 py-4 text-xs font-mono">
                            {ast.purchaseDate ? new Date(ast.purchaseDate).toLocaleDateString() : "N/A"}
                          </td>

                          <td className="px-6 py-4 text-right font-mono font-medium">
                            LKR {ast.purchaseCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </td>

                          <td className="px-6 py-4 text-center font-mono">
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-slate-100 dark:bg-slate-700 font-semibold">
                              {ast.monthsInUse} / {ast.usefulLifeMonths} mos
                            </span>
                          </td>

                          <td className="px-6 py-4 text-right font-mono text-blue-600 dark:text-blue-400 font-medium">
                            LKR {ast.monthlyDepreciation.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </td>

                          <td className="px-6 py-4 text-right font-mono text-amber-600 dark:text-amber-400 font-medium">
                            LKR {ast.accumulatedDepreciation.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </td>

                          <td className="px-6 py-4 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                            LKR {ast.netBookValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
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
