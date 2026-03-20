"use client";

import { ContractorStatus } from "@prisma/client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { updateContractor } from "@/actions/contractor-actions";
import { CheckCircle, XCircle, Loader2, Building2, Users, FileText, Banknote, Calendar, ShieldCheck, Pencil, Image as ImageIcon, ExternalLink, Eye, Info } from "lucide-react";
import { ContractorUpdateData } from "@/services/contractor.service";
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import TeamManager from "../TeamManager";
import Image from "next/image";

interface TeamMember {
    id: string;
    name: string;
    designation: string;
    nic?: string;
    contactNumber?: string;
}

interface Team {
    id: string;
    name: string;
    sltCode?: string;
    members: TeamMember[];
}

interface Contractor {
    id: string;
    name: string;
    email?: string;
    status: ContractorStatus;
    type: string;
    nic?: string;
    registrationNumber?: string;
    contactNumber?: string;
    address?: string;
    bankName?: string;
    bankAccountNumber?: string;
    bankBranch?: string;
    photoUrl?: string;
    nicFrontUrl?: string;
    nicBackUrl?: string;
    brCertUrl?: string;
    bankPassbookUrl?: string;
    registrationFeeSlipUrl?: string;
    policeReportUrl?: string;
    gramaCertUrl?: string;
    teams?: Team[];
    createdAt?: string;
    updatedAt?: string;
    armApprovedAt?: string;
    ospApprovedAt?: string;
    opmcId?: string;
    registrationFeePaid?: boolean;
    agreementDate?: string;
    agreementDuration?: number;
    agreementSigned?: boolean;
}

export default function ContractorApprovalsPage() {
    const queryClient = useQueryClient();
    const [selectedContractor, setSelectedContractor] = useState<Contractor | null>(null);

    // Get current user from localStorage
    const user = typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('user') || '{}') : {};
    const userRole = user.role || '';

    const [isApproveDialogOpen, setIsApproveDialogOpen] = useState(false);
    const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false);
    const [rejectionReason, setRejectionReason] = useState("");
    const [teamCodes, setTeamCodes] = useState<Record<string, string>>({});
    const [teamManagerOpen, setTeamManagerOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editData, setEditData] = useState<Partial<Contractor>>({});
    const [previewDoc, setPreviewDoc] = useState<{ label: string, url: string } | null>(null);

    // Fetch contractors pending approval
    const { data: contractors = [], isLoading } = useQuery({
        queryKey: ['contractor-approvals'],
        queryFn: async () => {
            const res = await fetch('/api/contractors?page=1&limit=1000');
            if (!res.ok) throw new Error('Failed to fetch contractors');
            const data = await res.json();
            const actualData = data.success && data.data ? data.data : data;
            const contractorsList = Array.isArray(actualData.contractors) ? actualData.contractors : [];
            return contractorsList.filter((c: Contractor) => c.status === 'ARM_PENDING' || c.status === 'OSP_PENDING');
        }
    });

    const { data: opmcs = [] } = useQuery({
        queryKey: ['opmcs'],
        queryFn: async () => {
            const res = await fetch('/api/opmcs');
            if (!res.ok) return [];
            return res.json();
        }
    });

    const approveMutation = useMutation({
        mutationFn: async ({ id, status, approverId, teams }: { id: string; status: string; approverId: string; teams?: Team[] }) => {
            const data: ContractorUpdateData = {
                status: status as ContractorStatus,
                teams,
                ...(userRole === 'AREA_MANAGER' ? { armApprovedById: approverId, armApprovedAt: new Date() } : {}),
                ...(userRole === 'OSP_MANAGER' ? { ospApprovedById: approverId, ospApprovedAt: new Date() } : {})
            };
            return await updateContractor(id, data);
        },
        onSuccess: (result) => {
            if (result.success) {
                toast.success('Contractor approved successfully');
                queryClient.invalidateQueries({ queryKey: ['contractor-approvals'] });
                setSelectedContractor(null);
            } else {
                toast.error(result.error || 'Failed to approve');
            }
        }
    });

    const rejectMutation = useMutation({
        mutationFn: async ({ id, reason, userId }: { id: string; reason: string; userId: string }) => {
            const data: ContractorUpdateData = {
                status: 'REJECTED',
                rejectionReason: reason,
                rejectionById: userId,
                rejectedAt: new Date()
            };
            return await updateContractor(id, data);
        },
        onSuccess: (result) => {
            if (result.success) {
                toast.success('Contractor registration rejected');
                queryClient.invalidateQueries({ queryKey: ['contractor-approvals'] });
                setSelectedContractor(null);
                setIsRejectDialogOpen(false);
                setRejectionReason("");
            } else {
                toast.error(result.error || 'Failed to reject');
            }
        }
    });

    const handleApprove = (contractor: Contractor) => {
        let nextStatus = '';
        const isAdmin = ['ADMIN', 'SUPER_ADMIN'].includes(userRole);

        if (contractor.status === 'ARM_PENDING' && (userRole === 'AREA_MANAGER' || isAdmin)) {
            nextStatus = 'OSP_PENDING';
        } else if ((contractor.status === 'OSP_PENDING' || contractor.status === 'ARM_PENDING') && (userRole === 'OSP_MANAGER' || isAdmin)) {
            nextStatus = 'ACTIVE';
        }

        if (!nextStatus) {
            toast.error("You don't have permission to approve at this stage");
            return;
        }

        if (nextStatus === 'ACTIVE') {
            const initialCodes: Record<string, string> = {};
            (contractor.teams || []).forEach((t: Team) => {
                initialCodes[t.id] = t.sltCode || '';
            });
            setTeamCodes(initialCodes);
            setIsApproveDialogOpen(true);
        } else if (nextStatus) {
            approveMutation.mutate({ id: contractor.id, status: nextStatus, approverId: user.id });
        }
    };

    const confirmFinalApproval = () => {
        if (!selectedContractor) return;
        const teamsToUpdate = (selectedContractor.teams || []).map((t: Team) => ({
            ...t,
            sltCode: teamCodes[t.id]
        }));

        if (selectedContractor.type === 'SOD') {
            const missingCode = teamsToUpdate.some((t: Team) => !t.sltCode);
            if (missingCode) {
                toast.error("All teams must have an SLT Identification Code before activation.");
                return;
            }
        }

        approveMutation.mutate({
            id: selectedContractor.id,
            status: 'ACTIVE',
            approverId: user.id,
            teams: teamsToUpdate
        });
        setIsApproveDialogOpen(false);
    };

    const handleReject = () => {
        if (!selectedContractor) return;
        if (!rejectionReason.trim()) {
            toast.error("Please provide a reason for rejection");
            return;
        }
        rejectMutation.mutate({
            id: selectedContractor.id,
            reason: rejectionReason,
            userId: user.id
        });
    };

    if (isLoading) {
        return (
            <div className="flex h-screen bg-slate-50">
                <Sidebar />
                <main className="flex-1 flex items-center justify-center">
                    <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                </main>
            </div>
        );
    }

    return (
        <div className="flex h-screen bg-slate-50 overflow-hidden">
            <Sidebar />
            <main className="flex-1 flex flex-col min-w-0 h-full">
                <Header />
                <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50">
                    <div className="max-w-6xl mx-auto space-y-6">

                        <div className="flex justify-between items-center bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                            <div>
                                <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Registration Approvals</h1>
                                <p className="text-slate-500 text-sm">Synchronized workflow for contractor authorization.</p>
                            </div>
                            <div className="flex items-center gap-2">
                                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-100 font-bold px-3 py-1 capitalize tracking-wide">
                                    <ShieldCheck className="w-3.5 h-3.5 mr-1.5" />
                                    {userRole.replace('_', ' ')}
                                </Badge>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                            {/* List of Pending Contractors */}
                            <div className="lg:col-span-1 space-y-4">
                                <div className="flex items-center justify-between mb-2">
                                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Queue ({contractors.length})</h3>
                                    <Badge variant="secondary" className="text-[9px] font-bold h-5 px-1.5 opacity-60">Real-time</Badge>
                                </div>
                                
                                <div className="space-y-3">
                                    {contractors.length === 0 ? (
                                        <div className="bg-white p-12 text-center rounded-3xl border-2 border-dashed border-slate-100 mt-2">
                                            <Info className="w-8 h-8 text-slate-200 mx-auto mb-2 opacity-50" />
                                            <p className="text-slate-400 text-xs font-bold italic">No registrations pending</p>
                                        </div>
                                    ) : (
                                        contractors.map((c: Contractor) => (
                                            <Card
                                                key={c.id}
                                                className={cn(
                                                    "cursor-pointer transition-all border-none ring-2 ring-transparent ring-inset",
                                                    selectedContractor?.id === c.id ? "ring-blue-600 shadow-xl scale-[1.02] bg-white" : "hover:ring-slate-200 bg-white shadow-sm"
                                                )}
                                                onClick={() => setSelectedContractor(c)}
                                            >
                                                <CardContent className="p-4">
                                                    <div className="flex justify-between items-start gap-3">
                                                        <div className="flex-1 min-w-0">
                                                            <h4 className="font-black text-slate-900 text-sm truncate uppercase tracking-tight">{c.name}</h4>
                                                            <div className="flex items-center gap-2 mt-1">
                                                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">{c.type}</span>
                                                                <span className="text-slate-300 w-1 h-1 rounded-full bg-slate-300" />
                                                                <span className="text-[10px] font-bold text-slate-400">{(c.teams || []).length} Teams</span>
                                                            </div>
                                                        </div>
                                                        <Badge className={cn(
                                                            "text-[8px] uppercase font-black tracking-widest h-5",
                                                            c.status === 'ARM_PENDING' ? "bg-amber-100 text-amber-700" : "bg-blue-100 text-blue-700"
                                                        )}>
                                                            {c.status === 'ARM_PENDING' ? 'ARM' : 'OSP'}
                                                        </Badge>
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        ))
                                    )}
                                </div>
                            </div>

                            {/* Details View */}
                            <div className="lg:col-span-2">
                                {selectedContractor ? (
                                    <Card className="shadow-2xl border-none rounded-3xl overflow-hidden animate-in fade-in slide-in-from-right-8 duration-500">
                                        <CardHeader className="bg-white border-b p-6">
                                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                                                <div>
                                                    <div className="flex items-center gap-3 mb-1">
                                                        <CardTitle className="text-2xl font-black text-slate-900 tracking-tight uppercase">{selectedContractor.name}</CardTitle>
                                                        <Badge variant="outline" className="text-[10px] font-black border-slate-200 text-slate-400 tracking-tighter">
                                                            ID: {selectedContractor.id.slice(-6).toUpperCase()}
                                                        </Badge>
                                                    </div>
                                                    <CardDescription className="font-medium text-slate-400">{selectedContractor.email || 'No email provided'}</CardDescription>
                                                </div>
                                                <div className="flex flex-wrap gap-2">
                                                    <div className="flex gap-1.5 p-1 bg-slate-50 rounded-xl border border-slate-100">
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            onClick={() => {
                                                                setEditData({ ...selectedContractor });
                                                                setIsEditModalOpen(true);
                                                            }}
                                                            className="h-9 w-9 text-slate-400 hover:text-blue-600 hover:bg-white hover:shadow-sm transition-all rounded-lg"
                                                            title="Edit Details"
                                                        >
                                                            <Pencil className="w-4 h-4" />
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            onClick={() => setTeamManagerOpen(true)}
                                                            className="h-9 w-9 text-slate-400 hover:text-indigo-600 hover:bg-white hover:shadow-sm transition-all rounded-lg"
                                                            title="Manage Teams"
                                                        >
                                                            <Users className="w-4 h-4" />
                                                        </Button>
                                                    </div>
                                                    
                                                    <div className="flex gap-2">
                                                        <Button
                                                            variant="outline"
                                                            onClick={() => setIsRejectDialogOpen(true)}
                                                            className="h-10 text-[11px] font-black uppercase tracking-widest text-red-600 border-red-100 hover:bg-red-50 hover:border-red-200 rounded-xl"
                                                            disabled={approveMutation.isPending || rejectMutation.isPending}
                                                        >
                                                            <XCircle className="w-4 h-4 mr-2" />
                                                            Reject
                                                        </Button>
                                                        <Button
                                                            onClick={() => handleApprove(selectedContractor)}
                                                            className="h-10 text-[11px] font-black uppercase tracking-widest bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-lg shadow-emerald-200"
                                                            disabled={approveMutation.isPending || rejectMutation.isPending}
                                                        >
                                                            {approveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle className="w-4 h-4 mr-2" />}
                                                            Authorize
                                                        </Button>
                                                    </div>
                                                </div>
                                            </div>
                                        </CardHeader>
                                        <CardContent className="p-0">
                                            {/* Structured View matching registration workflow */}
                                            <div className="grid grid-cols-1 lg:grid-cols-3 divide-y lg:divide-y-0 lg:divide-x border-b border-slate-100">
                                                {/* Section 1: Info */}
                                                <div className="p-6 space-y-6">
                                                    <h5 className="text-[10px] font-black text-blue-600 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                                                        <Info className="w-3 h-3" /> 01. Profile
                                                    </h5>
                                                    <div className="space-y-4">
                                                        <div className="space-y-1">
                                                            <Label className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">Contractor Name</Label>
                                                            <p className="text-sm font-black text-slate-900 leading-tight">{selectedContractor.name}</p>
                                                        </div>
                                                        <div className="space-y-1">
                                                            <Label className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">NIC / Reg No</Label>
                                                            <p className="text-sm font-black text-slate-700">{selectedContractor.nic || selectedContractor.registrationNumber}</p>
                                                        </div>
                                                        <div className="space-y-1">
                                                            <Label className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">Primary Contact</Label>
                                                            <p className="text-sm font-bold text-slate-700">{selectedContractor.contactNumber || 'N/A'}</p>
                                                        </div>
                                                        <div className="space-y-1">
                                                            <Label className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">Business Address</Label>
                                                            <p className="text-[11px] font-medium text-slate-600 leading-relaxed capitalize whitespace-pre-wrap">{selectedContractor.address?.toLowerCase() || 'N/A'}</p>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Section 2: Financials */}
                                                <div className="p-6 space-y-6 bg-slate-50/50">
                                                    <h5 className="text-[10px] font-black text-blue-600 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                                                        <Banknote className="w-3 h-3" /> 02. Bank & Fees
                                                    </h5>
                                                    <div className="space-y-4">
                                                        <div className="space-y-1">
                                                            <Label className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">Settlement Bank</Label>
                                                            <p className="text-sm font-black text-slate-900">{selectedContractor.bankName || 'N/A'}</p>
                                                        </div>
                                                        <div className="space-y-1">
                                                            <Label className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">Account Number</Label>
                                                            <p className="text-sm font-black font-mono text-blue-700 tracking-widest">{selectedContractor.bankAccountNumber || 'N/A'}</p>
                                                        </div>
                                                        <div className="space-y-1">
                                                            <Label className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">Branch Office</Label>
                                                            <p className="text-sm font-bold text-slate-700">{selectedContractor.bankBranch || 'N/A'}</p>
                                                        </div>
                                                        <div className="flex flex-wrap gap-2 pt-2">
                                                            <Badge className={cn("text-[9px] font-black h-5 px-2", selectedContractor.registrationFeePaid ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700")}>
                                                                FEE: {selectedContractor.registrationFeePaid ? 'PAID' : 'DUE'}
                                                            </Badge>
                                                            <Badge className={cn("text-[8px] font-black h-5 px-2", selectedContractor.agreementSigned ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700")}>
                                                                CONTRACT: {selectedContractor.agreementSigned ? 'SIGNED' : 'PENDING'}
                                                            </Badge>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Section 3: Verified Documents */}
                                                <div className="p-6 space-y-6">
                                                    <h5 className="text-[10px] font-black text-blue-600 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                                                        <FileText className="w-3 h-3" /> 03. Archive
                                                    </h5>
                                                    <div className="grid grid-cols-2 gap-2">
                                                        {[
                                                            { label: 'Profile Photo', url: selectedContractor.photoUrl },
                                                            { label: 'NIC Front', url: selectedContractor.nicFrontUrl },
                                                            { label: 'NIC Back', url: selectedContractor.nicBackUrl },
                                                            { label: 'BR Cert', url: selectedContractor.brCertUrl },
                                                            { label: 'Passbook', url: selectedContractor.bankPassbookUrl },
                                                            { label: 'Payment Slip', url: selectedContractor.registrationFeeSlipUrl },
                                                            { label: 'Police Report', url: selectedContractor.policeReportUrl },
                                                            { label: 'Grama Cert', url: selectedContractor.gramaCertUrl },
                                                        ].map((doc, idx) => (
                                                            <div key={idx} className={cn(
                                                                "group relative flex items-center gap-2 p-2 rounded-xl border transition-all h-10 overflow-hidden cursor-pointer",
                                                                doc.url ? "bg-white border-slate-100 hover:border-blue-300 hover:shadow-sm" : "bg-slate-50 border-dashed border-slate-200 opacity-40 grayscale"
                                                            )}
                                                            onClick={() => doc.url && setPreviewDoc({ label: doc.label, url: doc.url })}
                                                            >
                                                                {doc.url ? (
                                                                    <>
                                                                        <div className="w-5 h-5 rounded-lg bg-blue-50 flex items-center justify-center group-hover:bg-blue-600 transition-colors">
                                                                            <ImageIcon className="w-3 h-3 text-blue-600 group-hover:text-white" />
                                                                        </div>
                                                                        <span className="text-[10px] font-bold text-slate-700 truncate tracking-tight">{doc.label}</span>
                                                                        <div className="absolute right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                            <Eye className="w-3 h-3 text-blue-500" />
                                                                        </div>
                                                                    </>
                                                                ) : (
                                                                    <>
                                                                        <FileText className="w-3 h-3 text-slate-300" />
                                                                        <span className="text-[10px] font-medium text-slate-400 truncate tracking-tight">{doc.label}</span>
                                                                    </>
                                                                )}
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Bottom Panels grid */}
                                            <div className="grid grid-cols-1 lg:grid-cols-3 divide-y lg:divide-y-0 lg:divide-x bg-slate-50/20">
                                                {/* Teams Panel - spans 2 cols */}
                                                <div className="lg:col-span-2 p-6 space-y-6">
                                                    <div className="flex justify-between items-center px-1">
                                                        <h5 className="text-[10px] font-black text-blue-600 uppercase tracking-[0.2em] flex items-center gap-2">
                                                            <Users className="w-3 h-3" /> 04. Manpower & Teams
                                                        </h5>
                                                        <Badge variant="outline" className="text-[9px] font-bold border-slate-200 text-slate-400">
                                                            {(selectedContractor.teams || []).length} Active Units
                                                        </Badge>
                                                    </div>
                                                    
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                        {(selectedContractor.teams || []).length > 0 ? (
                                                            (selectedContractor.teams || []).map((team: Team, tIdx: number) => (
                                                                <div key={tIdx} className="bg-white rounded-2xl border border-slate-100 p-4 hover:border-blue-100 transition-all shadow-sm group">
                                                                    <div className="flex justify-between items-center mb-4 pb-2 border-b border-slate-50">
                                                                        <div className="flex items-center gap-2">
                                                                            <div className="w-2 h-2 rounded-full bg-blue-500" />
                                                                            <span className="text-[11px] font-black text-slate-900 uppercase tracking-tighter">{team.name}</span>
                                                                        </div>
                                                                        {team.sltCode && (
                                                                            <Badge className="bg-emerald-500 text-white border-none text-[8px] font-black h-4 px-1.5 rounded-md">
                                                                                REF: {team.sltCode}
                                                                            </Badge>
                                                                        )}
                                                                    </div>
                                                                    <div className="space-y-2">
                                                                        {(team.members || []).map((m: TeamMember, mIdx: number) => (
                                                                            <div key={mIdx} className="flex justify-between items-center bg-slate-50/50 p-2.5 rounded-xl border border-slate-100 group-hover:bg-white transition-colors">
                                                                                <div className="flex flex-col">
                                                                                    <span className="text-[11px] font-black text-slate-900">{m.name}</span>
                                                                                    <span className="text-[9px] font-bold text-slate-400 font-mono tracking-tighter">{m.nic || 'NO NIC'}</span>
                                                                                </div>
                                                                                <span className="text-[8px] font-black uppercase text-slate-400 tracking-tighter bg-white px-2 py-0.5 rounded border border-slate-100">
                                                                                    {m.designation || 'Staff'}
                                                                                </span>
                                                                            </div>
                                                                        ))}
                                                                        {(team.members || []).length === 0 && (
                                                                            <p className="text-[10px] text-slate-400 italic py-2 px-2">No members defined for this team.</p>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            ))
                                                        ) : (
                                                            <div className="col-span-1 md:col-span-2 text-center py-10 bg-white rounded-3xl border-2 border-dashed border-slate-100">
                                                                <Users className="w-8 h-8 text-slate-200 mx-auto mb-2 opacity-50" />
                                                                <p className="text-xs font-bold text-slate-300 italic">No team data provided.</p>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* History Panel */}
                                                <div className="p-6 space-y-6">
                                                    <h5 className="text-[10px] font-black text-blue-600 uppercase tracking-[0.2em] flex items-center gap-2">
                                                        <Calendar className="w-3 h-3" /> 05. Timeline
                                                    </h5>
                                                    <div className="space-y-8 border-l-2 border-slate-100 ml-1.5 pl-5 pt-2">
                                                        <div className="relative">
                                                            <div className="absolute -left-[23px] top-1 w-3.5 h-3.5 rounded-full bg-emerald-500 ring-4 ring-emerald-50 shadow-[0_0_15px_rgba(16,185,129,0.3)]" />
                                                            <div className="space-y-0.5">
                                                                <p className="text-[11px] font-black text-slate-900 uppercase tracking-tighter">Registration Complete</p>
                                                                <p className="text-[10px] font-bold text-slate-400 tracking-tight">{selectedContractor.createdAt ? new Date(selectedContractor.createdAt).toLocaleString() : 'N/A'}</p>
                                                                <p className="text-[10px] text-slate-500 font-medium leading-relaxed mt-1.5">Documentation verified by contractor system.</p>
                                                            </div>
                                                        </div>
                                                        
                                                        <div className="relative">
                                                            <div className={cn("absolute -left-[23px] top-1 w-3.5 h-3.5 rounded-full ring-4 transition-all duration-500", 
                                                                selectedContractor.armApprovedAt ? "bg-emerald-500 ring-emerald-50 shadow-[0_0_15px_rgba(16,185,129,0.3)]" : "bg-slate-200 ring-slate-100")} />
                                                            <div className="space-y-0.5">
                                                                <p className={cn("text-[11px] font-black uppercase tracking-tighter", selectedContractor.armApprovedAt ? "text-slate-900" : "text-slate-400")}>Regional Review (ARM)</p>
                                                                <p className="text-[10px] font-bold text-slate-400 tracking-tight">
                                                                    {selectedContractor.armApprovedAt ? new Date(selectedContractor.armApprovedAt).toLocaleString() : 'Pending operational check'}
                                                                </p>
                                                            </div>
                                                        </div>
                                                        
                                                        <div className="relative">
                                                            <div className={cn("absolute -left-[23px] top-1 w-3.5 h-3.5 rounded-full ring-4 transition-all duration-500", 
                                                                selectedContractor.ospApprovedAt ? "bg-emerald-500 ring-emerald-50 shadow-[0_0_15px_rgba(16,185,129,0.3)]" : "bg-slate-200 ring-slate-100")} />
                                                            <div className="space-y-0.5">
                                                                <p className={cn("text-[11px] font-black uppercase tracking-tighter", selectedContractor.ospApprovedAt ? "text-slate-900" : "text-slate-400")}>Final Approval (OSP)</p>
                                                                <p className="text-[10px] font-bold text-slate-400 tracking-tight">
                                                                    {selectedContractor.ospApprovedAt ? new Date(selectedContractor.ospApprovedAt).toLocaleString() : 'Waiting for chain of command'}
                                                                </p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                ) : (
                                    <div className="h-[500px] flex flex-col items-center justify-center bg-white rounded-3xl border-2 border-dashed border-slate-100 p-12 text-center animate-pulse">
                                        <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-6">
                                            <ShieldCheck className="w-10 h-10 text-slate-200" />
                                        </div>
                                        <h4 className="text-xl font-black text-slate-900 uppercase tracking-tight">Review Required</h4>
                                        <p className="text-slate-400 max-w-xs mx-auto text-sm mt-3 font-medium">Select a registration from the queue to start the verification workflow.</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </main>

            {/* Approve Dialog */}
            <Dialog open={isApproveDialogOpen} onOpenChange={setIsApproveDialogOpen}>
                <DialogContent className="max-w-md rounded-3xl border-none shadow-2xl">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-black text-slate-900 uppercase tracking-tight">Final Identification</DialogTitle>
                        <DialogDescription className="font-medium text-slate-400">Assign SLT specific reference codes to activate these teams.</DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 my-6">
                        {(selectedContractor?.teams || []).map((team: Team) => (
                            <div key={team.id} className="space-y-2">
                                <Label htmlFor={`code-${team.id}`} className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{team.name}</Label>
                                <Input
                                    id={`code-${team.id}`}
                                    placeholder="e.g. OSP-T1-COL"
                                    value={teamCodes[team.id] || ''}
                                    onChange={(e) => setTeamCodes({ ...teamCodes, [team.id]: e.target.value })}
                                    className="h-12 bg-slate-50 border-slate-100 focus:bg-white rounded-xl font-black placeholder:text-slate-300 transition-all"
                                />
                            </div>
                        ))}
                    </div>

                    <DialogFooter className="gap-2">
                        <Button variant="ghost" className="font-bold text-slate-400 hover:text-slate-900" onClick={() => setIsApproveDialogOpen(false)}>Cancel</Button>
                        <Button
                            onClick={confirmFinalApproval}
                            className="bg-emerald-600 hover:bg-emerald-700 h-10 px-8 text-[11px] font-black uppercase tracking-widest rounded-xl shadow-lg shadow-emerald-100"
                        >
                            Finalize & Activate
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Reject Dialog */}
            <Dialog open={isRejectDialogOpen} onOpenChange={setIsRejectDialogOpen}>
                <DialogContent className="max-w-md rounded-3xl border-none shadow-2xl">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-black text-red-600 uppercase tracking-tight flex items-center gap-2">
                            <XCircle className="w-6 h-6" /> Block Registration
                        </DialogTitle>
                        <DialogDescription className="font-medium text-slate-400">This will notify the contractor. Please be specific about the required changes.</DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 my-6">
                        <div className="space-y-2">
                            <Label htmlFor="rejection-reason" className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Reason for Rejection</Label>
                            <textarea
                                id="rejection-reason"
                                className="w-full min-h-[140px] p-4 rounded-2xl bg-slate-50 border border-slate-100 text-sm font-medium focus:ring-2 focus:ring-red-100 focus:bg-white focus:outline-none transition-all placeholder:text-slate-300"
                                placeholder="Describe exactly what needs fixing (e.g. 'Bank passbook photo is too blurry, please re-scan')..."
                                value={rejectionReason}
                                onChange={(e) => setRejectionReason(e.target.value)}
                            />
                        </div>
                    </div>

                    <DialogFooter className="gap-2 sm:justify-start">
                        <Button
                            onClick={handleReject}
                            className="bg-red-600 hover:bg-red-700 text-white h-10 px-8 text-[11px] font-black uppercase tracking-widest rounded-xl shadow-lg shadow-red-100"
                            disabled={rejectMutation.isPending}
                        >
                            {rejectMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <XCircle className="w-4 h-4 mr-2" />}
                            Confirm Rejection
                        </Button>
                        <Button variant="ghost" className="font-bold text-slate-400" onClick={() => setIsRejectDialogOpen(false)}>Cancel</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Team Manager Overlay */}
            {selectedContractor && (
                <TeamManager
                    isOpen={teamManagerOpen}
                    onClose={() => {
                        setTeamManagerOpen(false);
                        queryClient.invalidateQueries({ queryKey: ['contractor-approvals'] });
                    }}
                    contractorId={selectedContractor.id}
                    contractorName={selectedContractor.name}
                />
            )}

            {/* Doc Preview Modal */}
            <Dialog open={!!previewDoc} onOpenChange={(open) => !open && setPreviewDoc(null)}>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden p-0 flex flex-col bg-slate-900 border-none rounded-none sm:rounded-3xl shadow-2xl">
                    <DialogHeader className="p-4 border-b border-white/5 bg-slate-900 flex flex-row items-center justify-between">
                        <DialogTitle className="text-white font-black uppercase tracking-widest text-[11px]">
                            {previewDoc?.label}
                        </DialogTitle>
                        <Button variant="ghost" size="icon" className="text-white/40 hover:text-white hover:bg-white/10" onClick={() => setPreviewDoc(null)}>
                            <XCircle className="w-5 h-5" />
                        </Button>
                    </DialogHeader>
                    <div className="flex-1 overflow-auto bg-slate-950 flex items-center justify-center relative min-h-[400px]">
                        {previewDoc?.url.endsWith('.pdf') ? (
                            <iframe src={previewDoc.url} className="w-full h-full min-h-[70vh] bg-white" />
                        ) : (
                            <div className="relative w-full h-[70vh]">
                                <Image 
                                    src={previewDoc?.url || ''} 
                                    alt={previewDoc?.label || 'Preview'} 
                                    fill 
                                    unoptimized
                                    className="object-contain p-4" 
                                />
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>

            {/* Quick Edit (Hidden usually, used by the pencil icon) */}
            <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
                <DialogContent className="max-w-2xl rounded-3xl border-none shadow-2xl">
                    <DialogHeader>
                        <DialogTitle className="font-black text-slate-900 uppercase tracking-tight">Rapid Update</DialogTitle>
                        <DialogDescription className="font-medium">Modify record before finalization.</DialogDescription>
                    </DialogHeader>
                    <div className="grid grid-cols-2 gap-4 py-4 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
                        <div className="space-y-1">
                            <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Name</Label>
                            <Input value={editData.name || ''} onChange={e => setEditData({ ...editData, name: e.target.value })} className="bg-slate-50 border-slate-100 rounded-xl font-bold h-11" />
                        </div>
                        <div className="space-y-1">
                            <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Reg No</Label>
                            <Input value={editData.registrationNumber || ''} onChange={e => setEditData({ ...editData, registrationNumber: e.target.value })} className="bg-slate-50 border-slate-100 rounded-xl font-bold h-11" />
                        </div>
                        <div className="col-span-2 space-y-1">
                            <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Address</Label>
                            <Input value={editData.address || ''} onChange={e => setEditData({ ...editData, address: e.target.value })} className="bg-slate-50 border-slate-100 rounded-xl font-bold h-11" />
                        </div>
                        <div className="space-y-1">
                            <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">NIC</Label>
                            <Input value={editData.nic || ''} onChange={e => setEditData({ ...editData, nic: e.target.value })} className="bg-slate-50 border-slate-100 rounded-xl font-bold h-11" />
                        </div>
                        <div className="space-y-1">
                            <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Phone</Label>
                            <Input value={editData.contactNumber || ''} onChange={e => setEditData({ ...editData, contactNumber: e.target.value })} className="bg-slate-50 border-slate-100 rounded-xl font-bold h-11" />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="ghost" className="font-bold text-slate-400" onClick={() => setIsEditModalOpen(false)}>Cancel</Button>
                        <Button className="bg-blue-600 hover:bg-blue-700 text-white font-black uppercase tracking-widest px-8 rounded-xl h-11" onClick={async () => {
                            try {
                                const res = await fetch('/api/contractors', {
                                    method: 'PUT',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify(editData)
                                });
                                if (!res.ok) throw new Error("Update failed");
                                toast.success("Record Refined");
                                queryClient.invalidateQueries({ queryKey: ['contractor-approvals'] });
                                if (selectedContractor) {
                                    setSelectedContractor({ ...selectedContractor, ...editData } as Contractor);
                                }
                                setIsEditModalOpen(false);
                            } catch {
                                toast.error("Update Blocked");
                            }
                        }}>Confirm Update</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
