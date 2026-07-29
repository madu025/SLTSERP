import { ROLE_GROUPS } from '@/config/roles';
"use client";

import React, { useEffect, useState, useCallback } from "react";
import { ITAsset, Staff, InventoryStore as SiteOffice } from "@prisma/client";
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import AssetList from "@/components/helpdesk/AssetList";
import { Button } from "@/components/ui/button";
import { Laptop, RefreshCw, ClipboardList } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { useRouter } from "next/navigation";

import RoleGuard from "@/components/RoleGuard";

export default function HelpdeskAssetManagementPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [user, setUser] = useState<{ id: string; name: string; role: string } | null>(null);
  const [assets, setAssets] = useState<ITAsset[]>([]);
  const [usersList, setUsersList] = useState<Staff[]>([]);
  const [siteOfficesList, setSiteOfficesList] = useState<SiteOffice[]>([]);
  const [loading, setLoading] = useState(true);

  // Pagination States
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalAssets, setTotalAssets] = useState(0);
  const [initialLoading, setInitialLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");

  const [stats, setStats] = useState({
    total: 0,
    ACTIVE: 0,
    SPARE: 0,
    UNDER_REPAIR: 0,
    FAULTY: 0,
    DECOMMISSIONED: 0,
    DISPOSED: 0,
    TRANSFERRED: 0
  });

  // Debounce search input changes to prevent API spamming & UI layout shifting
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    setMounted(true);
    const stored = localStorage.getItem("user");
    if (stored) {
      const parsedUser = JSON.parse(stored);
      setUser(parsedUser);
      const allowedRoles = ["SUPER_ADMIN", "ADMIN", "ENGINEER", "OFFICE_ADMIN", "OFFICE_ADMIN_ASSISTANT"];
      if (!parsedUser.role || !allowedRoles.includes(parsedUser.role)) {
        toast.error("Unauthorized access.");
        router.push("/login");
      }
    } else {
      router.push("/login");
    }
  }, [router]);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch(`/api/helpdesk/assets/stats?_t=${Date.now()}`);
      if (!res.ok) throw new Error("Failed to fetch stats");
      const json = await res.json();
      if (json.success) {
        setStats(json.data);
      }
    } catch (err) {
      console.error("Failed to load asset stats:", err);
    }
  }, []);

  useEffect(() => {
    if (mounted) {
      fetchStats();
    }
  }, [mounted, fetchStats]);

  const fetchAssets = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (debouncedSearch) params.append("search", debouncedSearch);
      if (typeFilter !== "ALL") params.append("deviceType", typeFilter);
      if (statusFilter !== "ALL") params.append("status", statusFilter);
      params.append("page", page.toString());
      params.append("limit", "25");

      const res = await fetch(`/api/helpdesk/assets?${params.toString()}&_t=${Date.now()}`);
      if (!res.ok) throw new Error("Failed to fetch assets");
      const json = await res.json();
      if (json.success) {
        setAssets(json.data.assets || []);
        setTotalPages(Math.ceil((json.data.total || 0) / 25) || 1);
        setTotalAssets(json.data.total || 0);
        // Refresh metrics cards dynamically
        fetchStats();
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to load IT asset list");
    } finally {
      setLoading(false);
      setInitialLoading(false);
    }
  }, [debouncedSearch, typeFilter, statusFilter, page, fetchStats]);

  const fetchStaff = useCallback(async () => {
    if (!user) return;
    try {
      const res = await fetch("/api/staff", {
        headers: {
          "x-user-role": user.role
        }
      });
      if (!res.ok) throw new Error("Failed to fetch staff");
      const json = await res.json();
      
      if (Array.isArray(json)) {
        setUsersList(json);
      } else if (json.success && Array.isArray(json.data)) {
        setUsersList(json.data);
      }
    } catch (err) {
      console.error("Failed to load staff directory:", err);
    }
  }, [user]);

  const fetchSiteOffices = useCallback(async () => {
    try {
      const res = await fetch("/api/helpdesk/site-offices?limit=1000");
      if (!res.ok) throw new Error("Failed to fetch site offices");
      const json = await res.json();
      if (json.success) {
        setSiteOfficesList(json.data.siteOffices || []);
      }
    } catch (err) {
      console.error("Failed to load OSP site offices:", err);
    }
  }, []);

  const handleTypeFilterChange = (val: string) => {
    setTypeFilter(val);
    setPage(1);
  };

  const handleStatusFilterChange = (val: string) => {
    setStatusFilter(val);
    setPage(1);
  };

  const handleSearchChange = (val: string) => {
    setSearch(val);
    setPage(1);
  };

  useEffect(() => {
    if (mounted && user) {
      fetchAssets();
    }
  }, [mounted, user, fetchAssets]);

  useEffect(() => {
    if (mounted && user) {
      fetchStaff();
      fetchSiteOffices();
    }
  }, [mounted, user, fetchStaff, fetchSiteOffices]);


  const handleAddAsset = async (data: Record<string, unknown>): Promise<boolean> => {
    try {
      const res = await fetch("/api/helpdesk/assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
      });

      if (!res.ok) {
        const errJson = await res.json();
        if (errJson.error?.code === "ASSET_NUMBER_TAKEN" || errJson.error?.message === "ASSET_NUMBER_TAKEN") {
          throw new Error("Asset number is already registered.");
        }
        if (errJson.error?.code === "SERIAL_NUMBER_TAKEN" || errJson.error?.message === "SERIAL_NUMBER_TAKEN") {
          throw new Error("Serial number is already registered.");
        }
        throw new Error("Failed to register device");
      }

      const json = await res.json();
      if (json.success) {
        toast.success(`IT Asset ${json.data.assetNumber} successfully registered!`);
        fetchAssets();
        return true;
      }
      return false;
    } catch (err: unknown) {
      const error = err as Error;
      toast.error(error.message || "Failed to add asset");
      return false;
    }
  };

  const handleEditAsset = async (id: string, data: Record<string, unknown>): Promise<boolean> => {
    try {
      const res = await fetch(`/api/helpdesk/assets/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
      });
      if (!res.ok) {
        const errJson = await res.json();
        if (errJson.error?.code === "ASSET_NUMBER_TAKEN" || errJson.error?.message === "ASSET_NUMBER_TAKEN") {
          throw new Error("Asset number is already registered.");
        }
        if (errJson.error?.code === "SERIAL_NUMBER_TAKEN" || errJson.error?.message === "SERIAL_NUMBER_TAKEN") {
          throw new Error("Serial number is already registered.");
        }
        throw new Error(errJson.error?.message || "Failed to update asset");
      }
      const json = await res.json();
      if (json.success) {
        toast.success(`Asset ${json.data.assetNumber} updated successfully!`);
        fetchAssets();
        fetchStaff();
        return true;
      }
      return false;
    } catch (err: unknown) {
      const error = err as Error;
      toast.error(error.message || "Failed to update asset");
      return false;
    }
  };

  const handleDeleteAsset = async (id: string) => {
    try {
      const res = await fetch(`/api/helpdesk/assets/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete asset");
      toast.success("Asset deleted successfully.");
      // Optimistic update
      setAssets((prev) => prev.filter((a) => a.id !== id));
      fetchStats();
    } catch (err: unknown) {
      const error = err as Error;
      toast.error(error.message || "Failed to delete asset");
      throw err;
    }
  };

  const isITStaff = !!(user?.role && ["SUPER_ADMIN", "ADMIN", "ENGINEER", "OFFICE_ADMIN", "OFFICE_ADMIN_ASSISTANT"].includes(user.role));

  if (!mounted || !user || !isITStaff) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <RefreshCw className="h-6 w-6 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <RoleGuard allowedRoles={ROLE_GROUPS.OFFICE_ADMINS}>
      <div className="flex h-screen bg-slate-50 overflow-hidden">
        <Sidebar />
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <Header />
          <main className="flex-1 p-4 md:p-6 overflow-y-auto max-w-[1600px] mx-auto w-full space-y-6">
            {/* Header Title */}
            <div className="bg-card/70 backdrop-blur-md p-4 rounded-xl border border-border/50 shadow-sm flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="bg-primary/10 text-primary p-2.5 rounded-lg">
                  <Laptop className="h-5 w-5" />
                </div>
                <div>
                  <h1 className="text-base font-extrabold text-foreground">IT Asset Management</h1>
                  <p className="text-[10px] text-muted-foreground">Register company laptops, desktops, and mobile devices.</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs bg-card" onClick={fetchAssets}>
                  <RefreshCw className="h-3.5 w-3.5" />
                  Refresh
                </Button>
                <Link href="/helpdesk/assets/audits">
                  <Button size="sm" className="h-8 gap-1.5 text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-semibold">
                    <ClipboardList className="h-3.5 w-3.5" />
                    Physical Audits Review
                  </Button>
                </Link>
              </div>
            </div>

            {/* Top Stat Summary Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-8 gap-2.5">
              <div className="bg-card/70 border border-border/40 p-3 rounded-xl shadow-sm text-center">
                <span className="text-[10px] font-bold text-muted-foreground uppercase block">Total</span>
                <span className="text-lg font-black text-foreground">{stats.total}</span>
              </div>
              <div className="bg-card/70 border border-border/40 p-3 rounded-xl shadow-sm text-center">
                <span className="text-[10px] font-bold text-emerald-600 uppercase block">Active</span>
                <span className="text-lg font-black text-emerald-600">{stats.ACTIVE}</span>
              </div>
              <div className="bg-card/70 border border-border/40 p-3 rounded-xl shadow-sm text-center">
                <span className="text-[10px] font-bold text-indigo-500 uppercase block">Spare</span>
                <span className="text-lg font-black text-indigo-500">{stats.SPARE}</span>
              </div>
              <div className="bg-card/70 border border-border/40 p-3 rounded-xl shadow-sm text-center">
                <span className="text-[10px] font-bold text-amber-500 uppercase block">In Repair</span>
                <span className="text-lg font-black text-amber-500">{stats.UNDER_REPAIR}</span>
              </div>
              <div className="bg-card/70 border border-border/40 p-3 rounded-xl shadow-sm text-center">
                <span className="text-[10px] font-bold text-red-500 uppercase block">Faulty</span>
                <span className="text-lg font-black text-red-500">{stats.FAULTY}</span>
              </div>
              <div className="bg-card/70 border border-border/40 p-3 rounded-xl shadow-sm text-center">
                <span className="text-[10px] font-bold text-slate-500 uppercase block">Retired</span>
                <span className="text-lg font-black text-slate-500">{stats.DECOMMISSIONED}</span>
              </div>
              <div className="bg-card/70 border border-border/40 p-3 rounded-xl shadow-sm text-center">
                <span className="text-[10px] font-bold text-stone-500 uppercase block">Disposed</span>
                <span className="text-lg font-black text-stone-500">{stats.DISPOSED}</span>
              </div>
              <div className="bg-card/70 border border-border/40 p-3 rounded-xl shadow-sm text-center">
                <span className="text-[10px] font-bold text-purple-500 uppercase block">Transferred</span>
                <span className="text-lg font-black text-purple-500">{stats.TRANSFERRED}</span>
              </div>
            </div>

            {/* Asset Table Container */}
            {initialLoading ? (
              <div className="bg-card border border-border/50 rounded-xl p-8 flex flex-col items-center justify-center space-y-3 min-h-[300px]">
                <RefreshCw className="h-7 w-7 text-primary animate-spin" />
                <p className="text-xs font-semibold text-muted-foreground">Loading IT Device Records...</p>
              </div>
            ) : (
              <>
                <div className="bg-card border border-border/50 rounded-xl p-4 shadow-sm">
                  <AssetList
                    assets={assets}
                    loading={loading}
                    onAddAsset={handleAddAsset}
                    onEditAsset={handleEditAsset}
                    onDeleteAsset={handleDeleteAsset}
                    usersList={usersList}
                    siteOfficesList={siteOfficesList}
                    isStaff={isITStaff}
                    search={search}
                    onSearchChange={handleSearchChange}
                    typeFilter={typeFilter}
                    onTypeFilterChange={handleTypeFilterChange}
                    statusFilter={statusFilter}
                    onStatusFilterChange={handleStatusFilterChange}
                    onRefresh={fetchAssets}
                  />
                </div>
                
                {/* Pagination Controls */}
                {totalPages > 1 && (
                  <div className="bg-card/70 border border-border/40 p-3.5 rounded-xl flex items-center justify-between shadow-sm text-xs">
                    <span className="text-muted-foreground font-medium">
                      Showing <span className="font-bold text-foreground">{(page - 1) * 25 + 1}</span> to{" "}
                      <span className="font-bold text-foreground">
                        {Math.min(page * 25, totalAssets)}
                      </span>{" "}
                      of <span className="font-bold text-foreground">{totalAssets}</span> registered devices
                    </span>
                    
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs font-semibold"
                        disabled={page === 1}
                        onClick={() => setPage((prev) => Math.max(prev - 1, 1))}
                      >
                        Previous
                      </Button>
                      <span className="text-muted-foreground font-medium px-2">
                        Page <span className="font-bold text-foreground">{page}</span> of {totalPages}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs font-semibold"
                        disabled={page === totalPages}
                        onClick={() => setPage((prev) => Math.min(prev + 1, totalPages))}
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </main>
        </div>
      </div>
    </RoleGuard>
  );
}
