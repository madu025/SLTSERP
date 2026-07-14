"use client";

import React, { useEffect, useState } from "react";
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  Building2, Plus, Pencil, Trash2, Phone, User, Landmark, DollarSign, Search, 
  RefreshCw, FileText, ShoppingCart, Car, FileSignature, Layers, Eye, Calendar, AlertCircle
} from "lucide-react";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { 
  CreateSiteOfficeSchema, 
  CreateAgreementSchema, 
  CreateOfficeRequestSchema, 
  CreateOfficeVehicleSchema, 
  CreateOfficeTenderSchema 
} from "@/lib/validations/siteoffice.schema";
import { z } from "zod";

export default function SiteOfficesPage() {
  const [mounted, setMounted] = useState(false);
  const [user, setUser] = useState<{ id: string; name: string; role: string } | null>(null);
  const [siteOffices, setSiteOffices] = useState<any[]>([]);
  const [usersList, setUsersList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // Site detail drawer states
  const [detailOfficeId, setDetailOfficeId] = useState<string | null>(null);
  const [detailOffice, setDetailOffice] = useState<any | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");

  // Dialog triggers
  const [isOpen, setIsOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editOffice, setEditOffice] = useState<any | null>(null);
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Sub-module dialog forms trigger
  const [activeSubForm, setActiveSubForm] = useState<"agreement" | "request" | "vehicle" | "tender" | null>(null);
  const [subFormSubmitting, setSubFormSubmitting] = useState(false);

  // Main Forms
  const createForm = useForm({
    resolver: zodResolver(CreateSiteOfficeSchema),
    defaultValues: {
      name: "",
      address: "",
      officeAdminId: "",
      contactNo: "",
      rentalCost: 0,
      landlordName: "",
      landlordPhone: ""
    }
  });

  const editForm = useForm({
    resolver: zodResolver(CreateSiteOfficeSchema.partial())
  });

  // Sub-module Forms
  const agreementForm = useForm({
    resolver: zodResolver(CreateAgreementSchema),
    defaultValues: {
      agreementType: "RENTAL" as const,
      contractNumber: "",
      startDate: "",
      endDate: "",
      terms: "",
      monthlyRent: 0,
      landlordName: "",
      landlordPhone: "",
      documentUrl: ""
    }
  });

  const requestForm = useForm({
    resolver: zodResolver(CreateOfficeRequestSchema),
    defaultValues: {
      itemType: "FURNITURE" as const,
      description: "",
      estimatedCost: 0,
      priority: "MEDIUM" as const,
      status: "PENDING" as const,
      notes: ""
    }
  });

  const vehicleForm = useForm({
    resolver: zodResolver(CreateOfficeVehicleSchema),
    defaultValues: {
      vehicleRegNo: "",
      makeModel: "",
      assignedDriver: "",
      driverPhone: "",
      status: "ACTIVE" as const,
      notes: ""
    }
  });

  const tenderForm = useForm({
    resolver: zodResolver(CreateOfficeTenderSchema),
    defaultValues: {
      tenderNo: "",
      title: "",
      description: "",
      budget: 0,
      publishDate: "",
      closingDate: "",
      status: "DRAFT" as const,
      winnerVendor: "",
      winnerBidAmount: 0
    }
  });

  useEffect(() => {
    setMounted(true);
    const stored = localStorage.getItem("user");
    if (stored) {
      setUser(JSON.parse(stored));
    }
  }, []);

  const fetchSiteOffices = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.append("search", search);
      const res = await fetch(`/api/helpdesk/site-offices?${params.toString()}&_t=${Date.now()}`);
      if (!res.ok) throw new Error();
      const json = await res.json();
      if (json.success) {
        setSiteOffices(json.data.siteOffices || []);
      }
    } catch {
      toast.error("Failed to load site offices");
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await fetch("/api/users?page=1&limit=1000");
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          setUsersList(json.data.users || json.data || []);
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchSiteOfficeDetail = async (id: string) => {
    setLoadingDetail(true);
    try {
      const res = await fetch(`/api/helpdesk/site-offices/${id}?_t=${Date.now()}`);
      if (!res.ok) throw new Error();
      const json = await res.json();
      if (json.success) {
        setDetailOffice(json.data);
      }
    } catch {
      toast.error("Failed to load site office operational records");
    } finally {
      setLoadingDetail(false);
    }
  };

  useEffect(() => {
    if (mounted) {
      fetchSiteOffices();
      fetchUsers();
    }
  }, [mounted, search]);

  useEffect(() => {
    if (detailOfficeId) {
      fetchSiteOfficeDetail(detailOfficeId);
    } else {
      setDetailOffice(null);
    }
  }, [detailOfficeId]);

  const handleRegisterOffice = async (data: any) => {
    setSubmitting(true);
    try {
      const res = await fetch("/api/helpdesk/site-offices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          rentalCost: Number(data.rentalCost) || 0,
          officeAdminId: data.officeAdminId || null,
          contactNo: data.contactNo || null,
          landlordName: data.landlordName || null,
          landlordPhone: data.landlordPhone || null
        })
      });
      if (!res.ok) throw new Error();
      const json = await res.json();
      if (json.success) {
        toast.success(`Site office ${data.name} registered successfully!`);
        createForm.reset();
        setIsOpen(false);
        fetchSiteOffices();
      }
    } catch {
      toast.error("Failed to register site office. Ensure name is unique.");
    } finally {
      setSubmitting(false);
    }
  };

  const openEditDialog = (office: any) => {
    setEditOffice(office);
    editForm.reset({
      name: office.name,
      address: office.address,
      officeAdminId: office.officeAdminId || "",
      contactNo: office.contactNo || "",
      rentalCost: office.rentalCost || 0,
      landlordName: office.landlordName || "",
      landlordPhone: office.landlordPhone || ""
    });
  };

  const handleEditOffice = async (data: any) => {
    if (!editOffice) return;
    setEditSubmitting(true);
    try {
      const res = await fetch(`/api/helpdesk/site-offices/${editOffice.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          rentalCost: Number(data.rentalCost) || 0,
          officeAdminId: data.officeAdminId || null,
          contactNo: data.contactNo || null,
          landlordName: data.landlordName || null,
          landlordPhone: data.landlordPhone || null
        })
      });
      if (!res.ok) throw new Error();
      toast.success("Site office updated successfully!");
      setEditOffice(null);
      fetchSiteOffices();
      if (detailOfficeId === editOffice.id) {
        fetchSiteOfficeDetail(editOffice.id);
      }
    } catch {
      toast.error("Failed to update site office details.");
    } finally {
      setEditSubmitting(false);
    }
  };

  const handleDeleteOffice = async () => {
    if (!deleteConfirmId) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/helpdesk/site-offices/${deleteConfirmId}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      toast.success("Site office deleted.");
      setDeleteConfirmId(null);
      if (detailOfficeId === deleteConfirmId) {
        setDetailOfficeId(null);
      }
      fetchSiteOffices();
    } catch {
      toast.error("Failed to delete site office.");
    } finally {
      setDeleting(false);
    }
  };

  // Sub-module Forms submit handlers
  const handleAddAgreement = async (data: any) => {
    if (!detailOfficeId) return;
    setSubFormSubmitting(true);
    try {
      const res = await fetch(`/api/helpdesk/site-offices/${detailOfficeId}/agreements`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          monthlyRent: Number(data.monthlyRent) || 0,
          documentUrl: data.documentUrl || null,
          landlordName: data.landlordName || null,
          landlordPhone: data.landlordPhone || null
        })
      });
      if (!res.ok) throw new Error();
      toast.success("Rental Agreement successfully logged!");
      agreementForm.reset();
      setActiveSubForm(null);
      fetchSiteOfficeDetail(detailOfficeId);
      fetchSiteOffices();
    } catch {
      toast.error("Failed to submit rental agreement.");
    } finally {
      setSubFormSubmitting(false);
    }
  };

  const handleAddRequest = async (data: any) => {
    if (!detailOfficeId) return;
    setSubFormSubmitting(true);
    try {
      const res = await fetch(`/api/helpdesk/site-offices/${detailOfficeId}/requests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          estimatedCost: Number(data.estimatedCost) || 0,
          notes: data.notes || null
        })
      });
      if (!res.ok) throw new Error();
      toast.success("Physical goods requirement order request placed!");
      requestForm.reset();
      setActiveSubForm(null);
      fetchSiteOfficeDetail(detailOfficeId);
    } catch {
      toast.error("Failed to place requirement request.");
    } finally {
      setSubFormSubmitting(false);
    }
  };

  const handleAddVehicle = async (data: any) => {
    if (!detailOfficeId) return;
    setSubFormSubmitting(true);
    try {
      const res = await fetch(`/api/helpdesk/site-offices/${detailOfficeId}/vehicles`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          assignedDriver: data.assignedDriver || null,
          driverPhone: data.driverPhone || null,
          notes: data.notes || null
        })
      });
      if (!res.ok) throw new Error();
      toast.success("Vehicle allocation successfully registered!");
      vehicleForm.reset();
      setActiveSubForm(null);
      fetchSiteOfficeDetail(detailOfficeId);
    } catch {
      toast.error("Failed to assign vehicle to site.");
    } finally {
      setSubFormSubmitting(false);
    }
  };

  const handleAddTender = async (data: any) => {
    if (!detailOfficeId) return;
    setSubFormSubmitting(true);
    try {
      const res = await fetch(`/api/helpdesk/site-offices/${detailOfficeId}/tenders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          budget: Number(data.budget) || 0,
          winnerVendor: data.winnerVendor || null,
          winnerBidAmount: data.winnerBidAmount ? Number(data.winnerBidAmount) : null
        })
      });
      if (!res.ok) throw new Error();
      toast.success("Site purchasing tender successfully logged!");
      tenderForm.reset();
      setActiveSubForm(null);
      fetchSiteOfficeDetail(detailOfficeId);
    } catch {
      toast.error("Failed to log site procurement tender.");
    } finally {
      setSubFormSubmitting(false);
    }
  };

  // Delete children handlers
  const handleDeleteAgreement = async (agreementId: string) => {
    if (!confirm("Are you sure you want to delete this agreement record?")) return;
    try {
      const res = await fetch(`/api/helpdesk/site-offices/${detailOfficeId}/agreements?agreementId=${agreementId}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      toast.success("Agreement deleted.");
      fetchSiteOfficeDetail(detailOfficeId!);
      fetchSiteOffices();
    } catch {
      toast.error("Failed to delete agreement.");
    }
  };

  const handleDeleteRequest = async (requestId: string) => {
    if (!confirm("Are you sure you want to delete this request record?")) return;
    try {
      const res = await fetch(`/api/helpdesk/site-offices/${detailOfficeId}/requests?requestId=${requestId}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      toast.success("Request deleted.");
      fetchSiteOfficeDetail(detailOfficeId!);
    } catch {
      toast.error("Failed to delete request.");
    }
  };

  const handleDeleteVehicle = async (vehicleId: string) => {
    if (!confirm("Are you sure you want to return/remove this vehicle allocation?")) return;
    try {
      const res = await fetch(`/api/helpdesk/site-offices/${detailOfficeId}/vehicles?vehicleId=${vehicleId}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      toast.success("Vehicle allocation removed.");
      fetchSiteOfficeDetail(detailOfficeId!);
    } catch {
      toast.error("Failed to remove vehicle allocation.");
    }
  };

  const handleDeleteTender = async (tenderId: string) => {
    if (!confirm("Are you sure you want to delete this tender record?")) return;
    try {
      const res = await fetch(`/api/helpdesk/site-offices/${detailOfficeId}/tenders?tenderId=${tenderId}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      toast.success("Tender record deleted.");
      fetchSiteOfficeDetail(detailOfficeId!);
    } catch {
      toast.error("Failed to delete tender.");
    }
  };

  const updateRequestStatus = async (requestId: string, newStatus: string) => {
    try {
      const res = await fetch(`/api/helpdesk/site-offices/${detailOfficeId}/requests?requestId=${requestId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus })
      });
      if (!res.ok) throw new Error();
      toast.success("Request status updated!");
      fetchSiteOfficeDetail(detailOfficeId!);
    } catch {
      toast.error("Failed to update status.");
    }
  };

  // Compute rentals
  const totalMonthlyRental = siteOffices.reduce((acc, curr) => acc + (curr.rentalCost || 0), 0);

  const isITAdmin = !!(user?.role && ["SUPER_ADMIN", "ADMIN", "OFFICE_ADMIN"].includes(user.role));

  if (!mounted) return null;

  return (
    <div className="min-h-screen flex bg-background text-foreground">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Header />
        <main className="flex-grow p-4 md:p-6 overflow-y-auto max-w-[1400px] mx-auto w-full space-y-6 animate-fade-in">
          
          {/* Header Card */}
          <div className="bg-card/75 backdrop-blur-md p-4 rounded-xl border border-border/50 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="bg-primary/10 text-primary p-2.5 rounded-lg">
                <Building2 className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-base font-extrabold text-foreground">OSP Site Offices</h1>
                <p className="text-[10px] text-muted-foreground font-medium">Manage lease agreements, land contracts, vehicle pools, physical requirements, and site tenders.</p>
              </div>
            </div>

            {isITAdmin && (
              <Dialog open={isOpen} onOpenChange={setIsOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" className="h-8 gap-1.5 transition-all bg-primary hover:bg-primary/95 text-xs text-white font-bold">
                    <Plus className="h-4 w-4" />
                    Register Site
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md bg-card/95 backdrop-blur-xl border border-border/50">
                  <DialogHeader>
                    <DialogTitle className="text-base font-bold">Register Site Office</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={createForm.handleSubmit(handleRegisterOffice)} className="space-y-3.5 mt-2 text-xs">
                    <div className="space-y-1">
                      <label className="text-[10px] font-semibold text-muted-foreground uppercase">Office Name</label>
                      <Input {...createForm.register("name")} placeholder="e.g. Gampaha Site Office" className="h-8 text-xs bg-muted/20 border-border" />
                      {createForm.formState.errors.name && <p className="text-[10px] text-red-500">{createForm.formState.errors.name.message}</p>}
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-semibold text-muted-foreground uppercase">Address</label>
                      <Input {...createForm.register("address")} placeholder="e.g. 10/A, Colombo Road, Gampaha" className="h-8 text-xs bg-muted/20 border-border" />
                      {createForm.formState.errors.address && <p className="text-[10px] text-red-500">{createForm.formState.errors.address.message}</p>}
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[10px] font-semibold text-muted-foreground uppercase">Site Administrator</label>
                        <select
                          className="h-8 w-full rounded border border-border bg-muted/20 text-xs px-2.5 outline-none focus:ring-1 focus:ring-primary text-foreground"
                          onChange={(e) => createForm.setValue("officeAdminId", e.target.value)}
                        >
                          <option value="">Select Admin...</option>
                          {usersList.map((u) => (
                            <option key={u.id} value={u.id}>{u.name || u.username}</option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-semibold text-muted-foreground uppercase">Site Contact No</label>
                        <Input {...createForm.register("contactNo")} placeholder="e.g. 0332212345" className="h-8 text-xs bg-muted/20 border-border" />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-semibold text-muted-foreground uppercase">Monthly Rental Cost (LKR)</label>
                      <Input type="number" {...createForm.register("rentalCost", { valueAsNumber: true })} placeholder="e.g. 45000" className="h-8 text-xs bg-muted/20 border-border" />
                    </div>

                    <div className="grid grid-cols-2 gap-3 p-3 bg-muted/10 rounded-lg border border-border/40">
                      <div className="col-span-2 text-[10px] font-bold text-muted-foreground uppercase">Landlord Details</div>
                      <div className="space-y-1">
                        <label className="text-[9px] font-semibold text-muted-foreground">Landlord Name</label>
                        <Input {...createForm.register("landlordName")} placeholder="Landlord name" className="h-8 text-xs bg-card border-border" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] font-semibold text-muted-foreground">Landlord Contact</label>
                        <Input {...createForm.register("landlordPhone")} placeholder="Landlord phone" className="h-8 text-xs bg-card border-border" />
                      </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-2 border-t border-border/40">
                      <Button type="button" variant="outline" size="sm" onClick={() => setIsOpen(false)} className="h-8 text-xs">Cancel</Button>
                      <Button type="submit" size="sm" disabled={submitting} className="h-8 text-xs text-white bg-primary">
                        {submitting ? "Registering..." : "Register Office"}
                      </Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
            )}
          </div>

          {/* Stats Bar */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="bg-card/60 border border-border/50 shadow-sm backdrop-blur-md">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="p-2 bg-indigo-500/10 text-indigo-600 rounded-lg">
                  <Building2 className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Total Site Offices</p>
                  <p className="text-lg font-black mt-0.5">{siteOffices.length}</p>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card/60 border border-border/50 shadow-sm backdrop-blur-md">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="p-2 bg-emerald-500/10 text-emerald-600 rounded-lg">
                  <DollarSign className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Total Monthly Rental</p>
                  <p className="text-lg font-black mt-0.5">LKR {totalMonthlyRental.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card/60 border border-border/50 shadow-sm backdrop-blur-md">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="p-2 bg-amber-500/10 text-amber-600 rounded-lg">
                  <Landmark className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Active Agreements</p>
                  <p className="text-lg font-black mt-0.5">{siteOffices.filter(s => s.landlordName).length}</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Site Offices Grid/Table */}
          <div className="space-y-3">
            <div className="relative w-full max-w-sm">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, landlord, or address..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 text-xs h-9 bg-card border border-border/60"
              />
            </div>

            <div className="rounded-lg border border-border/50 bg-card/85 backdrop-blur-lg shadow-xl overflow-hidden">
              <Table>
                <TableHeader className="bg-muted/40">
                  <TableRow>
                    <TableHead className="font-semibold text-xs py-2">Office Name</TableHead>
                    <TableHead className="font-semibold text-xs py-2">Address</TableHead>
                    <TableHead className="font-semibold text-xs py-2">Site Administrator</TableHead>
                    <TableHead className="font-semibold text-xs py-2">Site Contact</TableHead>
                    <TableHead className="font-semibold text-xs py-2">Monthly Rent</TableHead>
                    <TableHead className="font-semibold text-xs py-2">Landlord</TableHead>
                    <TableHead className="font-semibold text-xs py-2 text-center">IT Devices</TableHead>
                    <TableHead className="font-semibold text-xs py-2 w-28 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-10">
                        <RefreshCw className="h-5 w-5 animate-spin mx-auto text-muted-foreground" />
                        <span className="text-xs text-muted-foreground mt-2 block">Loading OSP Sites...</span>
                      </TableCell>
                    </TableRow>
                  ) : siteOffices.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-10 text-muted-foreground text-xs">
                        No registered OSP Site Offices found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    siteOffices.map((office) => (
                      <TableRow key={office.id} className="hover:bg-muted/30 border-b border-border/40 text-xs">
                        <TableCell className="font-bold py-2.5 text-foreground cursor-pointer hover:underline" onClick={() => setDetailOfficeId(office.id)}>{office.name}</TableCell>
                        <TableCell className="py-2.5 text-muted-foreground">{office.address}</TableCell>
                        <TableCell className="py-2.5 font-medium">
                          {office.officeAdmin ? (
                            <div className="flex items-center gap-1">
                              <User className="h-3.5 w-3.5 text-primary" />
                              <span>{office.officeAdmin.name || office.officeAdmin.username}</span>
                            </div>
                          ) : (
                            <span className="italic text-muted-foreground/60">No administrator assigned</span>
                          )}
                        </TableCell>
                        <TableCell className="py-2.5 text-muted-foreground font-mono">
                          {office.contactNo || "N/A"}
                        </TableCell>
                        <TableCell className="py-2.5 font-semibold text-foreground">
                          LKR {office.rentalCost.toLocaleString()}
                        </TableCell>
                        <TableCell className="py-2.5 text-muted-foreground">
                          {office.landlordName ? (
                            <div>
                              <p className="font-medium text-foreground/80">{office.landlordName}</p>
                              <p className="text-[10px] text-muted-foreground font-mono">{office.landlordPhone}</p>
                            </div>
                          ) : (
                            <span className="italic text-muted-foreground/50">N/A</span>
                          )}
                        </TableCell>
                        <TableCell className="py-2.5 text-center">
                          <Badge className="bg-primary/10 text-primary border-none font-bold">
                            {office._count?.assets || 0} devices
                          </Badge>
                        </TableCell>
                        <TableCell className="py-2.5 text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6.5 w-6.5 p-0 text-muted-foreground hover:text-emerald-500 hover:bg-emerald-500/10"
                              onClick={() => setDetailOfficeId(office.id)}
                              title="Site Operations Console"
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </Button>
                            {isITAdmin && (
                              <>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-6.5 w-6.5 p-0 text-muted-foreground hover:text-primary hover:bg-primary/10"
                                  onClick={() => openEditDialog(office)}
                                  title="Edit site office"
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-6.5 w-6.5 p-0 text-muted-foreground hover:text-red-500 hover:bg-red-500/10"
                                  onClick={() => setDeleteConfirmId(office.id)}
                                  title="Delete site office"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </main>
      </div>

      {/* Edit Site Office Dialog */}
      <Dialog open={!!editOffice} onOpenChange={(open) => !open && setEditOffice(null)}>
        {editOffice && (
          <DialogContent className="max-w-md bg-card/95 backdrop-blur-xl border border-border/50 text-foreground">
            <DialogHeader>
              <DialogTitle className="text-sm font-bold">Edit OSP Site Office — {editOffice.name}</DialogTitle>
            </DialogHeader>
            <form onSubmit={editForm.handleSubmit(handleEditOffice)} className="space-y-3.5 mt-2 text-xs">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-muted-foreground uppercase">Office Name</label>
                <Input {...editForm.register("name")} className="h-8 text-xs bg-muted/20" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-muted-foreground uppercase">Address</label>
                <Input {...editForm.register("address")} className="h-8 text-xs bg-muted/20" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase">Site Administrator</label>
                  <select
                    className="h-8 w-full rounded border border-border bg-muted/20 text-xs px-2.5 outline-none focus:ring-1 focus:ring-primary text-foreground"
                    defaultValue={editOffice.officeAdminId || ""}
                    onChange={(e) => editForm.setValue("officeAdminId", e.target.value)}
                  >
                    <option value="">Select Admin...</option>
                    {usersList.map((u) => (
                      <option key={u.id} value={u.id}>{u.name || u.username}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase">Site Contact No</label>
                  <Input {...editForm.register("contactNo")} className="h-8 text-xs bg-muted/20" />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-muted-foreground uppercase">Monthly Rental Cost (LKR)</label>
                <Input type="number" {...editForm.register("rentalCost", { valueAsNumber: true })} className="h-8 text-xs bg-muted/20" />
              </div>

              <div className="grid grid-cols-2 gap-3 p-3 bg-muted/10 rounded-lg border border-border/40">
                <div className="col-span-2 text-[10px] font-bold text-muted-foreground uppercase">Landlord Details</div>
                <div className="space-y-1">
                  <label className="text-[9px] font-semibold text-muted-foreground">Landlord Name</label>
                  <Input {...editForm.register("landlordName")} className="h-8 text-xs bg-card border-border" />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-semibold text-muted-foreground">Landlord Contact</label>
                  <Input {...editForm.register("landlordPhone")} className="h-8 text-xs bg-card border-border" />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-border/40">
                <Button type="button" variant="outline" size="sm" onClick={() => setEditOffice(null)} className="h-8 text-xs">Cancel</Button>
                <Button type="submit" size="sm" disabled={editSubmitting} className="h-8 text-xs text-white bg-primary">
                  {editSubmitting ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </form>
          </DialogContent>
        )}
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteConfirmId} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
        <DialogContent className="max-w-sm bg-card/95 backdrop-blur-xl border border-border/50 text-foreground">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold flex items-center gap-2 text-red-600">
              <Trash2 className="h-4 w-4" />
              Delete Site Office
            </DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground py-2 font-medium">
            Are you sure you want to permanently delete this site office registry? IT assets linked will remain, but their site office link will be unassigned.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setDeleteConfirmId(null)}>Cancel</Button>
            <Button size="sm" disabled={deleting} className="h-8 text-xs bg-red-600 hover:bg-red-700 text-white font-bold" onClick={handleDeleteOffice}>
              {deleting ? "Deleting..." : "Delete Site"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Site Operations Console Detail Modal */}
      <Dialog open={!!detailOfficeId} onOpenChange={(open) => !open && setDetailOfficeId(null)}>
        {detailOfficeId && (
          <DialogContent className="max-w-4xl bg-card/95 backdrop-blur-xl border border-border/50 text-foreground max-h-[90vh] flex flex-col">
            <DialogHeader className="flex-shrink-0 border-b border-border/40 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="bg-primary/10 text-primary p-2 rounded-lg">
                  <Building2 className="h-5 w-5" />
                </div>
                <div>
                  <DialogTitle className="text-base font-extrabold">{detailOffice?.name || "Loading OSP Site Console..."}</DialogTitle>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{detailOffice?.address}</p>
                </div>
              </div>
            </DialogHeader>

            {loadingDetail ? (
              <div className="py-20 text-center flex-grow flex flex-col justify-center items-center">
                <RefreshCw className="h-8 w-8 animate-spin text-primary" />
                <p className="text-xs text-muted-foreground mt-3 font-medium">Loading OSP database records...</p>
              </div>
            ) : (
              detailOffice && (
                <div className="flex-grow overflow-hidden flex flex-col md:flex-row mt-3 gap-4">
                  {/* Tabs Selector Left */}
                  <div className="w-full md:w-48 flex flex-row md:flex-col gap-1 border-b md:border-b-0 md:border-r border-border/40 pb-3 md:pb-0 pr-0 md:pr-4 flex-shrink-0 overflow-x-auto md:overflow-x-visible">
                    <button
                      onClick={() => { setActiveTab("overview"); setActiveSubForm(null); }}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg text-left text-xs font-semibold transition-all ${
                        activeTab === "overview" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted/30"
                      }`}
                    >
                      <Layers className="h-4 w-4" />
                      Overview
                    </button>
                    <button
                      onClick={() => { setActiveTab("agreements"); setActiveSubForm(null); }}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg text-left text-xs font-semibold transition-all ${
                        activeTab === "agreements" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted/30"
                      }`}
                    >
                      <FileSignature className="h-4 w-4" />
                      Rentals & Leases
                    </button>
                    <button
                      onClick={() => { setActiveTab("requests"); setActiveSubForm(null); }}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg text-left text-xs font-semibold transition-all ${
                        activeTab === "requests" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted/30"
                      }`}
                    >
                      <ShoppingCart className="h-4 w-4" />
                      Goods Requests
                    </button>
                    <button
                      onClick={() => { setActiveTab("vehicles"); setActiveSubForm(null); }}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg text-left text-xs font-semibold transition-all ${
                        activeTab === "vehicles" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted/30"
                      }`}
                    >
                      <Car className="h-4 w-4" />
                      Vehicle Allocations
                    </button>
                    <button
                      onClick={() => { setActiveTab("tenders"); setActiveSubForm(null); }}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg text-left text-xs font-semibold transition-all ${
                        activeTab === "tenders" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted/30"
                      }`}
                    >
                      <FileText className="h-4 w-4" />
                      Purchasing Tenders
                    </button>
                  </div>

                  {/* Tab Contents Right */}
                  <div className="flex-grow overflow-y-auto pr-1 text-xs">
                    
                    {/* OVERVIEW TAB */}
                    {activeTab === "overview" && (
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4 bg-muted/20 p-3 rounded-lg border border-border/30">
                          <div>
                            <p className="text-[10px] text-muted-foreground uppercase font-bold">Custodian Admin</p>
                            <p className="font-semibold text-foreground mt-0.5">
                              {detailOffice.officeAdmin ? detailOffice.officeAdmin.name || detailOffice.officeAdmin.username : "No custodian assigned"}
                            </p>
                            <p className="text-[10px] text-muted-foreground mt-0.5">{detailOffice.officeAdmin?.email}</p>
                          </div>
                          <div>
                            <p className="text-[10px] text-muted-foreground uppercase font-bold">Office Contacts</p>
                            <p className="font-semibold text-foreground mt-0.5">{detailOffice.contactNo || "N/A"}</p>
                            <p className="text-[10px] text-muted-foreground mt-0.5">Active landlord: {detailOffice.landlordName || "N/A"}</p>
                          </div>
                        </div>

                        <div>
                          <h4 className="font-bold text-xs uppercase tracking-wider text-muted-foreground mb-2">Linked Company Assets ({detailOffice.assets?.length || 0})</h4>
                          <div className="border border-border/50 rounded-lg overflow-hidden">
                            <Table>
                              <TableHeader className="bg-muted/20">
                                <TableRow>
                                  <TableHead className="py-1.5 font-bold">Asset No</TableHead>
                                  <TableHead className="py-1.5 font-bold">Brand & Model</TableHead>
                                  <TableHead className="py-1.5 font-bold">Warranty</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {!detailOffice.assets || detailOffice.assets.length === 0 ? (
                                  <TableRow>
                                    <TableCell colSpan={3} className="text-center py-4 text-muted-foreground">
                                      No IT equipment currently allocated to this site office.
                                    </TableCell>
                                  </TableRow>
                                ) : (
                                  detailOffice.assets.map((ast: any) => (
                                    <TableRow key={ast.id} className="hover:bg-muted/20 text-xs">
                                      <TableCell className="font-semibold py-1.5">{ast.assetNumber}</TableCell>
                                      <TableCell className="py-1.5">{ast.brand} {ast.model}</TableCell>
                                      <TableCell className="py-1.5 text-muted-foreground">
                                        {ast.warrantyExpiry ? new Date(ast.warrantyExpiry).toLocaleDateString() : "No Warranty"}
                                      </TableCell>
                                    </TableRow>
                                  ))
                                )}
                              </TableBody>
                            </Table>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* AGREEMENTS TAB */}
                    {activeTab === "agreements" && (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <h4 className="font-bold text-xs uppercase text-muted-foreground">Rental / Purchase Agreements ({detailOffice.agreements?.length || 0})</h4>
                          {!activeSubForm && (
                            <Button size="sm" onClick={() => setActiveSubForm("agreement")} className="h-7 text-[10px] text-white bg-primary gap-1">
                              <Plus className="h-3 w-3" /> Add Contract
                            </Button>
                          )}
                        </div>

                        {activeSubForm === "agreement" && (
                          <form onSubmit={agreementForm.handleSubmit(handleAddAgreement)} className="p-3 bg-muted/10 rounded-lg border border-border/40 space-y-3">
                            <h5 className="font-bold text-foreground">Log New Agreement Record</h5>
                            
                            <div className="grid grid-cols-2 gap-3">
                              <div className="space-y-1">
                                <label className="text-[9px] font-bold text-muted-foreground uppercase">Type</label>
                                <select {...agreementForm.register("agreementType")} className="h-8 w-full rounded border border-border bg-card text-xs px-2.5 text-foreground">
                                  <option value="RENTAL">Rental Lease</option>
                                  <option value="LEASE">Long Lease</option>
                                  <option value="PURCHASE">Office Purchase</option>
                                </select>
                              </div>
                              <div className="space-y-1">
                                <label className="text-[9px] font-bold text-muted-foreground uppercase">Contract Number</label>
                                <Input {...agreementForm.register("contractNumber")} placeholder="e.g. SLT/SO-GAM/2026/9" className="h-8 text-xs bg-card" />
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                              <div className="space-y-1">
                                <label className="text-[9px] font-bold text-muted-foreground uppercase">Start Date</label>
                                <Input type="date" {...agreementForm.register("startDate")} className="h-8 text-xs bg-card" />
                              </div>
                              <div className="space-y-1">
                                <label className="text-[9px] font-bold text-muted-foreground uppercase">End Expiry Date</label>
                                <Input type="date" {...agreementForm.register("endDate")} className="h-8 text-xs bg-card" />
                              </div>
                            </div>

                            <div className="grid grid-cols-3 gap-2">
                              <div className="space-y-1">
                                <label className="text-[9px] font-bold text-muted-foreground uppercase">Monthly Rent (LKR)</label>
                                <Input type="number" {...agreementForm.register("monthlyRent", { valueAsNumber: true })} className="h-8 text-xs bg-card" />
                              </div>
                              <div className="space-y-1">
                                <label className="text-[9px] font-bold text-muted-foreground uppercase">Landlord Name</label>
                                <Input {...agreementForm.register("landlordName")} className="h-8 text-xs bg-card" />
                              </div>
                              <div className="space-y-1">
                                <label className="text-[9px] font-bold text-muted-foreground uppercase">Landlord Phone</label>
                                <Input {...agreementForm.register("landlordPhone")} className="h-8 text-xs bg-card" />
                              </div>
                            </div>

                            <div className="space-y-1">
                              <label className="text-[9px] font-bold text-muted-foreground uppercase">Terms & Conditions</label>
                              <Input {...agreementForm.register("terms")} placeholder="e.g., 3 months security deposit, includes water bill" className="h-8 text-xs bg-card" />
                            </div>

                            <div className="space-y-1">
                              <label className="text-[9px] font-bold text-muted-foreground uppercase">Document Link / Photo URL</label>
                              <Input {...agreementForm.register("documentUrl")} placeholder="https://..." className="h-8 text-xs bg-card" />
                            </div>

                            <div className="flex justify-end gap-2 pt-1">
                              <Button type="button" variant="outline" size="sm" onClick={() => setActiveSubForm(null)} className="h-7 text-[10px]">Cancel</Button>
                              <Button type="submit" size="sm" disabled={subFormSubmitting} className="h-7 text-[10px] text-white bg-primary">
                                {subFormSubmitting ? "Saving..." : "Save Agreement"}
                              </Button>
                            </div>
                          </form>
                        )}

                        <div className="border border-border/50 rounded-lg overflow-hidden">
                          <Table>
                            <TableHeader className="bg-muted/20">
                              <TableRow>
                                <TableHead className="py-1.5 font-bold">Contract No</TableHead>
                                <TableHead className="py-1.5 font-bold">Type</TableHead>
                                <TableHead className="py-1.5 font-bold">Period</TableHead>
                                <TableHead className="py-1.5 font-bold">Monthly Rent</TableHead>
                                <TableHead className="py-1.5 font-bold">Landlord</TableHead>
                                <TableHead className="py-1.5 font-bold w-12 text-right">Delete</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {!detailOffice.agreements || detailOffice.agreements.length === 0 ? (
                                <TableRow>
                                  <TableCell colSpan={6} className="text-center py-4 text-muted-foreground">
                                    No registered rental agreements logged.
                                  </TableCell>
                                </TableRow>
                              ) : (
                                detailOffice.agreements.map((ag: any) => (
                                  <TableRow key={ag.id} className="hover:bg-muted/20">
                                    <TableCell className="font-semibold py-2.5">
                                      {ag.contractNumber}
                                      {ag.documentUrl && (
                                        <a href={ag.documentUrl} target="_blank" rel="noreferrer" className="text-primary hover:underline block text-[9px] mt-0.5">View Document 🔗</a>
                                      )}
                                    </TableCell>
                                    <TableCell className="py-2.5">
                                      <Badge variant="outline" className="text-[9px] px-1.5 py-0.5 font-bold bg-slate-100 dark:bg-slate-800 text-foreground">
                                        {ag.agreementType}
                                      </Badge>
                                    </TableCell>
                                    <TableCell className="py-2.5 text-muted-foreground font-mono text-[10px]">
                                      {new Date(ag.startDate).toLocaleDateString()} - {ag.endDate ? new Date(ag.endDate).toLocaleDateString() : "Ongoing"}
                                    </TableCell>
                                    <TableCell className="py-2.5 font-medium">LKR {ag.monthlyRent.toLocaleString()}</TableCell>
                                    <TableCell className="py-2.5 text-muted-foreground">
                                      {ag.landlordName ? `${ag.landlordName} (${ag.landlordPhone || "N/A"})` : "N/A"}
                                    </TableCell>
                                    <TableCell className="py-2.5 text-right">
                                      <Button size="sm" variant="ghost" onClick={() => handleDeleteAgreement(ag.id)} className="h-6 w-6 p-0 text-red-500 hover:bg-red-500/10">
                                        <Trash2 className="h-3 w-3" />
                                      </Button>
                                    </TableCell>
                                  </TableRow>
                                ))
                              )}
                            </TableBody>
                          </Table>
                        </div>
                      </div>
                    )}

                    {/* PHYSICAL GOODS REQUESTS */}
                    {activeTab === "requests" && (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <h4 className="font-bold text-xs uppercase text-muted-foreground">Physical Goods Requisitions & Requirements</h4>
                          {!activeSubForm && (
                            <Button size="sm" onClick={() => setActiveSubForm("request")} className="h-7 text-[10px] text-white bg-primary gap-1">
                              <Plus className="h-3 w-3" /> Place Order
                            </Button>
                          )}
                        </div>

                        {activeSubForm === "request" && (
                          <form onSubmit={requestForm.handleSubmit(handleAddRequest)} className="p-3 bg-muted/10 rounded-lg border border-border/40 space-y-3">
                            <h5 className="font-bold text-foreground">Request Office Supplies / furniture / Maintenance</h5>
                            
                            <div className="grid grid-cols-2 gap-3">
                              <div className="space-y-1">
                                <label className="text-[9px] font-bold text-muted-foreground uppercase">Item Type</label>
                                <select {...requestForm.register("itemType")} className="h-8 w-full rounded border border-border bg-card text-xs px-2.5 text-foreground">
                                  <option value="FURNITURE">Office Furniture</option>
                                  <option value="STATIONERY">Office Stationery</option>
                                  <option value="EQUIPMENT">Office Equipment (AC, Water)</option>
                                  <option value="MAINTENANCE">Office Repairs / Maintenance</option>
                                  <option value="OTHER">Other supplies</option>
                                </select>
                              </div>
                              <div className="space-y-1">
                                <label className="text-[9px] font-bold text-muted-foreground uppercase">Priority</label>
                                <select {...requestForm.register("priority")} className="h-8 w-full rounded border border-border bg-card text-xs px-2.5 text-foreground">
                                  <option value="LOW">Low</option>
                                  <option value="MEDIUM">Medium</option>
                                  <option value="HIGH">High</option>
                                  <option value="URGENT">Urgent / Critical</option>
                                </select>
                              </div>
                            </div>

                            <div className="space-y-1">
                              <label className="text-[9px] font-bold text-muted-foreground uppercase">Description of Goods</label>
                              <textarea
                                {...requestForm.register("description")}
                                placeholder="e.g. 5 standard writing desks and 2 chairs for site technicians"
                                className="h-16 w-full rounded border border-border bg-card text-xs p-2 text-foreground"
                              />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                              <div className="space-y-1">
                                <label className="text-[9px] font-bold text-muted-foreground uppercase">Estimated Cost (LKR)</label>
                                <Input type="number" {...requestForm.register("estimatedCost", { valueAsNumber: true })} className="h-8 text-xs bg-card" />
                              </div>
                              <div className="space-y-1">
                                <label className="text-[9px] font-bold text-muted-foreground uppercase">Additional Notes</label>
                                <Input {...requestForm.register("notes")} placeholder="Optional details" className="h-8 text-xs bg-card" />
                              </div>
                            </div>

                            <div className="flex justify-end gap-2 pt-1">
                              <Button type="button" variant="outline" size="sm" onClick={() => setActiveSubForm(null)} className="h-7 text-[10px]">Cancel</Button>
                              <Button type="submit" size="sm" disabled={subFormSubmitting} className="h-7 text-[10px] text-white bg-primary">
                                {subFormSubmitting ? "Place Order" : "Place Order"}
                              </Button>
                            </div>
                          </form>
                        )}

                        <div className="border border-border/50 rounded-lg overflow-hidden">
                          <Table>
                            <TableHeader className="bg-muted/20">
                              <TableRow>
                                <TableHead className="py-1.5 font-bold">Category</TableHead>
                                <TableHead className="py-1.5 font-bold">Description</TableHead>
                                <TableHead className="py-1.5 font-bold">Cost</TableHead>
                                <TableHead className="py-1.5 font-bold">Priority</TableHead>
                                <TableHead className="py-1.5 font-bold">Requested By</TableHead>
                                <TableHead className="py-1.5 font-bold">Status</TableHead>
                                <TableHead className="py-1.5 font-bold w-12 text-right">Delete</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {!detailOffice.requests || detailOffice.requests.length === 0 ? (
                                <TableRow>
                                  <TableCell colSpan={7} className="text-center py-4 text-muted-foreground">
                                    No requirements requested yet.
                                  </TableCell>
                                </TableRow>
                              ) : (
                                detailOffice.requests.map((rq: any) => (
                                  <TableRow key={rq.id} className="hover:bg-muted/20">
                                    <TableCell className="font-bold py-2.5">{rq.itemType}</TableCell>
                                    <TableCell className="py-2.5 text-foreground/80">{rq.description}</TableCell>
                                    <TableCell className="py-2.5 font-medium font-mono text-[11px]">LKR {rq.estimatedCost.toLocaleString()}</TableCell>
                                    <TableCell className="py-2.5">
                                      <Badge variant="outline" className={`text-[9px] border-none font-bold uppercase ${
                                        rq.priority === "URGENT" ? "bg-red-100 text-red-700" :
                                        rq.priority === "HIGH" ? "bg-amber-100 text-amber-700" :
                                        "bg-slate-100 text-slate-700"
                                      }`}>
                                        {rq.priority}
                                      </Badge>
                                    </TableCell>
                                    <TableCell className="py-2.5 text-muted-foreground">
                                      {rq.requestedBy?.name || rq.requestedBy?.username}
                                    </TableCell>
                                    <TableCell className="py-2.5">
                                      <select
                                        defaultValue={rq.status}
                                        onChange={(e) => updateRequestStatus(rq.id, e.target.value)}
                                        className="h-6 bg-card border border-border rounded text-[10px] text-foreground font-bold px-1.5"
                                      >
                                        <option value="PENDING">Pending</option>
                                        <option value="APPROVED">Approved</option>
                                        <option value="DELIVERED">Delivered</option>
                                        <option value="REJECTED">Rejected</option>
                                      </select>
                                    </TableCell>
                                    <TableCell className="py-2.5 text-right">
                                      <Button size="sm" variant="ghost" onClick={() => handleDeleteRequest(rq.id)} className="h-6 w-6 p-0 text-red-500 hover:bg-red-500/10">
                                        <Trash2 className="h-3 w-3" />
                                      </Button>
                                    </TableCell>
                                  </TableRow>
                                ))
                              )}
                            </TableBody>
                          </Table>
                        </div>
                      </div>
                    )}

                    {/* VEHICLE ALLOCATIONS */}
                    {activeTab === "vehicles" && (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <h4 className="font-bold text-xs uppercase text-muted-foreground">Site Allocated Vehicle Pool</h4>
                          {!activeSubForm && (
                            <Button size="sm" onClick={() => setActiveSubForm("vehicle")} className="h-7 text-[10px] text-white bg-primary gap-1">
                              <Plus className="h-3 w-3" /> Assign Vehicle
                            </Button>
                          )}
                        </div>

                        {activeSubForm === "vehicle" && (
                          <form onSubmit={vehicleForm.handleSubmit(handleAddVehicle)} className="p-3 bg-muted/10 rounded-lg border border-border/40 space-y-3">
                            <h5 className="font-bold text-foreground">Allocate Vehicle to Site Pool</h5>
                            
                            <div className="grid grid-cols-2 gap-3">
                              <div className="space-y-1">
                                <label className="text-[9px] font-bold text-muted-foreground uppercase">Plate Registration Number</label>
                                <Input {...vehicleForm.register("vehicleRegNo")} placeholder="e.g. WP-CAS-9987" className="h-8 text-xs bg-card" />
                              </div>
                              <div className="space-y-1">
                                <label className="text-[9px] font-bold text-muted-foreground uppercase">Make & Model</label>
                                <Input {...vehicleForm.register("makeModel")} placeholder="e.g. Nissan Double Cab" className="h-8 text-xs bg-card" />
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                              <div className="space-y-1">
                                <label className="text-[9px] font-bold text-muted-foreground uppercase">Assigned Driver Name</label>
                                <Input {...vehicleForm.register("assignedDriver")} placeholder="Driver name" className="h-8 text-xs bg-card" />
                              </div>
                              <div className="space-y-1">
                                <label className="text-[9px] font-bold text-muted-foreground uppercase">Driver Phone</label>
                                <Input {...vehicleForm.register("driverPhone")} placeholder="Driver phone" className="h-8 text-xs bg-card" />
                              </div>
                            </div>

                            <div className="space-y-1">
                              <label className="text-[9px] font-bold text-muted-foreground uppercase">Allocation Notes</label>
                              <Input {...vehicleForm.register("notes")} placeholder="e.g. for regional site surveys" className="h-8 text-xs bg-card" />
                            </div>

                            <div className="flex justify-end gap-2 pt-1">
                              <Button type="button" variant="outline" size="sm" onClick={() => setActiveSubForm(null)} className="h-7 text-[10px]">Cancel</Button>
                              <Button type="submit" size="sm" disabled={subFormSubmitting} className="h-7 text-[10px] text-white bg-primary">
                                {subFormSubmitting ? "Assign Vehicle" : "Assign Vehicle"}
                              </Button>
                            </div>
                          </form>
                        )}

                        <div className="border border-border/50 rounded-lg overflow-hidden">
                          <Table>
                            <TableHeader className="bg-muted/20">
                              <TableRow>
                                <TableHead className="py-1.5 font-bold">Plate Reg No</TableHead>
                                <TableHead className="py-1.5 font-bold">Make & Model</TableHead>
                                <TableHead className="py-1.5 font-bold">Assigned Driver</TableHead>
                                <TableHead className="py-1.5 font-bold">Allocated Date</TableHead>
                                <TableHead className="py-1.5 font-bold">Status</TableHead>
                                <TableHead className="py-1.5 font-bold w-12 text-right">Remove</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {!detailOffice.vehicles || detailOffice.vehicles.length === 0 ? (
                                <TableRow>
                                  <TableCell colSpan={6} className="text-center py-4 text-muted-foreground">
                                    No vehicles currently allocated to this site pool.
                                  </TableCell>
                                </TableRow>
                              ) : (
                                detailOffice.vehicles.map((vh: any) => (
                                  <TableRow key={vh.id} className="hover:bg-muted/20">
                                    <TableCell className="font-mono font-bold py-2.5 text-foreground">{vh.vehicleRegNo}</TableCell>
                                    <TableCell className="py-2.5 font-medium">{vh.makeModel}</TableCell>
                                    <TableCell className="py-2.5">
                                      {vh.assignedDriver ? (
                                        <div>
                                          <p className="font-semibold text-foreground/80">{vh.assignedDriver}</p>
                                          <p className="text-[9px] text-muted-foreground font-mono">{vh.driverPhone}</p>
                                        </div>
                                      ) : (
                                        <span className="italic text-muted-foreground/60">No driver assigned</span>
                                      )}
                                    </TableCell>
                                    <TableCell className="py-2.5 text-muted-foreground font-mono text-[10px]">
                                      {new Date(vh.allocationDate).toLocaleDateString()}
                                    </TableCell>
                                    <TableCell className="py-2.5">
                                      <Badge variant="outline" className={`text-[9px] font-bold border-none ${
                                        vh.status === "ACTIVE" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                                      }`}>
                                        {vh.status}
                                      </Badge>
                                    </TableCell>
                                    <TableCell className="py-2.5 text-right">
                                      <Button size="sm" variant="ghost" onClick={() => handleDeleteVehicle(vh.id)} className="h-6 w-6 p-0 text-red-500 hover:bg-red-500/10">
                                        <Trash2 className="h-3 w-3" />
                                      </Button>
                                    </TableCell>
                                  </TableRow>
                                ))
                              )}
                            </TableBody>
                          </Table>
                        </div>
                      </div>
                    )}

                    {/* PURCHASING TENDERS */}
                    {activeTab === "tenders" && (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <h4 className="font-bold text-xs uppercase text-muted-foreground">Office Purchasing & Leasing Tenders</h4>
                          {!activeSubForm && (
                            <Button size="sm" onClick={() => setActiveSubForm("tender")} className="h-7 text-[10px] text-white bg-primary gap-1">
                              <Plus className="h-3 w-3" /> Add Tender
                            </Button>
                          )}
                        </div>

                        {activeSubForm === "tender" && (
                          <form onSubmit={tenderForm.handleSubmit(handleAddTender)} className="p-3 bg-muted/10 rounded-lg border border-border/40 space-y-3">
                            <h5 className="font-bold text-foreground">Log Site Procurement Tender</h5>
                            
                            <div className="grid grid-cols-2 gap-3">
                              <div className="space-y-1">
                                <label className="text-[9px] font-bold text-muted-foreground uppercase">Tender Number</label>
                                <Input {...tenderForm.register("tenderNo")} placeholder="e.g. SLT/TND/SO-GAM/2026/01" className="h-8 text-xs bg-card" />
                              </div>
                              <div className="space-y-1">
                                <label className="text-[9px] font-bold text-muted-foreground uppercase">Tender Title</label>
                                <Input {...tenderForm.register("title")} placeholder="e.g. Supply of workstation furniture" className="h-8 text-xs bg-card" />
                              </div>
                            </div>

                            <div className="space-y-1">
                              <label className="text-[9px] font-bold text-muted-foreground uppercase">Description & Specifications</label>
                              <textarea
                                {...tenderForm.register("description")}
                                placeholder="Describe procurement requirements..."
                                className="h-16 w-full rounded border border-border bg-card text-xs p-2 text-foreground"
                              />
                            </div>

                            <div className="grid grid-cols-3 gap-2">
                              <div className="space-y-1">
                                <label className="text-[9px] font-bold text-muted-foreground uppercase">Budget (LKR)</label>
                                <Input type="number" {...tenderForm.register("budget", { valueAsNumber: true })} className="h-8 text-xs bg-card" />
                              </div>
                              <div className="space-y-1">
                                <label className="text-[9px] font-bold text-muted-foreground uppercase">Publish Date</label>
                                <Input type="date" {...tenderForm.register("publishDate")} className="h-8 text-xs bg-card" />
                              </div>
                              <div className="space-y-1">
                                <label className="text-[9px] font-bold text-muted-foreground uppercase">Closing Date</label>
                                <Input type="date" {...tenderForm.register("closingDate")} className="h-8 text-xs bg-card" />
                              </div>
                            </div>

                            <div className="grid grid-cols-3 gap-2 p-2 bg-muted/10 rounded border border-border/40">
                              <div className="col-span-3 text-[9px] font-bold text-muted-foreground">Evaluation Winner Details (Optional)</div>
                              <div className="space-y-1 col-span-2">
                                <label className="text-[8px] font-semibold text-muted-foreground">Winning Vendor</label>
                                <Input {...tenderForm.register("winnerVendor")} className="h-7 text-xs bg-card" />
                              </div>
                              <div className="space-y-1">
                                <label className="text-[8px] font-semibold text-muted-foreground">Winning Bid Amount</label>
                                <Input type="number" {...tenderForm.register("winnerBidAmount", { valueAsNumber: true })} className="h-7 text-xs bg-card" />
                              </div>
                            </div>

                            <div className="flex justify-end gap-2 pt-1">
                              <Button type="button" variant="outline" size="sm" onClick={() => setActiveSubForm(null)} className="h-7 text-[10px]">Cancel</Button>
                              <Button type="submit" size="sm" disabled={subFormSubmitting} className="h-7 text-[10px] text-white bg-primary">
                                {subFormSubmitting ? "Save Tender" : "Save Tender"}
                              </Button>
                            </div>
                          </form>
                        )}

                        <div className="border border-border/50 rounded-lg overflow-hidden">
                          <Table>
                            <TableHeader className="bg-muted/20">
                              <TableRow>
                                <TableHead className="py-1.5 font-bold">Tender No</TableHead>
                                <TableHead className="py-1.5 font-bold">Tender Title</TableHead>
                                <TableHead className="py-1.5 font-bold">Closing Date</TableHead>
                                <TableHead className="py-1.5 font-bold">Budget</TableHead>
                                <TableHead className="py-1.5 font-bold">Status</TableHead>
                                <TableHead className="py-1.5 font-bold">Winner Bidder</TableHead>
                                <TableHead className="py-1.5 font-bold w-12 text-right">Delete</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {!detailOffice.tenders || detailOffice.tenders.length === 0 ? (
                                <TableRow>
                                  <TableCell colSpan={7} className="text-center py-4 text-muted-foreground">
                                    No procurement tenders logged for this site.
                                  </TableCell>
                                </TableRow>
                              ) : (
                                detailOffice.tenders.map((tn: any) => (
                                  <TableRow key={tn.id} className="hover:bg-muted/20">
                                    <TableCell className="font-semibold py-2.5 text-foreground font-mono">{tn.tenderNo}</TableCell>
                                    <TableCell className="py-2.5 font-semibold">{tn.title}</TableCell>
                                    <TableCell className="py-2.5 text-muted-foreground font-mono text-[10px]">
                                      {new Date(tn.closingDate).toLocaleDateString()}
                                    </TableCell>
                                    <TableCell className="py-2.5 font-medium text-[11px] font-mono">LKR {tn.budget.toLocaleString()}</TableCell>
                                    <TableCell className="py-2.5">
                                      <Badge variant="outline" className={`text-[9px] font-bold border-none uppercase ${
                                        tn.status === "AWARDED" ? "bg-emerald-100 text-emerald-700" :
                                        tn.status === "OPEN" ? "bg-indigo-100 text-indigo-700" :
                                        "bg-slate-100 text-slate-700"
                                      }`}>
                                        {tn.status}
                                      </Badge>
                                    </TableCell>
                                    <TableCell className="py-2.5 text-muted-foreground">
                                      {tn.winnerVendor ? (
                                        <div>
                                          <p className="font-semibold text-foreground/80">{tn.winnerVendor}</p>
                                          <p className="text-[9px] text-muted-foreground">LKR {tn.winnerBidAmount?.toLocaleString()}</p>
                                        </div>
                                      ) : (
                                        <span className="italic text-muted-foreground/60">Not awarded</span>
                                      )}
                                    </TableCell>
                                    <TableCell className="py-2.5 text-right">
                                      <Button size="sm" variant="ghost" onClick={() => handleDeleteTender(tn.id)} className="h-6 w-6 p-0 text-red-500 hover:bg-red-500/10">
                                        <Trash2 className="h-3 w-3" />
                                      </Button>
                                    </TableCell>
                                  </TableRow>
                                ))
                              )}
                            </TableBody>
                          </Table>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )
            )}

            <div className="flex justify-end gap-2 border-t border-border/40 pt-3 flex-shrink-0">
              <Button size="sm" onClick={() => setDetailOfficeId(null)} className="h-8 text-xs font-semibold">Close Panel</Button>
            </div>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}
