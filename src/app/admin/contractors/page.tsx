"use client";

import React, { useState, useMemo } from 'react';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import RoleGuard from '@/components/RoleGuard';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Search, Plus, Users, UserPlus, Share2, Trash, Mail, Building2, ShieldCheck, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import TeamManager from './TeamManager';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { ContractorFormSheet } from './components/ContractorFormSheet';
import { useContractorOperations } from './hooks/useContractorOperations';
import { ContractorSchema } from "@/lib/validations/contractor.schema";

interface Contractor extends ContractorSchema {
    id: string;
    status: 'ACTIVE' | 'PENDING' | 'REJECTED' | 'ARM_PENDING' | 'OSP_PENDING';
    documentStatus?: 'PENDING' | 'APPROVED' | 'REJECTED';
    opmc?: { name: string };
    _count?: { teams: number };
}

export default function ContractorsPage() {
    const [searchTerm, setSearchTerm] = useState("");
    const [viewMode, setViewMode] = useState<'ALL' | 'PENDING_DOCS' | 'PENDING_AUTH'>('ALL');
    
    // Modal States
    const [formOpen, setFormOpen] = useState(false);
    const [selectedContractor, setSelectedContractor] = useState<Contractor | null>(null);
    const [teamManagerOpen, setTeamManagerOpen] = useState(false);
    const [selectedContractorForTeams, setSelectedContractorForTeams] = useState<{ id: string, name: string } | null>(null);
    const [inviteModalOpen, setInviteModalOpen] = useState(false);
    const [shareModalOpen, setShareModalOpen] = useState(false);
    const [shareLink, setShareLink] = useState("");
    const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

    const [inviteData, setInviteData] = useState({
        name: '',
        contactNumber: '',
        type: 'SOD' as 'SOD' | 'OSP',
        opmcId: ''
    });

    const { 
        createMutation, 
        updateMutation, 
        deleteMutation, 
        approveMutation, 
        rejectMutation 
    } = useContractorOperations();

    // Role detection
    const userString = typeof window !== 'undefined' ? localStorage.getItem('user') : null;
    const userRole = userString ? JSON.parse(userString).role : '';
    const isAdmin = ['SUPER_ADMIN', 'ADMIN'].includes(userRole);

    // --- DATA FETCHING ---
    const { data: contractorsData, isLoading: loadingContractors } = useQuery({
        queryKey: ["contractors"],
        queryFn: async () => {
            const res = await fetch(`/api/admin/contractors?page=1&limit=1000&t=${Date.now()}`);
            if (!res.ok) throw new Error("Failed to fetch contractors");
            return res.json();
        }
    });

    const contractors = useMemo(() => {
        // Handle ApiResponse wrapping
        const data = contractorsData as {
            success?: boolean;
            data?: { contractors?: Contractor[] };
            contractors?: Contractor[];
        } | null | undefined;
        if (!data) return [];
        const actualContractors = (data.success && data.data) 
            ? data.data.contractors 
            : data.contractors;
        return Array.isArray(actualContractors) ? actualContractors : [];
    }, [contractorsData]);

    const { data: opmcs = [] } = useQuery<{ id: string; name: string; rtom: string }[]>({
        queryKey: ['opmcs'],
        queryFn: () => fetch(`/api/opmcs?t=${Date.now()}`).then(res => res.json())
    });


    // --- STATS CALCULATION ---
    const stats = useMemo(() => {
        const total = contractors.length;
        const active = contractors.filter(c => c.status === 'ACTIVE').length;
        const pending = contractors.filter(c => ['PENDING', 'ARM_PENDING', 'OSP_PENDING'].includes(c.status)).length;
        const rejected = contractors.filter(c => c.status === 'REJECTED').length;
        return { total, active, pending, rejected };
    }, [contractors]);

    // --- HANDLERS ---
    const handleAdd = () => {
        setSelectedContractor(null);
        setFormOpen(true);
    };

    const handleEdit = (contractor: Contractor) => {
        setSelectedContractor(contractor);
        setFormOpen(true);
    };

    const handleFormSubmit = async (data: ContractorSchema) => {
        if (selectedContractor) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await updateMutation.mutateAsync({ id: selectedContractor.id, data: data as any });
        } else {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await createMutation.mutateAsync(data as any);
        }
        setFormOpen(false);
    };

    const handleInviteSubmit = async () => {
        if (!inviteData.name || !inviteData.contactNumber || !inviteData.opmcId) {
            toast.error("Please fill all mandatory fields (Name, Contact, RTOM)");
            return;
        }

        try {
            const res = await fetch('/api/contractors/generate-link', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...inviteData })
            });
            const data = await res.json();

            if (!res.ok) {
                toast.error(data.error?.message || "Invite failed");
                return;
            }

            if (data.success && data.data?.registrationLink) {
                setShareLink(data.data.registrationLink);
                setShareModalOpen(true);
                setInviteModalOpen(false);
                setInviteData({ name: '', contactNumber: '', type: 'SOD', opmcId: '' });
                toast.success("Invitation generated successfully");
            } else {
                toast.error(data.error?.message || "Invite generation failed");
            }
        } catch {
            toast.error("Network error. Please try again.");
        }
    };

    const handleResendLink = async (id: string) => {
        try {
            const res = await fetch(`/api/contractors/${id}/resend-link`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ origin: window.location.origin })
            });
            const data = await res.json();
            if (!res.ok) {
                toast.error(data.error?.message || "Failed to resend link");
                return;
            }
            if (data.success && data.data?.registrationLink) {
                setShareLink(data.data.registrationLink);
                setShareModalOpen(true);
                toast.success("Link refreshed");
            }
        } catch {
            toast.error("Failed to resend");
        }
    };

    const filteredContractors = useMemo(() => {
        return contractors.filter((c) => {
            const matchesSearch = c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                (c.registrationNumber && c.registrationNumber.toLowerCase().includes(searchTerm.toLowerCase()));

            if (!matchesSearch) return false;

            if (viewMode === 'PENDING_DOCS') {
                return (c.status === 'PENDING' || c.status === 'ARM_PENDING') && (c.documentStatus === 'PENDING' || !c.documentStatus);
            }
            if (viewMode === 'PENDING_AUTH') {
                return (c.status === 'PENDING' || c.status === 'ARM_PENDING') && c.documentStatus === 'APPROVED';
            }

            return true;
        });
    }, [contractors, searchTerm, viewMode]);

    const getStatusBadge = (status: Contractor['status']) => {
        switch (status) {
            case 'ACTIVE':
                return <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200">Active</Badge>;
            case 'PENDING':
                return <Badge className="bg-amber-50 text-amber-700 border-amber-200">Pending</Badge>;
            case 'ARM_PENDING':
                return <Badge className="bg-blue-50 text-blue-700 border-blue-200">ARM Pending</Badge>;
            case 'OSP_PENDING':
                return <Badge className="bg-purple-50 text-purple-700 border-purple-200">OSP Pending</Badge>;
            case 'REJECTED':
                return <Badge className="bg-red-50 text-red-700 border-red-200">Rejected</Badge>;
            default:
                return <Badge className="bg-slate-50 text-slate-500 border-slate-200">{status}</Badge>;
        }
    };

    const ALLOWED_ROLES = [
        'SUPER_ADMIN',
        'ADMIN',
        'OFFICE_ADMIN',
        'OFFICE_ADMIN_ASSISTANT',
        'OSP_MANAGER',
        'AREA_MANAGER',
        'FINANCE_MANAGER',
        'FINANCE_ASSISTANT',
        'SITE_OFFICE_STAFF',
        'ENGINEER',
        'ASSISTANT_ENGINEER',
        'AREA_COORDINATOR',
        'MANAGER',
        'QC_OFFICER'
    ];

    return (
        <RoleGuard allowedRoles={ALLOWED_ROLES}>
            <div className="erp-page-wrapper flex-row overflow-hidden">
                <Sidebar />
                <main className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
                    <Header />
                    <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
                        <div className="max-w-7xl mx-auto space-y-4">
                            
                            {/* Page Header */}
                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                                <div className="space-y-0.5">
                                    <h1 className="text-xl font-black text-slate-900 tracking-tight">Contractor Directory</h1>
                                    <p className="text-xs text-slate-500">Manage registered partner contractors, profiles, and technician teams.</p>
                                </div>
                                <div className="flex gap-2 w-full sm:w-auto">
                                    <Button onClick={() => setInviteModalOpen(true)} variant="outline" className="flex-1 sm:flex-none h-8 px-4 border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-blue-600 transition-all font-bold text-xs">
                                        <UserPlus className="w-4 h-4 mr-1.5" /> Quick Invite
                                    </Button>
                                    <Button onClick={handleAdd} className="flex-1 sm:flex-none h-8 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-xs transition-all shadow-sm">
                                        <Plus className="w-4 h-4 mr-1.5" /> Add Contractor
                                    </Button>
                                </div>
                            </div>

                            {/* Top Stats Cards */}
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                            <Card className="rounded-xl border border-slate-200 bg-white">
                                <CardContent className="p-3 flex items-center justify-between">
                                    <div>
                                        <p className="text-[10px] font-black uppercase text-slate-400">Total Contractors</p>
                                        <p className="text-base font-black text-slate-900">{stats.total}</p>
                                    </div>
                                    <div className="h-8 w-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                                        <Building2 className="w-4 h-4" />
                                    </div>
                                </CardContent>
                            </Card>
                            <Card className="rounded-xl border border-slate-200 bg-white">
                                <CardContent className="p-3 flex items-center justify-between">
                                    <div>
                                        <p className="text-[10px] font-black uppercase text-slate-400">Active</p>
                                        <p className="text-base font-black text-emerald-600">{stats.active}</p>
                                    </div>
                                    <div className="h-8 w-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                                        <ShieldCheck className="w-4 h-4" />
                                    </div>
                                </CardContent>
                            </Card>
                            <Card className="rounded-xl border border-slate-200 bg-white">
                                <CardContent className="p-3 flex items-center justify-between">
                                    <div>
                                        <p className="text-[10px] font-black uppercase text-slate-400">Pending Actions</p>
                                        <p className="text-base font-black text-amber-600">{stats.pending}</p>
                                    </div>
                                    <div className="h-8 w-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                                        <Users className="w-4 h-4" />
                                    </div>
                                </CardContent>
                            </Card>
                            <Card className="rounded-xl border border-slate-200 bg-white">
                                <CardContent className="p-3 flex items-center justify-between">
                                    <div>
                                        <p className="text-[10px] font-black uppercase text-slate-400">Rejected</p>
                                        <p className="text-base font-black text-red-600">{stats.rejected}</p>
                                    </div>
                                    <div className="h-8 w-8 rounded-lg bg-red-50 text-red-600 flex items-center justify-center">
                                        <Trash className="w-4 h-4" />
                                    </div>
                                </CardContent>
                            </Card>
                        </div>

                        {/* Search & Filter Toolbar */}
                        <div className="erp-toolbar flex-col md:flex-row justify-between gap-3">
                            <div className="flex bg-slate-100 p-1 rounded-lg w-full md:w-auto">
                                {[
                                    { id: 'ALL', label: 'Show All' },
                                    { id: 'PENDING_DOCS', label: 'Review Required' },
                                    { id: 'PENDING_AUTH', label: 'Auth Required' }
                                ].map((tab) => (
                                    <button
                                        key={tab.id}
                                        onClick={() => setViewMode(tab.id as 'ALL' | 'PENDING_DOCS' | 'PENDING_AUTH')}
                                        className={cn(
                                            "flex-1 px-3 py-1 text-[10px] font-black uppercase tracking-wider rounded transition-all cursor-pointer",
                                            viewMode === tab.id ? "bg-white text-slate-900 shadow-sm" : "text-slate-400 hover:text-slate-600"
                                        )}
                                    >
                                        {tab.label}
                                    </button>
                                ))}
                            </div>
                            <div className="relative w-full md:w-80 group">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                                <Input
                                    placeholder="Search by name or code..."
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                    className="h-8 pl-9 bg-slate-50 border-none focus-visible:ring-1 focus-visible:ring-blue-200 rounded-lg text-xs"
                                />
                            </div>
                        </div>

                        {/* Contractors Table */}
                        <div className="erp-table-container">
                            {loadingContractors ? (
                                <div className="py-20 flex flex-col items-center justify-center text-slate-400 gap-4">
                                    <div className="h-8 w-8 border-3 border-blue-100 border-t-blue-600 rounded-full animate-spin" />
                                    <p className="text-[10px] font-black uppercase tracking-wider animate-pulse">Loading Contractors...</p>
                                </div>
                            ) : filteredContractors.length === 0 ? (
                                <div className="py-20 flex flex-col items-center justify-center bg-white rounded-xl border border-dashed border-slate-200 text-slate-400">
                                    <Building2 className="w-10 h-10 opacity-20 mb-3" />
                                    <p className="text-xs font-bold">No contractors found matching the criteria.</p>
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr>
                                                <th className="w-12 text-center">#</th>
                                                <th>Contractor / Company Name</th>
                                                <th>Type</th>
                                                <th>RTOM Region</th>
                                                <th className="text-center">Teams</th>
                                                <th>Status</th>
                                                <th className="text-right pr-6 w-40">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 bg-white">
                                            {filteredContractors.map((contractor: Contractor, index) => (
                                                <tr key={contractor.id} className="hover:bg-slate-50/50 transition-colors">
                                                    <td className="text-center font-mono text-slate-400">{index + 1}</td>
                                                    <td className="py-2.5">
                                                        <div className="font-bold text-slate-900">{contractor.name}</div>
                                                        <div className="text-[10px] text-slate-400 flex gap-2 items-center">
                                                            <span className="font-mono">{contractor.registrationNumber || 'NO CODE'}</span>
                                                            <span>•</span>
                                                            <span>{contractor.contactNumber || 'No Phone'}</span>
                                                        </div>
                                                    </td>
                                                    <td>
                                                        <Badge className={cn(
                                                            "border-none px-2 py-0.5 text-[9px] font-black tracking-wide",
                                                            contractor.type === 'OSP' ? "bg-purple-100 text-purple-700" : "bg-blue-100 text-blue-700"
                                                        )}>
                                                            {contractor.type || 'SOD'}
                                                        </Badge>
                                                    </td>
                                                    <td className="text-slate-600 font-medium">
                                                        {(() => {
                                                            const activeOpmc = contractor.opmc || (contractor as any).teams?.[0]?.opmc;
                                                            if (!activeOpmc) return <span className="text-slate-400">Central Office</span>;
                                                            return (
                                                                <div className="flex flex-col items-start gap-0.5">
                                                                    <span className="font-semibold text-slate-800 text-[13px]">{activeOpmc.name}</span>
                                                                    <div className="flex items-center gap-1">
                                                                        <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.2 rounded border border-slate-200">
                                                                            {activeOpmc.province || activeOpmc.region || 'SLT REGION'}
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                            );
                                                        })()}
                                                    </td>
                                                    <td className="text-center">
                                                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-700 bg-indigo-50 border border-indigo-100 px-1.5 py-0.5 rounded">
                                                            <Users className="w-3 h-3 text-indigo-500" />
                                                            {contractor._count?.teams || 0}
                                                        </span>
                                                    </td>
                                                    <td>
                                                        <div className="flex flex-col gap-0.5 items-start">
                                                            {getStatusBadge(contractor.status)}
                                                            {contractor.documentStatus && (
                                                                <span className={cn(
                                                                    "text-[9px] font-bold px-1.5 py-0.2 rounded border leading-none mt-0.5",
                                                                    contractor.documentStatus === 'APPROVED' ? "bg-emerald-50 text-emerald-700 border-emerald-100" :
                                                                    contractor.documentStatus === 'REJECTED' ? "bg-red-50 text-red-600 border-red-100" :
                                                                    "bg-slate-50 text-slate-500 border-slate-100"
                                                                )}>
                                                                    Docs: {contractor.documentStatus}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="text-right pr-6 py-2.5">
                                                        <div className="inline-flex items-center gap-1.5">
                                                            <Button
                                                                size="sm"
                                                                variant="ghost"
                                                                onClick={() => handleEdit(contractor)}
                                                                className="h-7 w-7 p-0 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                                                                title="Manage Profile"
                                                            >
                                                                <ShieldCheck className="w-3.5 h-3.5" />
                                                            </Button>
                                                            <Button
                                                                size="sm"
                                                                variant="ghost"
                                                                onClick={() => {
                                                                    setSelectedContractorForTeams({ id: contractor.id, name: contractor.name });
                                                                    setTeamManagerOpen(true);
                                                                }}
                                                                className="h-7 w-7 p-0 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                                                                title="Manpower Setup"
                                                            >
                                                                <Users className="w-3.5 h-3.5" />
                                                            </Button>
                                                            
                                                            {(contractor.status === 'PENDING' || contractor.status === 'ARM_PENDING' || contractor.status === 'OSP_PENDING') && (
                                                                <>
                                                                    {isAdmin && (contractor.status === 'ARM_PENDING' || contractor.status === 'OSP_PENDING' || contractor.documentStatus === 'APPROVED') ? (
                                                                        <Button
                                                                            size="sm"
                                                                            variant="ghost"
                                                                            onClick={() => approveMutation.mutate(contractor.id)}
                                                                            className="h-7 w-7 p-0 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-all"
                                                                            title="Approve Contractor"
                                                                        >
                                                                            <Check className="w-3.5 h-3.5" />
                                                                        </Button>
                                                                    ) : (
                                                                        <Button
                                                                            size="sm"
                                                                            variant="ghost"
                                                                            onClick={() => handleResendLink(contractor.id)}
                                                                            className="h-7 w-7 p-0 text-amber-600 hover:text-amber-700 hover:bg-amber-50 rounded-lg transition-all"
                                                                            title="Resend Invite Link"
                                                                        >
                                                                            <Share2 className="w-3.5 h-3.5" />
                                                                        </Button>
                                                                    )}
                                                                    {isAdmin && (
                                                                        <Button
                                                                            size="sm"
                                                                            variant="ghost"
                                                                            onClick={() => rejectMutation.mutate(contractor.id)}
                                                                            className="h-7 w-7 p-0 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-all"
                                                                            title="Reject Contractor"
                                                                        >
                                                                            <X className="w-3.5 h-3.5" />
                                                                        </Button>
                                                                    )}
                                                                </>
                                                            )}
                                                            
                                                            {isAdmin && (
                                                                <Button
                                                                    size="sm"
                                                                    variant="ghost"
                                                                    onClick={() => setDeleteTargetId(contractor.id)}
                                                                    className="h-7 w-7 p-0 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                                                                    title="Delete Contractor"
                                                                >
                                                                    <Trash className="w-3.5 h-3.5" />
                                                                </Button>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* --- MODALS --- */}
                
                <ContractorFormSheet 
                    open={formOpen} 
                    onOpenChange={setFormOpen}
                    initialData={selectedContractor || undefined}
                    onSubmit={handleFormSubmit}
                    isSubmitting={createMutation.isPending || updateMutation.isPending}
                />

                <TeamManager 
                    isOpen={teamManagerOpen} 
                    onClose={() => setTeamManagerOpen(false)}
                    contractorId={selectedContractorForTeams?.id || ""}
                    contractorName={selectedContractorForTeams?.name || ""}
                />

                {/* Invitation Dialog */}
                <Dialog open={inviteModalOpen} onOpenChange={setInviteModalOpen}>
                    <DialogContent className="max-w-md rounded-3xl">
                        <DialogHeader>
                            <DialogTitle className="text-xl font-black text-slate-900">Send Registration Invite</DialogTitle>
                            <DialogDescription className="text-xs font-medium text-slate-500">Generate an invite link for a new contractor.</DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                            <div className="space-y-1.5">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Contractor / Company Name</Label>
                                <Input value={inviteData.name} onChange={e => setInviteData({...inviteData, name: e.target.value})} className="h-11 rounded-xl bg-slate-50 border-none" />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Mobile Number</Label>
                                <Input value={inviteData.contactNumber} onChange={e => setInviteData({...inviteData, contactNumber: e.target.value})} className="h-11 rounded-xl bg-slate-50 border-none" />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Work Category</Label>
                                <Select value={inviteData.type} onValueChange={(v: 'SOD' | 'OSP') => setInviteData({...inviteData, type: v})}>
                                    <SelectTrigger className="h-11 rounded-xl bg-slate-50 border-none"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="SOD">Service Orders (Operations)</SelectItem>
                                        <SelectItem value="OSP">Network Projects (OSP)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Regional RTOM Office</Label>
                                <Select value={inviteData.opmcId} onValueChange={(v) => setInviteData({...inviteData, opmcId: v})}>
                                    <SelectTrigger className="h-11 rounded-xl bg-slate-50 border-none"><SelectValue placeholder="Select RTOM" /></SelectTrigger>
                                    <SelectContent>
                                        {opmcs.map((o: { id: string; name: string }) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <DialogFooter>
                            <Button onClick={handleInviteSubmit} className="w-full bg-slate-900 hover:bg-slate-800 text-white h-12 rounded-xl font-black uppercase text-xs tracking-widest">Generate Invite Link</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                {/* Share Dialog */}
                <Dialog open={shareModalOpen} onOpenChange={setShareModalOpen}>
                    <DialogContent className="max-w-md rounded-3xl">
                        <DialogHeader>
                            <DialogTitle className="text-xl font-black text-emerald-900">Invite Link Ready</DialogTitle>
                            <DialogDescription className="text-xs font-medium text-emerald-600">The registration link has been created.</DialogDescription>
                        </DialogHeader>
                        <div className="p-6 bg-emerald-50 rounded-2xl border border-emerald-100 flex flex-col items-center gap-4 text-center">
                            <div className="h-12 w-12 rounded-full bg-white flex items-center justify-center text-emerald-600 shadow-sm shadow-emerald-200"><Mail className="w-6 h-6" /></div>
                            <div className="space-y-1">
                                <p className="text-xs font-bold text-emerald-800 truncate max-w-[300px]">{shareLink}</p>
                                <p className="text-[10px] text-emerald-500">Link expires in 7 days</p>
                            </div>
                            <div className="flex gap-2 w-full">
                                <Button className="flex-1 bg-emerald-600 hover:bg-emerald-700 h-10 rounded-xl font-bold" onClick={() => {
                                    navigator.clipboard.writeText(shareLink);
                                    toast.success("Link copied to clipboard");
                                }}>Copy Link</Button>
                                <Button variant="outline" className="flex-1 border-emerald-200 text-emerald-600 hover:bg-white h-10 rounded-xl font-bold" onClick={() => window.open(`https://wa.me/${inviteData.contactNumber}?text=${encodeURIComponent(`Register for SLTS ERP: ${shareLink}`)}`)}>WhatsApp</Button>
                            </div>
                        </div>
                    </DialogContent>
                </Dialog>

                {/* Delete Contractor AlertDialog */}
                <AlertDialog open={!!deleteTargetId} onOpenChange={(o) => !o && setDeleteTargetId(null)}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Delete Contractor</AlertDialogTitle>
                            <AlertDialogDescription>
                                Are you sure you want to permanently delete this contractor? This action cannot be undone and will remove all contractor assignments.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => {
                                if (deleteTargetId) {
                                    deleteMutation.mutate(deleteTargetId);
                                }
                                setDeleteTargetId(null);
                            }} className="bg-red-600 hover:bg-red-700 text-white">
                                Delete
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>

            </main>
        </div>
        </RoleGuard>
    );
}
