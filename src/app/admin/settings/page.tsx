"use client";

import React, { useState, useEffect, useCallback } from 'react';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import { useRouter } from 'next/navigation';
import { Button } from "@/components/ui/button";
import {
    Settings,
    Table as TableIcon,
    Loader2,
    DollarSign,
    PackageCheck,
    Boxes,
    Wrench,
    Clock
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { MaterialAssignment } from './MaterialAssignment';
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

interface ColumnConfig {
    key: string;
    label: string;
    required?: boolean;
}

interface TableSettings {
    tableName: string;
    availableColumns: ColumnConfig[];
    visibleColumns: string[];
}

const TABLE_LABELS: Record<string, string> = {
    'pending_sod': 'Pending Service Orders',
    'completed_sod': 'Completed Service Orders',
    'return_sod': 'Return Service Orders',
    'restore_request': 'Restore Requests'
};

const AdminDashboard = () => {
    const router = useRouter();
    const queryClient = useQueryClient();
    const [activeTab, setActiveTab] = useState('finance');

    // --- ACCESS CHECK ---
    useEffect(() => {
        const storedUser = localStorage.getItem('user');
        if (storedUser) {
            try {
                const user = JSON.parse(storedUser);
                if (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN') {
                    router.push('/dashboard');
                }
            } catch {
                router.push('/login');
            }
        } else {
            router.push('/login');
        }
    }, [router]);

    // --- QUERIES ---
    const { data: settings = {}, isLoading } = useQuery<Record<string, TableSettings>>({
        queryKey: ['table-settings'],
        queryFn: async () => {
            const res = await fetch('/api/admin/table-settings');
            if (!res.ok) throw new Error('Failed to load table settings');
            return res.json();
        },
        staleTime: 60000
    });

    // --- MUTATIONS ---
    const mutation = useMutation({
        mutationFn: async (variables: { tableName: string; visibleColumns: string[] }) => {
            const res = await fetch('/api/admin/table-settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(variables)
            });
            if (!res.ok) throw new Error('Failed to save settings');
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['table-settings'] });
            toast.success("Table column settings saved successfully");
        },
        onError: () => toast.error("Failed to save table settings")
    });

    if (isLoading) {
        return (
            <div className="h-screen flex bg-slate-50 overflow-hidden">
                <Sidebar />
                <main className="flex-1 flex flex-col min-w-0 h-full">
                    <Header />
                    <div className="flex-1 flex items-center justify-center">
                        <div className="flex flex-col items-center gap-2 text-slate-500">
                            <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
                            <span className="text-xs font-semibold">Loading system governance settings...</span>
                        </div>
                    </div>
                </main>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 flex bg-slate-50 overflow-hidden">
            <Sidebar />
            <main className="flex-1 flex flex-col min-w-0 h-full">
                <Header />
                <div className="flex-1 overflow-y-auto p-4 md:p-8">
                    <div className="max-w-7xl mx-auto space-y-6">
                        {/* Header Header */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                            <div>
                                <div className="flex items-center gap-2">
                                    <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200 text-xs font-bold uppercase">
                                        Section-by-Section Master Governance
                                    </Badge>
                                </div>
                                <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight mt-1 flex items-center gap-2.5">
                                    <Settings className="w-7 h-7 text-indigo-600" />
                                    ERP System Administration & Governance
                                </h1>
                                <p className="text-xs text-slate-500 mt-1">
                                    Categorized rule engine for Finance, Service Orders (SOD), Inventory Benchmark Rates, and System Operations.
                                </p>
                            </div>
                        </div>

                        {/* Section-by-Section Categorized Tabs */}
                        <Tabs defaultValue="finance" value={activeTab} onValueChange={setActiveTab} className="w-full space-y-6">
                            <TabsList className="bg-slate-200/80 p-1 rounded-2xl grid grid-cols-2 md:grid-cols-5 gap-1 h-auto">
                                <TabsTrigger
                                    value="finance"
                                    className="rounded-xl py-2.5 text-xs font-bold data-[state=active]:bg-white data-[state=active]:text-indigo-600 data-[state=active]:shadow-sm flex items-center justify-center gap-2"
                                >
                                    <DollarSign className="w-4 h-4" />
                                    <span>1. Finance & Taxes</span>
                                </TabsTrigger>

                                <TabsTrigger
                                    value="sod"
                                    className="rounded-xl py-2.5 text-xs font-bold data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:shadow-sm flex items-center justify-center gap-2"
                                >
                                    <PackageCheck className="w-4 h-4" />
                                    <span>2. SOD Operations</span>
                                </TabsTrigger>

                                <TabsTrigger
                                    value="inventory"
                                    className="rounded-xl py-2.5 text-xs font-bold data-[state=active]:bg-white data-[state=active]:text-amber-600 data-[state=active]:shadow-sm flex items-center justify-center gap-2"
                                >
                                    <Boxes className="w-4 h-4" />
                                    <span>3. Inventory Rates</span>
                                </TabsTrigger>

                                <TabsTrigger
                                    value="maintenance"
                                    className="rounded-xl py-2.5 text-xs font-bold data-[state=active]:bg-white data-[state=active]:text-rose-600 data-[state=active]:shadow-sm flex items-center justify-center gap-2"
                                >
                                    <Wrench className="w-4 h-4" />
                                    <span>4. Operations & Maintenance</span>
                                </TabsTrigger>

                                <TabsTrigger
                                    value="tables"
                                    className="rounded-xl py-2.5 text-xs font-bold data-[state=active]:bg-white data-[state=active]:text-slate-800 data-[state=active]:shadow-sm flex items-center justify-center gap-2"
                                >
                                    <TableIcon className="w-4 h-4" />
                                    <span>5. Table Column Layouts</span>
                                </TabsTrigger>
                            </TabsList>

                            {/* TAB 1: FINANCE SECTION */}
                            <TabsContent value="finance">
                                <FinanceSectionCard />
                            </TabsContent>

                            {/* TAB 2: SOD OPERATIONS SECTION */}
                            <TabsContent value="sod">
                                <SODOperationsSectionCard />
                            </TabsContent>

                            {/* TAB 3: INVENTORY RATES SECTION */}
                            <TabsContent value="inventory">
                                <InventorySectionCard />
                                <div className="mt-6">
                                    <MaterialAssignment />
                                </div>
                            </TabsContent>

                            {/* TAB 4: ADVANCED MAINTENANCE SECTION */}
                            <TabsContent value="maintenance">
                                <AdvancedOperationsCard />
                            </TabsContent>

                            {/* TAB 5: TABLE PREFERENCES SECTION */}
                            <TabsContent value="tables">
                                <Card className="border-slate-200 shadow-sm">
                                    <CardHeader className="py-4 border-b border-slate-100">
                                        <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                                            <TableIcon className="w-5 h-5 text-blue-600" />
                                            Table Column Visibility & Layout Preferences
                                        </CardTitle>
                                        <CardDescription className="text-xs">Customize visible columns and ordering for system data tables.</CardDescription>
                                    </CardHeader>
                                    <CardContent className="p-6">
                                        <div className="grid gap-6">
                                            {Object.entries(settings || {}).map(([tableName, tableSettings]) => {
                                                if (!tableSettings) return null;
                                                return (
                                                    <TableConfigCard
                                                        key={tableName}
                                                        tableName={tableName}
                                                        settings={tableSettings}
                                                        onSave={(cols) => mutation.mutate({ tableName, visibleColumns: cols })}
                                                        isSaving={mutation.isPending}
                                                    />
                                                );
                                            })}
                                        </div>
                                    </CardContent>
                                </Card>
                            </TabsContent>
                        </Tabs>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default AdminDashboard;

// ----------------------------------------------------------------------
// SECTION 1: FINANCE & COMMERCIAL GOVERNANCE CARD
// ----------------------------------------------------------------------
function FinanceSectionCard() {
    const queryClient = useQueryClient();
    const { data: configs = {} } = useQuery<Record<string, string>>({
        queryKey: ['system-config'],
        queryFn: async () => (await fetch('/api/admin/system-config')).json(),
        staleTime: 30000
    });

    const mutation = useMutation({
        mutationFn: async ({ key, value }: { key: string, value: string }) => {
            const res = await fetch('/api/admin/system-config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ key, value })
            });
            if (!res.ok) throw new Error('Failed');
            return res.json();
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ['system-config'] });
            toast.success(`Updated ${variables.key} successfully`);
        },
        onError: () => toast.error("Failed to update financial parameter")
    });

    const handleValidatedUpdate = useCallback((key: string, rawVal: string, min: number = 0, max?: number) => {
        const num = Number(rawVal);
        if (isNaN(num)) {
            toast.error(`Invalid numeric value for ${key}`);
            return;
        }
        if (num < min) {
            toast.error(`Value cannot be less than ${min}`);
            return;
        }
        if (max !== undefined && num > max) {
            toast.error(`Value cannot exceed ${max}`);
            return;
        }
        mutation.mutate({ key, value: String(num) });
    }, [mutation]);

    return (
        <Card className="border-l-4 border-l-indigo-600 shadow-sm">
            <CardHeader className="py-4 border-b border-slate-100">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <DollarSign className="w-5 h-5 text-indigo-600" />
                        <CardTitle className="text-lg">Section 1: Finance, Taxes & Approval Limits</CardTitle>
                    </div>
                    {mutation.isPending && (
                        <div className="flex items-center gap-1.5 text-xs text-indigo-600 font-bold">
                            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving changes...
                        </div>
                    )}
                </div>
                <CardDescription>Configure government tax percentages, retention withholdings, and voucher approval limits.</CardDescription>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
                        <Label className="text-xs font-bold text-slate-800">Government VAT Rate (%)</Label>
                        <Input
                            type="number"
                            step="0.1"
                            defaultValue={configs['FINANCE_VAT_PERCENT'] || '18.0'}
                            onBlur={(e) => handleValidatedUpdate('FINANCE_VAT_PERCENT', e.target.value, 0, 100)}
                            className="h-9 bg-white font-mono font-bold text-xs"
                        />
                        <p className="text-[10px] text-slate-400">Value Added Tax applied to contractor invoices.</p>
                    </div>

                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
                        <Label className="text-xs font-bold text-slate-800">SSCL Levy Rate (%)</Label>
                        <Input
                            type="number"
                            step="0.1"
                            defaultValue={configs['FINANCE_SSCL_PERCENT'] || '2.5'}
                            onBlur={(e) => handleValidatedUpdate('FINANCE_SSCL_PERCENT', e.target.value, 0, 100)}
                            className="h-9 bg-white font-mono font-bold text-xs"
                        />
                        <p className="text-[10px] text-slate-400">Social Security Contribution Levy.</p>
                    </div>

                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
                        <Label className="text-xs font-bold text-slate-800">Retention Withholding (%)</Label>
                        <Input
                            type="number"
                            step="0.5"
                            defaultValue={configs['FINANCE_RETENTION_PERCENT'] || '5.0'}
                            onBlur={(e) => handleValidatedUpdate('FINANCE_RETENTION_PERCENT', e.target.value, 0, 100)}
                            className="h-9 bg-white font-mono font-bold text-xs"
                        />
                        <p className="text-[10px] text-slate-400">Security retention withheld from payouts.</p>
                    </div>

                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
                        <Label className="text-xs font-bold text-slate-800">QC Rejection Penalty (LKR)</Label>
                        <Input
                            type="number"
                            defaultValue={configs['FINANCE_QC_REJECTION_PENALTY_AMOUNT'] || '1500'}
                            onBlur={(e) => handleValidatedUpdate('FINANCE_QC_REJECTION_PENALTY_AMOUNT', e.target.value, 0)}
                            className="h-9 bg-white font-mono font-bold text-xs text-rose-600"
                        />
                        <p className="text-[10px] text-slate-400">Deduction amount per failed QC audit.</p>
                    </div>

                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
                        <Label className="text-xs font-bold text-slate-800">Manager Approval Limit (LKR)</Label>
                        <Input
                            type="number"
                            defaultValue={configs['FINANCE_APPROVAL_LIMIT_MANAGER'] || '100000'}
                            onBlur={(e) => handleValidatedUpdate('FINANCE_APPROVAL_LIMIT_MANAGER', e.target.value, 0)}
                            className="h-9 bg-white font-mono font-bold text-xs"
                        />
                        <p className="text-[10px] text-slate-400">Max voucher amount approved by Manager.</p>
                    </div>

                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
                        <Label className="text-xs font-bold text-slate-800">GM Approval Limit (LKR)</Label>
                        <Input
                            type="number"
                            defaultValue={configs['FINANCE_APPROVAL_LIMIT_GM'] || '1000000'}
                            onBlur={(e) => handleValidatedUpdate('FINANCE_APPROVAL_LIMIT_GM', e.target.value, 0)}
                            className="h-9 bg-white font-mono font-bold text-xs"
                        />
                        <p className="text-[10px] text-slate-400">Max voucher amount approved by GM.</p>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

// ----------------------------------------------------------------------
// SECTION 2: SOD OPERATIONS SECTION CARD
// ----------------------------------------------------------------------
function SODOperationsSectionCard() {
    const queryClient = useQueryClient();
    const { data: configs = {} } = useQuery<Record<string, string>>({
        queryKey: ['system-config'],
        queryFn: async () => (await fetch('/api/admin/system-config')).json(),
        staleTime: 30000
    });

    const mutation = useMutation({
        mutationFn: async ({ key, value }: { key: string, value: string }) => {
            const res = await fetch('/api/admin/system-config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ key, value })
            });
            if (!res.ok) throw new Error('Failed');
            return res.json();
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ['system-config'] });
            toast.success(`Updated ${variables.key} successfully`);
        },
        onError: () => toast.error("Failed to update operational setting")
    });

    const handleValidatedUpdate = useCallback((key: string, rawVal: string, min: number = 0, max?: number) => {
        const num = Number(rawVal);
        if (isNaN(num)) {
            toast.error(`Invalid numeric value for ${key}`);
            return;
        }
        if (num < min) {
            toast.error(`Value cannot be less than ${min}`);
            return;
        }
        if (max !== undefined && num > max) {
            toast.error(`Value cannot exceed ${max}`);
            return;
        }
        mutation.mutate({ key, value: String(num) });
    }, [mutation]);

    const ospSource = configs['OSP_MATERIAL_SOURCE'] || 'SLT';

    return (
        <Card className="border-l-4 border-l-blue-600 shadow-sm">
            <CardHeader className="py-4 border-b border-slate-100">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <PackageCheck className="w-5 h-5 text-blue-600" />
                        <CardTitle className="text-lg">Section 2: Service Orders (SOD) Operations & SLA Rules</CardTitle>
                    </div>
                    {mutation.isPending && (
                        <div className="flex items-center gap-1.5 text-xs text-blue-600 font-bold">
                            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving changes...
                        </div>
                    )}
                </div>
                <CardDescription>Manage SLA turnaround hours, FTTH material sources, and QC score thresholds.</CardDescription>
            </CardHeader>

            <CardContent className="p-6 space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                    {/* OSP FTTH Material Source Setting */}
                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                        <Label className="text-xs font-bold text-slate-800">OSP FTTH Material Source</Label>
                        <Select
                            value={ospSource}
                            onValueChange={(val) => mutation.mutate({ key: 'OSP_MATERIAL_SOURCE', value: val })}
                            disabled={mutation.isPending}
                        >
                            <SelectTrigger className="bg-white h-9 text-xs">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="SLT">
                                    <span className="font-medium text-xs">SLT Provided (Default)</span>
                                </SelectItem>
                                <SelectItem value="COMPANY">
                                    <span className="font-medium text-xs">Company (SLTS) Supplied</span>
                                </SelectItem>
                            </SelectContent>
                        </Select>
                        <p className="text-[10px] text-slate-400">Primary stock source for OSP FTTH orders.</p>
                    </div>

                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
                        <Label className="text-xs font-bold text-slate-800">FTTH SLA Target (Hours)</Label>
                        <Input
                            type="number"
                            defaultValue={configs['SOD_SLA_FTTH_HOURS'] || '48'}
                            onBlur={(e) => handleValidatedUpdate('SOD_SLA_FTTH_HOURS', e.target.value, 1)}
                            className="h-9 bg-white font-mono font-bold text-xs"
                        />
                        <p className="text-[10px] text-slate-400">Target hours to complete FTTH order.</p>
                    </div>

                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
                        <Label className="text-xs font-bold text-slate-800">Copper SLA Target (Hours)</Label>
                        <Input
                            type="number"
                            defaultValue={configs['SOD_SLA_COPPER_HOURS'] || '72'}
                            onBlur={(e) => handleValidatedUpdate('SOD_SLA_COPPER_HOURS', e.target.value, 1)}
                            className="h-9 bg-white font-mono font-bold text-xs"
                        />
                        <p className="text-[10px] text-slate-400">Target hours for Copper connection.</p>
                    </div>

                    {/* 5-Tier Executive SLA Breakdown Rules Sub-Section */}
                    <div className="sm:col-span-2 lg:col-span-4 p-4 bg-blue-50/50 rounded-xl border border-blue-200/60 space-y-3">
                        <div className="flex items-center gap-2">
                            <Clock className="w-4 h-4 text-blue-600" />
                            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">5-Tier Executive SLA Aging Breakdown Rules</h4>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                            <div className="space-y-1">
                                <Label className="text-[11px] font-bold text-emerald-700">Tier 1 Target (≤ Days)</Label>
                                <Input
                                    type="number"
                                    defaultValue={configs['SOD_SLA_TIER1_DAYS'] || '2'}
                                    onBlur={(e) => handleValidatedUpdate('SOD_SLA_TIER1_DAYS', e.target.value, 1)}
                                    className="h-8 bg-white font-mono font-bold text-xs border-emerald-300 text-emerald-600"
                                />
                                <p className="text-[9.5px] text-slate-400">Excellent SLA badge (Default ≤2 days).</p>
                            </div>
                            <div className="space-y-1">
                                <Label className="text-[11px] font-bold text-teal-700">Tier 2 Target (≤ Days)</Label>
                                <Input
                                    type="number"
                                    defaultValue={configs['SOD_SLA_TIER2_DAYS'] || '5'}
                                    onBlur={(e) => handleValidatedUpdate('SOD_SLA_TIER2_DAYS', e.target.value, 2)}
                                    className="h-8 bg-white font-mono font-bold text-xs border-teal-300 text-teal-600"
                                />
                                <p className="text-[9.5px] text-slate-400">Normal SLA badge (Default ≤5 days).</p>
                            </div>
                            <div className="space-y-1">
                                <Label className="text-[11px] font-bold text-amber-700">Tier 3 Target (≤ Days)</Label>
                                <Input
                                    type="number"
                                    defaultValue={configs['SOD_SLA_TIER3_DAYS'] || '7'}
                                    onBlur={(e) => handleValidatedUpdate('SOD_SLA_TIER3_DAYS', e.target.value, 3)}
                                    className="h-8 bg-white font-mono font-bold text-xs border-amber-300 text-amber-600"
                                />
                                <p className="text-[9.5px] text-slate-400">Warning SLA badge (Default ≤7 days).</p>
                            </div>
                            <div className="space-y-1">
                                <Label className="text-[11px] font-bold text-orange-700">Tier 4 Target (≤ Days)</Label>
                                <Input
                                    type="number"
                                    defaultValue={configs['SOD_SLA_TIER4_DAYS'] || '10'}
                                    onBlur={(e) => handleValidatedUpdate('SOD_SLA_TIER4_DAYS', e.target.value, 4)}
                                    className="h-8 bg-white font-mono font-bold text-xs border-orange-300 text-orange-600"
                                />
                                <p className="text-[9.5px] text-slate-400">High Warning SLA badge (Default ≤10 days).</p>
                            </div>
                        </div>
                    </div>

                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
                        <Label className="text-xs font-bold text-slate-800">QC Pass Score Threshold (%)</Label>
                        <Input
                            type="number"
                            defaultValue={configs['SOD_QC_PASS_SCORE_PERCENT'] || '80'}
                            onBlur={(e) => handleValidatedUpdate('SOD_QC_PASS_SCORE_PERCENT', e.target.value, 0, 100)}
                            className="h-9 bg-white font-mono font-bold text-xs text-emerald-600"
                        />
                        <p className="text-[10px] text-slate-400">Min score required to mark QC passed.</p>
                    </div>

                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
                        <Label className="text-xs font-bold text-slate-800">Free Drop Wire Span (Meters)</Label>
                        <Input
                            type="number"
                            defaultValue={configs['SOD_FREE_CABLE_DISTANCE_METERS'] || '50'}
                            onBlur={(e) => handleValidatedUpdate('SOD_FREE_CABLE_DISTANCE_METERS', e.target.value, 0)}
                            className="h-9 bg-white font-mono font-bold text-xs"
                        />
                        <p className="text-[10px] text-slate-400">Free cable span before surcharge applies.</p>
                    </div>

                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
                        <Label className="text-xs font-bold text-slate-800">Max Active SOD / Team</Label>
                        <Input
                            type="number"
                            defaultValue={configs['SOD_CONTRACTOR_MAX_ACTIVE_SOD'] || '50'}
                            onBlur={(e) => handleValidatedUpdate('SOD_CONTRACTOR_MAX_ACTIVE_SOD', e.target.value, 1)}
                            className="h-9 bg-white font-mono font-bold text-xs"
                        />
                        <p className="text-[10px] text-slate-400">Max active orders per contractor team.</p>
                    </div>

                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5 sm:col-span-2">
                        <Label className="text-xs font-bold text-slate-800">Offline Order Types (Comma-separated)</Label>
                        <Input 
                            defaultValue={configs['OFFLINE_ORDER_TYPES'] || 'MODIFY-LOCATION'}
                            onBlur={(e) => {
                                const val = e.target.value.trim();
                                if (val !== (configs['OFFLINE_ORDER_TYPES'] || 'MODIFY-LOCATION')) {
                                    mutation.mutate({ key: 'OFFLINE_ORDER_TYPES', value: val });
                                }
                            }}
                            disabled={mutation.isPending}
                            placeholder="e.g. MODIFY-LOCATION, RE-LOCATION"
                            className="h-9 bg-white text-xs font-mono"
                        />
                        <p className="text-[10px] text-slate-400">Order types marked offline during sync.</p>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

// ----------------------------------------------------------------------
// SECTION 3: INVENTORY & MATERIAL BENCHMARK RATES SECTION CARD
// ----------------------------------------------------------------------
function InventorySectionCard() {
    const queryClient = useQueryClient();
    const { data: configs = {} } = useQuery<Record<string, string>>({
        queryKey: ['system-config'],
        queryFn: async () => (await fetch('/api/admin/system-config')).json(),
        staleTime: 30000
    });

    const mutation = useMutation({
        mutationFn: async ({ key, value }: { key: string, value: string }) => {
            const res = await fetch('/api/admin/system-config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ key, value })
            });
            if (!res.ok) throw new Error('Failed');
            return res.json();
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ['system-config'] });
            toast.success(`Updated ${variables.key} successfully`);
        },
        onError: () => toast.error("Failed to update inventory rate setting")
    });

    const handleValidatedUpdate = useCallback((key: string, rawVal: string, min: number = 0, max?: number) => {
        const num = Number(rawVal);
        if (isNaN(num)) {
            toast.error(`Invalid numeric value for ${key}`);
            return;
        }
        if (num < min) {
            toast.error(`Value cannot be less than ${min}`);
            return;
        }
        if (max !== undefined && num > max) {
            toast.error(`Value cannot exceed ${max}`);
            return;
        }
        mutation.mutate({ key, value: String(num) });
    }, [mutation]);

    return (
        <Card className="border-l-4 border-l-amber-600 shadow-sm">
            <CardHeader className="py-4 border-b border-slate-100">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Boxes className="w-5 h-5 text-amber-600" />
                        <CardTitle className="text-lg">Section 3: Inventory Benchmark Rates & Reorder Points</CardTitle>
                    </div>
                    {mutation.isPending && (
                        <div className="flex items-center gap-1.5 text-xs text-amber-600 font-bold">
                            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving changes...
                        </div>
                    )}
                </div>
                <CardDescription>
                    Configure baseline benchmark reference rates (used for claims, fallback & budgeting) and warehouse reorder points.
                    <span className="italic font-semibold text-slate-700 ml-1">(Actual inventory valuation costs are captured per GRN batch).</span>
                </CardDescription>
            </CardHeader>

            <CardContent className="p-6 space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
                        <Label className="text-xs font-bold text-slate-800">Drop Wire Rate (LKR / Meter)</Label>
                        <Input
                            type="number"
                            defaultValue={configs['INVENTORY_DROP_WIRE_RATE_PER_METER'] || '45'}
                            onBlur={(e) => handleValidatedUpdate('INVENTORY_DROP_WIRE_RATE_PER_METER', e.target.value, 0)}
                            className="h-9 bg-white font-mono font-bold text-xs"
                        />
                        <p className="text-[10px] text-slate-400">Baseline benchmark claim rate per meter.</p>
                    </div>

                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
                        <Label className="text-xs font-bold text-slate-800">ONT Unit Standard Rate (LKR)</Label>
                        <Input
                            type="number"
                            defaultValue={configs['INVENTORY_ONT_UNIT_RATE'] || '12000'}
                            onBlur={(e) => handleValidatedUpdate('INVENTORY_ONT_UNIT_RATE', e.target.value, 0)}
                            className="h-9 bg-white font-mono font-bold text-xs"
                        />
                        <p className="text-[10px] text-slate-400">Baseline benchmark rate per ONT unit.</p>
                    </div>

                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
                        <Label className="text-xs font-bold text-slate-800">Safety Cable Stock (Meters)</Label>
                        <Input
                            type="number"
                            defaultValue={configs['INVENTORY_SAFETY_STOCK_CABLE_METERS'] || '5000'}
                            onBlur={(e) => handleValidatedUpdate('INVENTORY_SAFETY_STOCK_CABLE_METERS', e.target.value, 0)}
                            className="h-9 bg-white font-mono font-bold text-xs text-amber-700"
                        />
                        <p className="text-[10px] text-slate-400">Reorder point trigger threshold.</p>
                    </div>

                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
                        <Label className="text-xs font-bold text-slate-800">Store Auto-Approve Transfer (LKR)</Label>
                        <Input
                            type="number"
                            defaultValue={configs['INVENTORY_STORE_TRANSFER_AUTO_APPROVE_LIMIT'] || '50000'}
                            onBlur={(e) => handleValidatedUpdate('INVENTORY_STORE_TRANSFER_AUTO_APPROVE_LIMIT', e.target.value, 0)}
                            className="h-9 bg-white font-mono font-bold text-xs"
                        />
                        <p className="text-[10px] text-slate-400">Max auto-approved store transfer value.</p>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

// ----------------------------------------------------------------------
// SECTION 4: ADVANCED OPERATIONS & MAINTENANCE COMPONENT
// ----------------------------------------------------------------------
function AdvancedOperationsCard() {
    const router = useRouter();
    const queryClient = useQueryClient();

    // Reset Dialog States
    const [isResetDialogOpen, setIsResetDialogOpen] = useState(false);
    const [resetConfirmation, setResetConfirmation] = useState('');
    const [isResetLogsOpen, setIsResetLogsOpen] = useState(false);
    const [logsConfirmation, setLogsConfirmation] = useState('');

    // Fetch Sync Stats
    const { data: syncStats } = useQuery<{ queuedCount: number; lastSyncTriggered: string }>({
        queryKey: ['sync-stats'],
        queryFn: async () => (await fetch('/api/admin/sync-stats')).json(),
        refetchInterval: 10000
    });

    // Reset Data Mutation
    const resetDataMutation = useMutation({
        mutationFn: async () => {
            const res = await fetch('/api/admin/reset-demo-data', { method: 'POST' });
            if (!res.ok) throw new Error('Reset failed');
            return res.json() as Promise<{ message: string; serviceOrders?: number }>;
        },
        onSuccess: (data) => {
            toast.success(`Data reset successful: ${data.serviceOrders ?? 0} orders deleted`);
            setIsResetDialogOpen(false);
            setResetConfirmation('');
            queryClient.invalidateQueries();
            router.refresh();
        },
        onError: () => toast.error("Failed to reset demo data")
    });

    // Clear Logs Mutation
    const clearLogsMutation = useMutation({
        mutationFn: async () => {
            const res = await fetch('/api/admin/clear-logs', { method: 'POST' });
            if (!res.ok) throw new Error('Log clear failed');
            return res.json() as Promise<{ message: string; logsDeleted?: number }>;
        },
        onSuccess: (data) => {
            toast.success(`Logs cleared: ${data.logsDeleted ?? 0} entries deleted`);
            setIsResetLogsOpen(false);
            setLogsConfirmation('');
        },
        onError: () => toast.error("Failed to clear system logs")
    });

    return (
        <Card className="border-l-4 border-l-rose-600 shadow-sm">
            <CardHeader className="py-4 border-b border-slate-100">
                <div className="flex items-center gap-2">
                    <Wrench className="w-5 h-5 text-rose-600" />
                    <CardTitle className="text-lg">Section 4: Advanced Operations & System Maintenance</CardTitle>
                </div>
                <CardDescription>Perform administrative maintenance tasks, clear caches, and inspect queue stats.</CardDescription>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
                {/* Sync Queue Status */}
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wide">Sync Queue & Background Status</h4>
                        <p className="text-[11px] text-slate-500 mt-1">
                            Pending queued sync operations: <span className="font-mono font-bold text-slate-900">{syncStats?.queuedCount ?? 0}</span>
                        </p>
                    </div>
                    <Badge variant="outline" className="bg-emerald-50 text-emerald-700 font-mono text-xs font-bold shrink-0">
                        Queue Active
                    </Badge>
                </div>

                {/* Maintenance Actions */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="p-4 bg-rose-50/60 rounded-xl border border-rose-100 space-y-3">
                        <div>
                            <h4 className="text-xs font-extrabold text-rose-900 uppercase">Clear System Audit Logs</h4>
                            <p className="text-[11px] text-slate-500 mt-0.5">Purge older system error and operational log entries.</p>
                        </div>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setIsResetLogsOpen(true)}
                            className="text-xs font-bold text-rose-700 border-rose-200 hover:bg-rose-100"
                        >
                            Clear System Logs
                        </Button>
                    </div>

                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                        <div>
                            <h4 className="text-xs font-extrabold text-slate-900 uppercase">Reset Demo Transaction Data</h4>
                            <p className="text-[11px] text-slate-500 mt-0.5">Reset transient demo service orders for testing reset.</p>
                        </div>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setIsResetDialogOpen(true)}
                            className="text-xs font-bold text-slate-700 border-slate-300 hover:bg-slate-100"
                        >
                            Reset Demo Data
                        </Button>
                    </div>
                </div>

                {/* Dialogs */}
                <Dialog open={isResetDialogOpen} onOpenChange={setIsResetDialogOpen}>
                    <DialogContent className="max-w-md bg-white border border-slate-200 rounded-2xl p-6">
                        <DialogHeader>
                            <DialogTitle className="text-base font-bold text-slate-900">Reset Demo Transaction Data?</DialogTitle>
                            <DialogDescription className="text-xs text-slate-500 mt-1">
                                Type <span className="font-mono font-bold text-rose-600">RESET</span> to confirm demo data purge.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="py-2">
                            <Input
                                value={resetConfirmation}
                                onChange={(e) => setResetConfirmation(e.target.value)}
                                placeholder="Type RESET to confirm"
                                className="h-9 text-xs font-mono font-bold"
                            />
                        </div>
                        <DialogFooter className="flex gap-2">
                            <Button variant="outline" size="sm" onClick={() => setIsResetDialogOpen(false)}>Cancel</Button>
                            <Button
                                size="sm"
                                disabled={resetConfirmation !== 'RESET' || resetDataMutation.isPending}
                                onClick={() => resetDataMutation.mutate()}
                                className="bg-rose-600 hover:bg-rose-700 text-white font-bold"
                            >
                                {resetDataMutation.isPending ? 'Resetting...' : 'Confirm Reset'}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                <Dialog open={isResetLogsOpen} onOpenChange={setIsResetLogsOpen}>
                    <DialogContent className="max-w-md bg-white border border-slate-200 rounded-2xl p-6">
                        <DialogHeader>
                            <DialogTitle className="text-base font-bold text-slate-900">Clear System Audit Logs?</DialogTitle>
                            <DialogDescription className="text-xs text-slate-500 mt-1">
                                Type <span className="font-mono font-bold text-rose-600">CLEAR</span> to purge old logs.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="py-2">
                            <Input
                                value={logsConfirmation}
                                onChange={(e) => setLogsConfirmation(e.target.value)}
                                placeholder="Type CLEAR to confirm"
                                className="h-9 text-xs font-mono font-bold"
                            />
                        </div>
                        <DialogFooter className="flex gap-2">
                            <Button variant="outline" size="sm" onClick={() => setIsResetLogsOpen(false)}>Cancel</Button>
                            <Button
                                size="sm"
                                disabled={logsConfirmation !== 'CLEAR' || clearLogsMutation.isPending}
                                onClick={() => clearLogsMutation.mutate()}
                                className="bg-rose-600 hover:bg-rose-700 text-white font-bold"
                            >
                                {clearLogsMutation.isPending ? 'Clearing...' : 'Confirm Clear'}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </CardContent>
        </Card>
    );
}

// ----------------------------------------------------------------------
// TABLE CONFIG CARD HELPER COMPONENT
// ----------------------------------------------------------------------
function TableConfigCard({ tableName, settings, onSave, isSaving }: { tableName: string, settings: TableSettings, onSave: (cols: string[]) => void, isSaving: boolean }) {
    const initialVisible = Array.isArray(settings?.visibleColumns) ? settings.visibleColumns : [];
    const availableCols = Array.isArray(settings?.availableColumns) ? settings.availableColumns : [];
    const [visible, setVisible] = useState<string[]>(initialVisible);

    const [prevPropsSettings, setPrevPropsSettings] = useState<string[]>(initialVisible);

    if (Array.isArray(settings?.visibleColumns) && settings.visibleColumns.join(',') !== prevPropsSettings.join(',')) {
        setPrevPropsSettings(settings.visibleColumns);
        setVisible(settings.visibleColumns);
    }

    const toggleColumn = useCallback((key: string) => {
        setVisible(prev =>
            prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
        );
    }, []);

    const label = TABLE_LABELS[tableName] || tableName.toUpperCase();

    return (
        <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold text-slate-900 uppercase">{label} ({visible.length} Columns Active)</span>
                <Button
                    size="sm"
                    onClick={() => onSave(visible)}
                    disabled={isSaving}
                    className="h-8 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
                >
                    {isSaving ? 'Saving...' : 'Save Layout'}
                </Button>
            </div>

            <div className="flex flex-wrap gap-2 pt-1">
                {availableCols.map((col) => {
                    const isChecked = visible.includes(col.key);
                    return (
                        <button
                            key={col.key}
                            type="button"
                            onClick={() => !col.required && toggleColumn(col.key)}
                            disabled={col.required}
                            className={cn(
                                "px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all flex items-center gap-1.5",
                                isChecked ? "bg-blue-50 text-blue-700 border-blue-200" : "bg-white text-slate-500 border-slate-200 hover:border-slate-300",
                                col.required && "opacity-60 cursor-not-allowed"
                            )}
                        >
                            <span>{col.label}</span>
                            {col.required && <span className="text-[10px] text-slate-400">(Required)</span>}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
