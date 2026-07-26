"use client";

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import RoleGuard from '@/components/RoleGuard';
import { ROLE_GROUPS } from '@/config/sidebar-menu';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Plus, ListTree, CheckCircle2, ShieldAlert, BookOpen, Layers } from "lucide-react";
import { toast } from "sonner";

interface ChartOfAccount {
    id: string;
    code: string;
    name: string;
    type: 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE';
    parentId: string | null;
    isPostable: boolean;
    isActive: boolean;
    parent?: { id: string; code: string; name: string } | null;
}

export default function ChartOfAccountsPage() {
    const queryClient = useQueryClient();
    const [searchTerm, setSearchTerm] = useState("");
    const [typeFilter, setTypeFilter] = useState("ALL");
    const [isCreateOpen, setIsCreateOpen] = useState(false);

    // Form state
    const [newCode, setNewCode] = useState("");
    const [newName, setNewName] = useState("");
    const [newType, setNewType] = useState<'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE'>('ASSET');
    const [newParentId, setNewParentId] = useState<string>("NONE");
    const [newIsPostable, setNewIsPostable] = useState(true);

    const { data: accounts = [], isLoading, refetch } = useQuery<ChartOfAccount[]>({
        queryKey: ['chart-of-accounts'],
        queryFn: async () => {
            const res = await fetch(`/api/finance/chart-of-accounts?_t=${Date.now()}`, {
                cache: 'no-store'
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error?.message || 'Failed to fetch accounts');
            return json.data.accounts;
        }
    });

    const createMutation = useMutation({
        mutationFn: async (payload: { code: string; name: string; type: string; parentId?: string; isPostable: boolean }) => {
            const res = await fetch('/api/finance/chart-of-accounts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error?.message || 'Failed to create account');
            return json.data.account;
        },
        onSuccess: () => {
            toast.success("Account created successfully");
            setIsCreateOpen(false);
            setNewCode("");
            setNewName("");
            queryClient.invalidateQueries({ queryKey: ['chart-of-accounts'] });
        },
        onError: (err: any) => {
            toast.error(err.message || "Failed to create account");
        }
    });

    const handleCreate = (e: React.FormEvent) => {
        e.preventDefault();
        if (!newCode || !newName) {
            toast.error("Please fill in Account Code and Name");
            return;
        }
        createMutation.mutate({
            code: newCode,
            name: newName,
            type: newType,
            parentId: newParentId === "NONE" ? undefined : newParentId,
            isPostable: newIsPostable
        });
    };

    const filteredAccounts = accounts.filter(acc => {
        const matchesSearch = acc.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
            acc.name.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesType = typeFilter === "ALL" || acc.type === typeFilter;
        return matchesSearch && matchesType;
    });

    // Summary counts
    const totalCount = accounts.length;
    const assetCount = accounts.filter(a => a.type === 'ASSET').length;
    const liabilityCount = accounts.filter(a => a.type === 'LIABILITY').length;
    const equityCount = accounts.filter(a => a.type === 'EQUITY').length;
    const revenueCount = accounts.filter(a => a.type === 'REVENUE').length;
    const expenseCount = accounts.filter(a => a.type === 'EXPENSE').length;

    const getTypeBadge = (type: string) => {
        switch (type) {
            case 'ASSET':
                return <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300">ASSET</Badge>;
            case 'LIABILITY':
                return <Badge className="bg-amber-100 text-amber-800 border-amber-300">LIABILITY</Badge>;
            case 'EQUITY':
                return <Badge className="bg-indigo-100 text-indigo-800 border-indigo-300">EQUITY</Badge>;
            case 'REVENUE':
                return <Badge className="bg-blue-100 text-blue-800 border-blue-300">REVENUE</Badge>;
            case 'EXPENSE':
                return <Badge className="bg-rose-100 text-rose-800 border-rose-300">EXPENSE</Badge>;
            default:
                return <Badge variant="outline">{type}</Badge>;
        }
    };

    return (
        <RoleGuard allowedRoles={ROLE_GROUPS.FINANCE}>
            <div className="flex h-screen bg-slate-50 overflow-hidden">
                <Sidebar />
                <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                    <Header />
                    <main className="flex-1 overflow-y-auto p-6 space-y-6">
                        
                        {/* Page Header */}
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div>
                                <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
                                    <BookOpen className="w-7 h-7 text-indigo-600" />
                                    Chart of Accounts Master
                                </h1>
                                <p className="text-sm text-slate-500 mt-1">
                                    Master double-entry account catalog and financial classification rules.
                                </p>
                            </div>

                            <Button onClick={() => setIsCreateOpen(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm flex items-center gap-2">
                                <Plus className="w-4 h-4" />
                                Add Account
                            </Button>
                        </div>

                        {/* KPI Summary Cards */}
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
                            <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
                                <div className="text-xs font-semibold uppercase text-slate-500">Total Accounts</div>
                                <div className="text-2xl font-bold text-slate-900 mt-1">{totalCount}</div>
                            </div>
                            <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-200">
                                <div className="text-xs font-semibold uppercase text-emerald-700">Assets (1000)</div>
                                <div className="text-2xl font-bold text-emerald-900 mt-1">{assetCount}</div>
                            </div>
                            <div className="bg-amber-50 rounded-xl p-4 border border-amber-200">
                                <div className="text-xs font-semibold uppercase text-amber-700">Liabilities (2000)</div>
                                <div className="text-2xl font-bold text-amber-900 mt-1">{liabilityCount}</div>
                            </div>
                            <div className="bg-indigo-50 rounded-xl p-4 border border-indigo-200">
                                <div className="text-xs font-semibold uppercase text-indigo-700">Equity (3000)</div>
                                <div className="text-2xl font-bold text-indigo-900 mt-1">{equityCount}</div>
                            </div>
                            <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
                                <div className="text-xs font-semibold uppercase text-blue-700">Revenue (4000)</div>
                                <div className="text-2xl font-bold text-blue-900 mt-1">{revenueCount}</div>
                            </div>
                            <div className="bg-rose-50 rounded-xl p-4 border border-rose-200">
                                <div className="text-xs font-semibold uppercase text-rose-700">Expenses (5000/6000)</div>
                                <div className="text-2xl font-bold text-rose-900 mt-1">{expenseCount}</div>
                            </div>
                        </div>

                        {/* Search and Filters */}
                        <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200 flex flex-col md:flex-row items-center gap-4">
                            <div className="relative flex-1 w-full">
                                <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                                <Input
                                    placeholder="Search account code or name..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="pl-9 bg-slate-50 border-slate-200"
                                />
                            </div>

                            <Select value={typeFilter} onValueChange={setTypeFilter}>
                                <SelectTrigger className="w-full md:w-56 bg-slate-50 border-slate-200">
                                    <SelectValue placeholder="Filter by Account Type" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="ALL">All Account Types</SelectItem>
                                    <SelectItem value="ASSET">Assets</SelectItem>
                                    <SelectItem value="LIABILITY">Liabilities</SelectItem>
                                    <SelectItem value="EQUITY">Equity</SelectItem>
                                    <SelectItem value="REVENUE">Revenue</SelectItem>
                                    <SelectItem value="EXPENSE">Expenses</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Accounts Table */}
                        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                            {isLoading ? (
                                <div className="p-8 text-center text-slate-500">Loading Chart of Accounts...</div>
                            ) : filteredAccounts.length === 0 ? (
                                <div className="p-8 text-center text-slate-500">No accounts match the current filter.</div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left text-sm border-collapse">
                                        <thead>
                                            <tr className="bg-slate-100/70 border-b border-slate-200 text-slate-700 font-semibold uppercase text-xs">
                                                <th className="py-3.5 px-4">Account Code</th>
                                                <th className="py-3.5 px-4">Account Name</th>
                                                <th className="py-3.5 px-4">Category Type</th>
                                                <th className="py-3.5 px-4">Parent Account</th>
                                                <th className="py-3.5 px-4 text-center">Postable</th>
                                                <th className="py-3.5 px-4 text-center">Status</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-200">
                                            {filteredAccounts.map((acc) => (
                                                <tr key={acc.id} className="hover:bg-slate-50/80 transition-colors">
                                                    <td className="py-3.5 px-4 font-mono font-bold text-slate-900">{acc.code}</td>
                                                    <td className="py-3.5 px-4 font-medium text-slate-800">{acc.name}</td>
                                                    <td className="py-3.5 px-4">{getTypeBadge(acc.type)}</td>
                                                    <td className="py-3.5 px-4 text-slate-500">
                                                        {acc.parent ? `${acc.parent.code} - ${acc.parent.name}` : '-'}
                                                    </td>
                                                    <td className="py-3.5 px-4 text-center">
                                                        {acc.isPostable ? (
                                                            <span className="inline-flex items-center text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                                                                <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Yes
                                                            </span>
                                                        ) : (
                                                            <span className="inline-flex items-center text-xs font-semibold text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded-full">
                                                                Header Only
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="py-3.5 px-4 text-center">
                                                        <span className="inline-flex items-center text-xs font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                                                            Active
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>

                        {/* Create Account Modal */}
                        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                            <DialogContent className="sm:max-w-[480px]">
                                <DialogHeader>
                                    <DialogTitle className="flex items-center gap-2">
                                        <ListTree className="w-5 h-5 text-indigo-600" />
                                        Add New Chart of Account
                                    </DialogTitle>
                                </DialogHeader>
                                <form onSubmit={handleCreate} className="space-y-4 py-2">
                                    <div>
                                        <label className="text-xs font-bold uppercase text-slate-600 mb-1 block">Account Code (e.g. INV-1010)</label>
                                        <Input
                                            placeholder="e.g. BANK-1000"
                                            value={newCode}
                                            onChange={(e) => setNewCode(e.target.value)}
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold uppercase text-slate-600 mb-1 block">Account Name</label>
                                        <Input
                                            placeholder="e.g. Main Commercial Bank Account"
                                            value={newName}
                                            onChange={(e) => setNewName(e.target.value)}
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold uppercase text-slate-600 mb-1 block">Account Category Type</label>
                                        <Select value={newType} onValueChange={(val: any) => setNewType(val)}>
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="ASSET">ASSET (1000 Series)</SelectItem>
                                                <SelectItem value="LIABILITY">LIABILITY (2000 Series)</SelectItem>
                                                <SelectItem value="EQUITY">EQUITY (3000 Series)</SelectItem>
                                                <SelectItem value="REVENUE">REVENUE (4000 Series)</SelectItem>
                                                <SelectItem value="EXPENSE">EXPENSE (5000/6000 Series)</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold uppercase text-slate-600 mb-1 block">Parent Account (Optional)</label>
                                        <Select value={newParentId} onValueChange={setNewParentId}>
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="NONE">None (Top-Level Account)</SelectItem>
                                                {accounts.map(acc => (
                                                    <SelectItem key={acc.id} value={acc.id}>
                                                        {acc.code} - {acc.name}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <DialogFooter className="pt-4">
                                        <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>
                                            Cancel
                                        </Button>
                                        <Button type="submit" disabled={createMutation.isPending} className="bg-indigo-600 hover:bg-indigo-700 text-white">
                                            {createMutation.isPending ? 'Saving...' : 'Save Account'}
                                        </Button>
                                    </DialogFooter>
                                </form>
                            </DialogContent>
                        </Dialog>
                    </main>
                </div>
            </div>
        </RoleGuard>
    );
}
