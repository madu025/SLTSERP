"use client";

import React, { useEffect, useState, useCallback } from "react";
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Key,
  ShieldCheck,
  Plus,
  Search,
  Eye,
  Trash2,
  User,
  Laptop,
  AlertCircle,
  TrendingUp,
  Tag,
  Clipboard,
  X,
  Pencil,
  FileSpreadsheet,
  Download,
  RefreshCw
} from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

interface UserRecord {
  id: string;
  name: string | null;
  username: string;
  email: string;
  employeeId: string | null;
  role: string;
}

interface ITAsset {
  id: string;
  assetNumber: string;
  brand: string;
  model: string;
}

interface SoftwareLicenseAssignment {
  id: string;
  softwareLicenseId: string;
  assignedUserId?: string | null;
  assignedAssetId?: string | null;
  assignedEmail?: string | null;
  remarks?: string | null;
  assignedAt: string;
  assignedUser?: UserRecord | null;
  assignedAsset?: ITAsset | null;
}

interface SoftwareLicense {
  id: string;
  name: string;
  key?: string | null;
  vendor?: string | null;
  purchaseDate?: string | null;
  expiryDate?: string | null;
  purchaseCost?: number | null;
  totalLicenses: number;
  status: string;
  remarks?: string | null;
  createdAt: string;
  updatedAt: string;
  assignments?: SoftwareLicenseAssignment[];
  _count?: {
    assignments: number;
  };
}

export default function SoftwareLicensesDashboard() {
  const [mounted, setMounted] = useState(false);
  const [user, setUser] = useState<{ id: string; name: string; role: string } | null>(null);
  
  // Data lists
  const [licenses, setLicenses] = useState<SoftwareLicense[]>([]);
  const [usersList, setUsersList] = useState<UserRecord[]>([]);
  const [assetsList, setAssetsList] = useState<ITAsset[]>([]);
  
  // States
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [selectedLicense, setSelectedLicense] = useState<SoftwareLicense | null>(null);
  
  // Modal toggle states
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [exportingExcel, setExportingExcel] = useState(false);
  const [exportingAllocations, setExportingAllocations] = useState(false);
  
  // Form states - Create Software License
  const [licenseForm, setLicenseForm] = useState({
    name: "",
    key: "",
    vendor: "",
    purchaseDate: "",
    expiryDate: "",
    purchaseCost: "",
    totalLicenses: "1",
    status: "ACTIVE",
    remarks: ""
  });

  // Form states - Assignment
  const [assignmentForm, setAssignmentForm] = useState({
    assignedUserId: "",
    assignedAssetId: "",
    assignedEmail: "",
    remarks: ""
  });

  const handleExportLicensesToExcel = async () => {
    setExportingExcel(true);
    try {
      const params = new URLSearchParams();
      if (search) params.append("search", search);
      if (statusFilter !== "ALL") params.append("status", statusFilter);
      params.append("export", "true");

      const res = await fetch(`/api/helpdesk/software-licenses?${params.toString()}&_t=${Date.now()}`);
      if (!res.ok) throw new Error("Failed to fetch licenses");
      const json = await res.json();
      if (json.success && Array.isArray(json.data.licenses)) {
        const rows = json.data.licenses.map((lic: any) => ({
          "Software Name": lic.name,
          "License Key": lic.key || "—",
          "Vendor": lic.vendor || "Direct Purchase",
          "Total Seats": lic.totalLicenses || 1,
          "Allocated Seats": lic._count?.assignments || 0,
          "Available Seats": Math.max(0, (lic.totalLicenses || 1) - (lic._count?.assignments || 0)),
          "Purchase Cost (LKR)": lic.purchaseCost || 0,
          "Expiry Date": lic.expiryDate ? new Date(lic.expiryDate).toISOString().split('T')[0] : "Lifetime",
          "Status": lic.status || "—",
          "Remarks": lic.remarks || "—"
        }));

        const XLSX = await import("xlsx");
        const worksheet = XLSX.utils.json_to_sheet(rows);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Licenses");
        XLSX.writeFile(workbook, `Software_Licenses_Export_${new Date().toISOString().split('T')[0]}.xlsx`);
        toast.success("Excel sheet downloaded successfully!");
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to export software licenses.");
    } finally {
      setExportingExcel(false);
    }
  };

  const handleExportAllocationsToExcel = async () => {
    if (!selectedLicense || !selectedLicense.assignments || selectedLicense.assignments.length === 0) return;
    setExportingAllocations(true);
    try {
      const rows = selectedLicense.assignments.map((as: any) => ({
        "Allocation Target": as.assignedUser ? "User" : "Hardware Asset",
        "Assigned Name": as.assignedUser ? (as.assignedUser.name || as.assignedUser.username) : `Asset: ${as.assignedAsset?.assetNumber}`,
        "Employee ID": as.assignedUser ? (as.assignedUser.employeeId || "—") : "—",
        "Assigned Email": as.assignedEmail || "—",
        "Hardware Serial": as.assignedAsset ? as.assignedAsset.serialNumber : "—",
        "Hardware Model": as.assignedAsset ? `${as.assignedAsset.brand} ${as.assignedAsset.model}` : "—",
        "Allocation Date": as.assignedAt ? new Date(as.assignedAt).toISOString().split('T')[0] : "—",
        "Remarks": as.remarks || "—"
      }));

      const XLSX = await import("xlsx");
      const worksheet = XLSX.utils.json_to_sheet(rows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Allocations");
      XLSX.writeFile(workbook, `${selectedLicense.name.replace(/[^a-zA-Z0-9]/g, '_')}_Seats_Export_${new Date().toISOString().split('T')[0]}.xlsx`);
      toast.success("Seats allocation list exported successfully!");
    } catch (err) {
      console.error(err);
      toast.error("Failed to export allocation seats.");
    } finally {
      setExportingAllocations(false);
    }
  };

  // Edit mode states
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    name: "",
    key: "",
    vendor: "",
    purchaseDate: "",
    expiryDate: "",
    purchaseCost: "",
    totalLicenses: "1",
    status: "ACTIVE",
    remarks: ""
  });

  // User search states
  const [userSearchQuery, setUserSearchQuery] = useState("");
  const [searchingUsers, setSearchingUsers] = useState(false);
  const [selectedUserRecord, setSelectedUserRecord] = useState<UserRecord | null>(null);

  const handleUserSearch = async (query: string) => {
    setUserSearchQuery(query);
    if (query.trim().length < 3) {
      setUsersList([]);
      return;
    }
    
    setSearchingUsers(true);
    try {
      const res = await fetch(`/api/users?limit=50&search=${encodeURIComponent(query)}`, {
        headers: { "x-user-role": user?.role || "" }
      });
      if (res.ok) {
        const json = await res.json();
        if (json.users && Array.isArray(json.users)) {
          setUsersList(json.users);
        } else if (Array.isArray(json)) {
          setUsersList(json);
        }
      }
    } catch (err) {
      console.error("Failed to search users", err);
    } finally {
      setSearchingUsers(false);
    }
  };

  useEffect(() => {
    setMounted(true);
    const stored = localStorage.getItem("user");
    if (stored) {
      setUser(JSON.parse(stored));
    }
  }, []);

  const fetchLicenses = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.append("search", search);
      if (statusFilter !== "ALL") params.append("status", statusFilter);

      const res = await fetch(`/api/helpdesk/software-licenses?${params.toString()}&_t=${Date.now()}`);
      if (!res.ok) throw new Error("Failed to load licenses");
      const json = await res.json();
      if (json.success) {
        setLicenses(json.data.licenses || []);
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to load software licenses list");
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter]);

  const fetchUsers = async (role: string) => {
    try {
      const res = await fetch("/api/users?limit=1000", {
        headers: { "x-user-role": role }
      });
      if (res.ok) {
        const json = await res.json();
        if (json.users && Array.isArray(json.users)) {
          setUsersList(json.users);
        } else if (Array.isArray(json)) {
          setUsersList(json);
        }
      }
    } catch (err) {
      console.error("Failed to load users list", err);
    }
  };

  const fetchAssets = async () => {
    try {
      const res = await fetch("/api/helpdesk/assets?limit=1000");
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data?.assets) {
          setAssetsList(json.data.assets);
        }
      }
    } catch (err) {
      console.error("Failed to load hardware assets", err);
    }
  };

  useEffect(() => {
    if (mounted && user) {
      fetchLicenses();
      fetchAssets();
    }
  }, [mounted, user, fetchLicenses]);

  // Load single license details including assignments
  const handleViewDetails = async (id: string) => {
    try {
      const res = await fetch(`/api/helpdesk/software-licenses/${id}?_t=${Date.now()}`);
      if (!res.ok) throw new Error("Failed to load license details");
      const json = await res.json();
      if (json.success) {
        setSelectedLicense(json.data);
        setIsDetailsOpen(true);
        setIsEditing(false); // Reset edit state on load
        
        // Reset search states
        setUserSearchQuery("");
        setUsersList([]);
        setSelectedUserRecord(null);
        setAssignmentForm({
          assignedUserId: "",
          assignedAssetId: "",
          assignedEmail: "",
          remarks: ""
        });
        
        // Initialize edit form values
        const lic = json.data;
        setEditForm({
          name: lic.name || "",
          key: lic.key || "",
          vendor: lic.vendor || "",
          purchaseDate: lic.purchaseDate ? new Date(lic.purchaseDate).toISOString().split('T')[0] : "",
          expiryDate: lic.expiryDate ? new Date(lic.expiryDate).toISOString().split('T')[0] : "",
          purchaseCost: lic.purchaseCost ? String(lic.purchaseCost) : "",
          totalLicenses: String(lic.totalLicenses || "1"),
          status: lic.status || "ACTIVE",
          remarks: lic.remarks || ""
        });
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to load license details");
    }
  };

  // Update Software License Details
  const handleUpdateLicense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLicense) return;
    if (!editForm.name.trim()) {
      toast.error("Software name is required");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        name: editForm.name,
        key: editForm.key || null,
        vendor: editForm.vendor || null,
        purchaseDate: editForm.purchaseDate || null,
        expiryDate: editForm.expiryDate || null,
        purchaseCost: editForm.purchaseCost ? parseFloat(editForm.purchaseCost) : null,
        totalLicenses: parseInt(editForm.totalLicenses || "1"),
        status: editForm.status,
        remarks: editForm.remarks || null
      };

      const res = await fetch(`/api/helpdesk/software-licenses/${selectedLicense.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!res.ok) throw new Error("Update failed");
      const json = await res.json();
      if (json.success) {
        toast.success("License details updated successfully");
        setIsEditing(false);
        handleViewDetails(selectedLicense.id);
        fetchLicenses();
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to update software license");
    } finally {
      setSubmitting(false);
    }
  };

  // Add Software License
  const handleAddLicense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!licenseForm.name.trim()) return;

    setSubmitting(true);
    try {
      const payload = {
        ...licenseForm,
        purchaseCost: licenseForm.purchaseCost ? parseFloat(licenseForm.purchaseCost) : null,
        totalLicenses: parseInt(licenseForm.totalLicenses || "1"),
        purchaseDate: licenseForm.purchaseDate || null,
        expiryDate: licenseForm.expiryDate || null
      };

      const res = await fetch("/api/helpdesk/software-licenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error("Failed to create license");
      const json = await res.json();
      if (json.success) {
        toast.success("Software license registered successfully");
        setIsAddOpen(false);
        setLicenseForm({
          name: "",
          key: "",
          vendor: "",
          purchaseDate: "",
          expiryDate: "",
          purchaseCost: "",
          totalLicenses: "1",
          status: "ACTIVE",
          remarks: ""
        });
        fetchLicenses();
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to register software license");
    } finally {
      setSubmitting(false);
    }
  };

  // Assign License
  const handleAssignLicense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLicense) return;
    if (!assignmentForm.assignedUserId && !assignmentForm.assignedAssetId) {
      toast.error("Please select a target User or IT Asset to assign");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/helpdesk/software-licenses/${selectedLicense.id}/assignments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assignedUserId: assignmentForm.assignedUserId || null,
          assignedAssetId: assignmentForm.assignedAssetId || null,
          assignedEmail: selectedUserRecord ? selectedUserRecord.email : null,
          remarks: assignmentForm.remarks || null
        })
      });

      if (!res.ok) {
        throw new Error("Assignment failed");
      }

      toast.success("License seat assigned successfully");
      setAssignmentForm({ assignedUserId: "", assignedAssetId: "", assignedEmail: "", remarks: "" });
      handleViewDetails(selectedLicense.id);
      fetchLicenses();
    } catch (err) {
      console.error(err);
      toast.error("Failed to allocate license seat");
    } finally {
      setSubmitting(false);
    }
  };

  // Revoke Assignment
  const handleRevokeAssignment = async (assignmentId: string) => {
    if (!selectedLicense) return;
    if (!confirm("Are you sure you want to revoke this license allocation?")) return;

    try {
      const res = await fetch(`/api/helpdesk/software-licenses/${selectedLicense.id}/assignments?assignmentId=${assignmentId}`, {
        method: "DELETE"
      });
      if (!res.ok) throw new Error("Revocation failed");
      toast.success("License seat revoked successfully");
      handleViewDetails(selectedLicense.id);
      fetchLicenses();
    } catch (err) {
      console.error(err);
      toast.error("Failed to revoke license allocation");
    }
  };

  // Delete License
  const handleDeleteLicense = async (id: string) => {
    if (!confirm("Are you sure you want to completely delete this license? All assignments will be revoked!")) return;
    try {
      const res = await fetch(`/api/helpdesk/software-licenses/${id}`, {
        method: "DELETE"
      });
      if (!res.ok) throw new Error("Failed to delete license");
      toast.success("License deleted successfully");
      setIsDetailsOpen(false);
      fetchLicenses();
    } catch (err) {
      console.error(err);
      toast.error("Failed to delete software license");
    }
  };

  // Dashboard Stats Calculations
  const stats = (() => {
    let totalSeats = 0;
    let allocatedSeats = 0;
    let expiredCount = 0;

    licenses.forEach((lic) => {
      totalSeats += lic.totalLicenses || 0;
      allocatedSeats += lic._count?.assignments || 0;
      
      const isExpired = lic.status === "EXPIRED" || (lic.expiryDate && new Date(lic.expiryDate).getTime() < Date.now());
      if (isExpired) expiredCount++;
    });

    const availableSeats = Math.max(0, totalSeats - allocatedSeats);

    return {
      totalLicensesCount: licenses.length,
      totalSeats,
      allocatedSeats,
      availableSeats,
      expiredCount
    };
  })();

  if (!mounted) return null;

  return (
    <div className="min-h-screen flex bg-background text-foreground">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Header />
        
        <main className="flex-grow p-4 md:p-6 overflow-y-auto max-w-[1400px] mx-auto w-full space-y-6">
          
          {/* Header Banner */}
          <div className="bg-gradient-to-r from-slate-900 via-sky-900 to-indigo-950 rounded-xl p-5 md:p-8 text-white shadow-xl relative overflow-hidden flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="space-y-2 z-10">
              <div className="flex items-center gap-2 bg-white/10 px-3 py-1 rounded-full w-max text-xs backdrop-blur-sm">
                <Key className="h-3.5 w-3.5 text-sky-400" />
                <span className="font-bold text-sky-300">Software Asset Management (SAM)</span>
              </div>
              <h1 className="text-xl md:text-2xl font-extrabold tracking-tight">
                Software Licenses & Seat Allocation
              </h1>
              <p className="text-xs text-slate-300 max-w-lg">
                Track corporate software keys, vendors, seat distributions, cost calculations, and contract expirations.
              </p>
            </div>
            
            <div className="z-10">
              <Button
                onClick={() => setIsAddOpen(true)}
                className="bg-sky-500 hover:bg-sky-600 text-white font-bold rounded-xl px-5 py-2.5 shadow-lg shadow-sky-500/20 flex items-center gap-2 self-start md:self-auto hover:-translate-y-0.5 active:translate-y-0 transition-all duration-300"
              >
                <Plus className="h-4.5 w-4.5" />
                <span>Register License</span>
              </Button>
            </div>
            <div className="absolute right-0 bottom-0 top-0 w-1/3 bg-white/5 skew-x-12 translate-x-1/2 pointer-events-none" />
          </div>

          {/* KPI Dashboard Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            
            {/* Total Licenses */}
            <div className="bg-white/80 dark:bg-slate-900/50 border border-slate-200/50 dark:border-slate-800/50 p-4 rounded-xl shadow-sm flex items-center gap-4">
              <div className="bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 p-3 rounded-lg flex-shrink-0">
                <Tag className="h-5 w-5" />
              </div>
              <div>
                <span className="text-[10px] text-muted-foreground uppercase font-black tracking-wider block">Software Types</span>
                <span className="text-xl font-black text-foreground">{stats.totalLicensesCount}</span>
              </div>
            </div>

            {/* Total Purchased Seats */}
            <div className="bg-white/80 dark:bg-slate-900/50 border border-slate-200/50 dark:border-slate-800/50 p-4 rounded-xl shadow-sm flex items-center gap-4">
              <div className="bg-blue-500/10 text-blue-600 dark:text-blue-400 p-3 rounded-lg flex-shrink-0">
                <TrendingUp className="h-5 w-5" />
              </div>
              <div>
                <span className="text-[10px] text-muted-foreground uppercase font-black tracking-wider block">Total Seats</span>
                <span className="text-xl font-black text-foreground">{stats.totalSeats}</span>
              </div>
            </div>

            {/* Assigned Seats */}
            <div className="bg-white/80 dark:bg-slate-900/50 border border-slate-200/50 dark:border-slate-800/50 p-4 rounded-xl shadow-sm flex items-center gap-4">
              <div className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 p-3 rounded-lg flex-shrink-0">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <span className="text-[10px] text-muted-foreground uppercase font-black tracking-wider block">Allocated Seats</span>
                <span className="text-xl font-black text-foreground">{stats.allocatedSeats} <span className="text-xs text-muted-foreground">({stats.totalSeats ? Math.round((stats.allocatedSeats / stats.totalSeats) * 100) : 0}%)</span></span>
              </div>
            </div>

            {/* Expired Contracts */}
            <div className="bg-white/80 dark:bg-slate-900/50 border border-slate-200/50 dark:border-slate-800/50 p-4 rounded-xl shadow-sm flex items-center gap-4">
              <div className={`p-3 rounded-lg flex-shrink-0 ${stats.expiredCount > 0 ? "bg-rose-500/10 text-rose-600 dark:text-rose-400" : "bg-slate-500/10 text-slate-600 dark:text-slate-400"}`}>
                <AlertCircle className="h-5 w-5" />
              </div>
              <div>
                <span className="text-[10px] text-muted-foreground uppercase font-black tracking-wider block">Expired Contracts</span>
                <span className={`text-xl font-black ${stats.expiredCount > 0 ? "text-rose-600 dark:text-rose-400" : "text-foreground"}`}>{stats.expiredCount}</span>
              </div>
            </div>

          </div>

          {/* Filtering & Listing Section */}
          <div className="space-y-4">
            
            <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
              
              <div className="relative w-full sm:max-w-md">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search software, keys, or vendors..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && fetchLicenses()}
                  className="pl-9 h-9.5 text-xs bg-card border-border/50 rounded-xl"
                />
              </div>

              <div className="flex gap-2.5 w-full sm:w-auto items-center justify-end">
                <span className="text-[10px] text-muted-foreground font-black uppercase">Status:</span>
                <Select value={statusFilter} onValueChange={(val) => setStatusFilter(val)}>
                  <SelectTrigger className="h-8.5 text-xs font-semibold bg-card border-border/50 rounded-xl min-w-[140px]">
                    <SelectValue placeholder="All Statuses" />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border/40 shadow-xl rounded-xl">
                    <SelectItem value="ALL" className="text-xs">All Statuses</SelectItem>
                    <SelectItem value="ACTIVE" className="text-xs">Active</SelectItem>
                    <SelectItem value="EXPIRED" className="text-xs">Expired</SelectItem>
                    <SelectItem value="DECOMMISSIONED" className="text-xs">Decommissioned</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  size="sm"
                  variant="outline"
                  type="button"
                  onClick={handleExportLicensesToExcel}
                  disabled={exportingExcel}
                  className="h-8.5 rounded-xl border-border/50 bg-card hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200 gap-1.5 px-3"
                >
                  {exportingExcel ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <FileSpreadsheet className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  )}
                  Export
                </Button>
                <Button size="sm" onClick={fetchLicenses} className="h-8.5 rounded-xl bg-slate-900 text-white font-bold hover:bg-slate-800">
                  Search
                </Button>
              </div>

            </div>

            {/* Table Listing */}
            {loading ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-12 bg-card/60 rounded-xl border border-border/30 animate-pulse" />
                ))}
              </div>
            ) : licenses.length === 0 ? (
              <div className="text-center py-12 bg-card rounded-xl border border-border/40">
                <Key className="mx-auto h-8 w-8 text-muted-foreground/60 mb-2" />
                <p className="text-sm font-semibold text-muted-foreground">No software licenses found</p>
                <p className="text-xs text-muted-foreground/70">Click Register License above to add your first software asset.</p>
              </div>
            ) : (
              <div className="rounded-xl border border-border/40 bg-card/75 backdrop-blur-md shadow-xl overflow-hidden">
                <Table>
                  <TableHeader className="bg-muted/40">
                    <TableRow>
                      <TableHead className="font-bold text-[10px] uppercase text-muted-foreground py-2.5">Name</TableHead>
                      <TableHead className="font-bold text-[10px] uppercase text-muted-foreground py-2.5">License Key</TableHead>
                      <TableHead className="font-bold text-[10px] uppercase text-muted-foreground py-2.5">Vendor</TableHead>
                      <TableHead className="font-bold text-[10px] uppercase text-muted-foreground py-2.5 text-center">Total Seats</TableHead>
                      <TableHead className="font-bold text-[10px] uppercase text-muted-foreground py-2.5 text-center">Assigned Seats</TableHead>
                      <TableHead className="font-bold text-[10px] uppercase text-muted-foreground py-2.5 text-center">Available Seats</TableHead>
                      <TableHead className="font-bold text-[10px] uppercase text-muted-foreground py-2.5">Expiry Date</TableHead>
                      <TableHead className="font-bold text-[10px] uppercase text-muted-foreground py-2.5">Status</TableHead>
                      <TableHead className="font-bold text-[10px] uppercase text-muted-foreground py-2.5 text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {licenses.map((lic) => {
                      const total = lic.totalLicenses || 1;
                      const used = lic._count?.assignments || 0;
                      const avail = Math.max(0, total - used);
                      const isExpired = lic.status === "EXPIRED" || (lic.expiryDate && new Date(lic.expiryDate).getTime() < Date.now());

                      return (
                        <TableRow key={lic.id} className="hover:bg-muted/20 border-b border-border/30 transition-colors text-xs">
                          <TableCell className="font-black text-foreground/90 py-3">{lic.name}</TableCell>
                          <TableCell className="font-mono text-muted-foreground text-[10.5px]">
                            {lic.key ? (
                              <span className="bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700 select-all">{lic.key}</span>
                            ) : (
                              <span className="italic text-muted-foreground/50">None</span>
                            )}
                          </TableCell>
                          <TableCell className="text-muted-foreground">{lic.vendor || "Direct Purchase"}</TableCell>
                          <TableCell className="text-center font-bold text-slate-700 dark:text-slate-300">
                            {total}
                          </TableCell>
                          <TableCell className="text-center font-bold text-sky-600 dark:text-sky-400">
                            {used}
                          </TableCell>
                          <TableCell className="text-center font-bold">
                            <span className={avail <= 0 ? "text-rose-500 font-bold" : "text-emerald-500 font-bold"}>
                              {avail}
                            </span>
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {lic.expiryDate ? (
                              <span className={isExpired ? "text-rose-600 dark:text-rose-400 font-bold" : ""}>
                                {new Date(lic.expiryDate).toLocaleDateString()}
                              </span>
                            ) : (
                              <span className="text-muted-foreground/45 italic">Never Expire</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {isExpired ? (
                              <Badge className="bg-rose-500/10 text-rose-600 border border-rose-500/20 text-[9px] font-bold px-2 py-0.5">EXPIRED</Badge>
                            ) : lic.status === "ACTIVE" ? (
                              <Badge className="bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 text-[9px] font-bold px-2 py-0.5">ACTIVE</Badge>
                            ) : (
                              <Badge className="bg-slate-500/10 text-slate-600 border border-slate-500/20 text-[9px] font-bold px-2 py-0.5">DECOM</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right py-3">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleViewDetails(lic.id)}
                              className="h-7.5 px-2.5 rounded-lg border-slate-200 dark:border-slate-800 hover:bg-sky-500/10 hover:text-sky-600 text-xs font-bold"
                            >
                              <Eye className="h-3.5 w-3.5 mr-1" />
                              <span>View / Assign</span>
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}

          </div>
          
        </main>
      </div>

      {/* MODAL: Register Software License */}
      {isAddOpen && (
        <Dialog open={true} onOpenChange={(open) => !open && setIsAddOpen(false)}>
          <DialogContent className="sm:max-w-lg bg-card border-border/40 p-6 rounded-xl shadow-2xl text-foreground">
            <DialogHeader>
              <DialogTitle className="text-base font-black flex items-center gap-2 text-foreground">
                <Key className="w-5 h-5 text-sky-500" />
                <span>Register Software License</span>
              </DialogTitle>
            </DialogHeader>

            <form onSubmit={handleAddLicense} className="space-y-4 pt-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                
                <div className="space-y-1.5 sm:col-span-2">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Software Name *</label>
                  <Input
                    required
                    placeholder="e.g. Office 365 Pro, AutoCAD LT 2026"
                    value={licenseForm.name}
                    onChange={(e) => setLicenseForm({ ...licenseForm, name: e.target.value })}
                    className="h-9.5 text-xs bg-slate-50 dark:bg-slate-950 border-border/50 rounded-lg"
                  />
                </div>

                <div className="space-y-1.5 sm:col-span-2">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">License Key / Serial ID</label>
                  <Input
                    placeholder="e.g. AAAA-BBBB-CCCC-DDDD"
                    value={licenseForm.key}
                    onChange={(e) => setLicenseForm({ ...licenseForm, key: e.target.value })}
                    className="h-9.5 text-xs bg-slate-50 dark:bg-slate-950 border-border/50 rounded-lg"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Vendor / Reseller</label>
                  <Input
                    placeholder="e.g. Microsoft SL, Redington"
                    value={licenseForm.vendor}
                    onChange={(e) => setLicenseForm({ ...licenseForm, vendor: e.target.value })}
                    className="h-9.5 text-xs bg-slate-50 dark:bg-slate-950 border-border/50 rounded-lg"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Total License Seats</label>
                  <Input
                    type="number"
                    min="1"
                    required
                    placeholder="e.g. 5"
                    value={licenseForm.totalLicenses}
                    onChange={(e) => setLicenseForm({ ...licenseForm, totalLicenses: e.target.value })}
                    className="h-9.5 text-xs bg-slate-50 dark:bg-slate-950 border-border/50 rounded-lg"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Purchase Date</label>
                  <Input
                    type="date"
                    value={licenseForm.purchaseDate}
                    onChange={(e) => setLicenseForm({ ...licenseForm, purchaseDate: e.target.value })}
                    className="h-9.5 text-xs bg-slate-50 dark:bg-slate-950 border-border/50 rounded-lg"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Expiry Date</label>
                  <Input
                    type="date"
                    value={licenseForm.expiryDate}
                    onChange={(e) => setLicenseForm({ ...licenseForm, expiryDate: e.target.value })}
                    className="h-9.5 text-xs bg-slate-50 dark:bg-slate-950 border-border/50 rounded-lg"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Purchase Cost (LKR)</label>
                  <Input
                    type="number"
                    placeholder="e.g. 75000"
                    value={licenseForm.purchaseCost}
                    onChange={(e) => setLicenseForm({ ...licenseForm, purchaseCost: e.target.value })}
                    className="h-9.5 text-xs bg-slate-50 dark:bg-slate-950 border-border/50 rounded-lg"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Status</label>
                  <Select
                    value={licenseForm.status}
                    onValueChange={(val) => setLicenseForm({ ...licenseForm, status: val })}
                  >
                    <SelectTrigger className="h-9.5 text-xs bg-slate-50 dark:bg-slate-950 border-border/50 rounded-lg">
                      <SelectValue placeholder="ACTIVE" />
                    </SelectTrigger>
                    <SelectContent className="bg-card border-border/40 rounded-xl">
                      <SelectItem value="ACTIVE" className="text-xs">Active</SelectItem>
                      <SelectItem value="DECOMMISSIONED" className="text-xs">Decommissioned</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5 sm:col-span-2">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Remarks / Notes</label>
                  <Textarea
                    placeholder="Add details, activation keys instructions, or contract file reference..."
                    value={licenseForm.remarks}
                    onChange={(e) => setLicenseForm({ ...licenseForm, remarks: e.target.value })}
                    rows={2}
                    className="text-xs bg-slate-50 dark:bg-slate-950 border-border/50 rounded-lg resize-none"
                  />
                </div>

              </div>

              <DialogFooter className="pt-4 border-t border-border/40 flex justify-end gap-2.5">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsAddOpen(false)}
                  className="h-9 text-xs rounded-xl border-slate-200 dark:border-slate-800"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={submitting}
                  className="h-9 text-xs rounded-xl bg-sky-500 hover:bg-sky-600 text-white font-bold px-5"
                >
                  {submitting ? "Saving..." : "Save License"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {/* MODAL: License Details & Allocation Slide-out */}
      {isDetailsOpen && selectedLicense && (
        <Dialog open={true} onOpenChange={(open) => !open && setIsDetailsOpen(false)}>
          <DialogContent 
            showCloseButton={false}
            className="fixed !inset-y-0 !right-0 !top-0 !left-auto !translate-x-0 !translate-y-0 !h-full w-[45vw] md:w-[45vw] sm:w-full !max-w-none flex flex-col !p-0 !gap-0 overflow-hidden bg-white dark:bg-slate-950 border-l border-slate-200 dark:border-slate-800 shadow-2xl z-50 duration-300 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right !rounded-none text-foreground"
          >
            
            {/* Header section */}
            <div className="p-6 border-b border-border/40 bg-gradient-to-br from-slate-50 to-white dark:from-slate-900 dark:to-slate-950 relative flex-shrink-0">
              <button
                onClick={() => setIsDetailsOpen(false)}
                className="absolute top-5 right-5 p-1.5 rounded-full hover:bg-slate-200/50 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
              
              {!isEditing && (
                <button
                  onClick={() => setIsEditing(true)}
                  className="absolute top-5 right-12 p-1.5 rounded-full hover:bg-slate-200/50 dark:hover:bg-slate-800 text-slate-400 hover:text-sky-500 transition-colors flex items-center gap-1.5 text-xs font-bold"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  <span>Edit</span>
                </button>
              )}
              
              <div className="space-y-2 max-w-[90%]">
                <div className="flex items-center gap-2">
                  <Badge className="bg-sky-500/10 text-sky-600 border-sky-500/20 text-[9px] font-bold px-2 py-0.5">SOFTWARE ASSET</Badge>
                  {selectedLicense.expiryDate && new Date(selectedLicense.expiryDate).getTime() < Date.now() ? (
                    <Badge className="bg-rose-500/10 text-rose-600 border-rose-500/20 text-[9px] font-bold px-2 py-0.5">EXPIRED</Badge>
                  ) : (
                    <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-[9px] font-bold px-2 py-0.5">ACTIVE</Badge>
                  )}
                </div>
                <h2 className="text-lg font-black text-slate-900 dark:text-white leading-tight tracking-tight">
                  {selectedLicense.name}
                </h2>
                <p className="text-[10px] text-muted-foreground">
                  Registered {formatDistanceToNow(new Date(selectedLicense.createdAt), { addSuffix: true })}
                </p>
              </div>
            </div>

            {/* Scrollable Body */}
            <div className="flex-grow overflow-y-auto p-6 space-y-6 bg-slate-50/40 dark:bg-slate-950/40 custom-scrollbar">
              
              {/* Properties Grid */}
              <div className="grid grid-cols-2 gap-4 bg-white dark:bg-slate-900/50 p-4 rounded-xl border border-slate-200/50 dark:border-slate-800/50 shadow-sm">
                
                {isEditing ? (
                  <>
                    <div className="col-span-2 space-y-1">
                      <label className="text-[9px] font-black uppercase text-slate-400">Software Name *</label>
                      <Input
                        required
                        value={editForm.name}
                        onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                        className="h-8.5 text-xs bg-slate-50 dark:bg-slate-950 border-border/50 rounded-lg"
                      />
                    </div>
                    
                    <div className="space-y-1">
                      <label className="text-[9px] font-black uppercase text-slate-400">License Key</label>
                      <Input
                        value={editForm.key}
                        onChange={(e) => setEditForm({ ...editForm, key: e.target.value })}
                        className="h-8.5 text-xs bg-slate-50 dark:bg-slate-950 border-border/50 rounded-lg"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[9px] font-black uppercase text-slate-400">Vendor</label>
                      <Input
                        value={editForm.vendor}
                        onChange={(e) => setEditForm({ ...editForm, vendor: e.target.value })}
                        className="h-8.5 text-xs bg-slate-50 dark:bg-slate-950 border-border/50 rounded-lg"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[9px] font-black uppercase text-slate-400">Cost (LKR)</label>
                      <Input
                        type="number"
                        value={editForm.purchaseCost}
                        onChange={(e) => setEditForm({ ...editForm, purchaseCost: e.target.value })}
                        className="h-8.5 text-xs bg-slate-50 dark:bg-slate-950 border-border/50 rounded-lg"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[9px] font-black uppercase text-slate-400">Expiry Date</label>
                      <Input
                        type="date"
                        value={editForm.expiryDate}
                        onChange={(e) => setEditForm({ ...editForm, expiryDate: e.target.value })}
                        className="h-8.5 text-xs bg-slate-50 dark:bg-slate-950 border-border/50 rounded-lg"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[9px] font-black uppercase text-slate-400">Total Seats</label>
                      <Input
                        type="number"
                        min={selectedLicense.assignments?.length || 1}
                        value={editForm.totalLicenses}
                        onChange={(e) => setEditForm({ ...editForm, totalLicenses: e.target.value })}
                        className="h-8.5 text-xs bg-slate-50 dark:bg-slate-950 border-border/50 rounded-lg"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[9px] font-black uppercase text-slate-400">Status</label>
                      <Select
                        value={editForm.status}
                        onValueChange={(val) => setEditForm({ ...editForm, status: val })}
                      >
                        <SelectTrigger className="h-8.5 text-xs bg-slate-50 dark:bg-slate-950 border-border/50 rounded-lg">
                          <SelectValue placeholder="ACTIVE" />
                        </SelectTrigger>
                        <SelectContent className="bg-card border-border/40 rounded-xl">
                          <SelectItem value="ACTIVE" className="text-xs">Active</SelectItem>
                          <SelectItem value="DECOMMISSIONED" className="text-xs">Decommissioned</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="col-span-2 space-y-1">
                      <label className="text-[9px] font-black uppercase text-slate-400">Notes / Instructions</label>
                      <Textarea
                        value={editForm.remarks}
                        onChange={(e) => setEditForm({ ...editForm, remarks: e.target.value })}
                        rows={2}
                        className="text-xs bg-slate-50 dark:bg-slate-950 border-border/50 rounded-lg resize-none"
                      />
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider block mb-0.5">License Key</span>
                      <span className="font-mono text-xs font-bold text-slate-700 dark:text-slate-300">
                        {selectedLicense.key ? (
                          <span className="bg-slate-50 dark:bg-slate-950 px-2 py-0.5 rounded border select-all">{selectedLicense.key}</span>
                        ) : (
                          <span className="italic text-slate-400">None</span>
                        )}
                      </span>
                    </div>

                    <div>
                      <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider block mb-0.5">Vendor</span>
                      <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{selectedLicense.vendor || "Direct"}</span>
                    </div>

                    <div>
                      <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider block mb-0.5">Cost</span>
                      <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{selectedLicense.purchaseCost ? `LKR ${selectedLicense.purchaseCost.toLocaleString()}` : "Free / N/A"}</span>
                    </div>

                    <div>
                      <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider block mb-0.5">Expiry Date</span>
                      <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                        {selectedLicense.expiryDate ? new Date(selectedLicense.expiryDate).toLocaleDateString() : "Lifetime"}
                      </span>
                    </div>

                    <div className="col-span-2">
                      <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider block mb-0.5">Seat Distribution</span>
                      <div className="flex justify-between items-center text-xs font-bold mt-1 text-slate-700 dark:text-slate-300">
                        <span>Allocated: {selectedLicense.assignments?.length || 0}</span>
                        <span>Total purchased: {selectedLicense.totalLicenses}</span>
                      </div>
                      <div className="w-full bg-slate-100 dark:bg-slate-950 h-2.5 rounded-full overflow-hidden border border-slate-200/50 dark:border-slate-800/50 mt-1.5">
                        <div className="h-full bg-sky-500" style={{ width: `${Math.min(100, Math.round(((selectedLicense.assignments?.length || 0) / selectedLicense.totalLicenses) * 100))}%` }} />
                      </div>
                    </div>

                    {selectedLicense.remarks && (
                      <div className="col-span-2 pt-2 border-t border-border/30">
                        <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider block mb-1">Notes / Instructions</span>
                        <p className="text-xs text-slate-600 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">{selectedLicense.remarks}</p>
                      </div>
                    )}
                  </>
                )}

              </div>

              {/* Assignments Section */}
              <div className="space-y-3">
                <h3 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center justify-between w-full">
                  <span className="flex items-center gap-1.5">
                    <Clipboard className="w-3.5 h-3.5" /> Allocated Seats ({selectedLicense.assignments?.length || 0})
                  </span>
                  {selectedLicense.assignments && selectedLicense.assignments.length > 0 && (
                    <Button
                      size="sm"
                      variant="ghost"
                      type="button"
                      disabled={exportingAllocations}
                      onClick={handleExportAllocationsToExcel}
                      className="h-6 text-[9px] gap-1 hover:text-emerald-600 dark:hover:text-emerald-400 font-bold p-1 cursor-pointer flex items-center"
                    >
                      {exportingAllocations ? (
                        <RefreshCw className="h-3 w-3 animate-spin" />
                      ) : (
                        <FileSpreadsheet className="h-3 w-3" />
                      )}
                      <span>Export Seats</span>
                    </Button>
                  )}
                </h3>

                {selectedLicense.assignments?.length === 0 ? (
                  <div className="p-5 text-center bg-white dark:bg-slate-900/50 border border-slate-200/50 dark:border-slate-800/50 rounded-xl text-slate-400 text-xs">
                    No active assignments for this license. Allocate seats using the form below.
                  </div>
                ) : (
                  <div className="bg-white dark:bg-slate-900/50 border border-slate-200/50 dark:border-slate-800/50 rounded-xl overflow-hidden divide-y divide-border/30 shadow-sm">
                    {selectedLicense.assignments?.map((as: SoftwareLicenseAssignment) => (
                      <div key={as.id} className="p-3.5 flex items-center justify-between gap-3 text-xs">
                        <div className="flex items-center gap-3">
                          {as.assignedUser ? (
                            <div className="flex items-center gap-2 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 p-1.5 rounded-lg">
                              <User className="h-4 w-4" />
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 bg-blue-500/10 text-blue-600 dark:text-blue-400 p-1.5 rounded-lg">
                              <Laptop className="h-4 w-4" />
                            </div>
                          )}
                          <div>
                            <span className="font-bold text-slate-800 dark:text-slate-200">
                              {as.assignedUser ? (as.assignedUser.name || as.assignedUser.username) : `Hardware: ${as.assignedAsset?.assetNumber}`}
                            </span>
                            {as.assignedUser && (
                              <p className="text-[9.5px] text-slate-400 font-mono mt-0.5">Emp ID: {as.assignedUser.employeeId || "—"} ({as.assignedUser.role})</p>
                            )}
                            {as.assignedEmail && (
                              <p className="text-[9.5px] text-sky-600 dark:text-sky-400 font-medium select-all mt-0.5">{as.assignedEmail}</p>
                            )}
                            {as.assignedAsset && (
                              <p className="text-[9.5px] text-slate-400 mt-0.5">Device: {as.assignedAsset.brand} {as.assignedAsset.model}</p>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-3 flex-shrink-0">
                          <span className="text-[10px] text-slate-400 font-medium">
                            {formatDistanceToNow(new Date(as.assignedAt), { addSuffix: true })}
                          </span>
                          <button
                            onClick={() => handleRevokeAssignment(as.id)}
                            className="p-1 text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 rounded transition-colors"
                            title="Revoke Seat"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Assignment allocation form */}
              {true && (
                <div className="bg-white dark:bg-slate-900/50 p-4 border border-slate-200/50 dark:border-slate-800/50 rounded-xl space-y-3.5 shadow-sm">
                  <h3 className="text-[10px] font-black text-sky-600 dark:text-sky-400 uppercase tracking-widest flex items-center gap-1.5">
                    <Plus className="w-4 h-4" /> Allocate New Seat
                  </h3>
                  
                  <form onSubmit={handleAssignLicense} className="space-y-3">
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      
                      <div className="space-y-1">
                        <label className="text-[9px] font-black uppercase text-slate-400">Assign to User</label>
                        {selectedUserRecord ? (
                          <div className="flex items-center justify-between p-2.5 bg-indigo-500/10 border border-indigo-500/20 rounded-lg text-xs">
                            <div className="flex items-center gap-2">
                              <User className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                              <div>
                                <span className="font-bold text-slate-800 dark:text-slate-200">
                                  {selectedUserRecord.name || selectedUserRecord.username}
                                </span>
                                <span className="text-[9.5px] text-slate-400 block font-mono">
                                  Emp ID: {selectedUserRecord.employeeId || "—"} ({selectedUserRecord.role})
                                </span>
                              </div>
                            </div>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setSelectedUserRecord(null);
                                setAssignmentForm({ ...assignmentForm, assignedUserId: "" });
                              }}
                              className="h-6 w-6 p-0 text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 rounded-full"
                            >
                              <X className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        ) : (
                          <div className="relative">
                            <Input
                              type="text"
                              value={userSearchQuery}
                              onChange={(e) => handleUserSearch(e.target.value)}
                              placeholder="Search by name, email, or Emp No..."
                              className="h-8.5 text-xs bg-slate-50 dark:bg-slate-950 border-border/50 rounded-lg"
                            />
                            {searchingUsers && (
                              <div className="absolute right-2 top-2.5">
                                <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
                              </div>
                            )}

                            {userSearchQuery.trim().length >= 3 && usersList.length > 0 && (
                              <div className="absolute left-0 right-0 mt-1 bg-card border border-border/40 rounded-xl shadow-xl max-h-[180px] overflow-y-auto z-50 divide-y divide-border/20">
                                {usersList.map((usr) => (
                                  <button
                                    key={usr.id}
                                    type="button"
                                    onClick={() => {
                                      setSelectedUserRecord(usr);
                                      setAssignmentForm({ ...assignmentForm, assignedUserId: usr.id, assignedAssetId: "" });
                                      setUsersList([]);
                                    }}
                                    className="w-full p-2.5 text-left text-xs hover:bg-slate-100 dark:hover:bg-slate-900/60 transition-colors flex flex-col"
                                  >
                                    <span className="font-bold text-slate-800 dark:text-slate-200">
                                      {usr.name || usr.username}
                                    </span>
                                    <span className="text-[10px] text-slate-400 font-mono mt-0.5">
                                      Emp ID: {usr.employeeId || "—"} | {usr.email} | {usr.role}
                                    </span>
                                  </button>
                                ))}
                              </div>
                            )}

                            {userSearchQuery.trim().length >= 3 && usersList.length === 0 && !searchingUsers && (
                              <div className="absolute left-0 right-0 mt-1 p-3 text-center bg-card border border-border/40 rounded-xl shadow-xl text-[11px] text-slate-400 z-50">
                                No matching users found.
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="space-y-1">
                        <label className="text-[9px] font-black uppercase text-slate-400">Assign to Asset (Laptop etc.)</label>
                        <Select
                          value={assignmentForm.assignedAssetId}
                          onValueChange={(val) => setAssignmentForm({ ...assignmentForm, assignedAssetId: val === "none" ? "" : val, assignedUserId: "" })}
                        >
                          <SelectTrigger className="h-8.5 text-xs bg-slate-50 dark:bg-slate-950 border-border/50 rounded-lg">
                            <SelectValue placeholder="Select OSP Asset" />
                          </SelectTrigger>
                          <SelectContent className="bg-card border-border/40 rounded-xl max-h-[250px]">
                            <SelectItem value="none" className="text-xs italic text-slate-400">None</SelectItem>
                            {assetsList.map((ast) => (
                              <SelectItem key={ast.id} value={ast.id} className="text-xs">
                                {ast.assetNumber} - {ast.brand} {ast.model}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                    </div>

                    <div className="space-y-1">
                      <label className="text-[9px] font-black uppercase text-slate-400">Assignment notes</label>
                      <Input
                        placeholder="e.g. GIS team, project reference..."
                        value={assignmentForm.remarks}
                        onChange={(e) => setAssignmentForm({ ...assignmentForm, remarks: e.target.value })}
                        className="h-8.5 text-xs bg-slate-50 dark:bg-slate-950 border-border/50 rounded-lg"
                      />
                    </div>

                    <Button
                      type="submit"
                      disabled={submitting}
                      className="w-full h-8.5 text-xs font-bold text-white bg-sky-500 hover:bg-sky-600 rounded-lg shadow-sm"
                    >
                      {submitting ? "Allocating Seat..." : "Allocate License Seat"}
                    </Button>

                  </form>
                </div>
              )}

            </div>

            {/* Footer action tools */}
            <div className="p-4 border-t border-border/40 bg-slate-50 dark:bg-slate-900 flex justify-between gap-4 items-center flex-shrink-0">
              {isEditing ? (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsEditing(false)}
                    className="h-9 px-4 text-xs font-bold border-slate-200 dark:border-slate-800 rounded-xl"
                  >
                    Cancel
                  </Button>
                  
                  <Button
                    type="button"
                    onClick={handleUpdateLicense}
                    disabled={submitting}
                    className="h-9 px-5 text-xs font-bold bg-sky-500 text-white hover:bg-sky-600 rounded-xl shadow-md"
                  >
                    {submitting ? "Saving..." : "Save Changes"}
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => handleDeleteLicense(selectedLicense.id)}
                    className="h-9 px-3 text-xs font-bold text-rose-600 hover:bg-rose-500/10 border-slate-200 dark:border-slate-800 rounded-xl"
                  >
                    <Trash2 className="w-4 h-4 mr-1" />
                    <span>Delete License</span>
                  </Button>
                  
                  <Button
                    type="button"
                    onClick={() => setIsDetailsOpen(false)}
                    className="h-9 px-5 text-xs font-bold bg-slate-900 text-white hover:bg-slate-800 dark:bg-sky-600 dark:hover:bg-sky-700 rounded-xl shadow-md"
                  >
                    Done
                  </Button>
                </>
              )}
            </div>

          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
