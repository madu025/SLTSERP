"use client";

import {  useState  } from 'react';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import RoleGuard from '@/components/RoleGuard';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
    ShieldCheck, 
    Scale, 
    FileSpreadsheet, 
    FileText } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';

import ComplianceAuditTab from './tabs/ComplianceAuditTab';
import MaterialAuditTab from './tabs/MaterialAuditTab';
import ReconciliationTab from './tabs/ReconciliationTab';
import BalanceSheetTab from './tabs/BalanceSheetTab';

export default function AuditReconciliationHub() {
    const [activeTab, setActiveTab] = useState('compliance');

    // Fetch quick summary stats for top KPI cards
    const { data: auditReport } = useQuery({
        queryKey: ['inventory-audit-summary-kpi'],
        queryFn: async () => {
            const res = await fetch(`/api/admin/inventory/ai-audit?_t=${Date.now()}`);
            if (!res.ok) return null;
            return res.json();
        }
    });

    const summary = auditReport?.data?.summary;

    return (
        <RoleGuard allowedRoles={['SUPER_ADMIN', 'ADMIN', 'STORES_MANAGER', 'OSP_MANAGER', 'FINANCE_MANAGER']}>
            <div className="flex h-screen bg-slate-50 dark:bg-slate-900 overflow-hidden font-sans">
                <Sidebar />
                <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                    <Header />
                    <main className="flex-1 overflow-y-auto">
                        <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-6">
                            
                            {/* Page Header */}
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-950 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2">
                                        <span className="px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border border-blue-200 dark:border-blue-800/50 rounded-md font-mono">
                                            ISO 9001 / IFRS COMPLIANT
                                        </span>
                                        <span className="px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50 rounded-md font-mono">
                                            REAL-TIME LEDGER AUDIT
                                        </span>
                                    </div>
                                    <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2 mt-1">
                                        <ShieldCheck className="w-7 h-7 text-blue-600 dark:text-blue-400" />
                                        Audit & Reconciliation Hub
                                    </h1>
                                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                                        Centralized portal for inventory compliance, material usage reconciliation, and month-end closing balances.
                                    </p>
                                </div>

                                {/* KPI Mini Stat Pills */}
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                    <div className="bg-slate-50 dark:bg-slate-900/60 p-3 rounded-xl border border-slate-200/80 dark:border-slate-800 text-center min-w-[110px]">
                                        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">SODs Audited</p>
                                        <p className="text-lg font-black text-slate-900 dark:text-white mt-0.5">{summary?.sodsAudited ?? '—'}</p>
                                    </div>
                                    <div className="bg-slate-50 dark:bg-slate-900/60 p-3 rounded-xl border border-slate-200/80 dark:border-slate-800 text-center min-w-[110px]">
                                        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Discrepancies</p>
                                        <p className="text-lg font-black text-amber-600 dark:text-amber-400 mt-0.5">{summary?.discrepancyCount ?? '0'}</p>
                                    </div>
                                    <div className="bg-slate-50 dark:bg-slate-900/60 p-3 rounded-xl border border-slate-200/80 dark:border-slate-800 text-center col-span-2 sm:col-span-1 min-w-[110px]">
                                        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">High Risk</p>
                                        <p className="text-lg font-black text-rose-600 dark:text-rose-400 mt-0.5">{summary?.highSeverityCount ?? '0'}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Main Tabs Navigation */}
                            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full space-y-6">
                                <div className="bg-white dark:bg-slate-950 p-1.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm inline-flex w-full overflow-x-auto">
                                    <TabsList className="bg-transparent h-auto p-0 flex gap-1.5 w-full justify-start">
                                        <TabsTrigger 
                                            value="compliance" 
                                            className="data-[state=active]:bg-blue-600 data-[state=active]:text-white dark:data-[state=active]:bg-blue-600 dark:data-[state=active]:text-white rounded-lg px-4 py-2.5 flex items-center gap-2 text-xs font-bold transition-all whitespace-nowrap"
                                        >
                                            <ShieldCheck size={16} />
                                            <span>Inventory Compliance</span>
                                        </TabsTrigger>
                                        <TabsTrigger 
                                            value="material-audit" 
                                            className="data-[state=active]:bg-purple-600 data-[state=active]:text-white dark:data-[state=active]:bg-purple-600 dark:data-[state=active]:text-white rounded-lg px-4 py-2.5 flex items-center gap-2 text-xs font-bold transition-all whitespace-nowrap"
                                        >
                                            <FileSpreadsheet size={16} />
                                            <span>Material Audit</span>
                                        </TabsTrigger>
                                        <TabsTrigger 
                                            value="reconciliation" 
                                            className="data-[state=active]:bg-amber-600 data-[state=active]:text-white dark:data-[state=active]:bg-amber-600 dark:data-[state=active]:text-white rounded-lg px-4 py-2.5 flex items-center gap-2 text-xs font-bold transition-all whitespace-nowrap"
                                        >
                                            <Scale size={16} />
                                            <span>Usage Reconciliation</span>
                                        </TabsTrigger>
                                        <TabsTrigger 
                                            value="balance-sheet" 
                                            className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white dark:data-[state=active]:bg-emerald-600 dark:data-[state=active]:text-white rounded-lg px-4 py-2.5 flex items-center gap-2 text-xs font-bold transition-all whitespace-nowrap"
                                        >
                                            <FileText size={16} />
                                            <span>Contractor Balances</span>
                                        </TabsTrigger>
                                    </TabsList>
                                </div>

                                <TabsContent value="compliance" className="mt-0 outline-none">
                                    <ComplianceAuditTab />
                                </TabsContent>
                                <TabsContent value="material-audit" className="mt-0 outline-none">
                                    <MaterialAuditTab />
                                </TabsContent>
                                <TabsContent value="reconciliation" className="mt-0 outline-none">
                                    <ReconciliationTab />
                                </TabsContent>
                                <TabsContent value="balance-sheet" className="mt-0 outline-none">
                                    <BalanceSheetTab />
                                </TabsContent>
                            </Tabs>
                        </div>
                    </main>
                </div>
            </div>
        </RoleGuard>
    );
}
