"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { CheckCircle, XCircle, Loader2, Building2, Users, FileText, Banknote, Calendar, ShieldCheck, Pencil, Image as ImageIcon, ExternalLink } from "lucide-react";
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import TeamManager from "../TeamManager";

export default function ContractorApprovalsPage() {
    const queryClient = useQueryClient();
    const [selectedContractor, setSelectedContractor] = useState<any>(null);

    // Get current user from localStorage
    const user = typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('user') || '{}') : {};
    const userRole = user.role || '';

    const [isApproveDialogOpen, setIsApproveDialogOpen] = useState(false);
    const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false);
    const [rejectionReason, setRejectionReason] = useState("");
    const [teamCodes, setTeamCodes] = useState<Record<string, string>>({});
    const [teamManagerOpen, setTeamManagerOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editData, setEditData] = useState<any>({});

    // Fetch contractors pending approval
    const { data: contractors = [], isLoading } = useQuery({
        queryKey: ['contractor-approvals'],
        queryFn: async () => {
            const res = await fetch('/api/contractors?page=1&limit=1000');
            if (!res.ok) throw new Error('Failed to fetch contractors');
            const data = await res.json();
            const contractorsList = Array.isArray(data.contractors) ? data.contractors : [];
            // Filter only those pending ARM or OSP approval
            return contractorsList.filter((c: any) => c.status === 'ARM_PENDING' || c.status === 'OSP_PENDING');
        }
    });

    const { data: opmcs = [] } = useQuery({
        queryKey: ['opmcs'],
        queryFn: async () => {
            const res = await fetch('/api/opmc');
            if (!res.ok) return [];
            return res.json();
        }
    });

    const approveMutation = useMutation({
        mutationFn: async ({ id, status, approverId, teams }: any) => {
            const res = await fetch('/api/contractors', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id,
                    status,
                    teams,
                    ...(userRole === 'AREA_MANAGER' ? { armApprovedById: approverId, armApprovedAt: new Date() } : {}),
                    ...(userRole === 'OSP_MANAGER' ? { ospApprovedById: approverId, ospApprovedAt: new Date() } : {})
                })
            });
            if (!res.ok) throw new Error('Failed to approve');
            return res.json();
        },
        onSuccess: () => {
            toast.success('Contractor approved successfully');
            queryClient.invalidateQueries({ queryKey: ['contractor-approvals'] });
            setSelectedContractor(null);
        }
    });

    const rejectMutation = useMutation({
        mutationFn: async ({ id, reason, userId }: any) => {
            const res = await fetch('/api/contractors', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id,
                    status: 'REJECTED',
                    rejectionReason: reason,
                    rejectionById: userId,
                    rejectedAt: new Date()
                })
            });
            if (!res.ok) throw new Error('Failed to reject');
            return res.json();
        },
        onSuccess: () => {
            toast.success('Contractor registration rejected');
            queryClient.invalidateQueries({ queryKey: ['contractor-approvals'] });
            setSelectedContractor(null);
            setIsRejectDialogOpen(false);
            setRejectionReason("");
        }
    });

    const handleApprove = (contractor: any) => {
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
            (contractor.teams || []).forEach((t: any) => {
                initialCodes[t.id] = t.sltCode || '';
            });
            setTeamCodes(initialCodes);
            setIsApproveDialogOpen(true);
        } else if (nextStatus) {
            approveMutation.mutate({ id: contractor.id, status: nextStatus, approverId: user.id });
        }
    };

    const confirmFinalApproval = () => {
        const teamsToUpdate = selectedContractor.teams.map((t: any) => ({
            ...t,
            sltCode: teamCodes[t.id]
        }));

        // Validation: If SOD, all teams must have a code?
        if (selectedContractor.type === 'SOD') {
            const missingCode = teamsToUpdate.some((t: any) => !t.sltCode);
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
                                <h1 className="text-2xl font-bold text-slate-900">Contractor Approvals</h1>
                                <p className="text-slate-500">Review and authorize new contractor registrations.</p>
                            </div>
                            <div className="flex items-center gap-2">
                                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-100 px-3 py-1 capitalize">
                                    Role: {userRole.replace('_', ' ')}
                                </Badge>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                            {/* List of Pending Contractors */}
                            <div className="lg:col-span-1 space-y-4">
                                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-2">Pending Review ({contractors.length})</h3>
                                {contractors.length === 0 ? (
                                    <div className="bg-white p-12 text-center rounded-xl border border-dashed border-slate-200">
                                        <p className="text-slate-400 text-sm">No pending approvals</p>
                                    </div>
                                ) : (
                                    contractors.map((c: any) => (
                                        <Card
                                            key={c.id}
                                            className={cn(
                                                "cursor-pointer transition-all hover:shadow-md border-2",
                                                selectedContractor?.id === c.id ? "border-blue-500 bg-blue-50/10" : "border-transparent"
                                            )}
                                            onClick={() => setSelectedContractor(c)}
                                        >
                                            <CardContent className="p-4">
                                                <div className="flex justify-between items-start">
                                                    <div>
                                                        <h4 className="font-bold text-slate-800">{c.name}</h4>
                                                        <p className="text-xs text-slate-500 mt-1">
                                                            {c.type} Contractor • {(c.teams || []).length} Teams
                                                        </p>
                                                    </div>
                                                    <Badge className={cn(
                                                        "text-[10px] uppercase font-bold",
                                                        c.status === 'ARM_PENDING' ? "bg-amber-100 text-amber-700" : "bg-blue-100 text-blue-700"
                                                    )}>
                                                        {c.status === 'ARM_PENDING' ? 'Waiting for ARM' : 'Waiting for OSP'}
                                                    </Badge>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    ))
                                )}
                            </div>

                            {/* Details View */}
                            <div className="lg:col-span-2">
                                {selectedContractor ? (
                                    <Card className="shadow-lg border-slate-200 animate-in fade-in slide-in-from-right-4 duration-300">
                                        <CardHeader className="border-b bg-slate-50/50">
                                            <div className="flex justify-between items-center">
                                                <div>
                                                    <CardTitle className="text-xl">{selectedContractor.name}</CardTitle>
                                                    <CardDescription>{selectedContractor.email}</CardDescription>
                                                </div>
                                                <div className="flex gap-2">
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => {
                                                            setEditData({ ...selectedContractor });
                                                            setIsEditModalOpen(true);
                                                        }}
                                                        className="text-slate-500 hover:text-blue-600 hover:bg-blue-50"
                                                    >
                                                        <Pencil className="w-4 h-4 mr-2" />
                                                        Edit info
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => setTeamManagerOpen(true)}
                                                        className="text-slate-500 hover:text-indigo-600 hover:bg-indigo-50"
                                                    >
                                                        <Users className="w-4 h-4 mr-2" />
                                                        Manage Teams
                                                    </Button>
                                                    <Separator orientation="vertical" className="h-8 mx-1" />
                                                    <Button
                                                        variant="outline"
                                                        onClick={() => setIsRejectDialogOpen(true)}
                                                        className="text-red-600 border-red-200 hover:bg-red-50"
                                                        disabled={approveMutation.isPending || rejectMutation.isPending}
                                                    >
                                                        <XCircle className="w-4 h-4 mr-2" />
                                                        Reject
                                                    </Button>
                                                    <Button
                                                        onClick={() => handleApprove(selectedContractor)}
                                                        className="bg-green-600 hover:bg-green-700 font-bold"
                                                        disabled={approveMutation.isPending || rejectMutation.isPending}
                                                    >
                                                        {approveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle className="w-4 h-4 mr-2" />}
                                                        Approve
                                                    </Button>
                                                </div>
                                            </div>
                                        </CardHeader>
                                        <CardContent className="p-0">
                                            <div className="grid grid-cols-2">
                                                <div className="p-6 border-r space-y-6">
                                                    <section>
                                                        <h5 className="text-[10px] font-bold text-slate-400 uppercase mb-3 flex items-center gap-2">
                                                            <Building2 className="w-3 h-3" /> Basic Information
                                                        </h5>
                                                        <div className="space-y-3">
                                                            <div className="flex justify-between text-sm">
                                                                <span className="text-slate-500">NIC:</span>
                                                                <span className="font-medium">{selectedContractor.nic || 'N/A'}</span>
                                                            </div>
                                                            <div className="flex justify-between text-sm">
                                                                <span className="text-slate-500">Reg No:</span>
                                                                <span className="font-medium">{selectedContractor.registrationNumber || 'N/A'}</span>
                                                            </div>
                                                            <div className="flex justify-between text-sm">
                                                                <span className="text-slate-500">Contact:</span>
                                                                <span className="font-medium">{selectedContractor.contactNumber}</span>
                                                            </div>
                                                            <div className="flex flex-col gap-1 text-sm pt-2">
                                                                <span className="text-slate-500">Address:</span>
                                                                <span className="font-medium leading-relaxed">{selectedContractor.address}</span>
                                                            </div>
                                                        </div>
                                                    </section>

                                                    <section>
                                                        <h5 className="text-[10px] font-bold text-slate-400 uppercase mb-3 flex items-center gap-2">
                                                            <Banknote className="w-3 h-3" /> Financial Details
                                                        </h5>
                                                        <div className="space-y-3 p-3 bg-slate-50 rounded-lg border">
                                                            <div className="flex justify-between text-sm">
                                                                <span className="text-slate-500">Bank:</span>
                                                                <span className="font-medium">{selectedContractor.bankName || 'N/A'}</span>
                                                            </div>
                                                            <div className="flex justify-between text-sm">
                                                                <span className="text-slate-500">Account:</span>
                                                                <span className="font-medium font-mono">{selectedContractor.bankAccountNumber || 'N/A'}</span>
                                                            </div>
                                                        </div>
                                                    </section>

                                                    <section>
                                                        <h5 className="text-[10px] font-bold text-slate-400 uppercase mb-3 flex items-center gap-2">
                                                            <FileText className="w-3 h-3" /> Documents
                                                        </h5>
                                                        <div className="grid grid-cols-2 gap-2">
                                                            {[
                                                                { label: 'NIC Front', url: selectedContractor.nicFrontUrl },
                                                                { label: 'NIC Back', url: selectedContractor.nicBackUrl },
                                                                { label: 'BR Cert', url: selectedContractor.brCertUrl },
                                                                { label: 'Passbook', url: selectedContractor.bankPassbookUrl },
                                                                { label: 'Police Report', url: selectedContractor.policeReportUrl },
                                                                { label: 'Grama Cert', url: selectedContractor.gramaCertUrl },
                                                            ].map((doc, idx) => (
                                                                doc.url ? (
                                                                    <a key={idx} href={doc.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 p-2 bg-white border rounded text-[10px] hover:bg-slate-50 transition-colors">
                                                                        <ImageIcon className="w-3 h-3 text-blue-500" />
                                                                        <span className="truncate flex-1">{doc.label}</span>
                                                                        <ExternalLink className="w-2.5 h-2.5 opacity-50" />
                                                                    </a>
                                                                ) : (
                                                                    <div key={idx} className="flex items-center gap-2 p-2 bg-slate-50 border border-dashed rounded text-[10px] opacity-50 grayscale">
                                                                        <ImageIcon className="w-3 h-3" />
                                                                        <span className="truncate">{doc.label} (N/A)</span>
                                                                    </div>
                                                                )
                                                            ))}
                                                        </div>
                                                    </section>
                                                </div>
                                                <div className="p-6 space-y-6">
                                                    <section>
                                                        <h5 className="text-[10px] font-bold text-slate-400 uppercase mb-3 flex items-center gap-2">
                                                            <Users className="w-3 h-3" /> Team Structure
                                                        </h5>
                                                        <div className="space-y-4 max-h-80 overflow-y-auto pr-2">
                                                            {(selectedContractor.teams || []).length > 0 ? (
                                                                selectedContractor.teams.map((team: any, tIdx: number) => (
                                                                    <div key={tIdx} className="space-y-2">
                                                                        <div className="flex justify-between items-center bg-slate-50 p-2 rounded-lg border border-slate-100">
                                                                            <span className="text-xs font-bold text-slate-700">{team.name}</span>
                                                                            {team.sltCode && (
                                                                                <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-emerald-200 text-[10px]">
                                                                                    SLT: {team.sltCode}
                                                                                </Badge>
                                                                            )}
                                                                        </div>
                                                                        <div className="pl-4 space-y-1">
                                                                            {(team.members || []).map((m: any, mIdx: number) => (
                                                                                <div key={mIdx} className="flex items-center gap-2 text-[10px] text-slate-500">
                                                                                    <div className="w-1 h-1 rounded-full bg-slate-300" />
                                                                                    <span>{m.name} ({m.designation})</span>
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                    </div>
                                                                ))
                                                            ) : (
                                                                <p className="text-xs text-slate-400 italic">No teams registered</p>
                                                            )}
                                                        </div>
                                                    </section>

                                                    <section className="pt-4 border-t">
                                                        <h5 className="text-[10px] font-bold text-slate-400 uppercase mb-3 flex items-center gap-2">
                                                            <Calendar className="w-3 h-3" /> Workflow History
                                                        </h5>
                                                        <div className="space-y-4">
                                                            <div className="flex items-center gap-4">
                                                                <div className="w-2 h-2 rounded-full bg-green-500 ring-4 ring-green-100" />
                                                                <div className="flex-1">
                                                                    <p className="text-xs font-bold text-slate-700">Form Submitted</p>
                                                                    <p className="text-[10px] text-slate-400">{selectedContractor.updatedAt ? new Date(selectedContractor.updatedAt).toLocaleString() : 'N/A'}</p>
                                                                </div>
                                                            </div>
                                                            <div className="flex items-center gap-4">
                                                                <div className={cn("w-2 h-2 rounded-full ring-4", selectedContractor.armApprovedAt ? "bg-green-500 ring-green-100" : "bg-slate-200 ring-slate-100")} />
                                                                <div className="flex-1">
                                                                    <p className="text-xs font-bold text-slate-700">ARM Approval</p>
                                                                    <p className="text-[10px] text-slate-400">
                                                                        {selectedContractor.armApprovedAt ? new Date(selectedContractor.armApprovedAt).toLocaleString() : 'Pending review by Area Manager'}
                                                                    </p>
                                                                </div>
                                                            </div>
                                                            <div className="flex items-center gap-4">
                                                                <div className={cn("w-2 h-2 rounded-full ring-4", selectedContractor.ospApprovedAt ? "bg-green-500 ring-green-100" : "bg-slate-200 ring-slate-100")} />
                                                                <div className="flex-1">
                                                                    <p className="text-xs font-bold text-slate-700">OSP Manager Final Authorization</p>
                                                                    <p className="text-[10px] text-slate-400">
                                                                        {selectedContractor.ospApprovedAt ? new Date(selectedContractor.ospApprovedAt).toLocaleString() : 'Waiting for ARM approval'}
                                                                    </p>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </section>
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                ) : (
                                    <div className="h-[500px] flex flex-col items-center justify-center bg-white rounded-xl border-2 border-dashed border-slate-200 p-12 text-center">
                                        <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                                            <ShieldCheck className="w-8 h-8 text-slate-200" />
                                        </div>
                                        <h4 className="text-lg font-bold text-slate-800">Review Required</h4>
                                        <p className="text-slate-400 max-w-xs mx-auto text-sm mt-2">Select a contractor from the list to view their full registration details and authorize them.</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </main>

            <Dialog open={isApproveDialogOpen} onOpenChange={setIsApproveDialogOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Assign SLT Identification Codes</DialogTitle>
                        <DialogDescription>
                            Enter the identification codes provided by SLT for each team. These codes are required for SOD assignments.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-6 my-4">
                        {selectedContractor?.teams?.map((team: any) => (
                            <div key={team.id} className="space-y-2">
                                <Label htmlFor={`code-${team.id}`} className="text-sm font-bold">{team.name}</Label>
                                <Input
                                    id={`code-${team.id}`}
                                    placeholder="e.g. OSP-TEAM-01"
                                    value={teamCodes[team.id] || ''}
                                    onChange={(e) => setTeamCodes({ ...teamCodes, [team.id]: e.target.value })}
                                    className="h-10"
                                />
                            </div>
                        ))}
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsApproveDialogOpen(false)}>Cancel</Button>
                        <Button
                            onClick={confirmFinalApproval}
                            className="bg-green-600 hover:bg-green-700"
                        >
                            Finalize & Activate
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={isRejectDialogOpen} onOpenChange={setIsRejectDialogOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle className="text-red-600 flex items-center gap-2">
                            <XCircle className="w-5 h-5" /> Reject Registration
                        </DialogTitle>
                        <DialogDescription>
                            Please specify why you are rejecting this contractor's registration. This will be visible to the contractor so they can correct it.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 my-4">
                        <div className="space-y-2">
                            <Label htmlFor="rejection-reason" className="text-sm font-bold">Reason for Rejection</Label>
                            <textarea
                                id="rejection-reason"
                                className="w-full min-h-[100px] p-3 rounded-md border border-slate-200 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                placeholder="e.g. Bank passbook photo is unclear, Please upload a better one..."
                                value={rejectionReason}
                                onChange={(e) => setRejectionReason(e.target.value)}
                            />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsRejectDialogOpen(false)}>Cancel</Button>
                        <Button
                            onClick={handleReject}
                            className="bg-red-600 hover:bg-red-700 text-white"
                            disabled={rejectMutation.isPending}
                        >
                            {rejectMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <XCircle className="w-4 h-4 mr-2" />}
                            Confirm Rejection
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Edit Basic Info Dialog */}
            <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Edit Contractor Details</DialogTitle>
                        <DialogDescription>Update registration info before final approval.</DialogDescription>
                    </DialogHeader>
                    <div className="grid grid-cols-2 gap-4 py-4 max-h-[60vh] overflow-y-auto pr-2 no-scrollbar">
                        <div className="space-y-2">
                            <Label>Contractor Name</Label>
                            <Input value={editData.name || ''} onChange={e => setEditData({ ...editData, name: e.target.value })} />
                        </div>
                        <div className="space-y-2">
                            <Label>Registration Number</Label>
                            <Input value={editData.registrationNumber || ''} onChange={e => setEditData({ ...editData, registrationNumber: e.target.value })} />
                        </div>
                        <div className="col-span-2 space-y-2">
                            <Label>Address</Label>
                            <Input value={editData.address || ''} onChange={e => setEditData({ ...editData, address: e.target.value })} />
                        </div>
                        <div className="space-y-2">
                            <Label>NIC Number</Label>
                            <Input value={editData.nic || ''} onChange={e => setEditData({ ...editData, nic: e.target.value })} />
                        </div>
                        <div className="space-y-2">
                            <Label>Contact Number</Label>
                            <Input value={editData.contactNumber || ''} onChange={e => setEditData({ ...editData, contactNumber: e.target.value })} />
                        </div>

                        <div className="col-span-2 pt-2 border-t">
                            <h4 className="text-xs font-bold uppercase text-slate-400 mb-4">Banking & Internal</h4>
                        </div>
                        <div className="space-y-2">
                            <Label>Bank Name</Label>
                            <Input value={editData.bankName || ''} onChange={e => setEditData({ ...editData, bankName: e.target.value })} />
                        </div>
                        <div className="space-y-2">
                            <Label>Bank Branch</Label>
                            <Input value={editData.bankBranch || ''} onChange={e => setEditData({ ...editData, bankBranch: e.target.value })} />
                        </div>
                        <div className="space-y-2">
                            <Label>Account Number</Label>
                            <Input value={editData.bankAccountNumber || ''} onChange={e => setEditData({ ...editData, bankAccountNumber: e.target.value })} />
                        </div>
                        <div className="flex items-center space-x-2 pt-8">
                            <input
                                type="checkbox"
                                id="fee-paid"
                                checked={editData.registrationFeePaid || false}
                                onChange={e => setEditData({ ...editData, registrationFeePaid: e.target.checked })}
                                className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                            />
                            <Label htmlFor="fee-paid" className="cursor-pointer">Registration Fee Paid</Label>
                        </div>

                        <div className="col-span-2 pt-2 border-t">
                            <h4 className="text-xs font-bold uppercase text-slate-400 mb-4">Internal Assignment</h4>
                        </div>
                        <div className="space-y-2">
                            <Label>Assigned OPMC</Label>
                            <Select value={editData.opmcId || ''} onValueChange={(v) => setEditData({ ...editData, opmcId: v })}>
                                <SelectTrigger className="bg-white"><SelectValue placeholder="Select OPMC" /></SelectTrigger>
                                <SelectContent>
                                    {opmcs.map((o: any) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Agreement Date</Label>
                            <Input type="date" value={editData.agreementDate ? new Date(editData.agreementDate).toISOString().split('T')[0] : ''} onChange={e => setEditData({ ...editData, agreementDate: e.target.value })} />
                        </div>
                        <div className="space-y-2">
                            <Label>Agreement Duration (Years)</Label>
                            <Input type="number" value={editData.agreementDuration || 1} onChange={e => setEditData({ ...editData, agreementDuration: parseInt(e.target.value) })} />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsEditModalOpen(false)}>Cancel</Button>
                        <Button onClick={async () => {
                            try {
                                const res = await fetch('/api/contractors', {
                                    method: 'PUT',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify(editData)
                                });
                                if (!res.ok) throw new Error("Update failed");
                                toast.success("Details updated");
                                queryClient.invalidateQueries({ queryKey: ['contractor-approvals'] });
                                setSelectedContractor({ ...selectedContractor, ...editData });
                                setIsEditModalOpen(false);
                            } catch (err) {
                                toast.error("Failed to update");
                            }
                        }}>Save Changes</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Team Manager */}
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
        </div>
    );
}
