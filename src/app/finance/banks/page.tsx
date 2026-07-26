"use client";

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Search, Plus, Trash2, Edit2, ShieldAlert, Landmark, ChevronDown, ChevronRight, GitBranch } from "lucide-react";
import { toast } from 'sonner';

interface Bank {
    id: string;
    code: string;
    name: string;
}

interface Branch {
    id: string;
    bankId: string;
    code: string;
    name: string;
}

export default function BankBranchManagementPage() {
    const queryClient = useQueryClient();
    const [searchTerm, setSearchTerm] = useState("");
    const [expandedBankId, setExpandedBankId] = useState<string | null>(null);

    // Dialog control states
    const [showBankModal, setShowBankModal] = useState(false);
    const [showBranchModal, setShowBranchModal] = useState(false);
    const [selectedBank, setSelectedBank] = useState<Bank | null>(null);
    const [selectedBranch, setSelectedBranch] = useState<Branch | null>(null);

    // Delete confirmation states
    const [deleteBankTarget, setDeleteBankTarget] = useState<Bank | null>(null);
    const [deleteBranchTarget, setDeleteBranchTarget] = useState<Branch | null>(null);

    // Form inputs
    const [bankForm, setBankForm] = useState({ code: '', name: '' });
    const [branchForm, setBranchForm] = useState({ code: '', name: '' });

    const parseErrorMessage = (errData: any, fallback: string): string => {
        if (!errData) return fallback;
        if (typeof errData === 'string') return errData;
        if (typeof errData.error === 'string') return errData.error;
        if (typeof errData.error?.message === 'string') return errData.error.message;
        if (typeof errData.message === 'string') return errData.message;
        return fallback;
    };

    // --- QUERIES ---
    const { data: banks = [], isLoading: banksLoading } = useQuery<Bank[]>({
        queryKey: ["banks"],
        queryFn: async () => {
            const res = await fetch(`/api/banks?_t=${Date.now()}`, {
                cache: 'no-store',
                headers: { 'Pragma': 'no-cache', 'Cache-Control': 'no-cache' }
            });
            if (!res.ok) return [];
            const json = await res.json();
            const result = Array.isArray(json) ? json : (json.data || []);
            return Array.isArray(result) ? result : [];
        }
    });

    const { data: branches = [], isLoading: branchesLoading } = useQuery<Branch[]>({
        queryKey: ["branches", expandedBankId],
        queryFn: async () => {
            if (!expandedBankId) return [];
            const res = await fetch(`/api/banks/${expandedBankId}/branches?_t=${Date.now()}`, {
                cache: 'no-store',
                headers: { 'Pragma': 'no-cache', 'Cache-Control': 'no-cache' }
            });
            if (!res.ok) return [];
            const json = await res.json();
            const result = Array.isArray(json) ? json : (json.data || []);
            return Array.isArray(result) ? result : [];
        },
        enabled: !!expandedBankId
    });

    // --- MUTATIONS ---
    const createBankMutation = useMutation({
        mutationFn: async (data: typeof bankForm) => {
            const res = await fetch('/api/banks', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(parseErrorMessage(err, 'Failed to create bank'));
            }
            return res.json();
        },
        onSuccess: () => {
            toast.success('Bank created successfully');
            queryClient.invalidateQueries({ queryKey: ["banks"] });
            setShowBankModal(false);
        },
        onError: (err: Error) => {
            toast.error(err.message);
        }
    });

    const updateBankMutation = useMutation({
        mutationFn: async ({ id, data }: { id: string, data: typeof bankForm }) => {
            const res = await fetch(`/api/banks/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(parseErrorMessage(err, 'Failed to update bank'));
            }
            return res.json();
        },
        onSuccess: () => {
            toast.success('Bank updated successfully');
            queryClient.invalidateQueries({ queryKey: ["banks"] });
            setShowBankModal(false);
        },
        onError: (err: Error) => {
            toast.error(err.message);
        }
    });

    const deleteBankMutation = useMutation({
        mutationFn: async (id: string) => {
            const res = await fetch(`/api/banks/${id}`, { method: 'DELETE' });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(parseErrorMessage(err, 'Failed to delete bank'));
            }
            return res.json();
        },
        onSuccess: () => {
            toast.success('Bank deleted successfully');
            queryClient.invalidateQueries({ queryKey: ["banks"] });
            setDeleteBankTarget(null);
        },
        onError: (err: Error) => {
            toast.error(err.message || 'Failed to delete bank');
        }
    });

    const createBranchMutation = useMutation({
        mutationFn: async ({ bankId, data }: { bankId: string, data: typeof branchForm }) => {
            const res = await fetch(`/api/banks/${bankId}/branches`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(parseErrorMessage(err, 'Failed to create branch'));
            }
            return res.json();
        },
        onSuccess: () => {
            toast.success('Branch added successfully');
            queryClient.invalidateQueries({ queryKey: ["branches", expandedBankId] });
            setShowBranchModal(false);
        },
        onError: (err: Error) => {
            toast.error(err.message);
        }
    });

    const updateBranchMutation = useMutation({
        mutationFn: async ({ bankId, branchId, data }: { bankId: string, branchId: string, data: typeof branchForm }) => {
            const res = await fetch(`/api/banks/${bankId}/branches/${branchId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(parseErrorMessage(err, 'Failed to update branch'));
            }
            return res.json();
        },
        onSuccess: () => {
            toast.success('Branch updated successfully');
            queryClient.invalidateQueries({ queryKey: ["branches", expandedBankId] });
            setShowBranchModal(false);
        },
        onError: (err: Error) => {
            toast.error(err.message);
        }
    });

    const deleteBranchMutation = useMutation({
        mutationFn: async ({ bankId, branchId }: { bankId: string, branchId: string }) => {
            const res = await fetch(`/api/banks/${bankId}/branches/${branchId}`, { method: 'DELETE' });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(parseErrorMessage(err, 'Failed to delete branch'));
            }
            return res.json();
        },
        onSuccess: () => {
            toast.success('Branch deleted successfully');
            queryClient.invalidateQueries({ queryKey: ["branches", expandedBankId] });
            setDeleteBranchTarget(null);
        },
        onError: (err: Error) => {
            toast.error(err.message || 'Failed to delete branch');
        }
    });

    const handleOpenBankModal = (bank?: Bank) => {
        if (bank) {
            setSelectedBank(bank);
            setBankForm({ code: bank.code, name: bank.name });
        } else {
            setSelectedBank(null);
            setBankForm({ code: '', name: '' });
        }
        setShowBankModal(true);
    };

    const handleOpenBranchModal = (bank: Bank, branch?: Branch) => {
        setSelectedBank(bank);
        if (branch) {
            setSelectedBranch(branch);
            setBranchForm({ code: branch.code, name: branch.name });
        } else {
            setSelectedBranch(null);
            setBranchForm({ code: '', name: '' });
        }
        setShowBranchModal(true);
    };

    const handleBankSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (selectedBank) {
            updateBankMutation.mutate({ id: selectedBank.id, data: bankForm });
        } else {
            createBankMutation.mutate(bankForm);
        }
    };

    const handleBranchSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedBank) return;
        if (selectedBranch) {
            updateBranchMutation.mutate({ bankId: selectedBank.id, branchId: selectedBranch.id, data: branchForm });
        } else {
            createBranchMutation.mutate({ bankId: selectedBank.id, data: branchForm });
        }
    };

    const toggleBankExpand = (bankId: string) => {
        if (expandedBankId === bankId) {
            setExpandedBankId(null);
        } else {
            setExpandedBankId(bankId);
        }
    };

    const filteredBanks = banks.filter(b => {
        const query = searchTerm.toLowerCase();
        return b.name.toLowerCase().includes(query) || b.code.toLowerCase().includes(query);
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
                                Bank & Branch Registry
                            </h1>
                            <p className="text-sm text-muted-foreground mt-1">
                                Manage corporate banks and authorized bank branches
                            </p>
                        </div>
                        <Button onClick={() => handleOpenBankModal()} className="bg-blue-600 hover:bg-blue-700 text-white">
                            <Plus className="w-4 h-4 mr-2" />
                            Add Bank
                        </Button>
                    </div>

                    <div className="flex gap-2 items-center bg-white dark:bg-slate-900 p-3 rounded-lg border border-slate-200 dark:border-slate-800 shadow-sm">
                        <Search className="w-4 h-4 text-slate-400" />
                        <Input 
                            placeholder="Search by Bank code or name..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="border-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-slate-400"
                        />
                    </div>

                    <div className="flex-1 overflow-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-sm">
                        {banksLoading ? (
                            <div className="flex items-center justify-center h-48">
                                <span className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></span>
                            </div>
                        ) : filteredBanks.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-48 text-slate-500">
                                <Landmark className="w-12 h-12 mb-2 opacity-50" />
                                No banks found.
                            </div>
                        ) : (
                            <div className="divide-y divide-slate-100 dark:divide-slate-800">
                                {filteredBanks.map(bank => {
                                    const isExpanded = expandedBankId === bank.id;
                                    return (
                                        <div key={bank.id} className="flex flex-col">
                                            {/* Bank Row */}
                                            <div className="flex items-center justify-between p-4 hover:bg-slate-50/50 dark:hover:bg-slate-800/20">
                                                <div 
                                                    className="flex items-center gap-3 cursor-pointer flex-1"
                                                    onClick={() => toggleBankExpand(bank.id)}
                                                >
                                                    {isExpanded ? (
                                                        <ChevronDown className="w-4 h-4 text-slate-400" />
                                                    ) : (
                                                        <ChevronRight className="w-4 h-4 text-slate-400" />
                                                    )}
                                                    <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-blue-600">
                                                        <Landmark className="w-5 h-5" />
                                                    </div>
                                                    <div>
                                                        <span className="font-bold text-slate-900 dark:text-slate-100">{bank.name}</span>
                                                        <span className="ml-2 font-mono text-xs px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 font-semibold">{bank.code}</span>
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-2">
                                                    <Button 
                                                        variant="outline" 
                                                        size="sm" 
                                                        onClick={() => handleOpenBranchModal(bank)}
                                                        className="text-xs h-8"
                                                    >
                                                        <Plus className="w-3.5 h-3.5 mr-1" /> Add Branch
                                                    </Button>
                                                    <Button variant="ghost" size="sm" onClick={() => handleOpenBankModal(bank)}>
                                                        <Edit2 className="w-4 h-4 text-slate-500" />
                                                    </Button>
                                                    <Button variant="ghost" size="sm" onClick={() => setDeleteBankTarget(bank)}>
                                                        <Trash2 className="w-4 h-4 text-red-500" />
                                                    </Button>
                                                </div>
                                            </div>

                                            {/* Expandable Branches Section */}
                                            {isExpanded && (
                                                <div className="bg-slate-50/50 dark:bg-slate-900/50 pl-16 pr-4 py-2 border-t border-b border-slate-100 dark:border-slate-800">
                                                    <h4 className="text-xs font-bold text-slate-400 mb-2 tracking-wider uppercase flex items-center gap-1">
                                                        <GitBranch className="w-3.5 h-3.5" /> Branches
                                                    </h4>
                                                    {branchesLoading ? (
                                                        <div className="py-2 text-slate-400 text-xs">Loading branches...</div>
                                                    ) : branches.length === 0 ? (
                                                        <div className="py-2 text-slate-400 text-xs italic">No branches registered.</div>
                                                    ) : (
                                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 py-1">
                                                            {branches.map(branch => (
                                                                <div 
                                                                    key={branch.id} 
                                                                    className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded p-3 flex justify-between items-center shadow-xs"
                                                                >
                                                                    <div>
                                                                        <div className="font-semibold text-sm text-slate-800 dark:text-slate-200">{branch.name}</div>
                                                                        <div className="font-mono text-xs text-slate-400 font-semibold mt-0.5">Code: {branch.code}</div>
                                                                    </div>
                                                                    <div className="flex gap-1">
                                                                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => handleOpenBranchModal(bank, branch)}>
                                                                            <Edit2 className="w-3 h-3 text-slate-500" />
                                                                        </Button>
                                                                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setDeleteBranchTarget(branch)}>
                                                                            <Trash2 className="w-3 h-3 text-red-500" />
                                                                        </Button>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>

                {/* Bank Create/Edit Modal */}
                <Dialog open={showBankModal} onOpenChange={setShowBankModal}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>{selectedBank ? 'Edit Bank Details' : 'Add New Bank'}</DialogTitle>
                            <DialogDescription>
                                Specify bank code and organization name.
                            </DialogDescription>
                        </DialogHeader>
                        <form onSubmit={handleBankSubmit} className="space-y-4">
                            <div>
                                <label className="text-xs font-bold text-slate-500">Bank Code (Unique Identifier)</label>
                                <Input required value={bankForm.code} onChange={e => setBankForm({...bankForm, code: e.target.value})} placeholder="e.g. BOC, COMB, NDBS" />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-500">Bank Name</label>
                                <Input required value={bankForm.name} onChange={e => setBankForm({...bankForm, name: e.target.value})} placeholder="e.g. Bank of Ceylon" />
                            </div>
                            <DialogFooter>
                                <Button type="button" variant="outline" onClick={() => setShowBankModal(false)}>Cancel</Button>
                                <Button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white">Save Bank</Button>
                            </DialogFooter>
                        </form>
                    </DialogContent>
                </Dialog>

                {/* Branch Create/Edit Modal */}
                <Dialog open={showBranchModal} onOpenChange={setShowBranchModal}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>{selectedBranch ? 'Edit Branch' : 'Add Bank Branch'}</DialogTitle>
                            <DialogDescription>
                                Add branch details for bank: <strong>{selectedBank?.name}</strong>.
                            </DialogDescription>
                        </DialogHeader>
                        <form onSubmit={handleBranchSubmit} className="space-y-4">
                            <div>
                                <label className="text-xs font-bold text-slate-500">Branch Code</label>
                                <Input required value={branchForm.code} onChange={e => setBranchForm({...branchForm, code: e.target.value})} placeholder="e.g. 012, 056" />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-500">Branch Name</label>
                                <Input required value={branchForm.name} onChange={e => setBranchForm({...branchForm, name: e.target.value})} placeholder="e.g. Borella, Kollupitiya" />
                            </div>
                            <DialogFooter>
                                <Button type="button" variant="outline" onClick={() => setShowBranchModal(false)}>Cancel</Button>
                                <Button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white">Save Branch</Button>
                            </DialogFooter>
                        </form>
                    </DialogContent>
                </Dialog>

                {/* Delete Bank Confirmation */}
                <AlertDialog open={!!deleteBankTarget} onOpenChange={() => setDeleteBankTarget(null)}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle className="flex items-center gap-2 text-red-600">
                                <ShieldAlert className="w-5 h-5" />
                                Delete Bank?
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                                Are you sure you want to delete <strong>{deleteBankTarget?.name}</strong>? This will permanently delete all of its branches and cannot be undone.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction 
                                onClick={() => deleteBankTarget && deleteBankMutation.mutate(deleteBankTarget.id)}
                                className="bg-red-600 hover:bg-red-700 text-white"
                            >
                                Delete Bank
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>

                {/* Delete Branch Confirmation */}
                <AlertDialog open={!!deleteBranchTarget} onOpenChange={() => setDeleteBranchTarget(null)}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle className="flex items-center gap-2 text-red-600">
                                <ShieldAlert className="w-5 h-5" />
                                Delete Branch?
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                                Are you sure you want to delete branch <strong>{deleteBranchTarget?.name}</strong> ({deleteBranchTarget?.code})?
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction 
                                onClick={() => deleteBranchTarget && selectedBank && deleteBranchMutation.mutate({ bankId: selectedBank.id, branchId: deleteBranchTarget.id })}
                                className="bg-red-600 hover:bg-red-700 text-white"
                            >
                                Delete Branch
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>

            </main>
        </div>
    );
}
