"use client";

import React, { useEffect, useState } from "react";
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import AssetList from "@/components/helpdesk/AssetList";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Laptop, Search, RefreshCw } from "lucide-react";
import { toast } from "sonner";

export default function HelpdeskAssetManagementPage() {
  const [mounted, setMounted] = useState(false);
  const [user, setUser] = useState<{ id: string; name: string; role: string } | null>(null);
  const [assets, setAssets] = useState<any[]>([]);
  const [usersList, setUsersList] = useState<any[]>([]);
  const [siteOfficesList, setSiteOfficesList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");

  useEffect(() => {
    setMounted(true);
    const stored = localStorage.getItem("user");
    if (stored) {
      setUser(JSON.parse(stored));
    }
  }, []);

  const fetchAssets = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.append("search", search);
      if (typeFilter !== "ALL") params.append("deviceType", typeFilter);
      if (statusFilter !== "ALL") params.append("status", statusFilter);

      const res = await fetch(`/api/helpdesk/assets?${params.toString()}&_t=${Date.now()}`);
      if (!res.ok) throw new Error("Failed to fetch assets");
      const json = await res.json();
      if (json.success) {
        setAssets(json.data.assets || []);
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to load IT asset list");
    } finally {
      setLoading(false);
    }
  };

  const fetchStaff = async () => {
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
  };

  const fetchSiteOffices = async () => {
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
  };

  useEffect(() => {
    if (mounted && user) {
      fetchAssets();
      fetchStaff();
      fetchSiteOffices();
    }
  }, [mounted, user, typeFilter, statusFilter]);

  const handleSearchKeyPress = (e: React.FormEvent) => {
    e.preventDefault();
    fetchAssets();
  };

  const handleAddAsset = async (data: Record<string, unknown>) => {
    try {
      const res = await fetch("/api/helpdesk/assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
      });

      if (!res.ok) {
        const errJson = await res.json();
        if (errJson.error?.code === "ASSET_NUMBER_TAKEN") {
          throw new Error("Asset number is already registered.");
        }
        if (errJson.error?.code === "SERIAL_NUMBER_TAKEN") {
          throw new Error("Serial number is already registered.");
        }
        throw new Error("Failed to register device");
      }

      const json = await res.json();
      if (json.success) {
        toast.success(`IT Asset ${json.data.assetNumber} successfully registered!`);
        fetchAssets();
      }
    } catch (err: unknown) {
      const error = err as Error;
      toast.error(error.message || "Failed to add asset");
      throw err; // rethrow to keep modal open
    }
  };

  const handleEditAsset = async (id: string, data: Record<string, unknown>) => {
    try {
      const res = await fetch(`/api/helpdesk/assets/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error("Failed to update asset");
      const json = await res.json();
      if (json.success) {
        toast.success(`Asset ${json.data.assetNumber} updated successfully!`);
        fetchAssets();
      }
    } catch (err: unknown) {
      const error = err as Error;
      toast.error(error.message || "Failed to update asset");
      throw err;
    }
  };

  const handleDeleteAsset = async (id: string) => {
    try {
      const res = await fetch(`/api/helpdesk/assets/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete asset");
      toast.success("Asset deleted successfully.");
      // Optimistic update
      setAssets((prev) => prev.filter((a) => a.id !== id));
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
            <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs bg-card" onClick={fetchAssets}>
              <RefreshCw className="h-3.5 w-3.5" />
              Refresh list
            </Button>
          </div>

          {/* Filtering Panel */}
          <form onSubmit={handleSearchKeyPress} className="bg-card/75 border border-border/50 rounded-xl p-4 shadow-sm grid grid-cols-1 sm:grid-cols-4 gap-3 items-end text-xs">
            <div className="space-y-1 sm:col-span-2">
              <label className="text-[10px] font-bold text-muted-foreground uppercase">Search devices</label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Search Asset No, S/N, brand, model, department, location..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8.5 text-xs h-8.5 bg-card border border-border/60"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-muted-foreground uppercase">Device Category</label>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="h-8.5 text-xs bg-card border-border/60">
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent className="bg-card">
                  <SelectItem value="ALL">All Categories</SelectItem>
                  <SelectItem value="LAPTOP">Laptops</SelectItem>
                  <SelectItem value="DESKTOP">Desktops</SelectItem>
                  <SelectItem value="MOBILE">Mobile Phones</SelectItem>
                  <SelectItem value="PRINTER">Printers</SelectItem>
                  <SelectItem value="NETWORK">Network Devices</SelectItem>
                  <SelectItem value="OTHER">Other Equipment</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-muted-foreground uppercase">Operational Status</label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-8.5 text-xs bg-card border-border/60">
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent className="bg-card">
                  <SelectItem value="ALL">All Statuses</SelectItem>
                  <SelectItem value="ACTIVE">Active</SelectItem>
                  <SelectItem value="UNDER_REPAIR">Under Repair</SelectItem>
                  <SelectItem value="SPARE">Spare / In Stock</SelectItem>
                  <SelectItem value="FAULTY">Faulty</SelectItem>
                  <SelectItem value="DISPOSED">Disposed</SelectItem>
                  <SelectItem value="DECOMMISSIONED">Decommissioned</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </form>

          {/* Asset List Render */}
          {loading ? (
            <div className="space-y-2.5">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-11 bg-card/60 rounded-lg animate-pulse border border-border/30" />
              ))}
            </div>
          ) : (
            <AssetList
              assets={assets}
              onAddAsset={handleAddAsset}
              onEditAsset={handleEditAsset}
              onDeleteAsset={handleDeleteAsset}
              usersList={usersList}
              siteOfficesList={siteOfficesList}
              isStaff={isITStaff}
            />
          )}
        </main>
      </div>
    </div>
  );
}
