"use client";

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Trash, Plus, Pencil, Search, Users, ShieldAlert, ShieldCheck, Building2, Upload, FileText, Image as ImageIcon, Copy, ExternalLink, MessageCircle, CheckCircle, UserPlus, Share2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { ScrollArea } from "@/components/ui/scroll-area";
import TeamManager from './TeamManager';
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { toast } from 'sonner';

// Types
interface TeamMember {
    id?: string;
    name: string;
    idCopyNumber: string;
    contractorIdCopyNumber: string;
    photoUrl?: string;
    nicUrl?: string;
}

interface ContractorTeam {
    id?: string;
    name: string;
    opmcId?: string | null;
    storeIds?: string[];
    primaryStoreId?: string | null;
    status: 'ACTIVE' | 'INACTIVE';
    members: TeamMember[];
}

interface Contractor {
    id: string;
    name: string;
    address: string;
    registrationNumber: string;
    contactNumber?: string | null;
    nic?: string | null;
    brNumber?: string | null;
    agreementDuration?: number | null;
    brCertUrl?: string | null;
    status: 'ACTIVE' | 'INACTIVE' | 'PENDING';
    registrationFeePaid: boolean;
    agreementSigned: boolean;
    agreementDate?: string | null;
    bankName?: string | null;
    bankAccountNumber?: string | null;
    bankBranch?: string | null;
    bankPassbookUrl?: string | null;
    documentStatus?: 'PENDING' | 'APPROVED' | 'REJECTED';
    uploadToken?: string | null;
    teams: ContractorTeam[];

    // Documents
    photoUrl?: string;
    nicFrontUrl?: string;
    nicBackUrl?: string;
    policeReportUrl?: string;
    gramaCertUrl?: string;

    type: 'SOD' | 'OSP';
    armApprovedAt?: string | null;
    ospApprovedAt?: string | null;
    registrationToken?: string | null;
    createdAt: string;
}

// Zod Schema
const contractorSchema = z.object({
    name: z.string().min(2, "Name is required"),
    address: z.string().min(5, "Address is required"),
    registrationNumber: z.string().min(2, "Reg Num is required"),
    contactNumber: z.string().optional(),
    nic: z.string().optional(),
    brNumber: z.string().optional(),
    status: z.enum(['ACTIVE', 'INACTIVE', 'PENDING']),
    documentStatus: z.enum(['PENDING', 'APPROVED', 'REJECTED']).optional(),
    registrationFeePaid: z.boolean(),
    agreementSigned: z.boolean(),
    agreementDuration: z.string().optional(), // We'll handle conversion
    brCertUrl: z.string().optional(),
    agreementDate: z.string().optional(),
    bankName: z.string().optional(),
    bankAccountNumber: z.string().optional(),
    bankBranch: z.string().optional(),
    bankPassbookUrl: z.string().optional(),
    photoUrl: z.string().optional(),
    nicFrontUrl: z.string().optional(),
    nicBackUrl: z.string().optional(),
    policeReportUrl: z.string().optional(),
    gramaCertUrl: z.string().optional(),
    opmcId: z.string().optional(),
});

type ContractorFormValues = z.infer<typeof contractorSchema>

export default function ContractorsPage() {
    const queryClient = useQueryClient();
    const [searchTerm, setSearchTerm] = useState("");

    // Modal State
    const [showModal, setShowModal] = useState(false);
    const [selectedContractor, setSelectedContractor] = useState<Contractor | null>(null);

    // Dynamic Team Management State
    const [teams, setTeams] = useState<ContractorTeam[]>([]);

    // Share Modal State
    const [shareModalOpen, setShareModalOpen] = useState(false);
    const [shareLink, setShareLink] = useState("");

    // Team Manager State
    const [teamManagerOpen, setTeamManagerOpen] = useState(false);
    const [selectedContractorForTeams, setSelectedContractorForTeams] = useState<{ id: string, name: string } | null>(null);

    // Invite Modal State
    const [inviteModalOpen, setInviteModalOpen] = useState(false);
    const [inviteData, setInviteData] = useState({
        name: '',
        contactNumber: '',
        type: 'SOD' as 'SOD' | 'OSP'
    });

    // Get current user from localStorage
    const user = typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('user') || '{}') : {};
    const userRole = user.role || '';
    const isAdmin = ['SUPER_ADMIN', 'ADMIN'].includes(userRole);
    const isOspManager = userRole === 'OSP_MANAGER';
    const isSiteStaff = userRole === 'SITE_OFFICE_STAFF';

    const form = useForm<ContractorFormValues>({
        resolver: zodResolver(contractorSchema),
        defaultValues: {
            name: '', address: '', registrationNumber: '', brNumber: '', status: 'PENDING',
            registrationFeePaid: false, agreementSigned: false, agreementDate: '',
            bankAccountNumber: '', bankBranch: ''
        }
    });

    // --- QUERIES ---
    const { data: contractorsData, isLoading } = useQuery({
        queryKey: ["contractors"],
        queryFn: async () => {
            const res = await fetch("/api/contractors?page=1&limit=1000");
            if (!res.ok) {
                const error = await res.json();
                throw new Error(error.message || "Failed to fetch contractors");
            }
            return res.json();
        },
        staleTime: 10 * 60 * 1000, // 10 minutes - prevents re-fetching
        gcTime: 30 * 60 * 1000, // 30 minutes - keeps in cache
        refetchOnWindowFocus: false, // Don't refetch on tab focus
        refetchOnMount: false // Don't refetch on component mount if data exists
    });

    // Extract contractors array from paginated response
    const contractors = Array.isArray(contractorsData?.contractors)
        ? contractorsData.contractors
        : [];

    const { data: stores = [] } = useQuery({
        queryKey: ['stores'],
        queryFn: async () => {
            const res = await fetch('/api/stores');
            if (!res.ok) throw new Error("Failed to fetch stores");
            return res.json();
        },
        staleTime: 10 * 60 * 1000,
        gcTime: 30 * 60 * 1000
    });

    const { data: opmcs = [], isLoading: isLoadingOpmcs } = useQuery({
        queryKey: ['opmcs'],
        queryFn: async () => {
            const res = await fetch('/api/opmcs');
            if (!res.ok) throw new Error("Failed to fetch OPMCs");
            return res.json();
        },
        staleTime: 10 * 60 * 1000,
        gcTime: 30 * 60 * 1000
    });

    // Auto-select OPMC for site staff if they have only one
    React.useEffect(() => {
        if (inviteModalOpen && isSiteStaff && user.accessibleOpmcs?.length === 1) {
            setInviteData(prev => ({ ...prev, opmcId: user.accessibleOpmcs[0].id }));
        }
    }, [inviteModalOpen, isSiteStaff, user.accessibleOpmcs, opmcs]);

    // Filter OPMCs based on user access
    const filteredOpmcs = React.useMemo(() => {
        // If data hasn't loaded yet, return empty
        if (!opmcs || opmcs.length === 0) return [];

        // If it's a Super Admin or OSP Manager, show everything
        if (['SUPER_ADMIN', 'ADMIN', 'OSP_MANAGER'].includes(userRole)) return opmcs;

        // For others, use their assigned OPMCs
        const userOpmcIds = (user.accessibleOpmcs || []).map((o: any) => o.id);

        // Fallback for old sessions: If they are site staff but have NO assigned OPMCs in localStorage,
        // we might allow them to see all for now OR better, we tell them to re-login.
        // For now, let's allow all if the list is empty to prevent blockers, but warn them.
        if (isSiteStaff && userOpmcIds.length === 0) return opmcs;

        return opmcs.filter((o: any) => userOpmcIds.includes(o.id));
    }, [opmcs, user.accessibleOpmcs, userRole, isSiteStaff]);

    const isOpmcsLoading = isLoadingOpmcs || !opmcs.length && !inviteModalOpen;

    // --- MUTATIONS ---
    const mutation = useMutation({
        mutationFn: async (values: ContractorFormValues & { teams: ContractorTeam[], id?: string }) => {
            const method = values.id ? 'PUT' : 'POST';
            const payload = values.id ? values : { ...values, siteOfficeStaffId: user.id };
            const res = await fetch('/api/contractors', {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (!res.ok) throw new Error('Failed');
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["contractors"] });
            setShowModal(false);
            toast.success("Contractor saved successfully");
        },
        onError: () => toast.error("Failed to save contractor")
    });

    const deleteMutation = useMutation({
        mutationFn: async (id: string) => {
            await fetch(`/api/contractors?id=${id}`, { method: 'DELETE' });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["contractors"] });
            toast.success("Contractor deleted");
        }
    });

    const handleResendLink = async (id: string) => {
        const toastId = toast.loading("Retrieving link...");
        try {
            const res = await fetch(`/api/contractors/${id}/resend-link`, {
                method: 'POST',
            });
            if (!res.ok) throw new Error("Failed to retrieve link");
            const data = await res.json();
            setShareLink(data.registrationLink);
            setShareModalOpen(true);
            toast.success("Registration link retrieved!", { id: toastId });
        } catch (err: any) {
            toast.error(err.message || "Failed to resend link", { id: toastId });
        }
    };

    const uploadFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || e.target.files.length === 0) return null;
        const file = e.target.files[0];
        const formData = new FormData();
        formData.append('file', file);

        try {
            const res = await fetch('/api/upload', { method: 'POST', body: formData });
            if (!res.ok) throw new Error("Upload failed");
            const data = await res.json();
            return data.url;
        } catch (err) {
            toast.error("File upload failed");
            return null;
        }
    };

    // --- HANDLERS ---
    const handleAdd = () => {
        setSelectedContractor(null);
        setTeams([]); // Initialize empty teams for new contractor
        form.reset({
            name: '', address: '', registrationNumber: '', brNumber: '', status: 'PENDING',
            contactNumber: '', agreementDuration: '1', brCertUrl: '', nic: '',
            registrationFeePaid: false, agreementSigned: false, agreementDate: '',
            bankName: '', bankAccountNumber: '', bankBranch: '',
            opmcId: ''
        });
        setShowModal(true);
    };

    const handleEdit = (c: Contractor) => {
        setSelectedContractor(c);
        // Load teams with full details
        setTeams(c.teams.map(t => ({
            id: t.id,
            name: t.name,
            status: t.status,
            opmcId: t.opmcId || null,
            storeIds: (t as any).storeAssignments?.map((sa: any) => sa.storeId) || [],
            primaryStoreId: (t as any).storeAssignments?.find((sa: any) => sa.isPrimary)?.storeId || null,
            members: t.members.map((m: any) => ({
                id: m.id,
                name: m.name,
                idCopyNumber: m.idCopyNumber || m.nic || '',
                contractorIdCopyNumber: m.contractorIdCopyNumber || '',
                photoUrl: m.photoUrl || '',
                nicUrl: m.nicUrl || ''
            }))
        })));

        form.reset({
            name: c.name,
            address: c.address || '',
            registrationNumber: c.registrationNumber || '',
            contactNumber: c.contactNumber || '',
            nic: c.nic || '',
            brNumber: c.brNumber || '',
            agreementDuration: c.agreementDuration ? c.agreementDuration.toString() : '1',
            brCertUrl: c.brCertUrl || '',
            status: c.status,
            registrationFeePaid: c.registrationFeePaid,
            agreementSigned: c.agreementSigned,
            agreementDate: c.agreementDate ? new Date(c.agreementDate).toISOString().split('T')[0] : '',
            bankName: c.bankName || '',
            bankAccountNumber: c.bankAccountNumber || '',
            bankBranch: c.bankBranch || '',
            bankPassbookUrl: c.bankPassbookUrl || '',
            photoUrl: c.photoUrl || '',
            nicFrontUrl: c.nicFrontUrl || '',
            nicBackUrl: c.nicBackUrl || '',
            policeReportUrl: c.policeReportUrl || '',
            gramaCertUrl: c.gramaCertUrl || '',
            opmcId: (c as any).opmcId || ''
        });
        setShowModal(true);
    };

    const handleSubmit = (values: ContractorFormValues) => {
        // Include teams in the submission
        mutation.mutate({ ...values, teams, id: selectedContractor?.id });
    };

    // Team Management Helpers
    const addTeam = () => {
        setTeams([...teams, { name: 'New Team', status: 'ACTIVE', members: [] }]);
    };

    const updateTeam = (idx: number, field: keyof ContractorTeam, val: any) => {
        const newTeams = [...teams];
        (newTeams[idx] as any)[field] = val;
        setTeams(newTeams);
    };

    const toggleStore = (teamIdx: number, storeId: string) => {
        const currentStores = teams[teamIdx].storeIds || [];
        let newStores;
        if (currentStores.includes(storeId)) {
            newStores = currentStores.filter(id => id !== storeId);
            if (teams[teamIdx].primaryStoreId === storeId) {
                updateTeam(teamIdx, 'primaryStoreId', null);
            }
        } else {
            newStores = [...currentStores, storeId];
            if (newStores.length === 1) {
                updateTeam(teamIdx, 'primaryStoreId', storeId);
            }
        }
        updateTeam(teamIdx, 'storeIds', newStores);
    };

    const removeTeam = (idx: number) => {
        setTeams(teams.filter((_, i) => i !== idx));
    };

    const addMember = (teamIdx: number) => {
        const newTeams = [...teams];
        newTeams[teamIdx].members.push({ name: '', idCopyNumber: '', contractorIdCopyNumber: '' });
        setTeams(newTeams);
    };

    const updateMember = (teamIdx: number, memberIdx: number, field: keyof TeamMember, val: string) => {
        const newTeams = [...teams];
        (newTeams[teamIdx].members[memberIdx] as any)[field] = val;
        setTeams(newTeams);
    };

    const removeMember = (teamIdx: number, memberIdx: number) => {
        const newTeams = [...teams];
        newTeams[teamIdx].members = newTeams[teamIdx].members.filter((_, i) => i !== memberIdx);
        setTeams(newTeams);
    };

    const handleMemberUpload = async (teamIdx: number, memberIdx: number, field: 'photoUrl' | 'nicUrl', e: React.ChangeEvent<HTMLInputElement>) => {
        const url = await uploadFile(e);
        if (url) {
            updateMember(teamIdx, memberIdx, field, url);
        }
    };


    const [viewMode, setViewMode] = useState<'ALL' | 'PENDING_DOCS' | 'PENDING_AUTH'>('ALL');

    // Defensive check to ensure contractors is an array
    const contractorsList = Array.isArray(contractors) ? contractors : [];

    const filteredContractors = contractorsList.filter(c => {
        const matchesSearch = c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            c.registrationNumber?.includes(searchTerm);

        if (!matchesSearch) return false;

        if (viewMode === 'PENDING_DOCS') {
            // Show only if PENDING and Document Status is NOT Approved
            return c.status === 'PENDING' && (c.documentStatus === 'PENDING' || c.documentStatus === 'REJECTED' || !c.documentStatus);
        }
        if (viewMode === 'PENDING_AUTH') {
            // Show only if Status is PENDING but Documents are APPROVED (Ready for OSP)
            return c.status === 'PENDING' && c.documentStatus === 'APPROVED';
        }

        return true;
    });

    return (
        <div className="h-screen flex bg-slate-50 overflow-hidden">
            <Sidebar />
            <main className="flex-1 flex flex-col min-w-0 h-full">
                <Header />
                <div className="flex-1 overflow-y-auto p-4 md:p-8">
                    <div className="max-w-7xl mx-auto space-y-6">

                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                            <div>
                                <h1 className="text-2xl font-bold text-slate-900">Contractor Management</h1>
                                <p className="text-sm text-slate-500">Register and manage contractors, teams, and assignments.</p>
                            </div>
                            <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                                <Button onClick={() => setInviteModalOpen(true)} variant="outline" className="flex-1 sm:flex-none border-blue-200 text-blue-700 hover:bg-blue-50 text-xs sm:text-sm h-9">
                                    <UserPlus className="w-4 h-4 mr-2" /> Invite
                                </Button>
                                <Button onClick={handleAdd} className="flex-1 sm:flex-none bg-blue-600 hover:bg-blue-700 text-xs sm:text-sm h-9">
                                    <Plus className="w-4 h-4 mr-2" /> Register
                                </Button>
                            </div>
                        </div>

                        {/* Filter Tabs */}
                        <div className="flex space-x-1 bg-slate-100 p-1 rounded-lg w-full sm:w-fit overflow-x-auto no-scrollbar shrink-0">
                            <button
                                onClick={() => setViewMode('ALL')}
                                className={cn(
                                    "px-3 sm:px-4 py-1.5 text-[10px] sm:text-xs md:text-sm font-medium rounded-md transition-all whitespace-nowrap",
                                    viewMode === 'ALL' ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"
                                )}
                            >
                                All Contractors
                            </button>
                            <button
                                onClick={() => setViewMode('PENDING_DOCS')}
                                className={cn(
                                    "px-3 sm:px-4 py-1.5 text-[10px] sm:text-xs md:text-sm font-medium rounded-md transition-all flex items-center gap-2 whitespace-nowrap",
                                    viewMode === 'PENDING_DOCS' ? "bg-white text-amber-700 shadow-sm" : "text-slate-500 hover:text-amber-600"
                                )}
                            >
                                Needs Review
                                {contractorsList.filter(c => c.status === 'PENDING' && (c.documentStatus === 'PENDING' || !c.documentStatus)).length > 0 && (
                                    <span className="bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full text-[10px] font-bold">
                                        {contractorsList.filter(c => c.status === 'PENDING' && (c.documentStatus === 'PENDING' || !c.documentStatus)).length}
                                    </span>
                                )}
                            </button>
                            <button
                                onClick={() => setViewMode('PENDING_AUTH')}
                                className={cn(
                                    "px-3 sm:px-4 py-1.5 text-[10px] sm:text-xs md:text-sm font-medium rounded-md transition-all flex items-center gap-2 whitespace-nowrap",
                                    viewMode === 'PENDING_AUTH' ? "bg-white text-blue-700 shadow-sm" : "text-slate-500 hover:text-blue-600"
                                )}
                            >
                                Needs Authorization
                                {contractorsList.filter(c => c.status === 'PENDING' && c.documentStatus === 'APPROVED').length > 0 && (
                                    <span className="bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full text-[10px] font-bold">
                                        {contractorsList.filter(c => c.status === 'PENDING' && c.documentStatus === 'APPROVED').length}
                                    </span>
                                )}
                            </button>
                        </div>

                        <div className="flex items-center space-x-2 bg-white p-2 rounded-lg border">
                            <Search className="w-4 h-4 text-slate-400" />
                            <Input
                                placeholder="Search contractors..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className="border-none focus-visible:ring-0 shadow-none h-8"
                            />
                        </div>

                        <div className="grid grid-cols-1 gap-4">
                            {filteredContractors.map(contractor => (
                                <Card key={contractor.id} className="hover:shadow-md transition-shadow">
                                    <CardContent className="p-6">
                                        <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <h3 className="text-lg font-bold text-slate-800 truncate">{contractor.name}</h3>
                                                    <Badge variant="outline" className={contractor.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : ''}>
                                                        {contractor.status}
                                                    </Badge>
                                                </div>
                                                <p className="text-xs text-slate-500 mt-1">{contractor.registrationNumber}</p>
                                                <div className="flex flex-wrap gap-x-4 gap-y-2 mt-3 text-[10px] sm:text-xs text-slate-600">
                                                    <div className="flex items-center gap-1.5 bg-slate-50 px-2 py-1 rounded border border-slate-100"><Users className="w-3 h-3 text-slate-400" /> {(contractor as any)._count?.teams || 0} Teams</div>
                                                    <div className="flex items-center gap-1.5 bg-slate-50 px-2 py-1 rounded border border-slate-100"><Building2 className="w-3 h-3 text-slate-400" /> {(contractor as any).opmc?.name || 'No Office'}</div>
                                                    <div className="flex items-center gap-1.5 bg-slate-50 px-2 py-1 rounded border border-slate-100"><UserPlus className="w-3 h-3 text-slate-400" /> {(contractor as any).siteOfficeStaff?.name || 'Manual'}</div>
                                                </div>
                                            </div>
                                            <div className="flex gap-1.5 sm:gap-2 self-end sm:self-start">
                                                <Button variant="ghost" size="sm" onClick={() => handleEdit(contractor)} className="h-8 w-8 p-0 sm:w-auto sm:px-3 text-slate-500 hover:text-blue-600 hover:bg-blue-50">
                                                    <Pencil className="w-4 h-4 sm:mr-2" />
                                                    <span className="hidden sm:inline">Edit</span>
                                                </Button>
                                                <Button variant="ghost" size="sm" onClick={() => {
                                                    setSelectedContractorForTeams({ id: contractor.id, name: contractor.name });
                                                    setTeamManagerOpen(true);
                                                }} className="h-8 w-8 p-0 sm:w-auto sm:px-3 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50">
                                                    <Users className="w-4 h-4 sm:mr-2" />
                                                    <span className="hidden sm:inline">Teams</span>
                                                </Button>
                                                {contractor.status === 'PENDING' && (
                                                    <Button variant="ghost" size="sm" onClick={() => handleResendLink(contractor.id)} className="h-8 w-8 p-0 sm:w-auto sm:px-3 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50">
                                                        <Share2 className="w-4 h-4 sm:mr-2" />
                                                        <span className="hidden sm:inline">Reshare</span>
                                                    </Button>
                                                )}
                                                {isAdmin && (
                                                    <Button variant="ghost" size="sm" onClick={() => {
                                                        if (confirm("Are you sure you want to delete this contractor?")) {
                                                            deleteMutation.mutate(contractor.id);
                                                        }
                                                    }} className="h-8 w-8 p-0 sm:w-auto sm:px-3 text-slate-500 hover:text-red-600 hover:bg-red-50">
                                                        <Trash className="w-4 h-4" />
                                                    </Button>
                                                )}
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Modal */}
                <Dialog open={showModal} onOpenChange={setShowModal}>
                    <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto w-full">
                        <DialogHeader>
                            <DialogTitle>{selectedContractor ? 'Edit Contractor' : 'Register New Contractor'}</DialogTitle>
                            <DialogDescription>Manage contractor details, store assignment, and teams.</DialogDescription>
                        </DialogHeader>

                        <Form {...form}>
                            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6 mt-4">

                                {/* Basic Details */}
                                <div className="grid grid-cols-2 gap-4">
                                    <FormField control={form.control} name="name" render={({ field }) => (
                                        <FormItem><FormLabel>Contractor Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                                    )} />
                                    <FormField control={form.control} name="registrationNumber" render={({ field }) => (
                                        <FormItem><FormLabel>Registration No</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                                    )} />
                                    <FormField control={form.control} name="address" render={({ field }) => (
                                        <FormItem className="col-span-2"><FormLabel>Address</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                                    )} />

                                    <FormField control={form.control} name="nic" render={({ field }) => (
                                        <FormItem><FormLabel>NIC Number</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                                    )} />

                                    <FormField control={form.control} name="contactNumber" render={({ field }) => (
                                        <FormItem><FormLabel>Contact Number</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                                    )} />

                                    <FormField control={form.control} name="agreementDuration" render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Agreement Duration</FormLabel>
                                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                <FormControl><SelectTrigger><SelectValue placeholder="Select Duration" /></SelectTrigger></FormControl>
                                                <SelectContent>
                                                    <SelectItem value="1">1 Year</SelectItem>
                                                    <SelectItem value="2">2 Years</SelectItem>
                                                    <SelectItem value="3">3 Years</SelectItem>
                                                </SelectContent>
                                            </Select>
                                            <FormMessage />
                                        </FormItem>
                                    )} />

                                    <FormField control={form.control} name="brCertUrl" render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>BR Certificate</FormLabel>
                                            <div className="flex items-center gap-2">
                                                {field.value && <div className="text-xs text-green-600 flex items-center gap-1"><CheckCircle className="w-3 h-3" /> Uploaded</div>}
                                                <Input type="file" className="text-xs h-9 pt-1" accept="image/*,.pdf" onChange={async (e) => {
                                                    const url = await uploadFile(e);
                                                    if (url) field.onChange(url);
                                                }} />
                                            </div>
                                            <FormMessage />
                                        </FormItem>
                                    )} />

                                    {/* Status Field Removed - Managed via Approval Section */}
                                </div>

                                {/* Bank Details - Only visible after creation */}
                                {selectedContractor && (
                                    <div className="space-y-4 pt-4 border-t">
                                        <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">Bank Details</h3>
                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                            <FormField control={form.control} name="bankName" render={({ field }) => (
                                                <FormItem><FormLabel className="text-xs">Bank Name</FormLabel><FormControl><Input {...field} className="h-8" /></FormControl></FormItem>
                                            )} />
                                            <FormField control={form.control} name="bankBranch" render={({ field }) => (
                                                <FormItem><FormLabel className="text-xs">Branch</FormLabel><FormControl><Input {...field} className="h-8" /></FormControl></FormItem>
                                            )} />
                                            <FormField control={form.control} name="bankAccountNumber" render={({ field }) => (
                                                <FormItem><FormLabel className="text-xs">Account No</FormLabel><FormControl><Input {...field} className="h-8" /></FormControl></FormItem>
                                            )} />
                                            <FormField control={form.control} name="bankPassbookUrl" render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel className="text-xs">Bank Passbook Header</FormLabel>
                                                    <div className="flex flex-col gap-2">
                                                        {field.value && <img src={field.value} alt="Preview" className="h-10 w-16 object-cover rounded border" />}
                                                        <Input type="file" className="h-8 text-xs bg-white" accept="image/*,.pdf" onChange={async (e) => {
                                                            const url = await uploadFile(e);
                                                            if (url) field.onChange(url);
                                                        }} />
                                                    </div>
                                                </FormItem>
                                            )} />
                                            <FormField control={form.control} name="opmcId" render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel className="text-xs">Originating Office (OPMC)</FormLabel>
                                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                        <FormControl><SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select Office" /></SelectTrigger></FormControl>
                                                        <SelectContent>
                                                            {opmcs.map((o: any) => (<SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>))}
                                                        </SelectContent>
                                                    </Select>
                                                </FormItem>
                                            )} />
                                        </div>
                                    </div>
                                )}

                                {/* Documents Section - Only visible after creation */}
                                {selectedContractor ? (
                                    <div className="space-y-4 pt-4 border-t">
                                        <div className="flex justify-between items-center">
                                            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2"><FileText className="w-4 h-4" /> Documents & Review</h3>
                                            <Button type="button" size="sm" variant="outline" className="h-7 text-xs bg-blue-50 text-blue-700 border-blue-200" onClick={async () => {
                                                const toastId = toast.loading("Generating link...");
                                                try {
                                                    const res = await fetch('/api/contractors/generate-link', {
                                                        method: 'POST',
                                                        headers: { 'Content-Type': 'application/json' },
                                                        body: JSON.stringify({ contractorId: selectedContractor.id })
                                                    });

                                                    if (!res.ok) throw new Error("Failed to generate link");
                                                    const data = await res.json();

                                                    const fullUrl = `${window.location.origin}${data.path}`;
                                                    setShareLink(fullUrl);
                                                    setShareModalOpen(true);
                                                    toast.dismiss(toastId);
                                                } catch (err) {
                                                    toast.error("Failed to generate link", { id: toastId });
                                                }
                                            }}>
                                                Share Upload Link
                                            </Button>
                                        </div>
                                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                                            <FormField control={form.control} name="photoUrl" render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel className="text-xs">Contractor Photo</FormLabel>
                                                    <div className="flex flex-col gap-2">
                                                        {field.value && <img src={field.value} alt="Preview" className="h-16 w-16 object-cover rounded border" />}
                                                        <Input type="file" className="h-8 text-xs bg-white" onChange={async (e) => {
                                                            const url = await uploadFile(e);
                                                            if (url) field.onChange(url);
                                                        }} />
                                                    </div>
                                                </FormItem>
                                            )} />


                                            <FormField control={form.control} name="brCertUrl" render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel className="text-xs">BR Certificate</FormLabel>
                                                    <div className="flex flex-col gap-2">
                                                        {field.value && <img src={field.value} alt="Preview" className="h-16 w-16 object-cover rounded border" />}
                                                        <Input type="file" className="h-8 text-xs bg-white" onChange={async (e) => {
                                                            const url = await uploadFile(e);
                                                            if (url) field.onChange(url);
                                                        }} />
                                                    </div>
                                                </FormItem>
                                            )} />

                                            <FormField control={form.control} name="nicFrontUrl" render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel className="text-xs">NIC Front</FormLabel>
                                                    <div className="flex flex-col gap-2">
                                                        {field.value && <img src={field.value} alt="Preview" className="h-16 w-24 object-cover rounded border" />}
                                                        <Input type="file" className="h-8 text-xs bg-white" onChange={async (e) => {
                                                            const url = await uploadFile(e);
                                                            if (url) field.onChange(url);
                                                        }} />
                                                    </div>
                                                </FormItem>
                                            )} />
                                            <FormField control={form.control} name="nicBackUrl" render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel className="text-xs">NIC Back</FormLabel>
                                                    <div className="flex flex-col gap-2">
                                                        {field.value && <img src={field.value} alt="Preview" className="h-16 w-24 object-cover rounded border" />}
                                                        <Input type="file" className="h-8 text-xs bg-white" onChange={async (e) => {
                                                            const url = await uploadFile(e);
                                                            if (url) field.onChange(url);
                                                        }} />
                                                    </div>
                                                </FormItem>
                                            )} />
                                            <FormField control={form.control} name="policeReportUrl" render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel className="text-xs">Police Report</FormLabel>
                                                    <Input type="file" className="h-8 text-xs bg-white" onChange={async (e) => {
                                                        const url = await uploadFile(e);
                                                        if (url) field.onChange(url);
                                                    }} />
                                                    {field.value && <a href={field.value} target="_blank" className="text-[10px] text-blue-600 underline">View Report</a>}
                                                </FormItem>
                                            )} />
                                            <FormField control={form.control} name="gramaCertUrl" render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel className="text-xs">Grama Cert</FormLabel>
                                                    <Input type="file" className="h-8 text-xs bg-white" onChange={async (e) => {
                                                        const url = await uploadFile(e);
                                                        if (url) field.onChange(url);
                                                    }} />
                                                    {field.value && <a href={field.value} target="_blank" className="text-[10px] text-blue-600 underline">View Cert</a>}
                                                </FormItem>
                                            )} />
                                        </div>
                                    </div>
                                ) : (
                                    <div className="p-6 bg-slate-50 border border-slate-200 border-dashed rounded-lg text-center mt-6">
                                        <p className="text-sm text-slate-500">Please save the basic details first to enable <b>Documents</b>, <b>Bank Details</b>, and <b>Team Management</b>.</p>
                                    </div>
                                )}
                                <Separator />

                                {/* Document Approval Section (For Admins) */}
                                {selectedContractor && isAdmin && (selectedContractor.documentStatus === 'PENDING' || selectedContractor.documentStatus === 'REJECTED' || selectedContractor.documentStatus === 'APPROVED') && (
                                    <div className="bg-slate-50 border rounded-lg p-4 mt-4 flex items-center justify-between">
                                        <div>
                                            <h4 className="text-sm font-bold text-slate-800">Document Review Status</h4>
                                            <p className="text-xs text-slate-500">Current status: <Badge variant={selectedContractor.documentStatus === 'APPROVED' ? 'default' : 'secondary'} className={selectedContractor.documentStatus === 'APPROVED' ? 'bg-green-600' : (selectedContractor.documentStatus === 'REJECTED' ? 'bg-red-500 text-white' : 'bg-amber-100 text-amber-800')}>{selectedContractor.documentStatus}</Badge></p>
                                        </div>
                                        <div className="flex gap-2">
                                            {selectedContractor.documentStatus !== 'APPROVED' && (
                                                <Button type="button" size="sm" className="bg-green-600 hover:bg-green-700 text-white" onClick={() => {
                                                    // Quick Approve
                                                    form.setValue('documentStatus', 'APPROVED');
                                                    form.handleSubmit(handleSubmit)();
                                                    toast.success("Marked as Approved");
                                                }}>
                                                    <CheckCircle className="w-4 h-4 mr-1" /> Approve
                                                </Button>
                                            )}
                                            {selectedContractor.documentStatus !== 'REJECTED' && selectedContractor.documentStatus !== 'APPROVED' && (
                                                <Button type="button" size="sm" variant="destructive" onClick={() => {
                                                    form.setValue('documentStatus', 'REJECTED');
                                                    form.handleSubmit(handleSubmit)();
                                                }}>
                                                    <ShieldAlert className="w-4 h-4 mr-1" /> Reject
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* OSP Manager Approval Section */}
                                {selectedContractor && (isAdmin || isOspManager) && (
                                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-4 flex flex-col gap-3">
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <h4 className="text-sm font-bold text-blue-900 flex items-center gap-2">
                                                    <ShieldCheck className="w-4 h-4" /> OSP Manager Approval
                                                </h4>
                                                <p className="text-xs text-blue-700 mt-1">
                                                    Final authorization for the contractor to commence work.
                                                </p>
                                            </div>
                                            <Badge className={selectedContractor.status === 'ACTIVE' ? 'bg-green-600' : 'bg-slate-500'}>
                                                {selectedContractor.status}
                                            </Badge>
                                        </div>

                                        <Separator className="bg-blue-200" />

                                        <div className="flex items-center justify-between">
                                            {selectedContractor.documentStatus === 'APPROVED' ? (
                                                <div className="flex items-center gap-3 w-full justify-between">
                                                    <p className="text-xs text-blue-800 italic">
                                                        Documents verified. Ready for activation.
                                                    </p>
                                                    <div className="flex gap-2">
                                                        {selectedContractor.status !== 'ACTIVE' && (
                                                            <Button type="button" size="sm" className="bg-blue-700 hover:bg-blue-800 text-white" onClick={() => {
                                                                form.setValue('status', 'ACTIVE');
                                                                form.handleSubmit(handleSubmit)();
                                                                toast.success("Contractor Activated Successfully");
                                                            }}>
                                                                Authorize / Activate
                                                            </Button>
                                                        )}
                                                        {selectedContractor.status === 'ACTIVE' && (
                                                            <Button type="button" size="sm" variant="destructive" onClick={() => {
                                                                form.setValue('status', 'INACTIVE');
                                                                form.handleSubmit(handleSubmit)();
                                                                toast.info("Contractor Suspended");
                                                            }}>
                                                                Suspend / Deactivate
                                                            </Button>
                                                        )}
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="flex items-center gap-2 text-amber-700 bg-amber-50 px-3 py-2 rounded border border-amber-200 w-full">
                                                    <ShieldAlert className="w-4 h-4" />
                                                    <p className="text-xs font-semibold">
                                                        Cannot activate: Please complete Document Review first.
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* Teams & Members Section */}
                                <div className="space-y-4 pt-4 border-t">
                                    <div className="flex justify-between items-center">
                                        <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                                            <Users className="w-4 h-4" /> Teams & Members
                                        </h3>
                                        <Button type="button" size="sm" variant="outline" onClick={addTeam} className="h-7 text-xs">
                                            <Plus className="w-3 h-3 mr-1" /> Add Team
                                        </Button>
                                    </div>

                                    {teams.length === 0 && (
                                        <div className="text-center py-8 border-2 border-dashed rounded-lg bg-slate-50">
                                            <Users className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                                            <p className="text-xs text-slate-500">No teams added yet. Click "Add Team" to get started.</p>
                                        </div>
                                    )}

                                    {teams.map((team, tIdx) => (
                                        <Card key={tIdx} className="bg-slate-50">
                                            <CardContent className="p-4 space-y-4">
                                                <div className="flex justify-between items-start">
                                                    <div className="flex-1 grid grid-cols-2 gap-3">
                                                        <div className="space-y-1">
                                                            <Label className="text-xs">Team Name</Label>
                                                            <Input
                                                                value={team.name}
                                                                onChange={(e) => updateTeam(tIdx, 'name', e.target.value)}
                                                                className="h-8 text-xs"
                                                                placeholder="e.g. OSP Team A"
                                                            />
                                                        </div>
                                                        <div className="space-y-1">
                                                            <Label className="text-xs">Status</Label>
                                                            <Select value={team.status} onValueChange={(v) => updateTeam(tIdx, 'status', v)}>
                                                                <SelectTrigger className="h-8 text-xs">
                                                                    <SelectValue />
                                                                </SelectTrigger>
                                                                <SelectContent>
                                                                    <SelectItem value="ACTIVE">Active</SelectItem>
                                                                    <SelectItem value="INACTIVE">Inactive</SelectItem>
                                                                </SelectContent>
                                                            </Select>
                                                        </div>
                                                    </div>
                                                    {teams.length > 1 && (
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => setTeams(teams.filter((_, i) => i !== tIdx))}
                                                            className="ml-2 text-red-500 hover:text-red-700"
                                                        >
                                                            <Trash className="w-4 h-4" />
                                                        </Button>
                                                    )}
                                                </div>

                                                {/* Store Assignments */}
                                                <div className="space-y-2">
                                                    <Label className="text-xs font-semibold">Assigned Stores</Label>
                                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-32 overflow-y-auto p-2 bg-white rounded border">
                                                        {stores.map((store: any) => (
                                                            <div key={store.id} className="flex items-center gap-2">
                                                                <Checkbox
                                                                    checked={(team.storeIds || []).includes(store.id)}
                                                                    onCheckedChange={() => toggleStore(tIdx, store.id)}
                                                                    id={`store-${tIdx}-${store.id}`}
                                                                />
                                                                <Label htmlFor={`store-${tIdx}-${store.id}`} className="text-[10px] cursor-pointer">
                                                                    {store.name}
                                                                </Label>
                                                            </div>
                                                        ))}
                                                    </div>
                                                    {(team.storeIds || []).length > 0 && (
                                                        <div className="space-y-1">
                                                            <Label className="text-xs">Primary Store</Label>
                                                            <Select value={team.primaryStoreId || ''} onValueChange={(v) => updateTeam(tIdx, 'primaryStoreId', v)}>
                                                                <SelectTrigger className="h-8 text-xs">
                                                                    <SelectValue placeholder="Select primary store" />
                                                                </SelectTrigger>
                                                                <SelectContent>
                                                                    {(team.storeIds || []).map((storeId) => {
                                                                        const store = stores.find((s: any) => s.id === storeId);
                                                                        return store ? (
                                                                            <SelectItem key={store.id} value={store.id}>
                                                                                {store.name}
                                                                            </SelectItem>
                                                                        ) : null;
                                                                    })}
                                                                </SelectContent>
                                                            </Select>
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Team Members */}
                                                <div className="space-y-2">
                                                    <div className="flex justify-between items-center">
                                                        <Label className="text-xs font-semibold">Team Members</Label>
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => addMember(tIdx)}
                                                            className="h-6 text-[10px]"
                                                        >
                                                            <Plus className="w-3 h-3 mr-1" /> Add Member
                                                        </Button>
                                                    </div>

                                                    {team.members.length === 0 && (
                                                        <div className="text-center py-4 border border-dashed rounded bg-white">
                                                            <p className="text-[10px] text-slate-400">No members added</p>
                                                        </div>
                                                    )}

                                                    {team.members.map((member, mIdx) => (
                                                        <div key={mIdx} className="flex gap-2 items-start bg-white p-2 rounded border">
                                                            <div className="flex-1 grid grid-cols-2 gap-2">
                                                                <Input
                                                                    placeholder="Member Name"
                                                                    value={member.name}
                                                                    onChange={(e) => updateMember(tIdx, mIdx, 'name', e.target.value)}
                                                                    className="h-7 text-xs"
                                                                />
                                                                <Input
                                                                    placeholder="NIC / ID Number"
                                                                    value={member.idCopyNumber}
                                                                    onChange={(e) => updateMember(tIdx, mIdx, 'idCopyNumber', e.target.value)}
                                                                    className="h-7 text-xs"
                                                                />
                                                                <Input
                                                                    placeholder="Contractor ID"
                                                                    value={member.contractorIdCopyNumber}
                                                                    onChange={(e) => updateMember(tIdx, mIdx, 'contractorIdCopyNumber', e.target.value)}
                                                                    className="h-7 text-xs"
                                                                />
                                                                <div className="flex gap-1">
                                                                    <div className="flex-1">
                                                                        <Input
                                                                            type="file"
                                                                            accept="image/*,.pdf"
                                                                            className="h-7 text-[10px]"
                                                                            onChange={(e) => handleMemberUpload(tIdx, mIdx, 'photoUrl', e)}
                                                                        />
                                                                        {member.photoUrl && (
                                                                            <span className="text-[8px] text-green-600">✓ Photo</span>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            <Button
                                                                type="button"
                                                                variant="ghost"
                                                                size="sm"
                                                                onClick={() => removeMember(tIdx, mIdx)}
                                                                className="h-7 w-7 p-0 text-red-500"
                                                            >
                                                                <Trash className="w-3 h-3" />
                                                            </Button>
                                                        </div>
                                                    ))}
                                                </div>
                                            </CardContent>
                                        </Card>
                                    ))}
                                </div>

                                <DialogFooter>
                                    <Button type="button" variant="outline" onClick={() => setShowModal(false)}>Cancel</Button>
                                    <Button type="submit" disabled={mutation.isPending}>Save Contractor</Button>
                                </DialogFooter>
                            </form>
                        </Form>
                    </DialogContent>
                </Dialog>

                {/* Share Modal */}
                <Dialog open={shareModalOpen} onOpenChange={setShareModalOpen}>
                    <DialogContent className="max-w-md">
                        <DialogHeader>
                            <DialogTitle>Share Upload Link</DialogTitle>
                            <DialogDescription>
                                Share this secure link with the contractor. They can use it to upload documents without logging in.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 pt-2">
                            <div className="flex items-center gap-2">
                                <Input value={shareLink} readOnly className="bg-slate-50 text-xs font-mono" />
                                <Button size="icon" variant="outline" onClick={() => {
                                    navigator.clipboard.writeText(shareLink);
                                    toast.success("Copied to clipboard");
                                }}>
                                    <Copy className="w-4 h-4" />
                                </Button>
                            </div>

                            <div className="flex gap-2 justify-center">
                                <Button className="flex-1 bg-green-600 hover:bg-green-700" onClick={() => {
                                    const text = `Please upload your documents using this secure link: ${shareLink}`;
                                    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
                                }}>
                                    <MessageCircle className="w-4 h-4 mr-2" /> WhatsApp
                                </Button>
                                <Button variant="outline" className="flex-1" onClick={() => {
                                    const subject = "Contractor Document Upload";
                                    const body = `Please upload your required documents using this secure link:\n\n${shareLink}\n\nThis link will expire in 7 days.`;
                                    window.open(`mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`);
                                }}>
                                    <ExternalLink className="w-4 h-4 mr-2" /> Email
                                </Button>
                            </div>
                            <p className="text-[10px] text-slate-500 text-center">
                                This link expires in 7 days. You can generate a new one if needed.
                            </p>
                        </div>
                    </DialogContent>
                </Dialog>

                {/* Invite Modal */}
                <Dialog open={inviteModalOpen} onOpenChange={setInviteModalOpen}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Invite New Contractor</DialogTitle>
                            <DialogDescription>Generate a public registration link for a new contractor.</DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                            <div className="space-y-2">
                                <Label>Contractor Name</Label>
                                <Input placeholder="Company name or Individual" value={inviteData.name} onChange={e => setInviteData({ ...inviteData, name: e.target.value })} />
                            </div>
                            <div className="space-y-2">
                                <Label>Phone Number (Mobile)</Label>
                                <Input placeholder="07XXXXXXXX" value={inviteData.contactNumber} onChange={e => setInviteData({ ...inviteData, contactNumber: e.target.value })} />
                            </div>
                            <div className="space-y-2">
                                <Label>Contractor Type</Label>
                                <Select value={inviteData.type} onValueChange={(v: any) => setInviteData({ ...inviteData, type: v })}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="SOD">Service Order (SOD)</SelectItem>
                                        <SelectItem value="OSP">OSP Project</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Originating Office</Label>
                                <div className="px-3 py-2 bg-slate-50 border rounded-md text-xs font-medium text-slate-600">
                                    {user.accessibleOpmcs?.[0]?.name || 'Auto-detected from your profile'}
                                </div>
                                <p className="text-[10px] text-slate-400">The registration will be routed to your regional ARM for approval.</p>
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setInviteModalOpen(false)}>Cancel</Button>
                            <Button className="bg-blue-600 hover:bg-blue-700" onClick={async () => {
                                const toastId = toast.loading("Generating link...");
                                try {
                                    const res = await fetch('/api/contractors/generate-link', {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ ...inviteData, siteOfficeStaffId: user.id })
                                    });
                                    if (!res.ok) throw new Error("Failed");
                                    const data = await res.json();
                                    setShareLink(data.registrationLink);
                                    setInviteModalOpen(false);
                                    setShareModalOpen(true);
                                    toast.dismiss(toastId);
                                    toast.success("Invitation generated!");
                                } catch (err) {
                                    toast.error("Generation failed", { id: toastId });
                                }
                            }}>Generate & Copy Link</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                {/* Team Manager Modal */}
                {selectedContractorForTeams && (
                    <TeamManager
                        isOpen={teamManagerOpen}
                        onClose={() => setTeamManagerOpen(false)}
                        contractorId={selectedContractorForTeams.id}
                        contractorName={selectedContractorForTeams.name}
                    />
                )}
            </main>
        </div >
    );
}
