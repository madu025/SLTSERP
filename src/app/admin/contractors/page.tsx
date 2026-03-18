"use client";

import React, { useState, useMemo } from 'react';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Search, Plus, Pencil, Users, UserPlus, Share2, Trash, Mail, Building2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import TeamManager from './TeamManager';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { ContractorFormDialog } from './components/ContractorFormDialog';
import { useContractorOperations } from './hooks/useContractorOperations';
import { ContractorSchema } from "@/lib/validations/contractor.schema";

interface Contractor extends ContractorSchema {
    id: string;
    status: 'ACTIVE' | 'PENDING' | 'REJECTED';
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
            const res = await fetch(`/api/contractors?page=1&limit=1000&t=${Date.now()}`);
            if (!res.ok) throw new Error("Failed to fetch contractors");
            return res.json();
        }
    });

    const contractors = useMemo(() => {
        return Array.isArray(contractorsData?.contractors) ? contractorsData.contractors : [];
    }, [contractorsData]);

    const { data: stores = [] } = useQuery<{ id: string; name: string }[]>({
        queryKey: ['stores'],
        queryFn: () => fetch('/api/stores').then(res => res.json())
    });

    const { data: opmcs = [] } = useQuery<{ id: string; name: string }[]>({
        queryKey: ['opmcs'],
        queryFn: () => fetch('/api/opmcs').then(res => res.json())
    });

    const { data: banks = [] } = useQuery<{ id: string; name: string }[]>({
        queryKey: ['banks'],
        queryFn: () => fetch('/api/banks').then(res => res.json())
    });

    const { data: branches = [] } = useQuery<{ id: string; name: string }[]>({
        queryKey: ['branches'],
        queryFn: () => fetch('/api/branches').then(res => res.json())
    });

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
        try {
            const res = await fetch('/api/contractors/invite', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(inviteData)
            });
            const data = await res.json();
            if (data.success) {
                setShareLink(data.link);
                setShareModalOpen(true);
                setInviteModalOpen(false);
                toast.success("Invitation generated");
            } else {
                toast.error(data.error || "Invite failed");
            }
        } catch {
            toast.error("Network error");
        }
    };

    const handleResendLink = async (id: string) => {
        try {
            const res = await fetch('/api/contractors/resend-invite', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, origin: window.location.origin })
            });
            const data = await res.json();
            if (data.success) {
                setShareLink(data.link);
                setShareModalOpen(true);
                toast.success("Link refreshed");
            }
        } catch {
            toast.error("Failed to resend");
        }
    };

    const filteredContractors = useMemo(() => {
        return (contractors as Contractor[]).filter((c) => {
            const matchesSearch = c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                c.registrationNumber?.includes(searchTerm);

            if (!matchesSearch) return false;

            if (viewMode === 'PENDING_DOCS') {
                return c.status === 'PENDING' && (c.documentStatus === 'PENDING' || !c.documentStatus);
            }
            if (viewMode === 'PENDING_AUTH') {
                return c.status === 'PENDING' && c.documentStatus === 'APPROVED';
            }

            return true;
        });
    }, [contractors, searchTerm, viewMode]);

    return (
        <div className="h-screen flex bg-slate-50 overflow-hidden">
            <Sidebar />
            <main className="flex-1 flex flex-col min-w-0 h-full">
                <Header />
                <div className="flex-1 overflow-y-auto p-4 md:p-8">
                    <div className="max-w-7xl mx-auto space-y-8">
                        
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
                            <div className="space-y-1">
                                <h1 className="text-3xl font-black text-slate-900 tracking-tight">Contractor Registry</h1>
                                <p className="text-sm font-medium text-slate-500">Manage digital identities, jurisdictional groups, and payroll logistics.</p>
                            </div>
                            <div className="flex gap-3 w-full sm:w-auto">
                                <Button onClick={() => setInviteModalOpen(true)} variant="outline" className="flex-1 sm:flex-none h-11 px-6 border-slate-200 text-slate-600 hover:bg-white hover:text-blue-600 hover:border-blue-200 rounded-xl font-bold transition-all">
                                    <UserPlus className="w-4 h-4 mr-2" /> Quick Invite
                                </Button>
                                <Button onClick={handleAdd} className="flex-1 sm:flex-none h-11 px-8 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-xl shadow-slate-200 transition-all">
                                    <Plus className="w-4 h-4 mr-2" /> New Registration
                                </Button>
                            </div>
                        </div>

                        {/* Top Control Bar */}
                        <div className="bg-white p-2 rounded-2xl shadow-sm border border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4">
                            <div className="flex bg-slate-100 p-1 rounded-xl w-full md:w-auto">
                                {[
                                    { id: 'ALL', label: 'All Entities' },
                                    { id: 'PENDING_DOCS', label: 'Review Required' },
                                    { id: 'PENDING_AUTH', label: 'Auth Required' }
                                ].map((tab) => (
                                    <button
                                        key={tab.id}
                                        onClick={() => setViewMode(tab.id as 'ALL' | 'PENDING_DOCS' | 'PENDING_AUTH')}
                                        className={cn(
                                            "flex-1 px-4 py-2 text-xs font-black uppercase tracking-widest rounded-lg transition-all",
                                            viewMode === tab.id ? "bg-white text-slate-900 shadow-sm" : "text-slate-400 hover:text-slate-600"
                                        )}
                                    >
                                        {tab.label}
                                    </button>
                                ))}
                            </div>
                            <div className="relative w-full md:w-96 group">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                                <Input
                                    placeholder="Scan by identity or reg sequence..."
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                    className="h-11 pl-11 bg-slate-50 border-none focus-visible:ring-2 focus-visible:ring-blue-100 rounded-xl font-medium"
                                />
                            </div>
                        </div>

                        {/* Grid List */}
                        <div className="grid grid-cols-1 gap-4">
                            {loadingContractors ? (
                                <div className="py-20 flex flex-col items-center justify-center text-slate-400 gap-4">
                                    <div className="h-10 w-10 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin" />
                                    <p className="text-xs font-black uppercase tracking-widest animate-pulse">Synchronizing Registry...</p>
                                </div>
                            ) : filteredContractors.length === 0 ? (
                                <div className="py-20 flex flex-col items-center justify-center bg-white rounded-3xl border border-dashed text-slate-400 border-slate-200">
                                    <Building2 className="w-12 h-12 opacity-10 mb-4" />
                                    <p className="text-sm font-bold">No matching contractors found in the current buffer.</p>
                                </div>
                            ) : filteredContractors.map((contractor: Contractor) => (
                                <Card key={contractor.id} className="group border-none shadow-sm hover:shadow-xl hover:shadow-slate-200/50 transition-all duration-300 rounded-3xl overflow-hidden bg-white">
                                    <CardContent className="p-0">
                                        <div className="flex flex-col lg:flex-row">
                                            <div className="flex-1 p-6 lg:p-8">
                                                <div className="flex items-center gap-3 mb-4">
                                                    <div className="h-10 w-10 rounded-2xl bg-slate-50 flex items-center justify-center group-hover:bg-blue-50 transition-colors">
                                                        <Building2 className="w-5 h-5 text-slate-400 group-hover:text-blue-600 transition-colors" />
                                                    </div>
                                                    <div>
                                                        <div className="flex items-center gap-3 flex-wrap">
                                                            <h3 className="text-xl font-black text-slate-900 tracking-tight">{contractor.name}</h3>
                                                            <Badge className={cn(
                                                                "h-6 px-3 rounded-full text-[10px] font-black uppercase tracking-widest border-none",
                                                                contractor.status === 'ACTIVE' ? "bg-emerald-100 text-emerald-700" :
                                                                contractor.status === 'PENDING' ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-500"
                                                            )}>
                                                                {contractor.status}
                                                            </Badge>
                                                        </div>
                                                        <p className="text-xs font-mono text-slate-400 mt-1">{contractor.registrationNumber || 'NO-SEQUENCE'}</p>
                                                    </div>
                                                </div>

                                                <div className="flex flex-wrap gap-4 mt-6">
                                                    <div className="flex items-center gap-2 group/meta">
                                                        <div className="h-7 w-7 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600 border border-indigo-100"><Users className="w-3.5 h-3.5" /></div>
                                                        <div>
                                                            <p className="text-[9px] font-black uppercase text-slate-400 leading-none">Technician clusters</p>
                                                            <p className="text-xs font-bold text-slate-700">{contractor._count?.teams || 0} Functional Groups</p>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-2 group/meta">
                                                        <div className="h-7 w-7 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600 border border-blue-100"><Building2 className="w-3.5 h-3.5" /></div>
                                                        <div>
                                                            <p className="text-[9px] font-black uppercase text-slate-400 leading-none">RTOM Jurisdiction</p>
                                                            <p className="text-xs font-bold text-slate-700">{contractor.opmc?.name || 'Central Office'}</p>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="lg:w-72 bg-slate-50/50 p-6 flex flex-col justify-center gap-2 border-t lg:border-t-0 lg:border-l border-slate-100">
                                                <Button size="sm" onClick={() => handleEdit(contractor)} className="w-full bg-white hover:bg-blue-600 hover:text-white text-slate-600 border border-slate-100 shadow-sm rounded-xl h-10 font-bold transition-all">
                                                    <Pencil className="w-4 h-4 mr-2" /> Edit Records
                                                </Button>
                                                <Button size="sm" onClick={() => {
                                                    setSelectedContractorForTeams({ id: contractor.id, name: contractor.name });
                                                    setTeamManagerOpen(true);
                                                }} className="w-full bg-white hover:bg-slate-900 hover:text-white text-slate-600 border border-slate-100 shadow-sm rounded-xl h-10 font-bold transition-all">
                                                    <Users className="w-4 h-4 mr-2" /> Logistics
                                                </Button>
                                                <div className="flex gap-2">
                                                    {contractor.status === 'PENDING' && (
                                                        <>
                                                            {isAdmin && contractor.documentStatus === 'APPROVED' ? (
                                                                <Button size="sm" onClick={() => approveMutation.mutate(contractor.id)} className="flex-1 bg-white hover:bg-emerald-600 hover:text-white text-emerald-600 border border-emerald-100 rounded-xl h-10 font-bold transition-all">
                                                                    Approve
                                                                </Button>
                                                            ) : (
                                                                <Button size="sm" onClick={() => handleResendLink(contractor.id)} className="flex-1 bg-white hover:bg-emerald-50 text-emerald-600 border border-emerald-100 rounded-xl h-10 font-bold transition-all">
                                                                    <Share2 className="w-3.5 h-3.5" />
                                                                </Button>
                                                            )}
                                                            {isAdmin && (
                                                                <Button size="sm" onClick={() => rejectMutation.mutate(contractor.id)} className="flex-1 bg-white hover:bg-red-50 text-red-600 border border-red-100 rounded-xl h-10 font-bold transition-all">
                                                                    Reject
                                                                </Button>
                                                            )}
                                                        </>
                                                    )}
                                                    {isAdmin && (
                                                        <Button size="sm" variant="ghost" onClick={() => {
                                                            if (confirm("Permanently purge this entity from the registry?")) {
                                                                deleteMutation.mutate(contractor.id);
                                                            }
                                                        }} className="flex-1 hover:bg-red-50 text-red-400 hover:text-red-600 rounded-xl h-10 transition-all">
                                                            <Trash className="w-3.5 h-3.5" />
                                                        </Button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    </div>
                </div>

                {/* --- MODALS --- */}
                
                <ContractorFormDialog 
                    open={formOpen} 
                    onOpenChange={setFormOpen}
                    initialData={selectedContractor || undefined}
                    onSubmit={handleFormSubmit}
                    isSubmitting={createMutation.isPending || updateMutation.isPending}
                    banks={banks}
                    branches={branches}
                    stores={stores}
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
                            <DialogTitle className="text-xl font-black text-slate-900">Provision Invite</DialogTitle>
                            <DialogDescription className="text-xs font-medium text-slate-500">Generate a unique onboarding token for an external entity.</DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                            <div className="space-y-1.5">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Legal Entity Name</Label>
                                <Input value={inviteData.name} onChange={e => setInviteData({...inviteData, name: e.target.value})} className="h-11 rounded-xl bg-slate-50 border-none" />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Mobile / Primary Contact</Label>
                                <Input value={inviteData.contactNumber} onChange={e => setInviteData({...inviteData, contactNumber: e.target.value})} className="h-11 rounded-xl bg-slate-50 border-none" />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Onboarding Route</Label>
                                <Select value={inviteData.type} onValueChange={(v: 'SOD' | 'OSP') => setInviteData({...inviteData, type: v})}>
                                    <SelectTrigger className="h-11 rounded-xl bg-slate-50 border-none"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="SOD">Service Orders (Operations)</SelectItem>
                                        <SelectItem value="OSP">Network Projects (OSP)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">RTOM Office</Label>
                                <Select value={inviteData.opmcId} onValueChange={(v) => setInviteData({...inviteData, opmcId: v})}>
                                    <SelectTrigger className="h-11 rounded-xl bg-slate-50 border-none"><SelectValue placeholder="Assign HQ/RTOM" /></SelectTrigger>
                                    <SelectContent>
                                        {opmcs.map((o: { id: string; name: string }) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <DialogFooter>
                            <Button onClick={handleInviteSubmit} className="w-full bg-slate-900 hover:bg-slate-800 text-white h-12 rounded-xl font-black uppercase text-xs tracking-widest">Generate Onboarding Link</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                {/* Share Dialog */}
                <Dialog open={shareModalOpen} onOpenChange={setShareModalOpen}>
                    <DialogContent className="max-w-md rounded-3xl">
                        <DialogHeader>
                            <DialogTitle className="text-xl font-black text-emerald-900">Invite Ready</DialogTitle>
                            <DialogDescription className="text-xs font-medium text-emerald-600">Secure onboarding token has been generated.</DialogDescription>
                        </DialogHeader>
                        <div className="p-6 bg-emerald-50 rounded-2xl border border-emerald-100 flex flex-col items-center gap-4 text-center">
                            <div className="h-12 w-12 rounded-full bg-white flex items-center justify-center text-emerald-600 shadow-sm shadow-emerald-200"><Mail className="w-6 h-6" /></div>
                            <div className="space-y-1">
                                <p className="text-xs font-bold text-emerald-800 truncate max-w-[300px]">{shareLink}</p>
                                <p className="text-[10px] text-emerald-500">Token expires in 72 hours</p>
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

            </main>
        </div>
    );
}
