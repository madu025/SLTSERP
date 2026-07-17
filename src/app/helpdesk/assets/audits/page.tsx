"use client";

import React, { useEffect, useState, useCallback } from "react";
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, CheckCircle, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription
} from "@/components/ui/dialog";

interface AuditRecord {
  id: string;
  serialNumber: string;
  assetNumber: string | null;
  deviceType: "LAPTOP" | "DESKTOP" | "MOBILE" | "PRINTER" | "NETWORK" | "OTHER";
  brand: string;
  model: string;
  employeeNo: string;
  custodianName: string;
  department: string | null;
  siteOfficeId: string | null;
  location: string | null;
  status: string;
  remarks: string | null;
  isConfirmed: boolean;
  isMatched: boolean;
  isSynced: boolean;
  createdAt: string;
  existingAsset?: {
    id: string;
    assetNumber: string;
    brand: string;
    model: string;
    deviceType: string;
    status: string;
    department: string | null;
    siteOfficeId: string | null;
    siteOfficeName: string | null;
    location: string | null;
    assignedStaff: {
      id: string;
      employeeId: string;
      name: string;
    } | null;
  } | null;
}

export default function AdminAuditReviewPage() {
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [audits, setAudits] = useState<AuditRecord[]>([]);
  const [syncingId, setSyncingId] = useState<string | null>(null);

  // Site offices dropdown state
  const [siteOffices, setSiteOffices] = useState<{ id: string; name: string }[]>([]);

  // Dialog State
  const [isOpen, setIsOpen] = useState(false);
  const [selectedAudit, setSelectedAudit] = useState<AuditRecord | null>(null);

  // Dialog Fields Editor State
  const [editBrand, setEditBrand] = useState("");
  const [editModel, setEditModel] = useState("");
  const [editAssetNumber, setEditAssetNumber] = useState("");
  const [editDeviceType, setEditDeviceType] = useState("");
  const [editDepartment, setEditDepartment] = useState("");
  const [editSiteOfficeId, setEditSiteOfficeId] = useState("");
  const [editLocation, setEditLocation] = useState("");
  const [editStatus, setEditStatus] = useState("");

  useEffect(() => {
    setMounted(true);
  }, []);

  const fetchSiteOffices = useCallback(async () => {
    try {
      const res = await fetch("/api/helpdesk/site-offices?limit=200");
      const json = await res.json();
      if (json.success) {
        setSiteOffices(json.data || []);
      }
    } catch (err) {
      console.error("Failed to load site offices:", err);
    }
  }, []);

  const fetchAudits = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/helpdesk/assets/audits?_t=${Date.now()}`);
      const json = await res.json();
      if (json.success) {
        setAudits(json.data || []);
      } else {
        toast.error(json.error?.message || "Failed to load audits");
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to fetch device audits");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (mounted) {
      fetchAudits();
      fetchSiteOffices();
    }
  }, [mounted, fetchAudits, fetchSiteOffices]);

  const handleOpenReconcile = (audit: AuditRecord) => {
    setSelectedAudit(audit);
    setEditBrand(audit.brand);
    setEditModel(audit.model);
    setEditAssetNumber(audit.assetNumber || "");
    setEditDeviceType(audit.deviceType);
    setEditDepartment(audit.department || "");
    setEditSiteOfficeId(audit.siteOfficeId || "");
    setEditLocation(audit.location || "");
    setEditStatus(audit.status);
    setIsOpen(true);
  };

  const handleReject = async (auditId: string) => {
    if (!confirm("Are you sure you want to ignore/reject this audit submission?")) return;
    try {
      const res = await fetch(`/api/helpdesk/assets/audits?auditId=${auditId}`, {
        method: "PATCH"
      });
      const json = await res.json();
      if (json.success) {
        toast.success("Audit submission ignored/rejected.");
        setAudits((prev) => prev.filter(a => a.id !== auditId));
        setIsOpen(false);
      } else {
        toast.error(json.error?.message || "Action failed");
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to reject audit");
    }
  };

  const handleApproveSync = async (auditId: string) => {
    setSyncingId(auditId);
    try {
      const payload = {
        brand: editBrand,
        model: editModel,
        deviceType: editDeviceType,
        assetNumber: editAssetNumber || null,
        department: editDepartment || null,
        siteOfficeId: editSiteOfficeId || null,
        location: editLocation || null,
        status: editStatus
      };

      const res = await fetch(`/api/helpdesk/assets/audits?auditId=${auditId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });
      const json = await res.json();
      if (json.success) {
        toast.success("Audit entry synced to live inventory!");
        // Update audits state to show synced optimistically
        setAudits((prev) =>
          prev.map((a) =>
            a.id === auditId ? { 
              ...a, 
              isSynced: true, 
              isMatched: true,
              brand: editBrand,
              model: editModel,
              deviceType: editDeviceType as any,
              assetNumber: editAssetNumber || null,
              department: editDepartment || null,
              siteOfficeId: editSiteOfficeId || null,
              location: editLocation || null,
              status: editStatus
            } : a
          )
        );
        setIsOpen(false);
      } else {
        toast.error(json.error?.message || "Reconciliation failed");
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to reconcile records");
    } finally {
      setSyncingId(null);
    }
  };

  if (!mounted) return null;

  // Calculate metrics
  const total = audits.length;
  const pending = audits.filter(a => !a.isSynced).length;
  const synced = audits.filter(a => a.isSynced).length;
  const discrepancies = audits.filter(a => !a.isSynced && !a.isMatched).length;

  return (
    <div className="min-h-screen flex bg-background text-foreground animate-fade-in">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Header />
        <main className="flex-grow p-4 md:p-6 overflow-y-auto max-w-[1600px] mx-auto w-full space-y-6">
          
          {/* Header Controls */}
          <div className="bg-card/70 backdrop-blur-md p-4 rounded-xl border border-border/50 shadow-sm flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link href="/helpdesk/assets">
                <Button size="sm" variant="outline" className="h-8.5 px-2 bg-card border-border/60">
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              </Link>
              <div>
                <h1 className="text-base font-extrabold text-foreground flex items-center gap-1.5">
                  Device Audit Review Panel
                </h1>
                <p className="text-[10px] text-muted-foreground">
                  Verify, compare, and merge public user audit submissions into live inventory database.
                </p>
              </div>
            </div>
            <Button size="sm" variant="outline" className="h-8.5 gap-1.5 text-xs bg-card" onClick={fetchAudits} disabled={loading}>
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>

          {/* Stats Bar */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-card border border-border/60 p-4 rounded-xl shadow-sm">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Total Submissions</span>
              <div className="text-2xl font-black text-foreground mt-1">{total}</div>
            </div>
            <div className="bg-card border border-border/60 p-4 rounded-xl shadow-sm border-l-4 border-l-amber-500">
              <span className="text-[10px] font-bold text-amber-500 uppercase tracking-wider">Pending Action</span>
              <div className="text-2xl font-black text-amber-500 mt-1">{pending}</div>
            </div>
            <div className="bg-card border border-border/60 p-4 rounded-xl shadow-sm border-l-4 border-l-rose-500">
              <span className="text-[10px] font-bold text-rose-500 uppercase tracking-wider">Discrepancies</span>
              <div className="text-2xl font-black text-rose-500 mt-1">{discrepancies}</div>
            </div>
            <div className="bg-card border border-border/60 p-4 rounded-xl shadow-sm border-l-4 border-l-emerald-500">
              <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider">Synced to Assets</span>
              <div className="text-2xl font-black text-emerald-500 mt-1">{synced}</div>
            </div>
          </div>

          {/* Submissions Table List */}
          <div className="rounded-lg border border-border/50 bg-card/85 backdrop-blur-lg shadow-xl overflow-hidden">
            <Table>
              <TableHeader className="bg-muted/40">
                <TableRow>
                  <TableHead className="font-semibold text-xs py-2">Audited S/N</TableHead>
                  <TableHead className="font-semibold text-xs py-2">Asset No</TableHead>
                  <TableHead className="font-semibold text-xs py-2">Device Details</TableHead>
                  <TableHead className="font-semibold text-xs py-2">Custodian (EPF)</TableHead>
                  <TableHead className="font-semibold text-xs py-2">Match Status</TableHead>
                  <TableHead className="font-semibold text-xs py-2">Remarks / Condition</TableHead>
                  <TableHead className="font-semibold text-xs py-2 text-right">Reconcile Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-xs py-8 text-muted-foreground animate-pulse">
                      Loading audited devices submissions...
                    </TableCell>
                  </TableRow>
                ) : audits.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-xs py-8 text-muted-foreground">
                      No device audit reports submitted yet. Share the public form with employees!
                    </TableCell>
                  </TableRow>
                ) : (
                  audits.map((a) => {
                    // Match State computing
                    let badge = <Badge className="bg-blue-100 text-blue-800 border-blue-200 text-[10px]">NEW DEVICE</Badge>;
                    if (a.isSynced) {
                      badge = <Badge className="bg-slate-100 text-slate-700 border-slate-200 text-[10px]">SYNCED</Badge>;
                    } else if (a.isMatched) {
                      badge = <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 text-[10px]">PERFECT MATCH</Badge>;
                    } else if (a.isConfirmed) {
                      // Confirmed existing device but discrepancy found
                      badge = <Badge className="bg-amber-100 text-amber-800 border-amber-200 text-[10px]">DISCREPANCY</Badge>;
                    }

                    return (
                      <TableRow key={a.id} className="hover:bg-muted/15 transition-colors">
                        <TableCell className="font-mono text-xs">{a.serialNumber}</TableCell>
                        <TableCell className="text-xs">{a.assetNumber || "—"}</TableCell>
                        <TableCell className="text-xs">
                          <span className="font-bold">{a.brand}</span> {a.model}
                          <span className="text-[10px] text-muted-foreground block uppercase">{a.deviceType} - {a.status}</span>
                        </TableCell>
                        <TableCell className="text-xs">
                          <span className="font-semibold">{a.custodianName}</span>
                          <span className="text-[10px] text-muted-foreground block">EPF: {a.employeeNo}</span>
                          {a.department && (
                            <span className="text-[9px] text-primary block mt-0.5">{a.department}</span>
                          )}
                        </TableCell>
                        <TableCell>{badge}</TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-xs truncate">
                          {a.remarks || "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          {a.isSynced ? (
                            <div className="flex justify-end items-center gap-1 text-emerald-600 text-xs font-semibold mr-3">
                              <CheckCircle className="h-4 w-4" />
                              Synced
                            </div>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleOpenReconcile(a)}
                              className="h-7 text-xs bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200"
                            >
                              Reconcile
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </main>
      </div>

      {/* Reconcile Dialog Cockpit */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-slate-900 border-slate-800 text-white">
          <DialogHeader>
            <DialogTitle className="text-lg font-black flex items-center gap-2">
              Reconcile Audit - S/N: <span className="font-mono text-emerald-400">{selectedAudit?.serialNumber}</span>
            </DialogTitle>
            <DialogDescription className="text-slate-400 text-xs">
              Compare user-submitted details with the existing database record and modify if necessary before syncing.
            </DialogDescription>
          </DialogHeader>

          {selectedAudit && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4 text-xs">
              {/* Left Side: Side-by-Side Comparison */}
              <div className="space-y-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Comparison Dashboard</h3>
                <div className="border border-slate-800 rounded-xl overflow-hidden">
                  <div className="grid grid-cols-3 bg-slate-950 p-2 font-bold border-b border-slate-800">
                    <div>Field</div>
                    <div>Submitted</div>
                    <div>Live DB</div>
                  </div>
                  
                  {[
                    { 
                      label: "Custodian", 
                      sub: `${selectedAudit.custodianName} (${selectedAudit.employeeNo})`, 
                      live: selectedAudit.existingAsset?.assignedStaff 
                        ? `${selectedAudit.existingAsset.assignedStaff.name} (${selectedAudit.existingAsset.assignedStaff.employeeId})` 
                        : "N/A",
                      match: selectedAudit.custodianName.toLowerCase().trim() === (selectedAudit.existingAsset?.assignedStaff?.name || "").toLowerCase().trim() &&
                             selectedAudit.employeeNo.toLowerCase().trim() === (selectedAudit.existingAsset?.assignedStaff?.employeeId || "").toLowerCase().trim()
                    },
                    { 
                      label: "Asset Number", 
                      sub: selectedAudit.assetNumber || "N/A", 
                      live: selectedAudit.existingAsset?.assetNumber || "N/A",
                      match: (selectedAudit.assetNumber || "") === (selectedAudit.existingAsset?.assetNumber || "")
                    },
                    { 
                      label: "Brand", 
                      sub: selectedAudit.brand, 
                      live: selectedAudit.existingAsset?.brand || "N/A",
                      match: selectedAudit.brand.toLowerCase().trim() === (selectedAudit.existingAsset?.brand || "").toLowerCase().trim()
                    },
                    { 
                      label: "Model", 
                      sub: selectedAudit.model, 
                      live: selectedAudit.existingAsset?.model || "N/A",
                      match: selectedAudit.model.toLowerCase().trim() === (selectedAudit.existingAsset?.model || "").toLowerCase().trim()
                    },
                    { 
                      label: "Device Type", 
                      sub: selectedAudit.deviceType, 
                      live: selectedAudit.existingAsset?.deviceType || "N/A",
                      match: selectedAudit.deviceType === selectedAudit.existingAsset?.deviceType
                    },
                    { 
                      label: "Department", 
                      sub: selectedAudit.department || "N/A", 
                      live: selectedAudit.existingAsset?.department || "N/A",
                      match: (selectedAudit.department || "").toLowerCase().trim() === (selectedAudit.existingAsset?.department || "").toLowerCase().trim()
                    },
                    { 
                      label: "Site Office", 
                      sub: siteOffices.find(o => o.id === selectedAudit.siteOfficeId)?.name || "N/A", 
                      live: selectedAudit.existingAsset?.siteOfficeName || "N/A",
                      match: selectedAudit.siteOfficeId === selectedAudit.existingAsset?.siteOfficeId
                    },
                    { 
                      label: "Location", 
                      sub: selectedAudit.location || "N/A", 
                      live: selectedAudit.existingAsset?.location || "N/A",
                      match: (selectedAudit.location || "").toLowerCase().trim() === (selectedAudit.existingAsset?.location || "").toLowerCase().trim()
                    },
                  ].map((row, idx) => (
                    <div key={idx} className={`grid grid-cols-3 p-2.5 border-b border-slate-800/60 align-middle ${
                      row.match ? "bg-emerald-950/15 text-emerald-400" : "bg-rose-950/15 text-rose-300"
                    }`}>
                      <div className="font-semibold">{row.label}</div>
                      <div className="truncate pr-1">{row.sub}</div>
                      <div className="truncate">{row.live}</div>
                    </div>
                  ))}
                </div>

                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                  <span className="font-bold text-slate-400 block">User Remarks & Checklist:</span>
                  <p className="mt-1 text-slate-300 italic">{selectedAudit.remarks || "—"}</p>
                </div>
              </div>

              {/* Right Side: Edit / Sync Form */}
              <div className="space-y-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Sync Configurations (Edit prior to save)</h3>
                
                <div className="space-y-3.5 bg-slate-950/50 p-4 rounded-xl border border-slate-800">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase">Asset Number</label>
                      <Input 
                        value={editAssetNumber} 
                        onChange={e => setEditAssetNumber(e.target.value)} 
                        className="h-8 text-xs bg-slate-900 border-slate-850 text-white"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase">Device Type</label>
                      <Select value={editDeviceType} onValueChange={setEditDeviceType}>
                        <SelectTrigger className="h-8 text-xs bg-slate-900 border-slate-850 text-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-slate-900 border-slate-850 text-white">
                          <SelectItem value="LAPTOP">Laptop</SelectItem>
                          <SelectItem value="DESKTOP">Desktop</SelectItem>
                          <SelectItem value="MOBILE">Mobile Phone</SelectItem>
                          <SelectItem value="PRINTER">Printer</SelectItem>
                          <SelectItem value="NETWORK">Network Device</SelectItem>
                          <SelectItem value="OTHER">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase">Brand</label>
                      <Input 
                        value={editBrand} 
                        onChange={e => setEditBrand(e.target.value)} 
                        className="h-8 text-xs bg-slate-900 border-slate-855 text-white"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase">Model</label>
                      <Input 
                        value={editModel} 
                        onChange={e => setEditModel(e.target.value)} 
                        className="h-8 text-xs bg-slate-900 border-slate-855 text-white"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase">Department</label>
                      <Input 
                        value={editDepartment} 
                        onChange={e => setEditDepartment(e.target.value)} 
                        className="h-8 text-xs bg-slate-900 border-slate-855 text-white"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase">Site Office</label>
                      <Select 
                        value={editSiteOfficeId || "none"} 
                        onValueChange={val => setEditSiteOfficeId(val === "none" ? "" : val)}
                      >
                        <SelectTrigger className="h-8 text-xs bg-slate-900 border-slate-855 text-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-slate-900 border-slate-855 text-white max-h-40 overflow-y-auto">
                          <SelectItem value="none">Not Specified</SelectItem>
                          {siteOffices.map((office) => (
                            <SelectItem key={office.id} value={office.id}>{office.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase">Location</label>
                      <Input 
                        value={editLocation} 
                        onChange={e => setEditLocation(e.target.value)} 
                        className="h-8 text-xs bg-slate-900 border-slate-855 text-white"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase">Asset Status</label>
                      <Select value={editStatus} onValueChange={setEditStatus}>
                        <SelectTrigger className="h-8 text-xs bg-slate-900 border-slate-855 text-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-slate-900 border-slate-855 text-white">
                          <SelectItem value="ACTIVE">Active</SelectItem>
                          <SelectItem value="UNDER_REPAIR">Under Repair</SelectItem>
                          <SelectItem value="DECOMMISSIONED">Decommissioned</SelectItem>
                          <SelectItem value="SPARE">Spare Inventory</SelectItem>
                          <SelectItem value="FAULTY">Faulty</SelectItem>
                          <SelectItem value="DISPOSED">Disposed</SelectItem>
                          <SelectItem value="TRANSFERRED">Transferred</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                <div className="flex gap-2.5 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => handleReject(selectedAudit.id)}
                    className="flex-1 text-xs border-red-800 text-red-400 bg-red-950/20 hover:bg-red-950/40"
                  >
                    Ignore / Reject Report
                  </Button>
                  
                  <Button
                    type="button"
                    onClick={() => handleApproveSync(selectedAudit.id)}
                    disabled={syncingId === selectedAudit.id}
                    className="flex-1 text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-semibold"
                  >
                    {syncingId === selectedAudit.id ? "Syncing..." : "Approve & Sync Details"}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
