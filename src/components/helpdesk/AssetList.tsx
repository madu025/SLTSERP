import React, { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Laptop, Monitor, Phone, Printer, Network, HardDrive, User, Plus, Pencil, Trash2, AlertTriangle, ClipboardList, RefreshCw, X, Layers } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CreateAssetSchema, UpdateAssetSchema, CreateAssetHandoverSchema } from "@/lib/validations/helpdesk.schema";
import { toast } from "sonner";

import { z } from "zod";

export interface ITAsset {
  id: string;
  assetNumber: string;
  serialNumber: string;
  deviceType: "LAPTOP" | "DESKTOP" | "MOBILE" | "PRINTER" | "NETWORK" | "OTHER";
  brand: string;
  model: string;
  assignedStaffId?: string | null;
  assignedStaff?: {
    id: string;
    name: string;
    employeeId: string;
    designation?: string | null;
  } | null;
  department?: string | null;
  siteOfficeId?: string | null;
  siteOffice?: {
    id: string;
    name: string;
  } | null;
  location?: string | null;
  status: "ACTIVE" | "UNDER_REPAIR" | "DECOMMISSIONED" | "SPARE" | "FAULTY" | "DISPOSED";
  purchaseDate?: string | Date | null;
  warrantyExpiry?: string | Date | null;
  purchaseCost?: number | null;
  agreementReceived?: boolean;
  _count?: {
    units: number;
  };
}

export interface StaffSummary {
  id: string;
  name: string;
  employeeId: string;
  designation?: string | null;
}

interface AssetListProps {
  assets: ITAsset[];
  onAddAsset: (data: z.infer<typeof CreateAssetSchema>) => Promise<void>;
  onEditAsset?: (id: string, data: z.infer<typeof UpdateAssetSchema>) => Promise<void>;
  onDeleteAsset?: (id: string) => Promise<void>;
  usersList: StaffSummary[];
  siteOfficesList?: { id: string; name: string }[];
  isStaff?: boolean;
}

export default function AssetList({
  assets,
  onAddAsset,
  onEditAsset,
  onDeleteAsset,
  usersList,
  siteOfficesList = [],
  isStaff = false
}: AssetListProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editAsset, setEditAsset] = useState<ITAsset | null>(null);
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<ITAsset | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isUnregistered, setIsUnregistered] = useState(false);

  // Handover Log States
  const [handoverAsset, setHandoverAsset] = useState<ITAsset | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [handoverLogs, setHandoverLogs] = useState<any[]>([]);
  const [loadingHandovers, setLoadingHandovers] = useState(false);
  const [handoverSubmitting, setHandoverSubmitting] = useState(false);

  // Units Drawer States
  const [selectedAssetForUnits, setSelectedAssetForUnits] = useState<ITAsset | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [units, setUnits] = useState<any[]>([]);
  const [loadingUnits, setLoadingUnits] = useState(false);
  const [unitSubmitting, setUnitSubmitting] = useState(false);
  const [unitForm, setUnitForm] = useState({
    serialNumber: "",
    unitNumber: "",
    status: "IN_HAND_STORES",
    assignedStaffId: "",
    remarks: ""
  });

  const createForm = useForm({
    resolver: zodResolver(CreateAssetSchema),
    defaultValues: {
      assetNumber: "",
      serialNumber: "",
      deviceType: "LAPTOP" as const,
      brand: "",
      model: "",
      assignedStaffId: "",
      department: "",
      siteOfficeId: "",
      location: "",
      status: "ACTIVE" as const,
      purchaseDate: "",
      warrantyExpiry: "",
      purchaseCost: 0
    }
  });
  const { register, handleSubmit, setValue, reset, formState: { errors } } = createForm;

  // Edit form with UpdateAssetSchema
  const editForm = useForm({
    resolver: zodResolver(UpdateAssetSchema)
  });

  // Handover form
  const handoverForm = useForm({
    resolver: zodResolver(CreateAssetHandoverSchema),
    defaultValues: {
      transactionType: "ISSUED_TO_USER" as const,
      targetStaffId: "",
      condition: "",
      remarks: ""
    }
  });

  const fetchHandoverLogs = async (assetId: string) => {
    setLoadingHandovers(true);
    try {
      const res = await fetch(`/api/helpdesk/assets/${assetId}/handover?_t=${Date.now()}`);
      if (res.ok) {
        const json = await res.json();
        if (json.success) setHandoverLogs(json.data);
        else if (Array.isArray(json)) setHandoverLogs(json);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingHandovers(false);
    }
  };

  const openHandoverDialog = (asset: ITAsset) => {
    setHandoverAsset(asset);
    handoverForm.reset();
    fetchHandoverLogs(asset.id);
  };

  const handleHandoverSubmit = async (data: z.infer<typeof CreateAssetHandoverSchema>) => {
    if (!handoverAsset) return;
    setHandoverSubmitting(true);
    try {
      const res = await fetch(`/api/helpdesk/assets/${handoverAsset.id}/handover`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          targetStaffId: data.targetStaffId || null
        })
      });
      if (!res.ok) throw new Error();
      
      handoverForm.reset();
      fetchHandoverLogs(handoverAsset.id);
      
      // We rely on the parent component reloading to fetch new assignedUser from API
      // Since it's a structural change, we can alert the parent or let the user refresh.
      // But we will manually trigger a page reload for simplicity since we don't have a direct `fetchAssets` callback exposed inside AssetList except from parent `assets` prop changing, wait, the parent `assets/page.tsx` listens to `typeFilter` but doesn't pass a `onUpdate` prop.
      toast.success("Handover logged! Please refresh the page to see the updated custodian in the main list.");
      
    } catch {
      toast.error("Failed to log asset transaction.");
    } finally {
      setHandoverSubmitting(false);
    }
  };

  const openEditDialog = (asset: ITAsset) => {
    setEditAsset(asset);
    setSearchQuery("");
    setIsUnregistered(false);
    
    // Format dates to YYYY-MM-DD for standard html5 input
    const formatInputDate = (d: string | Date | null | undefined) => {
      if (!d) return "";
      try {
        return new Date(d).toISOString().split('T')[0];
      } catch {
        return "";
      }
    };

    editForm.reset({
      assetNumber: asset.assetNumber,
      serialNumber: asset.serialNumber,
      deviceType: asset.deviceType,
      brand: asset.brand,
      model: asset.model,
      assignedStaffId: asset.assignedStaffId || "",
      department: asset.department || "",
      siteOfficeId: asset.siteOfficeId || "",
      location: asset.location || "",
      status: asset.status,
      purchaseDate: formatInputDate(asset.purchaseDate),
      warrantyExpiry: formatInputDate(asset.warrantyExpiry),
      purchaseCost: asset.purchaseCost || 0,
      agreementReceived: asset.agreementReceived || false,
      newCustodianName: "",
      newCustodianEmpNo: ""
    });
  };

  const handleEditSubmit = async (data: z.infer<typeof UpdateAssetSchema>) => {
    if (!editAsset || !onEditAsset) return;
    setEditSubmitting(true);
    try {
      const formatted = {
        ...data,
        assignedStaffId: data.assignedStaffId || null,
        department: data.department || null,
        siteOfficeId: data.siteOfficeId || null,
        location: data.location || null,
        purchaseDate: data.purchaseDate || null,
        warrantyExpiry: data.warrantyExpiry || null,
        purchaseCost: data.purchaseCost ? Number(data.purchaseCost) : null
      };
      await onEditAsset(editAsset.id, formatted);
      setEditAsset(null);
    } catch (err) {
      console.error(err);
    } finally {
      setEditSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm || !onDeleteAsset) return;
    setDeleting(true);
    try {
      await onDeleteAsset(deleteConfirm.id);
      setDeleteConfirm(null);
    } catch (err) {
      console.error(err);
    } finally {
      setDeleting(false);
    }
  };

  const fetchUnits = async (assetId: string) => {
    setLoadingUnits(true);
    try {
      const res = await fetch(`/api/helpdesk/assets/${assetId}/units?_t=${Date.now()}`);
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          setUnits(json.data);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingUnits(false);
    }
  };

  const openUnitsDrawer = (asset: ITAsset) => {
    setSelectedAssetForUnits(asset);
    setUnitForm({
      serialNumber: "",
      unitNumber: "",
      status: "IN_HAND_STORES",
      assignedStaffId: "",
      remarks: ""
    });
    fetchUnits(asset.id);
  };

  const handleAddUnit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAssetForUnits) return;
    if (!unitForm.serialNumber.trim()) {
      toast.error("Serial number is required");
      return;
    }

    setUnitSubmitting(true);
    try {
      const res = await fetch(`/api/helpdesk/assets/${selectedAssetForUnits.id}/units`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serialNumber: unitForm.serialNumber,
          unitNumber: unitForm.unitNumber || null,
          status: unitForm.status,
          assignedStaffId: unitForm.status === "ASSIGNED_TO_USER" ? unitForm.assignedStaffId || null : null,
          remarks: unitForm.remarks || null
        })
      });

      if (!res.ok) {
        const errorJson = await res.json();
        if (errorJson.message === "SERIAL_NUMBER_TAKEN") {
          toast.error("Serial number is already registered!");
          return;
        }
        if (errorJson.message === "UNIT_NUMBER_TAKEN") {
          toast.error("Unit number is already registered!");
          return;
        }
        throw new Error();
      }

      toast.success("Unit serial added successfully");
      setUnitForm({
        serialNumber: "",
        unitNumber: "",
        status: "IN_HAND_STORES",
        assignedStaffId: "",
        remarks: ""
      });
      fetchUnits(selectedAssetForUnits.id);
    } catch {
      toast.error("Failed to add unit serial");
    } finally {
      setUnitSubmitting(false);
    }
  };

  const handleUpdateUnitStatus = async (unitId: string, updates: { status?: string; assignedStaffId?: string | null }) => {
    if (!selectedAssetForUnits) return;
    try {
      const res = await fetch(`/api/helpdesk/assets/${selectedAssetForUnits.id}/units`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          unitId,
          ...updates
        })
      });
      if (!res.ok) throw new Error();
      toast.success("Unit details updated successfully");
      fetchUnits(selectedAssetForUnits.id);
    } catch {
      toast.error("Failed to update unit details");
    }
  };

  const handleDeleteUnit = async (unitId: string) => {
    if (!selectedAssetForUnits) return;
    if (!confirm("Are you sure you want to retire/delete this unit serial?")) return;

    try {
      const res = await fetch(`/api/helpdesk/assets/${selectedAssetForUnits.id}/units?unitId=${unitId}`, {
        method: "DELETE"
      });
      if (!res.ok) throw new Error();
      toast.success("Unit retired successfully");
      fetchUnits(selectedAssetForUnits.id);
    } catch {
      toast.error("Failed to retire unit");
    }
  };

  const getDeviceIcon = (type: string) => {
    switch (type) {
      case "LAPTOP":
        return <Laptop className="h-4 w-4 text-indigo-500" />;
      case "DESKTOP":
        return <Monitor className="h-4 w-4 text-blue-500" />;
      case "MOBILE":
        return <Phone className="h-4 w-4 text-teal-500" />;
      case "PRINTER":
        return <Printer className="h-4 w-4 text-amber-500" />;
      case "NETWORK":
        return <Network className="h-4 w-4 text-purple-500" />;
      case "OTHER":
      default:
        return <HardDrive className="h-4 w-4 text-slate-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "ACTIVE":
        return <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-200 border-emerald-200 text-[10px]">ACTIVE</Badge>;
      case "UNDER_REPAIR":
        return <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-200 border-amber-200 text-[10px]">REPAIRING</Badge>;
      case "SPARE":
        return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-200 border-blue-200 text-[10px]">SPARE</Badge>;
      case "FAULTY":
        return <Badge className="bg-rose-100 text-rose-800 hover:bg-rose-200 border-rose-200 text-[10px]">FAULTY</Badge>;
      case "DISPOSED":
        return <Badge className="bg-red-100 text-red-800 hover:bg-red-200 border-red-200 text-[10px]">DISPOSED</Badge>;
      case "DECOMMISSIONED":
      default:
        return <Badge className="bg-slate-100 text-slate-800 hover:bg-slate-200 border-slate-200 text-[10px]">DECOMMISSIONED</Badge>;
    }
  };

  const onSubmit = async (data: z.infer<typeof CreateAssetSchema>) => {
    setSubmitting(true);
    try {
      // Empty string values to undefined/null
      const formatted = {
        ...data,
        assignedStaffId: data.assignedStaffId || null,
        department: data.department || null,
        siteOfficeId: data.siteOfficeId || null,
        location: data.location || null,
        purchaseDate: data.purchaseDate || null,
        warrantyExpiry: data.warrantyExpiry || null,
        purchaseCost: data.purchaseCost ? Number(data.purchaseCost) : null
      };
      await onAddAsset(formatted);
      reset();
      setIsOpen(false);
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  const filteredUsers = searchQuery ? usersList.filter(u =>
    u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.employeeId.toLowerCase().includes(searchQuery.toLowerCase())
  ).slice(0, 5) : [];

  const currentAssignedStaffId = editForm.watch("assignedStaffId");
  const currentStaff = usersList.find(u => u.id === currentAssignedStaffId);

  return (
    <div className="space-y-4">
      {isStaff && (
        <div className="flex justify-between items-center bg-card/60 backdrop-blur-md p-4 rounded-lg border border-border/50">
          <div>
            <h2 className="text-sm font-bold text-foreground">Registered Company IT Assets</h2>
            <p className="text-xs text-muted-foreground">List of laptops, printers, and network devices.</p>
          </div>
          <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="h-8 gap-1.5 transition-all hover:scale-103 bg-primary hover:bg-primary/95 text-xs text-white">
                <Plus className="h-4 w-4" />
                Register Asset
              </Button>
            </DialogTrigger>
            <DialogContent 
              showCloseButton={false}
              className="fixed !inset-y-0 !right-0 !top-0 !left-auto !translate-x-0 !translate-y-0 !h-full w-[35vw] md:w-[35vw] sm:w-full !max-w-none flex flex-col !p-0 !gap-0 overflow-hidden bg-white dark:bg-slate-950 border-l border-slate-200 dark:border-slate-800 shadow-2xl z-50 duration-300 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right !rounded-none text-foreground"
            >
              <div className="relative p-6 pb-4 flex-shrink-0 bg-slate-50 dark:bg-slate-900/60 border-b border-slate-200/60 dark:border-slate-800/60">
                <div className="absolute top-0 right-0 p-5">
                  <button 
                    type="button"
                    onClick={() => setIsOpen(false)} 
                    className="p-2 rounded-full hover:bg-slate-200/50 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <DialogTitle className="text-base font-extrabold text-slate-900 dark:text-white">Register New IT Device</DialogTitle>
              </div>
              <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col flex-grow overflow-hidden text-xs">
                <div className="flex-grow overflow-y-auto p-6 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-semibold text-muted-foreground uppercase">Asset Number</label>
                    <Input
                      {...register("assetNumber")}
                      placeholder="e.g. SLT-IT-009"
                      className="h-8 text-xs bg-muted/20 border-border"
                    />
                    {errors.assetNumber && <p className="text-[10px] text-red-500">{errors.assetNumber.message}</p>}
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-semibold text-muted-foreground uppercase">Serial Number</label>
                    <Input
                      {...register("serialNumber")}
                      placeholder="e.g. S/N 9987A-BX"
                      className="h-8 text-xs bg-muted/20 border-border"
                    />
                    {errors.serialNumber && <p className="text-[10px] text-red-500">{errors.serialNumber.message}</p>}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-semibold text-muted-foreground uppercase">Device Type</label>
                    <Select onValueChange={(v) => setValue("deviceType", v as "LAPTOP" | "DESKTOP" | "MOBILE" | "PRINTER" | "NETWORK" | "OTHER")}>
                      <SelectTrigger className="h-8 text-xs bg-muted/20 border-border">
                        <SelectValue placeholder="LAPTOP" />
                      </SelectTrigger>
                      <SelectContent className="bg-card">
                        <SelectItem value="LAPTOP">Laptop</SelectItem>
                        <SelectItem value="DESKTOP">Desktop Computer</SelectItem>
                        <SelectItem value="MOBILE">Mobile Phone</SelectItem>
                        <SelectItem value="PRINTER">Printer</SelectItem>
                        <SelectItem value="NETWORK">Network Device</SelectItem>
                        <SelectItem value="OTHER">Other Equipment</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-semibold text-muted-foreground uppercase">Brand</label>
                    <Input
                      {...register("brand")}
                      placeholder="e.g. HP / Lenovo"
                      className="h-8 text-xs bg-muted/20 border-border"
                    />
                    {errors.brand && <p className="text-[10px] text-red-500">{errors.brand.message}</p>}
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-semibold text-muted-foreground uppercase">Model</label>
                    <Input
                      {...register("model")}
                      placeholder="e.g. ThinkPad T14"
                      className="h-8 text-xs bg-muted/20 border-border"
                    />
                    {errors.model && <p className="text-[10px] text-red-500">{errors.model.message}</p>}
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-muted-foreground uppercase">Assign to Staff (Custodian)</label>
                  <Select onValueChange={(v) => setValue("assignedStaffId", v)}>
                    <SelectTrigger className="h-8 text-xs bg-muted/20 border-border">
                      <SelectValue placeholder="Select Employee..." />
                    </SelectTrigger>
                    <SelectContent className="bg-card">
                      <SelectItem value="">Unassigned (Keep as Spare)</SelectItem>
                      {usersList.map((usr) => (
                        <SelectItem key={usr.id} value={usr.id}>{usr.name} ({usr.employeeId})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-semibold text-muted-foreground uppercase">Department</label>
                    <Input
                      {...register("department")}
                      placeholder="e.g. HR / Finance"
                      className="h-8 text-xs bg-muted/20 border-border"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-semibold text-muted-foreground uppercase">Site Office</label>
                    <Select onValueChange={(v) => setValue("siteOfficeId", v)}>
                      <SelectTrigger className="h-8 text-xs bg-muted/20 border-border">
                        <SelectValue placeholder="Select OSP Site..." />
                      </SelectTrigger>
                      <SelectContent className="bg-card">
                        <SelectItem value="">None (HQ / General)</SelectItem>
                        {siteOfficesList.map((site) => (
                          <SelectItem key={site.id} value={site.id}>{site.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-muted-foreground uppercase">Room / Desk Location Metadata (Opt)</label>
                  <Input
                    {...register("location")}
                    placeholder="e.g. Server Room, Floor 2"
                    className="h-8 text-xs bg-muted/20 border-border"
                  />
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-semibold text-muted-foreground uppercase">Purchase Date</label>
                    <Input
                      type="date"
                      {...register("purchaseDate")}
                      className="h-8 text-xs bg-muted/20 border-border"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-semibold text-muted-foreground uppercase">Warranty Expiry</label>
                    <Input
                      type="date"
                      {...register("warrantyExpiry")}
                      className="h-8 text-xs bg-muted/20 border-border"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-semibold text-muted-foreground uppercase">Cost (LKR)</label>
                    <Input
                      type="number"
                      step="0.01"
                      {...register("purchaseCost")}
                      placeholder="0.00"
                      className="h-8 text-xs bg-muted/20 border-border"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-muted-foreground uppercase">Initial Status</label>
                  <Select onValueChange={(v) => setValue("status", v as z.infer<typeof CreateAssetSchema>["status"])}>
                    <SelectTrigger className="h-8 text-xs bg-muted/20 border-border">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-card">
                      <SelectItem value="ACTIVE">Active</SelectItem>
                      <SelectItem value="SPARE">Spare / Ready to Use</SelectItem>
                      <SelectItem value="UNDER_REPAIR">Under Repair</SelectItem>
                      <SelectItem value="FAULTY">Faulty (Needs Inspection)</SelectItem>
                      <SelectItem value="DISPOSED">Disposed / Scrapped</SelectItem>
                      <SelectItem value="DECOMMISSIONED">Decommissioned</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                </div>
                <div className="flex justify-end gap-2 p-5 border-t border-border/40 bg-slate-50 dark:bg-slate-900/20 shrink-0">
                  <Button type="button" variant="outline" size="sm" onClick={() => setIsOpen(false)} className="h-8 text-xs">
                    Cancel
                  </Button>
                  <Button type="submit" size="sm" disabled={submitting} className="h-8 text-xs text-white bg-primary">
                    {submitting ? "Saving..." : "Save Device"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      )}

      <div className="rounded-lg border border-border/50 bg-card/85 backdrop-blur-lg shadow-xl overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/40">
            <TableRow>
              <TableHead className="font-semibold text-xs py-2">Asset No</TableHead>
              <TableHead className="font-semibold text-xs py-2">Type</TableHead>
              <TableHead className="font-semibold text-xs py-2">Brand & Model</TableHead>
              <TableHead className="font-semibold text-xs py-2">Serial Number</TableHead>
              <TableHead className="font-semibold text-xs py-2">Custodian</TableHead>
              <TableHead className="font-semibold text-xs py-2">Department</TableHead>
              <TableHead className="font-semibold text-xs py-2">Agreement</TableHead>
              <TableHead className="font-semibold text-xs py-2">Site Office / Loc</TableHead>
              <TableHead className="font-semibold text-xs py-2">Status</TableHead>
              {isStaff && <TableHead className="font-semibold text-xs py-2 w-16">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {assets.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8 text-muted-foreground text-xs">
                  No company IT devices registered yet.
                </TableCell>
              </TableRow>
            ) : (
              assets.map((asset) => (
                <TableRow key={asset.id} className="hover:bg-muted/30 border-b border-border/40 text-xs">
                  <TableCell className="font-semibold py-2.5">{asset.assetNumber}</TableCell>
                  <TableCell className="py-2.5">
                    <div className="flex items-center gap-1.5 capitalize text-muted-foreground">
                      {getDeviceIcon(asset.deviceType)}
                      <span>{asset.deviceType.toLowerCase()}</span>
                    </div>
                  </TableCell>
                  <TableCell className="py-2.5 font-medium">
                    <div className="flex items-center gap-2">
                      <span>{asset.brand} - {asset.model}</span>
                      {asset._count?.units !== undefined && asset._count.units > 0 && (
                        <span className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-1.5 py-0.5 rounded text-[10px] font-black">
                          {asset._count.units} {asset._count.units === 1 ? 'Unit' : 'Units'}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="py-2.5 font-mono text-muted-foreground text-[11px]">
                     {asset._count?.units !== undefined && asset._count.units > 0 ? (
                       <span className="italic text-[10px] text-slate-400 font-sans font-semibold">Tracked via Units</span>
                     ) : (
                       asset.serialNumber
                     )}
                   </TableCell>
                  <TableCell className="py-2.5 text-foreground/80">
                    {asset.assignedStaff ? (
                      <div className="flex items-center gap-1">
                        <User className="h-3.5 w-3.5 text-primary" />
                        <span>{asset.assignedStaff.name}</span>
                      </div>
                    ) : (
                      <span className="italic text-muted-foreground/50">None (Spare)</span>
                    )}
                  </TableCell>
                  <TableCell className="py-2.5 text-muted-foreground">{asset.department || "N/A"}</TableCell>
                  <TableCell className="py-2.5">
                    {asset.agreementReceived ? (
                      <span className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded-full text-[10px] font-bold">
                        Received
                      </span>
                    ) : (
                      <span className="bg-amber-500/10 text-amber-600 dark:text-amber-400 px-2 py-0.5 rounded-full text-[10px] font-bold">
                        Pending
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="py-2.5 text-muted-foreground">
                    {asset.siteOffice?.name || "HQ"}
                    {asset.location ? ` - ${asset.location}` : ""}
                  </TableCell>
                  <TableCell className="py-2.5">{getStatusBadge(asset.status)}</TableCell>
                  {isStaff && (
                    <TableCell className="py-2.5">
                      <div className="flex items-center gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 w-6 p-0 text-muted-foreground hover:text-primary hover:bg-primary/10"
                          onClick={() => openEditDialog(asset)}
                          title="Edit asset"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 w-6 p-0 text-muted-foreground hover:text-red-500 hover:bg-red-500/10"
                          onClick={() => setDeleteConfirm(asset)}
                          title="Delete asset"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 w-6 p-0 text-muted-foreground hover:text-indigo-500 hover:bg-indigo-500/10"
                          onClick={() => openHandoverDialog(asset)}
                          title="Handover Log"
                        >
                          <ClipboardList className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 w-6 p-0 text-muted-foreground hover:text-emerald-500 hover:bg-emerald-500/10"
                          onClick={() => openUnitsDrawer(asset)}
                          title="Manage Units (Serials)"
                        >
                          <Layers className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Edit Asset Drawer */}
      <Dialog open={!!editAsset} onOpenChange={(open) => !open && setEditAsset(null)}>
        {editAsset && (
          <DialogContent 
            showCloseButton={false}
            className="fixed !inset-y-0 !right-0 !top-0 !left-auto !translate-x-0 !translate-y-0 !h-full w-[35vw] md:w-[35vw] sm:w-full !max-w-none flex flex-col !p-0 !gap-0 overflow-hidden bg-white dark:bg-slate-950 border-l border-slate-200 dark:border-slate-800 shadow-2xl z-50 duration-300 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right !rounded-none text-foreground"
          >
            <div className="relative p-6 pb-4 flex-shrink-0 bg-slate-50 dark:bg-slate-900/60 border-b border-slate-200/60 dark:border-slate-800/60">
              <div className="absolute top-0 right-0 p-5">
                <button 
                  type="button"
                  onClick={() => setEditAsset(null)} 
                  className="p-2 rounded-full hover:bg-slate-200/50 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <DialogTitle className="text-base font-extrabold text-slate-900 dark:text-white">Edit Asset — {editAsset.assetNumber}</DialogTitle>
            </div>
            <form onSubmit={editForm.handleSubmit(handleEditSubmit)} className="flex flex-col flex-grow overflow-hidden text-xs">
              <div className="flex-grow overflow-y-auto p-6 space-y-4 mt-0">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase">Asset No</label>
                  <Input {...editForm.register("assetNumber")} className="h-8 text-xs bg-muted/20" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase">Serial No</label>
                  <Input {...editForm.register("serialNumber")} className="h-8 text-xs bg-muted/20" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase">Device Type</label>
                  <Select
                    value={editForm.watch("deviceType") || "LAPTOP"}
                    onValueChange={(v) => editForm.setValue("deviceType", v as z.infer<typeof UpdateAssetSchema>["deviceType"])}
                  >
                    <SelectTrigger className="h-8 text-xs bg-muted/20">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-card">
                      <SelectItem value="LAPTOP">Laptop</SelectItem>
                      <SelectItem value="DESKTOP">Desktop Computer</SelectItem>
                      <SelectItem value="MOBILE">Mobile Phone</SelectItem>
                      <SelectItem value="PRINTER">Printer</SelectItem>
                      <SelectItem value="NETWORK">Network Device</SelectItem>
                      <SelectItem value="OTHER">Other Equipment</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase">Brand</label>
                  <Input {...editForm.register("brand")} className="h-8 text-xs bg-muted/20" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase">Model</label>
                  <Input {...editForm.register("model")} className="h-8 text-xs bg-muted/20" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase">Department</label>
                  <Input {...editForm.register("department")} className="h-8 text-xs bg-muted/20" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase">Site Office</label>
                  <Select
                    value={editForm.watch("siteOfficeId") || ""}
                    onValueChange={(v) => editForm.setValue("siteOfficeId", v || null)}
                  >
                    <SelectTrigger className="h-8 text-xs bg-muted/20">
                      <SelectValue placeholder="Select OSP Site..." />
                    </SelectTrigger>
                    <SelectContent className="bg-card">
                      <SelectItem value="">None (HQ / General)</SelectItem>
                      {siteOfficesList.map((site) => (
                        <SelectItem key={site.id} value={site.id}>{site.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-muted-foreground uppercase">Room / Desk Location Metadata (Opt)</label>
                <Input {...editForm.register("location")} className="h-8 text-xs bg-muted/20" />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase">Purchase Date</label>
                  <Input type="date" {...editForm.register("purchaseDate")} className="h-8 text-xs bg-muted/20" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase">Warranty Expiry</label>
                  <Input type="date" {...editForm.register("warrantyExpiry")} className="h-8 text-xs bg-muted/20" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase">Cost (LKR)</label>
                  <Input type="number" step="0.01" {...editForm.register("purchaseCost")} className="h-8 text-xs bg-muted/20" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase">Status</label>
                  <Select
                    value={editForm.watch("status") || "ACTIVE"}
                    onValueChange={(v) => editForm.setValue("status", v as ITAsset["status"])}
                  >
                    <SelectTrigger className="h-8 text-xs bg-muted/20">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-card">
                      <SelectItem value="ACTIVE">Active</SelectItem>
                      <SelectItem value="SPARE">Spare / Ready to Use</SelectItem>
                      <SelectItem value="UNDER_REPAIR">Under Repair</SelectItem>
                      <SelectItem value="FAULTY">Faulty</SelectItem>
                      <SelectItem value="DISPOSED">Disposed</SelectItem>
                      <SelectItem value="DECOMMISSIONED">Decommissioned</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Custodian & Agreement Section */}
              <div className="bg-slate-50 dark:bg-slate-900/40 p-4 rounded-lg border border-slate-200 dark:border-slate-800 space-y-3">
                <div className="flex justify-between items-center pb-2 border-b border-slate-200/60 dark:border-slate-800/60">
                  <span className="text-[10px] font-extrabold text-slate-800 dark:text-slate-200 uppercase tracking-wider">Custodian Details</span>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="checkbox"
                      id="isUnregistered"
                      checked={isUnregistered}
                      onChange={(e) => {
                        setIsUnregistered(e.target.checked);
                        if (e.target.checked) {
                          editForm.setValue("assignedStaffId", "");
                        } else {
                          editForm.setValue("newCustodianName", "");
                          editForm.setValue("newCustodianEmpNo", "");
                        }
                      }}
                      className="rounded border-slate-300 dark:border-slate-700 text-primary focus:ring-primary h-3.5 w-3.5"
                    />
                    <label htmlFor="isUnregistered" className="text-[10px] font-semibold text-slate-600 dark:text-slate-400 select-none cursor-pointer">
                      Unregistered Custodian?
                    </label>
                  </div>
                </div>

                {!isUnregistered ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <div className="relative flex-grow">
                        <Input
                          placeholder="Search custodian name or EPF..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="h-8 text-xs bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800"
                        />
                      </div>
                      {currentAssignedStaffId && (
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => {
                            editForm.setValue("assignedStaffId", "");
                            setSearchQuery("");
                          }}
                          className="h-8 px-2 text-xs text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20"
                        >
                          Clear Custodian
                        </Button>
                      )}
                    </div>

                    {/* Search Results */}
                    {searchQuery && (
                      <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-md shadow-lg max-h-40 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-900 z-10 relative">
                        {filteredUsers.length > 0 ? (
                          filteredUsers.map((u) => (
                            <button
                              key={u.id}
                              type="button"
                              onClick={() => {
                                editForm.setValue("assignedStaffId", u.id);
                                setSearchQuery("");
                              }}
                              className="w-full text-left px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-900 text-xs flex justify-between items-center transition-colors"
                            >
                              <span className="font-semibold text-slate-700 dark:text-slate-300">{u.name}</span>
                              <span className="text-[10px] text-slate-500 bg-slate-100 dark:bg-slate-900 dark:text-slate-400 px-1.5 py-0.5 rounded">EPF: {u.employeeId}</span>
                            </button>
                          ))
                        ) : (
                          <div className="px-3 py-2 text-[10px] text-slate-500 dark:text-slate-400 italic">No staff found matching query.</div>
                        )}
                      </div>
                    )}

                    {/* Current Custodian Badge */}
                    <div className="text-xs pt-1 flex items-center justify-between">
                      <span className="text-slate-500 dark:text-slate-400">Current Custodian:</span>
                      {currentAssignedStaffId ? (
                        <span className="font-bold text-primary bg-primary/10 dark:bg-primary/20 px-3 py-1 rounded-full flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5" />
                          {currentStaff ? `${currentStaff.name} (EPF: ${currentStaff.employeeId})` : "Linked Staff Profile"}
                        </span>
                      ) : (
                        <span className="text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-full font-semibold">
                          None (Spare / In Stores)
                        </span>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase">Unregistered Name</label>
                      <Input
                        {...editForm.register("newCustodianName")}
                        placeholder="e.g. John Silva"
                        className="h-8 text-xs bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase">Employee EPF No</label>
                      <Input
                        {...editForm.register("newCustodianEmpNo")}
                        placeholder="e.g. 1928"
                        className="h-8 text-xs bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800"
                      />
                    </div>
                  </div>
                )}

                {/* Handover Agreement Checkbox */}
                <div className="flex items-center gap-2 pt-3 border-t border-slate-200/60 dark:border-slate-800/60">
                  <input
                    type="checkbox"
                    id="agreementReceived"
                    checked={editForm.watch("agreementReceived") || false}
                    onChange={(e) => editForm.setValue("agreementReceived", e.target.checked)}
                    className="rounded border-slate-300 dark:border-slate-700 text-primary focus:ring-primary h-4 w-4"
                  />
                  <label
                    htmlFor="agreementReceived"
                    className="text-xs font-bold text-slate-800 dark:text-slate-200 select-none cursor-pointer"
                  >
                    Handover Agreement Form Received
                  </label>
                </div>
              </div>
              </div>
              <div className="flex justify-end gap-2 p-5 border-t border-border/40 bg-slate-50 dark:bg-slate-900/20 shrink-0">
                <Button type="button" variant="outline" size="sm" onClick={() => setEditAsset(null)} className="h-8 text-xs">Cancel</Button>
                <Button type="submit" size="sm" disabled={editSubmitting} className="h-8 text-xs text-white bg-primary">
                  {editSubmitting ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </form>
          </DialogContent>
        )}
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteConfirm} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
        {deleteConfirm && (
          <DialogContent className="max-w-sm bg-card/95 backdrop-blur-xl border border-border/50 shadow-2xl">
            <DialogHeader>
              <DialogTitle className="text-sm font-bold flex items-center gap-2 text-red-600">
                <AlertTriangle className="h-4 w-4" />
                Confirm Asset Deletion
              </DialogTitle>
            </DialogHeader>
            <p className="text-xs text-muted-foreground py-2">
              Are you sure you want to permanently delete asset <strong className="text-foreground">{deleteConfirm.assetNumber}</strong> ({deleteConfirm.brand} {deleteConfirm.model})? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
              <Button variant="destructive" size="sm" onClick={handleDelete} disabled={deleting}>
                {deleting ? "Deleting..." : "Delete Asset"}
              </Button>
            </div>
          </DialogContent>
        )}
      </Dialog>

      {/* Asset Handover Drawer */}
      <Dialog open={!!handoverAsset} onOpenChange={(open) => !open && setHandoverAsset(null)}>
        {handoverAsset && (
          <DialogContent 
            showCloseButton={false}
            className="fixed !inset-y-0 !right-0 !top-0 !left-auto !translate-x-0 !translate-y-0 !h-full w-[35vw] md:w-[35vw] sm:w-full !max-w-none flex flex-col !p-0 !gap-0 overflow-hidden bg-white dark:bg-slate-950 border-l border-slate-200 dark:border-slate-800 shadow-2xl z-50 duration-300 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right !rounded-none text-foreground"
          >
            <div className="relative p-6 pb-4 flex-shrink-0 bg-slate-50 dark:bg-slate-900/60 border-b border-slate-200/60 dark:border-slate-800/60">
              <div className="absolute top-0 right-0 p-5">
                <button 
                  type="button"
                  onClick={() => setHandoverAsset(null)} 
                  className="p-2 rounded-full hover:bg-slate-200/50 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <DialogTitle className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                <ClipboardList className="h-4 w-4 text-primary" />
                Handover Log
              </DialogTitle>
              <p className="text-[10px] text-muted-foreground mt-1">Asset: {handoverAsset.assetNumber} ({handoverAsset.brand} {handoverAsset.model})</p>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              <form onSubmit={handoverForm.handleSubmit(handleHandoverSubmit)} className="space-y-3 text-xs bg-muted/10 p-3 rounded border border-border/40">
                <h4 className="font-bold uppercase text-[10px] text-muted-foreground">Log New Transaction</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase">Transaction Type</label>
                    <Select
                      defaultValue="ISSUED_TO_USER"
                      onValueChange={(v) => handoverForm.setValue("transactionType", v as z.infer<typeof CreateAssetHandoverSchema>["transactionType"])}
                    >
                      <SelectTrigger className="h-8 text-xs bg-card">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-card">
                        <SelectItem value="ISSUED_TO_USER">Issue to User</SelectItem>
                        <SelectItem value="RETURNED_TO_STORE">Return to Store</SelectItem>
                        <SelectItem value="EXCHANGED">Exchange</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase">Target Staff (Custodian)</label>
                    <Select
                      onValueChange={(v) => handoverForm.setValue("targetStaffId", v || null)}
                    >
                      <SelectTrigger className="h-8 text-xs bg-card">
                        <SelectValue placeholder="Select staff (if issuing)" />
                      </SelectTrigger>
                      <SelectContent className="bg-card">
                        <SelectItem value="">N/A (Returned)</SelectItem>
                        {usersList.map((u) => (
                          <SelectItem key={u.id} value={u.id}>
                            {u.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase">Condition</label>
                    <Input {...handoverForm.register("condition")} placeholder="e.g. Brand New, Used - Good" className="h-8 text-xs bg-card" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase">Remarks</label>
                    <Input {...handoverForm.register("remarks")} placeholder="Charger included" className="h-8 text-xs bg-card" />
                  </div>
                </div>
                
                <div className="flex justify-end pt-1">
                  <Button type="submit" size="sm" disabled={handoverSubmitting} className="h-7 text-xs bg-primary text-white">
                    {handoverSubmitting ? "Logging..." : "Confirm Transaction"}
                  </Button>
                </div>
              </form>

              <div className="mt-5 space-y-2">
                <h4 className="font-bold uppercase text-[10px] text-muted-foreground">Transaction History</h4>
                
                {loadingHandovers ? (
                  <div className="flex justify-center items-center py-6 text-muted-foreground">
                    <RefreshCw className="h-5 w-5 animate-spin" />
                  </div>
                ) : handoverLogs.length === 0 ? (
                  <p className="text-center text-xs text-muted-foreground py-4 italic">No handover logs found for this asset.</p>
                ) : (
                  <div className="space-y-2">
                    {handoverLogs.map((log) => (
                      <div key={log.id} className="p-3 bg-card border border-border/50 rounded flex justify-between items-start">
                        <div>
                          <p className="font-bold text-xs text-foreground">
                            {log.transactionType.replace(/_/g, ' ')}
                            {log.targetStaff && <span className="text-muted-foreground font-medium ml-1">to {log.targetStaff.name}</span>}
                          </p>
                          {log.condition && <p className="text-[10px] text-muted-foreground mt-0.5">Condition: <span className="text-foreground">{log.condition}</span></p>}
                          {log.remarks && <p className="text-[10px] text-muted-foreground mt-0.5">Remarks: <span className="text-foreground">{log.remarks}</span></p>}
                        </div>
                        <div className="text-right">
                          <p className="text-[9px] text-muted-foreground font-mono">{new Date(log.date).toLocaleString()}</p>
                          <p className="text-[9px] text-primary font-bold mt-1 uppercase">By: {log.performedBy?.name || log.performedBy?.username}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="p-5 border-t border-border/40 bg-slate-50 dark:bg-slate-900/20 shrink-0 flex justify-end">
               <Button variant="outline" size="sm" onClick={() => setHandoverAsset(null)} className="h-8 text-xs">Close</Button>
            </div>
          </DialogContent>
        )}
      </Dialog>

      {/* Asset Units Drawer */}
      <Dialog open={!!selectedAssetForUnits} onOpenChange={(open) => !open && setSelectedAssetForUnits(null)}>
        {selectedAssetForUnits && (
          <DialogContent 
            showCloseButton={false}
            className="fixed !inset-y-0 !right-0 !top-0 !left-auto !translate-x-0 !translate-y-0 !h-full w-[45vw] md:w-[45vw] sm:w-full !max-w-none flex flex-col !p-0 !gap-0 overflow-hidden bg-white dark:bg-slate-950 border-l border-slate-200 dark:border-slate-800 shadow-2xl z-50 duration-300 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right !rounded-none text-foreground"
          >
            <div className="relative p-6 pb-4 flex-shrink-0 bg-slate-50 dark:bg-slate-900/60 border-b border-slate-200/60 dark:border-slate-800/60">
              <div className="absolute top-0 right-0 p-5">
                <button 
                  type="button"
                  onClick={() => setSelectedAssetForUnits(null)} 
                  className="p-2 rounded-full hover:bg-slate-200/50 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <DialogTitle className="text-base font-extrabold text-slate-900 dark:text-white">
                Manage Serial Units — {selectedAssetForUnits.brand} {selectedAssetForUnits.model}
              </DialogTitle>
              <p className="text-[10px] text-muted-foreground mt-0.5">Asset Ref: {selectedAssetForUnits.assetNumber}</p>
            </div>

            <div className="flex-grow overflow-y-auto p-6 space-y-6">
              
              {/* Unit Serials List */}
              <div className="space-y-3">
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
                  Registered Units ({units.length})
                </h3>

                {loadingUnits ? (
                  <div className="flex justify-center items-center py-6 text-muted-foreground">
                    <RefreshCw className="h-5 w-5 animate-spin" />
                  </div>
                ) : units.length === 0 ? (
                  <p className="text-center text-xs text-muted-foreground py-6 italic bg-slate-50 dark:bg-slate-900/10 border border-border/30 rounded-xl">
                    No physical serial units registered. Use the form below to add units.
                  </p>
                ) : (
                  <div className="bg-white dark:bg-slate-900/20 border border-border/40 rounded-xl overflow-hidden divide-y divide-border/30 shadow-sm">
                    {units.map((unit) => (
                      <div key={unit.id} className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                        <div className="space-y-1">
                          <p className="font-bold text-foreground">
                            S/N: <span className="font-mono text-slate-600 dark:text-slate-300 select-all">{unit.serialNumber}</span>
                            {unit.unitNumber && <span className="ml-2 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-[10px] text-muted-foreground border">Tag: {unit.unitNumber}</span>}
                          </p>
                          {unit.remarks && <p className="text-[10px] text-muted-foreground italic">Note: {unit.remarks}</p>}
                        </div>

                        <div className="flex items-center gap-3.5 flex-wrap">
                          {/* Unit status dropdown action */}
                          <div className="flex items-center gap-1.5">
                            <span className="text-[9px] font-bold text-muted-foreground uppercase">Status:</span>
                            <Select
                              value={unit.status}
                              onValueChange={(val) => {
                                handleUpdateUnitStatus(unit.id, {
                                  status: val,
                                  assignedStaffId: val === "ASSIGNED_TO_USER" ? unit.assignedStaffId || null : null
                                });
                              }}
                            >
                              <SelectTrigger className="h-7 text-[11px] font-semibold min-w-[120px] bg-card border-border/50">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent className="bg-card">
                                <SelectItem value="IN_HAND_STORES">In-Hand Stores (Stock)</SelectItem>
                                <SelectItem value="ASSIGNED_TO_USER">Assigned to User</SelectItem>
                                <SelectItem value="REPAIR_MODE">Repair Mode</SelectItem>
                                <SelectItem value="DISPOSABLE">Disposable (Retired)</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          {/* Staff reassign dropdown inline (only if ASSIGNED_TO_USER) */}
                          {unit.status === "ASSIGNED_TO_USER" && (
                            <div className="flex items-center gap-1.5">
                              <span className="text-[9px] font-bold text-muted-foreground uppercase">User:</span>
                              <Select
                                value={unit.assignedStaffId || "none"}
                                onValueChange={(val) => {
                                  handleUpdateUnitStatus(unit.id, {
                                    status: "ASSIGNED_TO_USER",
                                    assignedStaffId: val === "none" ? null : val
                                  });
                                }}
                              >
                                <SelectTrigger className="h-7 text-[11px] font-semibold min-w-[140px] bg-card border-border/50">
                                  <SelectValue placeholder="Select Staff member" />
                                </SelectTrigger>
                                <SelectContent className="bg-card max-h-[180px]">
                                  <SelectItem value="none">Unassigned (Spare)</SelectItem>
                                  {usersList.map((st) => (
                                    <SelectItem key={st.id} value={st.id}>
                                      {st.name} ({st.employeeId})
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          )}

                          <button
                            type="button"
                            onClick={() => handleDeleteUnit(unit.id)}
                            className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 rounded transition-colors"
                            title="Retire Unit Serial"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Add New Unit Form */}
              <div className="bg-slate-50 dark:bg-slate-900/30 p-4 border border-border/40 rounded-xl space-y-3.5 shadow-sm">
                <h3 className="text-[10px] font-black text-primary uppercase tracking-widest flex items-center gap-1.5">
                  <Plus className="w-4 h-4" /> Register New Physical Unit
                </h3>

                <form onSubmit={handleAddUnit} className="space-y-3.5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[9px] font-black uppercase text-slate-400">Serial Number *</label>
                      <Input
                        required
                        placeholder="e.g. S/N GHK887-PL"
                        value={unitForm.serialNumber}
                        onChange={(e) => setUnitForm({ ...unitForm, serialNumber: e.target.value })}
                        className="h-8.5 text-xs bg-slate-50 dark:bg-slate-950 border-border/50 rounded-lg"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[9px] font-black uppercase text-slate-400">Unit Number / Barcode</label>
                      <Input
                        placeholder="e.g. SLT-TAG-099"
                        value={unitForm.unitNumber}
                        onChange={(e) => setUnitForm({ ...unitForm, unitNumber: e.target.value })}
                        className="h-8.5 text-xs bg-slate-50 dark:bg-slate-950 border-border/50 rounded-lg"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[9px] font-black uppercase text-slate-400">Lifecycle Status</label>
                      <Select
                        value={unitForm.status}
                        onValueChange={(val) => setUnitForm({ ...unitForm, status: val })}
                      >
                        <SelectTrigger className="h-8.5 text-xs bg-slate-50 dark:bg-slate-950 border-border/50 rounded-lg">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-card">
                          <SelectItem value="IN_HAND_STORES">In-Hand Stores (Stock)</SelectItem>
                          <SelectItem value="ASSIGNED_TO_USER">Assigned to User</SelectItem>
                          <SelectItem value="REPAIR_MODE">Repair Mode</SelectItem>
                          <SelectItem value="DISPOSABLE">Disposable (Retired)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {unitForm.status === "ASSIGNED_TO_USER" && (
                      <div className="space-y-1">
                        <label className="text-[9px] font-black uppercase text-slate-400">Assign Custodian</label>
                        <Select
                          value={unitForm.assignedStaffId}
                          onValueChange={(val) => setUnitForm({ ...unitForm, assignedStaffId: val })}
                        >
                          <SelectTrigger className="h-8.5 text-xs bg-slate-50 dark:bg-slate-950 border-border/50 rounded-lg">
                            <SelectValue placeholder="Select Staff member" />
                          </SelectTrigger>
                          <SelectContent className="bg-card max-h-[180px]">
                            <SelectItem value="">None (Spare)</SelectItem>
                            {usersList.map((st) => (
                              <SelectItem key={st.id} value={st.id}>
                                {st.name} ({st.employeeId})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] font-black uppercase text-slate-400">Remarks / Condition Details</label>
                    <Input
                      placeholder="e.g. Brand new batch unit, minor scratches on outer casing..."
                      value={unitForm.remarks}
                      onChange={(e) => setUnitForm({ ...unitForm, remarks: e.target.value })}
                      className="h-8.5 text-xs bg-slate-50 dark:bg-slate-950 border-border/50 rounded-lg"
                    />
                  </div>

                  <Button
                    type="submit"
                    disabled={unitSubmitting}
                    className="w-full h-8.5 text-xs font-bold text-white bg-emerald-500 hover:bg-emerald-600 rounded-lg shadow-sm"
                  >
                    {unitSubmitting ? "Adding physical unit..." : "Add Serial Unit"}
                  </Button>
                </form>
              </div>

            </div>

            <div className="p-5 border-t border-border/40 bg-slate-50 dark:bg-slate-900/20 shrink-0 flex justify-end">
              <Button variant="outline" size="sm" onClick={() => setSelectedAssetForUnits(null)} className="h-8 text-xs">Close</Button>
            </div>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}
