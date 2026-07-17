"use client";

import React, { useEffect, useState, useCallback } from "react";
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, CheckCircle, ArrowLeft, X } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
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
  isPersonal: boolean;
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
    imei2?: string | null;
    simNumber?: string | null;
    mdmEnrolled?: boolean | null;
  } | null;
}

export default function AdminAuditReviewPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [user, setUser] = useState<{ id: string; name: string; role: string } | null>(null);
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
  const [editImei2, setEditImei2] = useState("");
  const [editSimNumber, setEditSimNumber] = useState("");
  const [editMdmEnrolled, setEditMdmEnrolled] = useState(false);

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

  const fetchSiteOffices = useCallback(async () => {
    try {
      const res = await fetch("/api/helpdesk/site-offices?limit=200");
      const json = await res.json();
      if (json.success) {
        setSiteOffices(json.data.siteOffices || json.data || []);
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
    if (mounted && user) {
      fetchAudits();
      fetchSiteOffices();
    }
  }, [mounted, user, fetchAudits, fetchSiteOffices]);

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
    setEditImei2(audit.existingAsset?.imei2 || "");
    setEditSimNumber(audit.existingAsset?.simNumber || "");
    setEditMdmEnrolled(audit.existingAsset?.mdmEnrolled || false);
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
        status: editStatus,
        imei2: editImei2 || null,
        simNumber: editSimNumber || null,
        mdmEnrolled: editMdmEnrolled
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
              deviceType: editDeviceType as AuditRecord["deviceType"],
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

  const isITStaff = !!(user?.role && ["SUPER_ADMIN", "ADMIN", "ENGINEER", "OFFICE_ADMIN", "OFFICE_ADMIN_ASSISTANT"].includes(user.role));

  if (!mounted || !user || !isITStaff) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <RefreshCw className="h-6 w-6 text-primary animate-spin" />
      </div>
    );
  }

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
                    let badge = <Badge className="bg-blue-100 text-blue-800 border-blue-200 text-[10px]">NEW SUBMISSION</Badge>;
                    if (a.isSynced) {
                      badge = <Badge className="bg-slate-100 text-slate-700 border-slate-200 text-[10px]">SYNCED</Badge>;
                    } else if (a.isPersonal) {
                      badge = <Badge className="bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-950/30 dark:text-purple-400 dark:border-purple-800 text-[10px]">PERSONAL DEVICE</Badge>;
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

      {/* Reconcile Dialog Cockpit (Right-side Drawer Layout) */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent 
          showCloseButton={false}
          className="fixed !inset-y-0 !right-0 !top-0 !left-auto !translate-x-0 !translate-y-0 !h-full w-[35vw] lg:w-[35vw] md:w-[50vw] sm:w-full !max-w-none flex flex-col !p-0 !gap-0 overflow-hidden bg-slate-900 border-l border-slate-800 shadow-2xl z-50 duration-300 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right !rounded-none text-slate-100"
        >
          {selectedAudit && (() => {
            const hasExistingAsset = !!selectedAudit.existingAsset;
            const custodianMatch = selectedAudit.custodianName.toLowerCase().trim() === (selectedAudit.existingAsset?.assignedStaff?.name || "").toLowerCase().trim() &&
                                   selectedAudit.employeeNo.toLowerCase().trim() === (selectedAudit.existingAsset?.assignedStaff?.employeeId || "").toLowerCase().trim();
            const assetNoMatch = (selectedAudit.assetNumber || "") === (selectedAudit.existingAsset?.assetNumber || "");
            const brandMatch = selectedAudit.brand.toLowerCase().trim() === (selectedAudit.existingAsset?.brand || "").toLowerCase().trim();
            const modelMatch = selectedAudit.model.toLowerCase().trim() === (selectedAudit.existingAsset?.model || "").toLowerCase().trim();
            const deviceTypeMatch = selectedAudit.deviceType === selectedAudit.existingAsset?.deviceType;
            const deptMatch = (selectedAudit.department || "").toLowerCase().trim() === (selectedAudit.existingAsset?.department || "").toLowerCase().trim();
            const siteOfficeMatch = selectedAudit.siteOfficeId === selectedAudit.existingAsset?.siteOfficeId;
            const locationMatch = (selectedAudit.location || "").toLowerCase().trim() === (selectedAudit.existingAsset?.location || "").toLowerCase().trim();

            const allFieldsMatch = hasExistingAsset && 
              custodianMatch && assetNoMatch && brandMatch && modelMatch && 
              deviceTypeMatch && deptMatch && siteOfficeMatch && locationMatch;

            return (
              <>
                {/* Drawer Header */}
                <div className="relative p-5 pb-4 flex-shrink-0 bg-slate-950 border-b border-slate-800">
                  <div className="absolute top-0 right-0 p-4.5">
                    <button 
                      type="button"
                      onClick={() => setIsOpen(false)} 
                      className="p-1.5 rounded-full hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <DialogTitle className="text-sm font-extrabold text-white flex items-center gap-1.5">
                    Reconcile Audit - S/N: <span className="font-mono text-emerald-450">{selectedAudit.serialNumber}</span>
                  </DialogTitle>
                  <DialogDescription className="text-slate-400 text-[11px] mt-0.5">
                    Compare user-submitted details and sync with database inventory.
                  </DialogDescription>
                </div>

                {/* Drawer Scrollable Body (Vertical Stack Layout) */}
                <div className="flex-1 overflow-y-auto p-5 space-y-5">
                  
                  {/* Section 1: Comparison Dashboard */}
                  <div className="space-y-2.5">
                    <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span>
                      Comparison Dashboard
                    </h3>
                    
                    {selectedAudit.isPersonal ? (
                      <div className="bg-purple-950/20 border border-purple-900/40 text-purple-300 p-3 rounded-lg text-[10px]">
                        This is a user-reported <strong>Personal Device</strong>. It does not exist in the company inventory. Syncing will resolve the audit request without database asset updates.
                      </div>
                    ) : !hasExistingAsset ? (
                      <div className="bg-blue-950/20 border border-blue-900/40 text-blue-300 p-3 rounded-lg text-[10px]">
                        <strong>New / Unregistered Device:</strong> This serial number does not exist in the database inventory yet. Syncing will register it as a new asset.
                      </div>
                    ) : allFieldsMatch ? (
                      <div className="bg-emerald-950/20 border border-emerald-900/40 text-emerald-300 p-3 rounded-lg text-[10px]">
                        <strong>All Details Match:</strong> The audited details match the database record perfectly. No discrepancies detected!
                      </div>
                    ) : (
                      <div className="bg-amber-950/20 border border-amber-900/40 text-amber-300 p-3 rounded-lg text-[10px]">
                        <strong>Discrepancies Detected:</strong> Some details do not match the database. Check the highlighted rows below.
                      </div>
                    )}

                    <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950/20">
                      <table className="w-full table-fixed border-collapse text-[11px]">
                        <thead>
                          <tr className="bg-slate-950 border-b border-slate-800 text-slate-400 font-bold text-left">
                            <th className="w-[30%] p-2.5">Field</th>
                            <th className="w-[35%] p-2.5">Submitted</th>
                            <th className="w-[35%] p-2.5">Live DB</th>
                          </tr>
                        </thead>
                        <tbody>
                          {[
                            { 
                              label: "Custodian", 
                              sub: `${selectedAudit.custodianName} (${selectedAudit.employeeNo})`, 
                              live: selectedAudit.existingAsset?.assignedStaff 
                                ? `${selectedAudit.existingAsset.assignedStaff.name} (${selectedAudit.existingAsset.assignedStaff.employeeId})` 
                                : "N/A",
                              match: custodianMatch
                            },
                            { 
                              label: "Asset No", 
                              sub: selectedAudit.assetNumber || "N/A", 
                              live: selectedAudit.existingAsset?.assetNumber || "N/A",
                              match: assetNoMatch
                            },
                            { 
                              label: "Brand", 
                              sub: selectedAudit.brand, 
                              live: selectedAudit.existingAsset?.brand || "N/A",
                              match: brandMatch
                            },
                            { 
                              label: "Model", 
                              sub: selectedAudit.model, 
                              live: selectedAudit.existingAsset?.model || "N/A",
                              match: modelMatch
                            },
                            { 
                              label: "Device Type", 
                              sub: selectedAudit.deviceType, 
                              live: selectedAudit.existingAsset?.deviceType || "N/A",
                              match: deviceTypeMatch
                            },
                            { 
                              label: "Department", 
                              sub: selectedAudit.department || "N/A", 
                              live: selectedAudit.existingAsset?.department || "N/A",
                              match: deptMatch
                            },
                            { 
                              label: "Site Office", 
                              sub: (siteOffices || []).find(o => o.id === selectedAudit.siteOfficeId)?.name || "N/A", 
                              live: selectedAudit.existingAsset?.siteOfficeName || "N/A",
                              match: siteOfficeMatch
                            },
                            { 
                              label: "Location", 
                              sub: selectedAudit.location || "N/A", 
                              live: selectedAudit.existingAsset?.location || "N/A",
                              match: locationMatch
                            },
                          ].map((row, idx) => (
                            <tr 
                              key={idx} 
                              className={`border-b border-slate-800/40 transition-colors ${
                                row.match 
                                  ? "bg-emerald-950/5 text-emerald-400 hover:bg-emerald-950/10" 
                                  : "bg-amber-950/5 text-amber-300 hover:bg-amber-950/10"
                              }`}
                            >
                              <td className="p-2.5 font-semibold align-top">{row.label}</td>
                              <td className="p-2.5 whitespace-normal break-words pr-1.5">{row.sub}</td>
                              <td className="p-2.5 whitespace-normal break-words text-slate-400">{row.live}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Section 2: User Remarks */}
                  <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 space-y-1">
                    <span className="font-bold text-slate-400 block uppercase text-[9px] tracking-wider">User Remarks & Checklist</span>
                    <p className="text-[11px] text-slate-200 italic whitespace-normal break-words">{selectedAudit.remarks || "No comments provided."}</p>
                  </div>

                  {/* Section 3: Sync Configurations Form */}
                  <div className="space-y-2.5">
                    <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span>
                      Sync Configurations (Edit fields to resolve details)
                    </h3>
                    
                    <div className="space-y-3.5 bg-slate-950/30 p-4 rounded-xl border border-slate-800">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-[9px] font-bold text-slate-400 uppercase">Asset Number</label>
                          <Input 
                            value={editAssetNumber} 
                            onChange={e => setEditAssetNumber(e.target.value)} 
                            className="h-8 text-xs bg-slate-900 border-slate-800 text-white focus-visible:ring-emerald-500"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] font-bold text-slate-400 uppercase">Device Type</label>
                          <Select value={editDeviceType} onValueChange={setEditDeviceType}>
                            <SelectTrigger className="h-8 text-xs bg-slate-900 border-slate-800 text-white focus:ring-emerald-500">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-slate-900 border-slate-800 text-white">
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
                          <label className="text-[9px] font-bold text-slate-400 uppercase">Brand</label>
                          <Input 
                            value={editBrand} 
                            onChange={e => setEditBrand(e.target.value)} 
                            className="h-8 text-xs bg-slate-900 border-slate-800 text-white focus-visible:ring-emerald-500"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] font-bold text-slate-400 uppercase">Model</label>
                          <Input 
                            value={editModel} 
                            onChange={e => setEditModel(e.target.value)} 
                            className="h-8 text-xs bg-slate-900 border-slate-800 text-white focus-visible:ring-emerald-500"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-[9px] font-bold text-slate-400 uppercase">Department</label>
                          <Input 
                            value={editDepartment} 
                            onChange={e => setEditDepartment(e.target.value)} 
                            className="h-8 text-xs bg-slate-900 border-slate-800 text-white focus-visible:ring-emerald-500"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] font-bold text-slate-400 uppercase">Site Office</label>
                          <Select 
                            value={editSiteOfficeId || "none"} 
                            onValueChange={val => setEditSiteOfficeId(val === "none" ? "" : val)}
                          >
                            <SelectTrigger className="h-8 text-xs bg-slate-900 border-slate-800 text-white focus:ring-emerald-500">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-slate-900 border-slate-800 text-white max-h-40 overflow-y-auto">
                              <SelectItem value="none">Not Specified</SelectItem>
                              {(siteOffices || []).map((office) => (
                                <SelectItem key={office.id} value={office.id}>{office.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-[9px] font-bold text-slate-400 uppercase">Location</label>
                          <Input 
                            value={editLocation} 
                            onChange={e => setEditLocation(e.target.value)} 
                            className="h-8 text-xs bg-slate-900 border-slate-800 text-white focus-visible:ring-emerald-500"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] font-bold text-slate-400 uppercase">Asset Status</label>
                          <Select value={editStatus} onValueChange={setEditStatus}>
                            <SelectTrigger className="h-8 text-xs bg-slate-900 border-slate-800 text-white focus:ring-emerald-500">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-slate-900 border-slate-800 text-white">
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

                      {editDeviceType === "MOBILE" && (
                        <div className="space-y-3.5 pt-2.5 border-t border-slate-800/60">
                          <h4 className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">Mobile Specifications</h4>
                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <label className="text-[9px] font-bold text-slate-400 uppercase">Secondary IMEI (IMEI 2)</label>
                              <Input 
                                value={editImei2} 
                                onChange={e => setEditImei2(e.target.value)} 
                                placeholder="Secondary IMEI if Dual SIM"
                                className="h-8 text-xs bg-slate-900 border-slate-800 text-white focus-visible:ring-emerald-500"
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-[9px] font-bold text-slate-400 uppercase">SIM Phone Number</label>
                              <Input 
                                value={editSimNumber} 
                                onChange={e => setEditSimNumber(e.target.value)} 
                                placeholder="e.g. +94 77 XXXXXXX"
                                className="h-8 text-xs bg-slate-900 border-slate-800 text-white focus-visible:ring-emerald-500"
                              />
                            </div>
                          </div>
                          <div className="flex items-center gap-2 pt-1">
                            <input 
                              type="checkbox"
                              id="mdmEnrolled"
                              checked={editMdmEnrolled}
                              onChange={e => setEditMdmEnrolled(e.target.checked)}
                              className="h-3.5 w-3.5 rounded border-slate-800 bg-slate-900 text-emerald-500 focus:ring-emerald-500 accent-emerald-500"
                            />
                            <label htmlFor="mdmEnrolled" className="text-[10px] font-bold text-slate-300 cursor-pointer select-none">
                              Enrolled in Mobile Device Management (MDM)
                            </label>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Drawer Sticky Footer */}
                <div className="p-4 bg-slate-950/80 border-t border-slate-800 flex gap-3 flex-shrink-0">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => handleReject(selectedAudit.id)}
                    className="flex-1 h-9 text-xs border-red-900 text-red-400 bg-red-950/10 hover:bg-red-950/30 hover:text-red-300 transition-colors"
                  >
                    Ignore Report
                  </Button>
                  
                  <Button
                    type="button"
                    onClick={() => handleApproveSync(selectedAudit.id)}
                    disabled={syncingId === selectedAudit.id}
                    className="flex-1 h-9 text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-semibold transition-colors"
                  >
                    {syncingId === selectedAudit.id ? "Syncing..." : "Approve & Sync"}
                  </Button>
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
