"use client";

import { ContractorStatus } from "@prisma/client";
import { useState, Suspense } from "react";
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

function ContractorApprovals() {
    const queryClient = useQueryClient();
    const [selectedContractor, setSelectedContractor] = useState<Contractor | null>(null);

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
        <div className="erp-page-wrapper flex-row overflow-hidden">
            <Sidebar />
            <main className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
                <Header />
                <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
                    <div className="max-w-7xl mx-auto space-y-4">

                        {/* Page Header */}
                        <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                            <div className="space-y-0.5">
                                <h1 className="text-lg font-black text-slate-900 tracking-tight">Registration Approvals</h1>
                                <p className="text-slate-500 text-xs font-medium">Synchronized workflow for contractor authorization.</p>
                            </div>
                            <div className="flex items-center gap-2">
                                <Badge className="bg-blue-50 text-blue-700 border border-blue-200 font-black px-2.5 py-0.5 text-[10px] uppercase tracking-wide">
                                    <ShieldCheck className="w-3.5 h-3.5 mr-1" />
                                    {userRole.replace('_', ' ')}
                                </Badge>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

                            {/* Queue Panel */}
                            <div className="lg:col-span-1 space-y-3">
                                <div className="flex items-center justify-between px-1">
                                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Queue ({contractors.length})</h3>
                                    <Badge className="bg-slate-100 text-slate-500 border-none text-[8px] font-bold h-4 px-1.5 opacity-80">Real-time</Badge>
                                </div>
                                
                                <div className="space-y-2">
                                    {contractors.length === 0 ? (
                                        <div className="bg-white p-12 text-center rounded-xl border border-dashed border-slate-200 mt-1">
                                            <Info className="w-8 h-8 text-slate-200 mx-auto mb-2 opacity-50" />
                                            <p className="text-slate-400 text-xs font-bold italic">No registrations pending</p>
                                        </div>
                                    ) : (
                                        contractors.map((c: Contractor) => (
                                            <Card
                                                key={c.id}
                                                className={cn(
                                                    "cursor-pointer transition-all border-slate-200 shadow-sm",
                                                    selectedContractor?.id === c.id ? "border-blue-600 bg-blue-50/10 shadow-md" : "hover:border-slate-300 bg-white"
                                                )}
                                                onClick={() => setSelectedContractor(c)}
                                            >
                                                <CardContent className="p-3">
                                                    <div className="flex justify-between items-start gap-2">
                                                        <div className="flex-1 min-w-0">
                                                            <h4 className="font-bold text-slate-900 text-xs truncate uppercase tracking-tight">{c.name}</h4>
                                                            <div className="flex items-center gap-1.5 mt-0.5">
                                                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-wide">{c.type}</span>
                                                                <span className="text-slate-300">•</span>
                                                                <span className="text-[9px] font-bold text-slate-400">{(c.teams || []).length} Teams</span>
                                                            </div>
                                                        </div>
                                                        <Badge className={cn(
                                                            "text-[8px] uppercase font-black tracking-widest h-4 px-1.5 border-none",
                                                            c.status === 'ARM_PENDING' ? "bg-amber-100 text-amber-700" : "bg-purple-100 text-purple-700"
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

                            {/* Details Panel */}
                            <div className="lg:col-span-2">
                                {selectedContractor ? (
                                    <Card className="shadow-md border-slate-200 rounded-xl overflow-hidden bg-white">
                                        <CardHeader className="bg-white border-b border-slate-100 p-4">
                                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                                                <div>
                                                    <div className="flex items-center gap-2 mb-0.5">
                                                        <CardTitle className="text-base font-black text-slate-900 tracking-tight uppercase">{selectedContractor.name}</CardTitle>
                                                        <Badge variant="outline" className="text-[9px] font-black border-slate-200 text-slate-400 tracking-wider">
                                                            ID: {selectedContractor.id.slice(-6).toUpperCase()}
                                                        </Badge>
                                                    </div>
                                                    <CardDescription className="text-xs font-semibold text-slate-400">{selectedContractor.email || 'No email provided'}</CardDescription>
                                                </div>
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <div className="flex gap-1 p-0.5 bg-slate-50 rounded-lg border border-slate-100">
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            onClick={() => {
                                                                setEditData({ ...selectedContractor });
                                                                setIsEditModalOpen(true);
                                                            }}
                                                            className="h-7 w-7 text-slate-400 hover:text-blue-600 hover:bg-white hover:shadow-sm rounded transition-all"
                                                            title="Edit Details"
                                                        >
                                                            <Pencil className="w-3.5 h-3.5" />
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            onClick={() => setTeamManagerOpen(true)}
                                                            className="h-7 w-7 text-slate-400 hover:text-indigo-600 hover:bg-white hover:shadow-sm rounded transition-all"
                                                            title="Manage Teams"
                                                        >
                                                            <Users className="w-3.5 h-3.5" />
                                                        </Button>
                                                    </div>
                                                    
                                                    <div className="flex gap-1.5">
                                                        <Button
                                                            variant="outline"
                                                            onClick={() => setIsRejectDialogOpen(true)}
                                                            className="h-7 text-[10px] font-black uppercase tracking-wider text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300 rounded-lg px-3"
                                                            disabled={approveMutation.isPending || rejectMutation.isPending}
                                                        >
                                                            <XCircle className="w-3.5 h-3.5 mr-1" />
                                                            Reject
                                                        </Button>
                                                        <Button
                                                            onClick={() => handleApprove(selectedContractor)}
                                                            className="h-7 text-[10px] font-black uppercase tracking-wider bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg px-3 shadow-sm"
                                                            disabled={approveMutation.isPending || rejectMutation.isPending}
                                                        >
                                                            {approveMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <CheckCircle className="w-3.5 h-3.5 mr-1" />}
                                                            Authorize
                                                        </Button>
                                                    </div>
                                                </div>
                                            </div>
                                        </CardHeader>
                                        <CardContent className="p-0">
                                            
                                            {/* Three-Column Details Grid */}
                                            <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-slate-100 border-b border-slate-100">
                                                
                                                {/* Profile Block */}
                                                <div className="p-4 space-y-3">
                                                    <h5 className="text-[10px] font-black text-blue-600 uppercase tracking-widest flex items-center gap-1.5">
                                                        <Info className="w-3 h-3" /> 01. Profile
                                                    </h5>
                                                    <div className="space-y-2.5">
                                                        <div className="space-y-0.5">
                                                            <Label className="text-[9px] text-slate-400 font-bold uppercase tracking-tight">Contractor Name</Label>
                                                            <p className="text-xs font-black text-slate-900 leading-tight">{selectedContractor.name}</p>
                                                        </div>
                                                        <div className="space-y-0.5">
                                                            <Label className="text-[9px] text-slate-400 font-bold uppercase tracking-tight">NIC / Reg No</Label>
                                                            <p className="text-xs font-black text-slate-700">{selectedContractor.nic || selectedContractor.registrationNumber}</p>
                                                        </div>
                                                        <div className="space-y-0.5">
                                                            <Label className="text-[9px] text-slate-400 font-bold uppercase tracking-tight">Primary Contact</Label>
                                                            <p className="text-xs font-bold text-slate-700">{selectedContractor.contactNumber || 'N/A'}</p>
                                                        </div>
                                                        <div className="space-y-0.5">
                                                            <Label className="text-[9px] text-slate-400 font-bold uppercase tracking-tight">Business Address</Label>
                                                            <p className="text-[10px] font-medium text-slate-600 leading-tight capitalize whitespace-pre-wrap">{selectedContractor.address?.toLowerCase() || 'N/A'}</p>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Finance Block */}
                                                <div className="p-4 space-y-3 bg-slate-50/30">
                                                    <h5 className="text-[10px] font-black text-blue-600 uppercase tracking-widest flex items-center gap-1.5">
                                                        <Banknote className="w-3 h-3" /> 02. Settlement
                                                    </h5>
                                                    <div className="space-y-2.5">
                                                        <div className="space-y-0.5">
                                                            <Label className="text-[9px] text-slate-400 font-bold uppercase tracking-tight">Settlement Bank</Label>
                                                            <p className="text-xs font-black text-slate-900">{selectedContractor.bankName || 'N/A'}</p>
                                                        </div>
                                                        <div className="space-y-0.5">
                                                            <Label className="text-[9px] text-slate-400 font-bold uppercase tracking-tight">Account Number</Label>
                                                            <p className="text-xs font-black font-mono text-blue-700 tracking-wider">{selectedContractor.bankAccountNumber || 'N/A'}</p>
                                                        </div>
                                                        <div className="space-y-0.5">
                                                            <Label className="text-[9px] text-slate-400 font-bold uppercase tracking-tight">Branch Office</Label>
                                                            <p className="text-xs font-bold text-slate-700">{selectedContractor.bankBranch || 'N/A'}</p>
                                                        </div>
                                                        <div className="flex flex-wrap gap-1.5 pt-1">
                                                            <Badge className={cn("text-[8px] font-black px-1.5 py-0.2 h-4 border-none", selectedContractor.registrationFeePaid ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700")}>
                                                                FEE: {selectedContractor.registrationFeePaid ? 'PAID' : 'DUE'}
                                                            </Badge>
                                                            <Badge className={cn("text-[8px] font-black px-1.5 py-0.2 h-4 border-none", selectedContractor.agreementSigned ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700")}>
                                                                CONTRACT: {selectedContractor.agreementSigned ? 'SIGNED' : 'PENDING'}
                                                            </Badge>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Verified Documents Block */}
                                                <div className="p-4 space-y-3">
                                                    <h5 className="text-[10px] font-black text-blue-600 uppercase tracking-widest flex items-center gap-1.5">
                                                        <FileText className="w-3 h-3" /> 03. Archive
                                                    </h5>
                                                    <div className="grid grid-cols-2 gap-1.5">
                                                        {[
                                                            { label: 'Photo', url: selectedContractor.photoUrl },
                                                            { label: 'NIC Front', url: selectedContractor.nicFrontUrl },
                                                            { label: 'NIC Back', url: selectedContractor.nicBackUrl },
                                                            { label: 'BR Cert', url: selectedContractor.brCertUrl },
                                                            { label: 'Passbook', url: selectedContractor.bankPassbookUrl },
                                                            { label: 'Fee Slip', url: selectedContractor.registrationFeeSlipUrl },
                                                            { label: 'Police Rep', url: selectedContractor.policeReportUrl },
                                                            { label: 'Grama Cert', url: selectedContractor.gramaCertUrl },
                                                        ].map((doc, idx) => (
                                                            <div key={idx} className={cn(
                                                                "group relative flex items-center gap-1.5 p-1 rounded-lg border transition-all h-8 overflow-hidden cursor-pointer",
                                                                doc.url ? "bg-white border-slate-200 hover:border-blue-300 hover:bg-blue-50/20" : "bg-slate-50/50 border-dashed border-slate-100 opacity-40 grayscale"
                                                            )}
                                                            onClick={() => doc.url && setPreviewDoc({ label: doc.label, url: doc.url })}
                                                            >
                                                                {doc.url ? (
                                                                    <>
                                                                        <div className="w-4 h-4 rounded bg-blue-50 flex items-center justify-center group-hover:bg-blue-600 transition-colors">
                                                                            <ImageIcon className="w-2.5 h-2.5 text-blue-600 group-hover:text-white" />
                                                                        </div>
                                                                        <span className="text-[9px] font-bold text-slate-700 truncate tracking-tight">{doc.label}</span>
                                                                        <div className="absolute right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                            <Eye className="w-2.5 h-2.5 text-blue-500" />
                                                                        </div>
                                                                    </>
                                                                ) : (
                                                                    <>
                                                                        <FileText className="w-2.5 h-2.5 text-slate-300" />
                                                                        <span className="text-[9px] font-medium text-slate-400 truncate tracking-tight">{doc.label}</span>
                                                                    </>
                                                                )}
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Teams & Timeline Split */}
                                            <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-slate-100 bg-slate-50/10">
                                                
                                                {/* Active Units */}
                                                <div className="md:col-span-2 p-4 space-y-3">
                                                    <div className="flex justify-between items-center px-0.5">
                                                        <h5 className="text-[10px] font-black text-blue-600 uppercase tracking-widest flex items-center gap-1.5">
                                                            <Users className="w-3 h-3" /> 04. Teams
                                                        </h5>
                                                        <Badge variant="outline" className="text-[8px] font-bold border-slate-200 text-slate-400 h-4 px-1.5">
                                                            {(selectedContractor.teams || []).length} Active
                                                        </Badge>
                                                    </div>
                                                    
                                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                        {(selectedContractor.teams || []).length > 0 ? (
                                                            (selectedContractor.teams || []).map((team: Team, tIdx: number) => (
                                                                <div key={tIdx} className="bg-white rounded-lg border border-slate-200 p-2.5 shadow-sm group">
                                                                    <div className="flex justify-between items-center mb-2 pb-1 border-b border-slate-50">
                                                                        <div className="flex items-center gap-1.5">
                                                                            <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                                                                            <span className="text-[10px] font-black text-slate-900 uppercase tracking-tight">{team.name}</span>
                                                                        </div>
                                                                        {team.sltCode && (
                                                                            <Badge className="bg-emerald-500 text-white border-none text-[8px] font-black h-4 px-1.5 rounded">
                                                                                REF: {team.sltCode}
                                                                            </Badge>
                                                                        )}
                                                                    </div>
                                                                    <div className="space-y-1">
                                                                        {(team.members || []).map((m: TeamMember, mIdx: number) => (
                                                                            <div key={mIdx} className="flex justify-between items-center bg-slate-50/40 p-1.5 rounded border border-slate-100 group-hover:bg-white transition-colors">
                                                                                <div className="flex flex-col">
                                                                                    <span className="text-[10px] font-black text-slate-950">{m.name}</span>
                                                                                    <span className="text-[8px] font-bold text-slate-400 font-mono tracking-tight">{m.nic || 'NO NIC'}</span>
                                                                                </div>
                                                                                <span className="text-[8px] font-black uppercase text-slate-400 tracking-tighter bg-white px-1 py-0.2 rounded border border-slate-100">
                                                                                    {m.designation || 'Staff'}
                                                                                </span>
                                                                            </div>
                                                                        ))}
                                                                        {(team.members || []).length === 0 && (
                                                                            <p className="text-[9px] text-slate-400 italic py-1 px-1">No members.</p>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            ))
                                                        ) : (
                                                            <div className="col-span-1 sm:col-span-2 text-center py-6 bg-white rounded-xl border border-dashed border-slate-200">
                                                                <Users className="w-6 h-6 text-slate-200 mx-auto mb-1.5 opacity-50" />
                                                                <p className="text-[10px] font-bold text-slate-300 italic">No team data provided.</p>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Timeline Block */}
                                                <div className="p-4 space-y-3">
                                                    <h5 className="text-[10px] font-black text-blue-600 uppercase tracking-widest flex items-center gap-1.5">
                                                        <Calendar className="w-3 h-3" /> 05. Timeline
                                                    </h5>
                                                    <div className="space-y-4 border-l-2 border-slate-100 ml-1.5 pl-3 pt-1">
                                                        <div className="relative">
                                                            <div className="absolute -left-[17px] top-1 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-emerald-50" />
                                                            <div className="space-y-0.5">
                                                                <p className="text-[9px] font-black text-slate-900 uppercase tracking-tight">Registration Complete</p>
                                                                <p className="text-[8px] font-bold text-slate-400">{selectedContractor.createdAt ? new Date(selectedContractor.createdAt).toLocaleString() : 'N/A'}</p>
                                                            </div>
                                                        </div>
                                                        
                                                        <div className="relative">
                                                            <div className={cn("absolute -left-[17px] top-1 w-2.5 h-2.5 rounded-full ring-2 transition-all duration-500", 
                                                                selectedContractor.armApprovedAt ? "bg-emerald-500 ring-emerald-50" : "bg-slate-200 ring-slate-100")} />
                                                            <div className="space-y-0.5">
                                                                <p className={cn("text-[9px] font-black uppercase tracking-tight", selectedContractor.armApprovedAt ? "text-slate-900" : "text-slate-400")}>Regional Review (ARM)</p>
                                                                <p className="text-[8px] font-bold text-slate-400">
                                                                    {selectedContractor.armApprovedAt ? new Date(selectedContractor.armApprovedAt).toLocaleString() : 'Pending Operational Check'}
                                                                </p>
                                                            </div>
                                                        </div>
                                                        
                                                        <div className="relative">
                                                            <div className={cn("absolute -left-[17px] top-1 w-2.5 h-2.5 rounded-full ring-2 transition-all duration-500", 
                                                                selectedContractor.ospApprovedAt ? "bg-emerald-500 ring-emerald-50" : "bg-slate-200 ring-slate-100")} />
                                                            <div className="space-y-0.5">
                                                                <p className={cn("text-[9px] font-black uppercase tracking-tight", selectedContractor.ospApprovedAt ? "text-slate-900" : "text-slate-400")}>Final Approval (OSP)</p>
                                                                <p className="text-[8px] font-bold text-slate-400">
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
                                    <div className="h-[400px] flex flex-col items-center justify-center bg-white rounded-xl border border-dashed border-slate-200 p-8 text-center animate-pulse">
                                        <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                                            <ShieldCheck className="w-8 h-8 text-slate-200" />
                                        </div>
                                        <h4 className="text-sm font-black text-slate-900 uppercase tracking-wider">Review Required</h4>
                                        <p className="text-slate-400 max-w-xs mx-auto text-xs mt-2 font-medium">Select a registration from the queue to start the verification workflow.</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </main>

            {/* Approve Dialog */}
            <Dialog open={isApproveDialogOpen} onOpenChange={setIsApproveDialogOpen}>
                <DialogContent className="max-w-md rounded-2xl border-none shadow-xl">
                    <DialogHeader>
                        <DialogTitle className="text-base font-black text-slate-900 uppercase tracking-tight">Final Identification</DialogTitle>
                        <DialogDescription className="text-xs font-semibold text-slate-500">Assign SLT specific reference codes to activate these teams.</DialogDescription>
                    </DialogHeader>

                    <div className="space-y-3 my-4">
                        {(selectedContractor?.teams || []).map((team: Team) => (
                            <div key={team.id} className="space-y-1">
                                <Label htmlFor={`code-${team.id}`} className="text-[9px] font-black text-slate-400 uppercase tracking-wider ml-1">{team.name}</Label>
                                <Input
                                    id={`code-${team.id}`}
                                    placeholder="e.g. OSP-T1-COL"
                                    value={teamCodes[team.id] || ''}
                                    onChange={(e) => setTeamCodes({ ...teamCodes, [team.id]: e.target.value })}
                                    className="h-10 bg-slate-50 border-slate-100 rounded-lg text-xs"
                                />
                            </div>
                        ))}
                    </div>

                    <DialogFooter className="gap-2">
                        <Button variant="ghost" className="font-bold text-xs text-slate-400 hover:text-slate-900 h-9 px-4 rounded-lg" onClick={() => setIsApproveDialogOpen(false)}>Cancel</Button>
                        <Button
                            onClick={confirmFinalApproval}
                            className="bg-emerald-600 hover:bg-emerald-700 h-9 px-4 text-xs font-bold text-white rounded-lg shadow-sm"
                        >
                            Finalize & Activate
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Reject Dialog */}
            <Dialog open={isRejectDialogOpen} onOpenChange={setIsRejectDialogOpen}>
                <DialogContent className="max-w-md rounded-2xl border-none shadow-xl">
                    <DialogHeader>
                        <DialogTitle className="text-base font-black text-red-600 uppercase tracking-tight flex items-center gap-1.5">
                            <XCircle className="w-5 h-5" /> Block Registration
                        </DialogTitle>
                        <DialogDescription className="text-xs font-medium text-slate-500">This will notify the contractor. Please be specific about the required changes.</DialogDescription>
                    </DialogHeader>

                    <div className="space-y-3 my-4">
                        <div className="space-y-1">
                            <Label htmlFor="rejection-reason" className="text-[9px] font-black text-slate-400 uppercase tracking-wider ml-1">Reason for Rejection</Label>
                            <textarea
                                id="rejection-reason"
                                className="w-full min-h-[120px] p-3 rounded-lg bg-slate-50 border border-slate-100 text-xs font-medium focus:ring-1 focus:ring-red-100 focus:bg-white focus:outline-none transition-all placeholder:text-slate-300"
                                placeholder="Describe exactly what needs fixing (e.g. 'Bank passbook photo is too blurry, please re-scan')..."
                                value={rejectionReason}
                                onChange={(e) => setRejectionReason(e.target.value)}
                            />
                        </div>
                    </div>

                    <DialogFooter className="gap-2 sm:justify-start">
                        <Button
                            onClick={handleReject}
                            className="bg-red-600 hover:bg-red-700 text-white h-9 px-4 text-xs font-bold rounded-lg shadow-sm"
                            disabled={rejectMutation.isPending}
                        >
                            {rejectMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <XCircle className="w-3.5 h-3.5 mr-1.5" />}
                            Confirm Rejection
                        </Button>
                        <Button variant="ghost" className="font-bold text-xs text-slate-400 h-9 px-4 rounded-lg" onClick={() => setIsRejectDialogOpen(false)}>Cancel</Button>
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
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden p-0 flex flex-col bg-slate-900 border-none rounded-none sm:rounded-2xl shadow-2xl">
                    <DialogHeader className="p-3 border-b border-white/5 bg-slate-900 flex flex-row items-center justify-between">
                        <DialogTitle className="text-white font-black uppercase tracking-wider text-[10px]">
                            {previewDoc?.label}
                        </DialogTitle>
                        <Button variant="ghost" size="icon" className="text-white/40 hover:text-white hover:bg-white/10 h-7 w-7 rounded-lg" onClick={() => setPreviewDoc(null)}>
                            <XCircle className="w-4 h-4" />
                        </Button>
                    </DialogHeader>
                    <div className="flex-1 overflow-auto bg-slate-955 flex items-center justify-center relative min-h-[400px]">
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

            {/* Quick Edit Dialog */}
            <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
                <DialogContent className="max-w-2xl rounded-2xl border-none shadow-xl">
                    <DialogHeader>
                        <DialogTitle className="font-black text-slate-900 uppercase tracking-tight text-base">Rapid Update</DialogTitle>
                        <DialogDescription className="text-xs font-semibold text-slate-500">Modify record before finalization.</DialogDescription>
                    </DialogHeader>
                    <div className="grid grid-cols-2 gap-3 py-3 max-h-[50vh] overflow-y-auto pr-1">
                        <div className="space-y-1">
                            <Label className="text-[9px] font-black text-slate-400 uppercase tracking-wider ml-1">Name</Label>
                            <Input value={editData.name || ''} onChange={e => setEditData({ ...editData, name: e.target.value })} className="bg-slate-50 border-slate-100 rounded-lg h-10 text-xs" />
                        </div>
                        <div className="space-y-1">
                            <Label className="text-[9px] font-black text-slate-400 uppercase tracking-wider ml-1">Reg No</Label>
                            <Input value={editData.registrationNumber || ''} onChange={e => setEditData({ ...editData, registrationNumber: e.target.value })} className="bg-slate-50 border-slate-100 rounded-lg h-10 text-xs" />
                        </div>
                        <div className="col-span-2 space-y-1">
                            <Label className="text-[9px] font-black text-slate-400 uppercase tracking-wider ml-1">Address</Label>
                            <Input value={editData.address || ''} onChange={e => setEditData({ ...editData, address: e.target.value })} className="bg-slate-50 border-slate-100 rounded-lg h-10 text-xs" />
                        </div>
                        <div className="space-y-1">
                            <Label className="text-[9px] font-black text-slate-400 uppercase tracking-wider ml-1">NIC</Label>
                            <Input value={editData.nic || ''} onChange={e => setEditData({ ...editData, nic: e.target.value })} className="bg-slate-50 border-slate-100 rounded-lg h-10 text-xs" />
                        </div>
                        <div className="space-y-1">
                            <Label className="text-[9px] font-black text-slate-400 uppercase tracking-wider ml-1">Phone</Label>
                            <Input value={editData.contactNumber || ''} onChange={e => setEditData({ ...editData, contactNumber: e.target.value })} className="bg-slate-50 border-slate-100 rounded-lg h-10 text-xs" />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="ghost" className="font-bold text-xs text-slate-400 h-9 px-4 rounded-lg" onClick={() => setIsEditModalOpen(false)}>Cancel</Button>
                        <Button className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs uppercase px-6 rounded-lg h-9 shadow-sm" onClick={async () => {
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

export default function ContractorApprovalsPage() {
    return (
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-background text-foreground text-xs font-medium">Loading Approvals...</div>}>
            <ContractorApprovals />
        </Suspense>
    );
}
