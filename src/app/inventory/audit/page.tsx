"use client";

import React, { useState } from 'react';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import RoleGuard from '@/components/RoleGuard';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ShieldCheck, Scale, FileSpreadsheet, FileText } from 'lucide-react';

import ComplianceAuditTab from './tabs/ComplianceAuditTab';
import MaterialAuditTab from './tabs/MaterialAuditTab';
import ReconciliationTab from './tabs/ReconciliationTab';
import BalanceSheetTab from './tabs/BalanceSheetTab';

export default function AuditReconciliationHub() {
    const [activeTab, setActiveTab] = useState('compliance');

    return (
        <RoleGuard allowedRoles={['SUPER_ADMIN', 'ADMIN', 'STORES_MANAGER', 'OSP_MANAGER', 'FINANCE_MANAGER']}>
            <div className="flex h-screen bg-slate-50 dark:bg-slate-900 overflow-hidden font-sans">
                <Sidebar />
                <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                    <Header />
                    <main className="flex-1 overflow-y-auto">
                        <div className="max-w-7xl mx-auto p-6 space-y-6">
                            <div className="flex items-center gap-3 border-b border-slate-200 dark:border-slate-800 pb-4">
                                <div className="p-3 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-xl">
                                    <ShieldCheck size={28} className="stroke-[2.5]" />
                                </div>
                                <div>
                                    <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                                        Audit & Reconciliation Hub
                                    </h1>
                                    <p className="text-sm font-semibold text-slate-500 dark:text-slate-400 mt-1">
                                        Centralized portal for inventory compliance, material audits, and month-end closing
                                    </p>
                                </div>
                            </div>

                            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full space-y-6">
                                <div className="bg-white dark:bg-slate-950 p-1 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm inline-flex w-full overflow-x-auto">
                                    <TabsList className="bg-transparent h-auto p-0 flex gap-1 w-full justify-start">
                                        <TabsTrigger 
                                            value="compliance" 
                                            className="data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700 dark:data-[state=active]:bg-blue-900/30 dark:data-[state=active]:text-blue-400 rounded-lg px-4 py-2.5 flex items-center gap-2 whitespace-nowrap"
                                        >
                                            <ShieldCheck size={16} />
                                            <span className="font-bold">Inventory Compliance</span>
                                        </TabsTrigger>
                                        <TabsTrigger 
                                            value="material-audit" 
                                            className="data-[state=active]:bg-purple-50 data-[state=active]:text-purple-700 dark:data-[state=active]:bg-purple-900/30 dark:data-[state=active]:text-purple-400 rounded-lg px-4 py-2.5 flex items-center gap-2 whitespace-nowrap"
                                        >
                                            <FileSpreadsheet size={16} />
                                            <span className="font-bold">Material Audit</span>
                                        </TabsTrigger>
                                        <TabsTrigger 
                                            value="reconciliation" 
                                            className="data-[state=active]:bg-amber-50 data-[state=active]:text-amber-700 dark:data-[state=active]:bg-amber-900/30 dark:data-[state=active]:text-amber-400 rounded-lg px-4 py-2.5 flex items-center gap-2 whitespace-nowrap"
                                        >
                                            <Scale size={16} />
                                            <span className="font-bold">Reconciliation</span>
                                        </TabsTrigger>
                                        <TabsTrigger 
                                            value="balance-sheet" 
                                            className="data-[state=active]:bg-emerald-50 data-[state=active]:text-emerald-700 dark:data-[state=active]:bg-emerald-900/30 dark:data-[state=active]:text-emerald-400 rounded-lg px-4 py-2.5 flex items-center gap-2 whitespace-nowrap"
                                        >
                                            <FileText size={16} />
                                            <span className="font-bold">Contractor Balances</span>
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
