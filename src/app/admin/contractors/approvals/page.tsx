"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { CheckCircle, XCircle, Loader2, Building2, Users, FileText, Banknote, Calendar, ShieldCheck } from "lucide-react";
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";

export default function ContractorApprovalsPage() {
    const queryClient = useQueryClient();
    const [selectedContractor, setSelectedContractor] = useState<any>(null);

    // Get current user from localStorage
    const user = typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('user') || '{}') : {};
    const userRole = user.role || '';

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

    const approveMutation = useMutation({
        mutationFn: async ({ id, status, approverId }: any) => {
            const res = await fetch('/api/contractors', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id,
                    status,
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

    const handleApprove = (contractor: any) => {
        let nextStatus = '';
        if (contractor.status === 'ARM_PENDING' && userRole === 'AREA_MANAGER') {
            nextStatus = 'OSP_PENDING';
        } else if (contractor.status === 'OSP_PENDING' && userRole === 'OSP_MANAGER') {
            nextStatus = 'ACTIVE';
        }

        if (!nextStatus) {
            toast.error("You don't have permission to approve at this stage");
            return;
        }

        approveMutation.mutate({ id: contractor.id, status: nextStatus, approverId: user.id });
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
                                                        <p className="text-xs text-slate-500 mt-1">{c.type} Contractor</p>
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
                                                        onClick={() => handleApprove(selectedContractor)}
                                                        className="bg-green-600 hover:bg-green-700"
                                                        disabled={approveMutation.isPending}
                                                    >
                                                        {approveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle className="w-4 h-4 mr-2" />}
                                                        Approve Registration
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
                                                </div>

                                                <div className="p-6 space-y-6">
                                                    <section>
                                                        <h5 className="text-[10px] font-bold text-slate-400 uppercase mb-3 flex items-center gap-2">
                                                            <Users className="w-3 h-3" /> Team Structure
                                                        </h5>
                                                        {selectedContractor.type === 'OSP' ? (
                                                            <div className="p-4 bg-blue-50 text-blue-700 text-xs rounded-lg border border-blue-100 italic">
                                                                OSP Project contractors do not require team member registration.
                                                            </div>
                                                        ) : (
                                                            <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                                                                {(selectedContractor.teamMembers || []).length > 0 ? (
                                                                    selectedContractor.teamMembers.map((m: any, idx: number) => (
                                                                        <div key={idx} className="p-3 bg-white border rounded shadow-sm flex items-center gap-3">
                                                                            <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-400">{idx + 1}</div>
                                                                            <div>
                                                                                <p className="text-sm font-bold text-slate-700">{m.name}</p>
                                                                                <p className="text-[10px] text-slate-500">NIC: {m.nic}</p>
                                                                            </div>
                                                                        </div>
                                                                    ))
                                                                ) : (
                                                                    <p className="text-xs text-slate-400 italic">No team members listed</p>
                                                                )}
                                                            </div>
                                                        )}
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
                                                                    <p className="text-[10px] text-slate-400">{new Date(selectedContractor.updatedAt).toLocaleString()}</p>
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
        </div>
    );
}
