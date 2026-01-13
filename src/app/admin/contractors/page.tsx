"use client";

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Trash, Plus, Pencil, Search, Users, ShieldAlert, ShieldCheck, Building2, Upload, FileText, Image as ImageIcon, Copy, ExternalLink, MessageCircle, CheckCircle, UserPlus, Share2, Banknote, CheckCircle2, Trash2, Loader2 } from "lucide-react";
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
import { Progress } from "@/components/ui/progress";

// Types
interface TeamMember {
    id?: string;
    name: string;
    idCopyNumber: string;
    contractorIdCopyNumber: string;
    photoUrl?: string;
    nicUrl?: string;
    passportPhotoUrl?: string;
}

interface ContractorTeam {
    id?: string;
    name: string;
    opmcId?: string | null;
    storeIds?: string[];
    primaryStoreId?: string | null;
    sltCode?: string | null;
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
    type: z.enum(['SOD', 'OSP']),
});

type ContractorFormValues = z.infer<typeof contractorSchema>

export default function ContractorsPage() {
    const queryClient = useQueryClient();
    const [searchTerm, setSearchTerm] = useState("");

    // Modal State
    const [showModal, setShowModal] = useState(false);
    const [selectedContractor, setSelectedContractor] = useState<Contractor | null>(null);
    const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});

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
    const [inviteData, setInviteData] = useState<{
        name: string;
        contactNumber: string;
        type: 'SOD' | 'OSP';
    }>({
        name: '',
        contactNumber: '',
        type: 'SOD'
    });

    const handleInviteOpen = () => {
        setInviteData({
            name: '',
            contactNumber: '',
            type: 'SOD'
        });
        setInviteModalOpen(true);
    };

    const [step, setStep] = useState(1);
    const [manualBank, setManualBank] = useState(false);
    const [manualBranch, setManualBranch] = useState(false);
    const [branchSearch, setBranchSearch] = useState("");
    const [showBranchList, setShowBranchList] = useState(false);

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
            bankAccountNumber: '', bankBranch: '', type: 'SOD'
        }
    });

    // --- QUERIES ---
    const { data: contractorsData, isLoading } = useQuery({
        queryKey: ["contractors"],
        queryFn: async () => {
            const res = await fetch(`/api/contractors?page=1&limit=1000&t=${Date.now()}`);
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
            if (!res.ok) throw new Error("Failed to fetch RTOMs");
            return res.json();
        },
        staleTime: 10 * 60 * 1000,
        gcTime: 30 * 60 * 1000
    });

    const { data: banks = [] } = useQuery({
        queryKey: ['banks'],
        queryFn: async () => {
            const res = await fetch('/api/banks');
            if (res.ok) return res.json();
            return [];
        }
    });

    const { data: branches = [] } = useQuery({
        queryKey: ['branches'],
        queryFn: async () => {
            const res = await fetch('/api/branches');
            if (res.ok) return res.json();
            return [];
        }
    });

    // Auto-select RTOM for site staff if they have only one
    React.useEffect(() => {
        if (inviteModalOpen && isSiteStaff && user.accessibleOpmcs?.length === 1) {
            setInviteData(prev => ({ ...prev, opmcId: user.accessibleOpmcs[0].id }));
        }
    }, [inviteModalOpen, isSiteStaff, user.accessibleOpmcs, opmcs]);

    // Filter RTOMs based on user access
    const filteredOpmcs = React.useMemo(() => {
        // If data hasn't loaded yet, return empty
        if (!opmcs || opmcs.length === 0) return [];

        // If it's a Super Admin or OSP Manager, show everything
        if (['SUPER_ADMIN', 'ADMIN', 'OSP_MANAGER'].includes(userRole)) return opmcs;

        // For others, use their assigned RTOMs
        const userOpmcIds = (user.accessibleOpmcs || []).map((o: any) => o.id);

        // Fallback for old sessions: If they are site staff but have NO assigned RTOMs in localStorage,
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
            const res = await fetch(`/api/contractors?id=${id}`, { method: 'DELETE' });
            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.message || "Failed to delete contractor");
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["contractors"] });
            toast.success("Contractor deleted");
        },
        onError: (error: any) => {
            toast.error(error.message || "Failed to delete contractor");
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

    const uploadFile = async (e: React.ChangeEvent<HTMLInputElement>, fieldName: string) => {
        if (!e.target.files || e.target.files.length === 0) return null;
        const file = e.target.files[0];
        const formData = new FormData();
        formData.append('file', file);

        return new Promise<string | null>((resolve) => {
            const xhr = new XMLHttpRequest();
            xhr.open('POST', '/api/upload', true);

            xhr.upload.onprogress = (event) => {
                if (event.lengthComputable) {
                    const percentComplete = Math.round((event.loaded / event.total) * 100);
                    setUploadProgress(prev => ({ ...prev, [fieldName]: percentComplete }));
                }
            };

            xhr.onload = () => {
                if (xhr.status === 200) {
                    const response = JSON.parse(xhr.responseText);
                    setUploadProgress(prev => {
                        const next = { ...prev };
                        delete next[fieldName];
                        return next;
                    });
                    resolve(response.url);
                } else {
                    toast.error("Upload failed");
                    setUploadProgress(prev => {
                        const next = { ...prev };
                        delete next[fieldName];
                        return next;
                    });
                    resolve(null);
                }
            };

            xhr.onerror = () => {
                toast.error("Network error");
                setUploadProgress(prev => {
                    const next = { ...prev };
                    delete next[fieldName];
                    return next;
                });
                resolve(null);
            };

            xhr.send(formData);
        });
    };

    // --- HANDLERS ---
    const handleAdd = () => {
        setSelectedContractor(null);
        setTeams([]);
        setStep(1);
        form.reset({
            name: '', address: '', registrationNumber: '', brNumber: '', status: 'PENDING',
            contactNumber: '', agreementDuration: '1', brCertUrl: '', nic: '',
            registrationFeePaid: false, agreementSigned: false, agreementDate: '',
            bankName: '', bankAccountNumber: '', bankBranch: '',
            opmcId: '',
            type: 'SOD'
        });
        setShowModal(true);
    };

    const handleEdit = (c: Contractor) => {
        setSelectedContractor(c);
        setStep(1);
        // Load teams with full details
        setTeams(c.teams.map(t => ({
            id: t.id,
            name: t.name,
            status: t.status,
            sltCode: t.sltCode,
            opmcId: t.opmcId || null,
            storeIds: (t as any).storeAssignments?.map((sa: any) => sa.storeId) || [],
            primaryStoreId: (t as any).storeAssignments?.find((sa: any) => sa.isPrimary)?.storeId || null,
            members: t.members.map((m: any) => ({
                id: m.id,
                name: m.name,
                idCopyNumber: m.idCopyNumber || m.nic || '',
                contractorIdCopyNumber: m.contractorIdCopyNumber || '',
                photoUrl: m.photoUrl || '',
                passportPhotoUrl: m.passportPhotoUrl || m.photoUrl || '',
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
        setTeams(prev => {
            const newTeams = [...prev];
            newTeams[idx] = { ...newTeams[idx], [field]: val };
            return newTeams;
        });
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
        setTeams(prev => prev.filter((_, i) => i !== idx));
    };

    const addMember = (teamIdx: number) => {
        setTeams(prev => {
            const newTeams = [...prev];
            const team = { ...newTeams[teamIdx] };
            team.members = [...team.members, { name: '', idCopyNumber: '', contractorIdCopyNumber: '', photoUrl: '', passportPhotoUrl: '' }];
            newTeams[teamIdx] = team;
            return newTeams;
        });
    };

    const updateMember = (teamIdx: number, memberIdx: number, field: string, val: string) => {
        setTeams(prev => {
            const newTeams = [...prev];
            const team = { ...newTeams[teamIdx] };
            const members = [...team.members];
            const member = { ...members[memberIdx], [field]: val };

            // Sync photo fields
            if (field === 'passportPhotoUrl') member.photoUrl = val;
            else if (field === 'photoUrl') member.passportPhotoUrl = val;

            members[memberIdx] = member;
            team.members = members;
            newTeams[teamIdx] = team;
            return newTeams;
        });
    };

    const removeMember = (teamIdx: number, memberIdx: number) => {
        const newTeams = [...teams];
        newTeams[teamIdx].members = newTeams[teamIdx].members.filter((_, i) => i !== memberIdx);
        setTeams(newTeams);
    };

    const handleMemberUpload = async (teamIdx: number, memberIdx: number, field: 'photoUrl' | 'nicUrl', e: React.ChangeEvent<HTMLInputElement>) => {
        const fieldName = `member-${teamIdx}-${memberIdx}-${field}`;
        const url = await uploadFile(e, fieldName);
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
                                <Button onClick={handleInviteOpen} variant="outline" className="flex-1 sm:flex-none border-blue-200 text-blue-700 hover:bg-blue-50 text-xs sm:text-sm h-9">
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
                                                            console.log("[DELETE] Attempting to delete contractor:", contractor.id, contractor.name);
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
                    <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto w-full no-scrollbar">
                        <DialogHeader>
                            <DialogTitle>{selectedContractor ? 'Edit Contractor' : 'Register New Contractor'}</DialogTitle>
                            <DialogDescription>
                                {selectedContractor ? 'Update the details for this contractor.' : 'Enter the details to register a new contractor.'}
                            </DialogDescription>
                        </DialogHeader>

                        <div className="flex items-center justify-center mb-10 overflow-x-auto pb-4 gap-4 no-scrollbar">
                            {[
                                { id: 1, label: "Info", icon: Building2 },
                                { id: 2, label: "Finc", icon: Banknote },
                                { id: 3, label: "Docs", icon: FileText },
                                ...(form.watch('type') === 'SOD' ? [{ id: 4, label: "Team", icon: Users }] : []),
                                { id: 5, label: "Save", icon: CheckCircle2 }
                            ].map((s, idx, arr) => (
                                <React.Fragment key={s.id}>
                                    <div className="flex flex-col items-center gap-2">
                                        <div className={cn(
                                            "w-10 h-10 rounded-full flex items-center justify-center transition-all shadow-sm",
                                            step === s.id ? "bg-blue-600 text-white ring-4 ring-blue-100" :
                                                step > s.id ? "bg-green-500 text-white" : "bg-white text-slate-400 border border-slate-200"
                                        )}>
                                            <s.icon className="w-5 h-5" />
                                        </div>
                                        <span className={cn(
                                            "text-[10px] font-bold uppercase tracking-wider text-center",
                                            step >= s.id ? "text-slate-900" : "text-slate-400"
                                        )}>{s.label}</span>
                                    </div>
                                    {idx < arr.length - 1 && (
                                        <div className={cn("h-[2px] w-12 transition-colors", step > s.id ? "bg-green-500" : "bg-slate-200")} />
                                    )}
                                </React.Fragment>
                            ))}
                        </div>

                        <Form {...form}>
                            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">

                                {/* Step 1: Basic Details */}
                                {step === 1 && (
                                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                        <div className="grid grid-cols-2 gap-4">
                                            <FormField control={form.control} name="type" render={({ field }) => (
                                                <FormItem className="col-span-2">
                                                    <FormLabel>Contractor Type</FormLabel>
                                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                        <FormControl><SelectTrigger><SelectValue placeholder="Select Type" /></SelectTrigger></FormControl>
                                                        <SelectContent>
                                                            <SelectItem value="SOD">Service Order (SOD)</SelectItem>
                                                            <SelectItem value="OSP">OSP Project</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </FormItem>
                                            )} />

                                            <FormField control={form.control} name="name" render={({ field }) => (
                                                <FormItem><FormLabel>Contractor Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                                            )} />
                                            <FormField control={form.control} name="registrationNumber" render={({ field }) => (
                                                <FormItem><FormLabel>Registration No</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                                            )} />
                                            <FormField control={form.control} name="address" render={({ field }) => (
                                                <FormItem className="col-span-2"><FormLabel>Address</FormLabel><FormControl><Textarea {...field} rows={2} /></FormControl><FormMessage /></FormItem>
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

                                            <FormField control={form.control} name="opmcId" render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Originating Office (RTOM)</FormLabel>
                                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                        <FormControl><SelectTrigger><SelectValue placeholder="Select Office" /></SelectTrigger></FormControl>
                                                        <SelectContent>
                                                            {opmcs.map((o: any) => (<SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>))}
                                                        </SelectContent>
                                                    </Select>
                                                </FormItem>
                                            )} />
                                        </div>
                                        <div className="flex justify-end gap-2 border-t pt-4">
                                            <Button type="button" variant="outline" onClick={() => setShowModal(false)}>Cancel</Button>
                                            <Button type="button" className="bg-blue-600 px-8" onClick={() => setStep(2)}>Continue</Button>
                                        </div>
                                    </div>
                                )}

                                {/* Step 2: Bank Details */}
                                {step === 2 && (
                                    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                            <FormField control={form.control} name="bankName" render={({ field }) => (
                                                <FormItem className="col-span-2">
                                                    <FormLabel>Bank Name</FormLabel>
                                                    {!manualBank ? (
                                                        <Select
                                                            value={banks.find((b: any) => b.name === field.value)?.id}
                                                            onValueChange={(val) => {
                                                                if (val === "OTHER") { setManualBank(true); field.onChange(""); }
                                                                else { const bank = banks.find((b: any) => b.id === val); field.onChange(bank?.name || ""); }
                                                            }}>
                                                            <FormControl><SelectTrigger><SelectValue placeholder="Select Bank" /></SelectTrigger></FormControl>
                                                            <SelectContent>{banks.map((b: any) => (<SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>))}<SelectItem value="OTHER">+ Other (Type manually)</SelectItem></SelectContent>
                                                        </Select>
                                                    ) : (<div className="flex gap-2"><Input {...field} /><Button variant="ghost" onClick={() => setManualBank(false)}>List</Button></div>)}
                                                </FormItem>
                                            )} />

                                            <FormField control={form.control} name="bankBranch" render={({ field }) => (
                                                <FormItem className="col-span-2">
                                                    <FormLabel>Branch</FormLabel>
                                                    {!manualBranch ? (
                                                        <div className="relative">
                                                            <Input
                                                                placeholder="Type to search branch..."
                                                                value={field.value || branchSearch}
                                                                onFocus={() => setShowBranchList(true)}
                                                                onChange={(e) => {
                                                                    setBranchSearch(e.target.value);
                                                                    setShowBranchList(true);
                                                                }}
                                                            />
                                                            {showBranchList && (
                                                                <div className="absolute z-50 w-full mt-1 bg-white border rounded-lg shadow-xl max-h-60 overflow-y-auto no-scrollbar">
                                                                    {branches
                                                                        .filter((b: any) => b.name.toLowerCase().startsWith(branchSearch.toLowerCase()))
                                                                        .sort((a: any, b: any) => a.name.localeCompare(b.name))
                                                                        .slice(0, 50)
                                                                        .map((br: any, i: number) => (
                                                                            <div
                                                                                key={i}
                                                                                className="px-4 py-2 hover:bg-blue-50 cursor-pointer text-sm"
                                                                                onClick={() => {
                                                                                    field.onChange(br.name);
                                                                                    setBranchSearch(br.name);
                                                                                    setShowBranchList(false);
                                                                                }}
                                                                            >
                                                                                {br.name}
                                                                            </div>
                                                                        ))
                                                                    }
                                                                    <div
                                                                        className="px-4 py-2 hover:bg-blue-50 cursor-pointer text-sm font-bold text-blue-600 border-t sticky bottom-0 bg-white"
                                                                        onClick={() => {
                                                                            setManualBranch(true);
                                                                            field.onChange("");
                                                                            setShowBranchList(false);
                                                                        }}
                                                                    >
                                                                        + Other (Type manually)
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    ) : (<div className="flex gap-2"><Input {...field} /><Button variant="ghost" onClick={() => setManualBranch(false)}>List</Button></div>)}
                                                </FormItem>
                                            )} />

                                            <FormField control={form.control} name="bankAccountNumber" render={({ field }) => (
                                                <FormItem className="col-span-2">
                                                    <FormLabel>Account Number</FormLabel>
                                                    <FormControl><Input {...field} /></FormControl>
                                                </FormItem>
                                            )} />

                                            <FormField control={form.control} name="bankPassbookUrl" render={({ field }) => (
                                                <FormItem className="col-span-2">
                                                    <FormLabel>Bank Passbook Header</FormLabel>
                                                    <div className="flex flex-col gap-2 mt-1">
                                                        {field.value && <img src={field.value} alt="Preview" className="h-20 w-32 object-cover rounded border" />}
                                                        <div className="relative">
                                                            <Input type="file" accept="image/*,.pdf" onChange={async (e) => {
                                                                const url = await uploadFile(e, 'bankPassbookUrl');
                                                                if (url) field.onChange(url);
                                                            }} />
                                                            {uploadProgress['bankPassbookUrl'] !== undefined && (
                                                                <div className="absolute -bottom-1 left-0 right-0 px-1">
                                                                    <Progress value={uploadProgress['bankPassbookUrl']} className="h-1" />
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </FormItem>
                                            )} />
                                        </div>
                                        <div className="flex justify-between border-t pt-4">
                                            <Button type="button" variant="outline" onClick={() => setStep(1)}>Back</Button>
                                            <Button type="button" className="bg-blue-600 px-8" onClick={() => setStep(3)}>Continue</Button>
                                        </div>
                                    </div>
                                )}

                                {/* Step 3: Documents */}
                                {step === 3 && (
                                    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
                                        <div className="grid grid-cols-2 gap-4">
                                            {[
                                                { label: "Contractor Photo", field: "photoUrl" },
                                                { label: "BR Certificate", field: "brCertUrl" },
                                                { label: "NIC Front", field: "nicFrontUrl" },
                                                { label: "NIC Back", field: "nicBackUrl" },
                                                { label: "Police Report", field: "policeReportUrl" },
                                                { label: "Grama Cert", field: "gramaCertUrl" }
                                            ].map((doc) => (
                                                <FormField key={doc.field} control={form.control} name={doc.field as any} render={({ field }) => (
                                                    <FormItem className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                                                        <FormLabel className="text-xs font-bold uppercase">{doc.label}</FormLabel>
                                                        <div className="flex flex-col gap-2 mt-2">
                                                            {field.value ? (
                                                                <div className="relative group w-full h-24">
                                                                    <img src={field.value} alt="Doc" className="w-full h-full object-cover rounded border" />
                                                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity rounded">
                                                                        <Button type="button" size="sm" variant="destructive" onClick={() => field.onChange("")}>Remove</Button>
                                                                    </div>
                                                                </div>
                                                            ) : (
                                                                <div className="w-full h-24 border-2 border-dashed rounded flex flex-col items-center justify-center bg-white cursor-pointer hover:border-blue-400 transition-colors relative">
                                                                    <Upload className="w-6 h-6 text-slate-300" />
                                                                    <span className="text-[10px] text-slate-400 mt-1">Click to upload</span>
                                                                    <Input type="file" className="absolute inset-0 opacity-0 cursor-pointer h-full" onChange={async (e) => {
                                                                        const url = await uploadFile(e, doc.field);
                                                                        if (url) field.onChange(url);
                                                                    }} />
                                                                    {uploadProgress[doc.field] !== undefined && (
                                                                        <div className="absolute bottom-0 left-0 right-0 px-1 pb-1">
                                                                            <Progress value={uploadProgress[doc.field]} className="h-1" />
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </FormItem>
                                                )} />
                                            ))}
                                        </div>
                                        <div className="flex justify-between border-t pt-4">
                                            <Button type="button" variant="outline" onClick={() => setStep(2)}>Back</Button>
                                            <Button type="button" className="bg-blue-600 px-8" onClick={() => setStep(form.watch('type') === 'SOD' ? 4 : 5)}>Continue</Button>
                                        </div>
                                    </div>
                                )}

                                {/* Step 4: Teams (SOD Only) */}
                                {step === 4 && form.watch('type') === 'SOD' && (
                                    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
                                        <div className="flex justify-between items-center bg-slate-50 p-4 rounded-lg border">
                                            <div>
                                                <h4 className="font-bold text-slate-800">Team Management</h4>
                                                <p className="text-xs text-slate-500">Add operational teams and assign members.</p>
                                            </div>
                                            <Button type="button" size="sm" variant="outline" onClick={addTeam}><Plus className="w-3 h-3 mr-1" /> Add Team</Button>
                                        </div>

                                        <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 no-scrollbar">
                                            {teams.map((team, tIdx) => (
                                                <Card key={tIdx} className="border-slate-200">
                                                    <CardContent className="p-4 space-y-4">
                                                        <div className="flex justify-between gap-4">
                                                            <Input value={team.name} onChange={(e) => updateTeam(tIdx, 'name', e.target.value)} placeholder="Team Name" className="flex-1" />
                                                            <Button type="button" variant="ghost" size="sm" onClick={() => removeTeam(tIdx)} className="text-red-500"><Trash2 className="w-4 h-4" /></Button>
                                                        </div>
                                                        <div className="grid grid-cols-2 gap-4">
                                                            <div>
                                                                <Label className="text-xs">Primary Store</Label>
                                                                <Select value={team.primaryStoreId || ""} onValueChange={(val) => updateTeam(tIdx, 'primaryStoreId', val)}>
                                                                    <SelectTrigger className="h-9"><SelectValue placeholder="Select Store" /></SelectTrigger>
                                                                    <SelectContent>{stores.map((s: any) => (<SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>))}</SelectContent>
                                                                </Select>
                                                            </div>
                                                            <div className="flex flex-col justify-end">
                                                                <Button type="button" variant="outline" size="sm" onClick={() => addMember(tIdx)} className="h-9"><UserPlus className="w-3 h-3 mr-2" /> Add Member</Button>
                                                            </div>
                                                        </div>
                                                        <div className="space-y-2 mt-4">
                                                            {team.members.map((m, mIdx) => (
                                                                <div key={mIdx} className="flex items-center gap-2 bg-slate-50 p-2 rounded border border-slate-100">
                                                                    <Input value={m.name} onChange={(e) => updateMember(tIdx, mIdx, 'name', e.target.value)} placeholder="Member Name" className="h-8 text-xs flex-1" />
                                                                    <Input value={m.idCopyNumber} onChange={(e) => updateMember(tIdx, mIdx, 'idCopyNumber', e.target.value)} placeholder="NIC" className="h-8 text-xs w-24" />
                                                                    <Button type="button" variant="ghost" size="sm" onClick={() => removeMember(tIdx, mIdx)} className="h-8 w-8 text-red-400 p-0"><Trash2 className="w-3 h-3" /></Button>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </CardContent>
                                                </Card>
                                            ))}
                                        </div>
                                        <div className="flex justify-between border-t pt-4">
                                            <Button type="button" variant="outline" onClick={() => setStep(3)}>Back</Button>
                                            <Button type="button" className="bg-blue-600 px-8" onClick={() => setStep(5)}>Continue</Button>
                                        </div>
                                    </div>
                                )}

                                {/* Step 5: Final Review & Save */}
                                {step === 5 && (
                                    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500 text-center py-8">
                                        <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-4 border-4 border-blue-100">
                                            <CheckCircle2 className="w-10 h-10 text-blue-600" />
                                        </div>
                                        <h3 className="text-xl font-bold text-slate-900">Ready to Save?</h3>
                                        <p className="text-slate-500 max-w-sm mx-auto">
                                            Please review the information provided. Once saved, the contractor will be registered in the system.
                                        </p>
                                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-left space-y-2 text-sm">
                                            <div className="flex justify-between"><span>Name:</span> <span className="font-bold">{form.getValues('name')}</span></div>
                                            <div className="flex justify-between"><span>Type:</span> <span className="font-bold">{form.getValues('type')}</span></div>
                                            <div className="flex justify-between border-t pt-2 mt-2">
                                                <span>Documents:</span>
                                                <div className="flex gap-1 flex-wrap justify-end max-w-[200px]">
                                                    {['photoUrl', 'nicFrontUrl', 'nicBackUrl', 'brCertUrl', 'bankPassbookUrl'].map(f => (
                                                        form.getValues(f as any) ? (
                                                            <div key={f} className="w-6 h-6 rounded bg-green-100 flex items-center justify-center" title={f}>
                                                                <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />
                                                            </div>
                                                        ) : (
                                                            <div key={f} className="w-6 h-6 rounded bg-slate-200 flex items-center justify-center opacity-40" title={f}>
                                                                <ImageIcon className="w-3 h-3 text-slate-400" />
                                                            </div>
                                                        )
                                                    ))}
                                                </div>
                                            </div>
                                            {form.getValues('type') === 'SOD' && (
                                                <div className="flex justify-between"><span>Teams:</span> <span className="font-bold">{teams.length} Team(s)</span></div>
                                            )}
                                        </div>
                                        <div className="flex justify-between border-t pt-6 mt-10">
                                            <Button type="button" variant="outline" onClick={() => setStep(form.watch('type') === 'SOD' ? 4 : 3)}>Back</Button>
                                            <Button type="submit" disabled={mutation.isPending} className="bg-blue-600 px-12">
                                                {mutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                                                Save Contractor
                                            </Button>
                                        </div>
                                    </div>
                                )}
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
                                <Input
                                    placeholder="Company name or Individual"
                                    value={inviteData.name}
                                    onChange={e => setInviteData({ ...inviteData, name: e.target.value })}
                                    autoComplete="off"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Phone Number (Mobile)</Label>
                                <Input
                                    placeholder="07XXXXXXXX"
                                    value={inviteData.contactNumber}
                                    onChange={e => setInviteData({ ...inviteData, contactNumber: e.target.value })}
                                    autoComplete="off"
                                />
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
                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                                <p className="text-xs text-blue-800">
                                    <strong>Note:</strong> RTOM and Store assignments will be configured through Teams after registration is completed.
                                </p>
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setInviteModalOpen(false)}>Cancel</Button>
                            <Button className="bg-blue-600 hover:bg-blue-700" onClick={async () => {
                                console.log("[FRONTEND] Generate Link clicked");
                                console.log("[FRONTEND] Invite data:", inviteData);

                                if (!inviteData.name || !inviteData.contactNumber) {
                                    toast.error("Please fill in basic details");
                                    return;
                                }

                                const toastId = toast.loading("Generating link...");
                                try {
                                    const payload = {
                                        ...inviteData,
                                        siteOfficeStaffId: user.id
                                    };
                                    console.log("[FRONTEND] Sending payload:", payload);

                                    const res = await fetch('/api/contractors/generate-link', {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify(payload)
                                    });

                                    if (!res.ok) {
                                        const errorData = await res.json();
                                        console.error("[FRONTEND] API Error:", errorData);
                                        throw new Error(errorData.error || errorData.message || "Failed to generate link");
                                    }

                                    const data = await res.json();
                                    console.log("[FRONTEND] Success! Received:", data);
                                    setShareLink(data.registrationLink);

                                    // Try to copy to clipboard immediately
                                    try {
                                        await navigator.clipboard.writeText(data.registrationLink);
                                        toast.success("Link generated & copied to clipboard!", { id: toastId });
                                    } catch (copyErr) {
                                        toast.success("Link generated!", { id: toastId });
                                    }

                                    setInviteModalOpen(false);
                                    setShareModalOpen(true);

                                    // Refresh contractor list
                                    queryClient.invalidateQueries({ queryKey: ['contractors'] });
                                } catch (err: any) {
                                    console.error("[FRONTEND] Full error:", err);
                                    toast.error(err.message || "Generation failed", { id: toastId });
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
        </div>
    );
}
