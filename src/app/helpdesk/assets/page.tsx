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

export default function HelpdeskAssetManagementPage() {
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
      setUser(JSON.parse(stored));
    }
  }, []);

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

  if (!mounted) return null;

  return (
    <div className="min-h-screen flex bg-background text-foreground animate-fade-in">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Header />
        <main className="flex-grow p-4 md:p-6 overflow-y-auto max-w-[1600px] mx-auto w-full space-y-6">
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
              <Link href="/helpdesk/assets/audits">
                <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs bg-card">
                  <ClipboardList className="h-3.5 w-3.5 text-slate-500" />
                  Review Audits
                </Button>
              </Link>
              <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs bg-card" onClick={fetchAssets}>
                <RefreshCw className="h-3.5 w-3.5" />
                Refresh list
              </Button>
            </div>
          </div>

          {/* Stats Cards Section */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {/* Card 1: Total Assets */}
            <div className="bg-card border border-border/60 p-4 rounded-xl shadow-sm flex flex-col justify-between">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Total IT Assets</span>
              <div className="flex items-baseline gap-2 mt-2">
                <span className="text-2xl font-black text-foreground">{stats.total}</span>
                <span className="text-[10px] text-muted-foreground">registered</span>
              </div>
            </div>

            {/* Card 2: Active */}
            <div className="bg-card border border-border/60 p-4 rounded-xl shadow-sm flex flex-col justify-between border-l-4 border-l-emerald-500">
              <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Active Devices</span>
              <div className="flex items-baseline gap-2 mt-2">
                <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400">{stats.ACTIVE}</span>
                <span className="text-[10px] text-muted-foreground">in-use</span>
              </div>
            </div>

            {/* Card 3: Spare / Stores */}
            <div className="bg-card border border-border/60 p-4 rounded-xl shadow-sm flex flex-col justify-between border-l-4 border-l-blue-500">
              <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">Spare in Stores</span>
              <div className="flex items-baseline gap-2 mt-2">
                <span className="text-2xl font-black text-blue-600 dark:text-blue-400">{stats.SPARE}</span>
                <span className="text-[10px] text-muted-foreground">ready to issue</span>
              </div>
            </div>

            {/* Card 4: Under Repair / Faulty */}
            <div className="bg-card border border-border/60 p-4 rounded-xl shadow-sm flex flex-col justify-between border-l-4 border-l-amber-500">
              <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">Repair & Faulty</span>
              <div className="flex items-baseline gap-2 mt-2">
                <span className="text-2xl font-black text-amber-600 dark:text-amber-400">{stats.UNDER_REPAIR + stats.FAULTY}</span>
                <span className="text-[10px] text-muted-foreground">inactive</span>
              </div>
            </div>

            {/* Card 5: Disposed & Decommissioned */}
            <div className="bg-card border border-border/60 p-4 rounded-xl shadow-sm flex flex-col justify-between border-l-4 border-l-slate-400">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Disposed / Retired</span>
              <div className="flex items-baseline gap-2 mt-2">
                <span className="text-2xl font-black text-slate-500">{stats.DISPOSED + stats.DECOMMISSIONED + stats.TRANSFERRED}</span>
                <span className="text-[10px] text-muted-foreground">decommissioned</span>
              </div>
            </div>
          </div>

          {/* Asset List Render */}
          {initialLoading ? (
            <div className="space-y-2.5">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-11 bg-card/60 rounded-lg animate-pulse border border-border/30" />
              ))}
            </div>
          ) : (
            <>
              <div className="relative">
                {loading && (
                  <div className="absolute inset-0 bg-background/25 backdrop-blur-[0.5px] z-10 flex items-center justify-center rounded-lg">
                    <RefreshCw className="h-6 w-6 text-primary animate-spin" />
                  </div>
                )}
                <AssetList
                  assets={assets}
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
  );
}
