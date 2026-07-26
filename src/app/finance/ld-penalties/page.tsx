"use client";

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Search, Plus, Trash2, ShieldAlert, CheckCircle, FileText, XCircle, Landmark, ShieldCheck } from "lucide-react";
import { toast } from 'sonner';

interface Project {
    id: string;
    projectCode: string;
    name: string;
}

interface ProjectLDPenalty {
    id: string;
    projectId: string;
    title: string;
    description: string | null;
    type: string;
    category: string;
    amount: number;
    percentage: number | null;
    waivedAmount: number;
    netAmount: number;
    status: string;
    remarks: string | null;
    createdAt: string;
    project: {
        name: string;
        projectCode: string;
    };
}

export default function LDPenaltyManagementPage() {
    const queryClient = useQueryClient();
    const [searchTerm, setSearchTerm] = useState("");
    const [statusFilter, setStatusFilter] = useState("ALL");
    
    // Dialog/Modal states
    const [showLevyModal, setShowLevyModal] = useState(false);
    const [showWaiveModal, setShowWaiveModal] = useState(false);
    const [selectedPenalty, setSelectedPenalty] = useState<ProjectLDPenalty | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<ProjectLDPenalty | null>(null);

    // Form inputs
    const [levyForm, setLevyForm] = useState({
        projectId: '',
        title: '',
        description: '',
        type: 'LD',
        category: 'DELAY',
        amount: 0,
        remarks: ''
    });

    const [waivedAmount, setWaivedAmount] = useState(0);
    const [remarks, setRemarks] = useState("");

    // --- QUERIES ---
    const { data: penalties = [], isLoading } = useQuery<ProjectLDPenalty[]>({
        queryKey: ["penalties", statusFilter],
        queryFn: async () => {
            const res = await fetch(`/api/finance/ld-penalties?status=${statusFilter}`);
            if (!res.ok) return [];
            return res.json();
        }
    });

    const { data: projectsData = [] } = useQuery<any>({
        queryKey: ["projects"],
        queryFn: async () => {
            const res = await fetch("/api/projects?limit=1000");
            if (!res.ok) return [];
            return res.json();
        }
    });

    const projects: Project[] = Array.isArray(projectsData) 
        ? projectsData 
        : (projectsData.projects || []);

    // --- MUTATIONS ---
    const levyMutation = useMutation({
        mutationFn: async (data: typeof levyForm) => {
            const res = await fetch('/api/finance/ld-penalties', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...data,
                    amount: Number(data.amount),
                    leviedById: 'admin_user'
                })
            });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || 'Failed to levy penalty');
            }
            return res.json();
        },
        onSuccess: () => {
            toast.success('Penalty levied successfully');
            queryClient.invalidateQueries({ queryKey: ["penalties"] });
            setShowLevyModal(false);
            setLevyForm({
                projectId: '',
                title: '',
                description: '',
                type: 'LD',
                category: 'DELAY',
                amount: 0,
                remarks: ''
            });
        },
        onError: (err: Error) => {
            toast.error(err.message);
        }
    });

    const statusMutation = useMutation({
        mutationFn: async ({ id, status, waived, remarks }: { id: string; status: string; waived?: number; remarks?: string }) => {
            const res = await fetch('/api/finance/ld-penalties', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id,
                    status,
                    userId: 'admin_user',
                    waivedAmount: waived,
                    remarks
                })
            });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || 'Failed to update status');
            }
            return res.json();
        },
        onSuccess: (data) => {
            toast.success(`Penalty status updated to ${data.status}`);
            queryClient.invalidateQueries({ queryKey: ["penalties"] });
            setShowWaiveModal(false);
            setWaivedAmount(0);
            setRemarks("");
        },
        onError: (err: Error) => {
            toast.error(err.message);
        }
    });

    const deleteMutation = useMutation({
        mutationFn: async (id: string) => {
            const res = await fetch(`/api/finance/ld-penalties?id=${id}`, { method: 'DELETE' });
            if (!res.ok) throw new Error('Failed to delete penalty');
            return res.json();
        },
        onSuccess: () => {
            toast.success('Penalty deleted successfully');
            queryClient.invalidateQueries({ queryKey: ["penalties"] });
            setDeleteTarget(null);
        },
        onError: () => {
            toast.error('Failed to delete penalty');
        }
    });

    const handleLevySubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (levyForm.amount <= 0) {
            toast.error("Penalty amount must be greater than zero");
            return;
        }
        levyMutation.mutate(levyForm);
    };

    const handleWaiveSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedPenalty) return;
        if (waivedAmount <= 0) {
            toast.error("Waived amount must be greater than zero");
            return;
        }
        if (waivedAmount > selectedPenalty.amount) {
            toast.error("Waived amount cannot exceed gross penalty amount");
            return;
        }
        statusMutation.mutate({
            id: selectedPenalty.id,
            status: 'WAIVED',
            waived: waivedAmount,
            remarks
        });
    };

    const handleOpenWaiveModal = (penalty: ProjectLDPenalty) => {
        setSelectedPenalty(penalty);
        setWaivedAmount(penalty.amount);
        setShowWaiveModal(true);
    };

    const getStatusStyle = (status: string) => {
        const styles: Record<string, string> = {
            PROPOSED: 'bg-slate-100 text-slate-700 border-slate-200',
            APPROVED: 'bg-amber-50 text-amber-700 border-amber-200',
            WAIVED: 'bg-blue-50 text-blue-700 border-blue-200',
            COLLECTED: 'bg-emerald-50 text-emerald-700 border-emerald-200'
        };
        return styles[status] || 'bg-slate-100';
    };

    const filteredPenalties = penalties.filter(p => {
        const query = searchTerm.toLowerCase();
        return p.title.toLowerCase().includes(query) ||
            p.project.name.toLowerCase().includes(query) ||
            p.project.projectCode.toLowerCase().includes(query);
    });

    return (
        <div className="h-screen flex bg-slate-50 dark:bg-slate-950 overflow-hidden">
            <Sidebar />
            <main className="flex-1 flex flex-col min-w-0 h-full">
                <Header />
                <div className="flex-1 flex flex-col min-h-0 overflow-hidden p-6 space-y-4">
                    
                    <div className="flex justify-between items-center">
                        <div>
                            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                                <Landmark className="w-6 h-6 text-blue-600" />
                                Liquidated Damages &amp; Penalties
                            </h1>
                            <p className="text-sm text-muted-foreground mt-1">
                                Levy delay penalties and manage project performance deductions
                            </p>
                        </div>
                        <Button onClick={() => setShowLevyModal(true)} className="bg-blue-600 hover:bg-blue-700 text-white">
                            <Plus className="w-4 h-4 mr-2" />
                            Levy Penalty
                        </Button>
                    </div>

                    {/* Filters & Search */}
                    <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center bg-white dark:bg-slate-900 p-3 rounded-lg border border-slate-200 dark:border-slate-800 shadow-sm">
                        <div className="flex items-center gap-2 flex-1 border rounded px-3 py-1 bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800">
                            <Search className="w-4 h-4 text-slate-400" />
                            <Input 
                                placeholder="Search by project code, name, or penalty title..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className="border-0 shadow-none h-8 focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-slate-400"
                            />
                        </div>
                        <div className="flex gap-1.5 flex-wrap">
                            {['ALL', 'PROPOSED', 'APPROVED', 'WAIVED', 'COLLECTED'].map(status => (
                                <button
                                    key={status}
                                    onClick={() => setStatusFilter(status)}
                                    className={`px-3 py-1 text-xs font-semibold rounded-full border transition-all ${
                                        statusFilter === status 
                                            ? 'bg-blue-600 text-white border-blue-600' 
                                            : 'bg-white dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700 hover:border-blue-300'
                                    }`}
                                >
                                    {status.replace(/_/g, ' ')}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Table View */}
                    <div className="flex-1 overflow-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-sm">
                        {isLoading ? (
                            <div className="flex items-center justify-center h-48">
                                <span className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></span>
                            </div>
                        ) : filteredPenalties.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-48 text-slate-500">
                                <FileText className="w-12 h-12 mb-2 opacity-50" />
                                No penalties or LDs found.
                            </div>
                        ) : (
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                        <th className="p-4">Project & Category</th>
                                        <th className="p-4">Title</th>
                                        <th className="p-4 text-right">Gross Amount</th>
                                        <th className="p-4 text-right">Waived Amount</th>
                                        <th className="p-4 text-right">Net Amount</th>
                                        <th className="p-4">Status</th>
                                        <th className="p-4 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
                                    {filteredPenalties.map(penalty => (
                                        <tr key={penalty.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                                            <td className="p-4">
                                                <div className="font-bold text-slate-950 dark:text-slate-50">{penalty.project.projectCode}</div>
                                                <div className="text-xs text-slate-500 mt-0.5">{penalty.project.name} | {penalty.category}</div>
                                            </td>
                                            <td className="p-4">
                                                <div className="font-semibold text-slate-900 dark:text-slate-100">{penalty.title}</div>
                                                <div className="text-xs text-slate-500 mt-0.5">{penalty.description || 'No description'}</div>
                                            </td>
                                            <td className="p-4 text-right text-slate-700 dark:text-slate-300 font-semibold">
                                                LKR {penalty.amount.toLocaleString()}
                                            </td>
                                            <td className="p-4 text-right text-blue-600 font-semibold">
                                                LKR {penalty.waivedAmount.toLocaleString()}
                                            </td>
                                            <td className="p-4 text-right text-red-600 font-bold">
                                                LKR {penalty.netAmount.toLocaleString()}
                                            </td>
                                            <td className="p-4">
                                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold border ${getStatusStyle(penalty.status)}`}>
                                                    {penalty.status.replace(/_/g, ' ')}
                                                </span>
                                            </td>
                                            <td className="p-4 text-right">
                                                <div className="flex justify-end gap-1.5">
                                                    {penalty.status === 'PROPOSED' && (
                                                        <>
                                                            <Button 
                                                                size="sm" 
                                                                variant="outline" 
                                                                onClick={() => statusMutation.mutate({ id: penalty.id, status: 'APPROVED' })}
                                                                className="h-8 text-xs border-amber-200 text-amber-600 hover:bg-amber-50"
                                                            >
                                                                <ShieldCheck className="w-3.5 h-3.5 mr-1" /> Approve
                                                            </Button>
                                                            <Button 
                                                                size="sm" 
                                                                variant="outline" 
                                                                onClick={() => handleOpenWaiveModal(penalty)}
                                                                className="h-8 text-xs border-blue-200 text-blue-600 hover:bg-blue-50"
                                                            >
                                                                <XCircle className="w-3.5 h-3.5 mr-1" /> Waive
                                                            </Button>
                                                            <Button variant="ghost" size="sm" onClick={() => setDeleteTarget(penalty)}>
                                                                <Trash2 className="w-4 h-4 text-red-500" />
                                                            </Button>
                                                        </>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>

                {/* Levy Penalty Dialog */}
                <Dialog open={showLevyModal} onOpenChange={setShowLevyModal}>
                    <DialogContent className="max-w-md">
                        <DialogHeader>
                            <DialogTitle>Levy Project Penalty / LD</DialogTitle>
                            <DialogDescription>
                                Propose a deduction or penalty amount for a specific project.
                            </DialogDescription>
                        </DialogHeader>
                        <form onSubmit={handleLevySubmit} className="space-y-4">
                            <div className="space-y-3">
                                <div>
                                    <label className="text-xs font-bold text-slate-500">Project</label>
                                    <select 
                                        required
                                        value={levyForm.projectId} 
                                        onChange={e => setLevyForm({...levyForm, projectId: e.target.value})}
                                        className="w-full h-10 px-3 border border-slate-200 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                                    >
                                        <option value="">-- Select Project --</option>
                                        {projects.map(p => (
                                            <option key={p.id} value={p.id}>{p.projectCode} - {p.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-500">Title</label>
                                    <Input required value={levyForm.title} onChange={e => setLevyForm({...levyForm, title: e.target.value})} placeholder="e.g. Penalty for 2 weeks delay" />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-500">Description</label>
                                    <Input value={levyForm.description} onChange={e => setLevyForm({...levyForm, description: e.target.value})} placeholder="DLP compliance delay, quality failure, etc." />
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <label className="text-xs font-bold text-slate-500">Type</label>
                                        <select 
                                            value={levyForm.type} 
                                            onChange={e => setLevyForm({...levyForm, type: e.target.value})}
                                            className="w-full h-10 px-3 border border-slate-200 rounded-md text-sm focus:outline-none"
                                        >
                                            <option value="LD">LD (Liquidated Damages)</option>
                                            <option value="PENALTY">PENALTY</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-slate-500">Category</label>
                                        <select 
                                            value={levyForm.category} 
                                            onChange={e => setLevyForm({...levyForm, category: e.target.value})}
                                            className="w-full h-10 px-3 border border-slate-200 rounded-md text-sm focus:outline-none"
                                        >
                                            <option value="DELAY">DELAY</option>
                                            <option value="QUALITY">QUALITY</option>
                                            <option value="SAFETY">SAFETY</option>
                                            <option value="PERFORMANCE">PERFORMANCE</option>
                                            <option value="OTHER">OTHER</option>
                                        </select>
                                    </div>
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-500">Penalty Amount (LKR)</label>
                                    <Input required type="number" value={levyForm.amount} onChange={e => setLevyForm({...levyForm, amount: Number(e.target.value)})} />
                                </div>
                            </div>
                            <DialogFooter>
                                <Button type="button" variant="outline" onClick={() => setShowLevyModal(false)}>Cancel</Button>
                                <Button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white">Propose Levy</Button>
                            </DialogFooter>
                        </form>
                    </DialogContent>
                </Dialog>

                {/* Waive Penalty Dialog */}
                <Dialog open={showWaiveModal} onOpenChange={setShowWaiveModal}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Waive Proposed Penalty</DialogTitle>
                            <DialogDescription>
                                Set waived amount for penalty: <strong>{selectedPenalty?.title}</strong>.
                            </DialogDescription>
                        </DialogHeader>
                        <form onSubmit={handleWaiveSubmit} className="space-y-4">
                            <div>
                                <label className="text-xs font-bold text-slate-500">Gross Penalty Amount: LKR {selectedPenalty?.amount.toLocaleString()}</label>
                                <div className="flex items-center gap-2 mt-1">
                                    <span className="font-semibold text-slate-500">LKR</span>
                                    <Input 
                                        type="number" 
                                        required 
                                        value={waivedAmount} 
                                        onChange={e => setWaivedAmount(Number(e.target.value))} 
                                        max={selectedPenalty?.amount}
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-500">Waiver Reason</label>
                                <Input 
                                    value={remarks} 
                                    onChange={e => setRemarks(e.target.value)} 
                                    placeholder="e.g. Delayed site delivery by client accepted"
                                />
                            </div>
                            <DialogFooter>
                                <Button type="button" variant="outline" onClick={() => setShowWaiveModal(false)}>Cancel</Button>
                                <Button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white">Confirm Waiver</Button>
                            </DialogFooter>
                        </form>
                    </DialogContent>
                </Dialog>

                {/* Delete Alert */}
                <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle className="flex items-center gap-2 text-red-600">
                                <ShieldAlert className="w-5 h-5" />
                                Delete Proposed Penalty?
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                                Are you sure you want to permanently delete draft penalty proposal <strong>{deleteTarget?.title}</strong>?
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction 
                                onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
                                className="bg-red-600 hover:bg-red-700 text-white"
                            >
                                Delete
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>

            </main>
        </div>
    );
}
