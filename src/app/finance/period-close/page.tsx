"use client";

import { useState } from 'react';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import RoleGuard from '@/components/RoleGuard';
import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';
import { Lock, CheckCircle2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface YearEndResult {
    year: number;
    totalRevenue: number;
    totalExpense: number;
    netProfit: number;
}

export default function PeriodClosePage() {
    const [year, setYear] = useState<number>(() => new Date().getFullYear() - 1);
    const [isExecuting, setIsExecuting] = useState<boolean>(false);
    const [lastClose, setLastClose] = useState<YearEndResult | null>(null);

    const handleExecuteYearEnd = async () => {
        if (!Number.isInteger(year) || year < 2000 || year >= new Date().getFullYear()) {
            toast.error('Select a completed fiscal year');
            return;
        }
        if (!window.confirm(`Close FY ${year}? This posts the year-end journal and locks all 12 fiscal periods.`)) return;
        setIsExecuting(true);
        try {
            const res = await fetch('/api/finance/period-close', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ year })
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error?.message || 'Failed to execute Year-End Close');
            setLastClose(json.data);
            toast.success(`Formal Year-End Close FY ${year} executed! Retained Earnings updated & periods locked.`);
        } catch (err: unknown) {
            toast.error(err instanceof Error ? err.message : 'Failed to execute period close');
        } finally {
            setIsExecuting(false);
        }
    };

    return (
        <RoleGuard allowedRoles={[]} permissionId={RBAC_PERMISSIONS.ADMIN_RBAC}>
            <div className="flex h-screen bg-slate-50 overflow-hidden">
                <Sidebar />
                <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                    <Header />
                    <main className="flex-1 overflow-y-auto p-6 space-y-6">
                        
                        {/* Title */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div>
                                <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
                                    <Lock className="w-7 h-7 text-indigo-600" />
                                    Financial Period Close & Year-End Rollover
                                </h1>
                                <p className="text-sm text-slate-500 mt-1">
                                    Trial Balance validation, period locking, P&L zeroing, and Retained Earnings (EQU-RET-3010) rollover.
                                </p>
                            </div>

                            <Button onClick={handleExecuteYearEnd} disabled={isExecuting} className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold">
                                <ShieldCheck className="w-4 h-4 mr-2" />
                                {isExecuting ? 'Closing FY...' : `Execute FY ${year} Close`}
                            </Button>
                        </div>

                        {/* Status KPI Cards */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-200">
                                <div className="text-xs font-semibold uppercase text-slate-500">Selected Fiscal Year</div>
                                <label htmlFor="fiscal-close-year" className="sr-only">Fiscal year to close</label>
                                <input id="fiscal-close-year" type="number" min={2000} max={new Date().getFullYear() - 1}
                                    value={year} onChange={(event) => setYear(Number(event.target.value))}
                                    className="mt-1 w-32 rounded border border-slate-300 bg-white px-2 py-1 text-xl font-bold text-slate-900" />
                            </div>
                            <div className="bg-emerald-50 rounded-xl p-5 border border-emerald-200">
                                <div className="text-xs font-semibold uppercase text-emerald-800">Trial Balance Integrity</div>
                                <div className="text-xl font-bold text-emerald-950 mt-1 font-mono flex items-center gap-1.5">
                                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                                    {lastClose?.year === year ? 'Balanced at close' : 'Validated on close'}
                                </div>
                            </div>
                            <div className="bg-indigo-900 text-white rounded-xl p-5 shadow-sm">
                                <div className="text-xs font-semibold uppercase text-indigo-300">Period Lock Security</div>
                                <div className="text-xl font-bold text-indigo-100 mt-1 font-mono">
                                    {lastClose?.year === year ? 'FY periods locked' : 'Not yet verified'}
                                </div>
                            </div>
                        </div>

                        {/* Last Year End Close Result */}
                        {lastClose && (
                            <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200 space-y-4">
                                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                                    Year-End Close Summary — FY {lastClose.year}
                                </h2>
                                <div className="grid grid-cols-3 gap-4 font-mono text-sm">
                                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                                        <span className="text-xs text-slate-500 block uppercase">Total Revenue</span>
                                        <span className="font-bold text-slate-900">LKR {lastClose.totalRevenue.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                                    </div>
                                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                                        <span className="text-xs text-slate-500 block uppercase">Total Expense</span>
                                        <span className="font-bold text-slate-900">LKR {lastClose.totalExpense.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                                    </div>
                                    <div className="bg-indigo-50 p-3 rounded-lg border border-indigo-200">
                                        <span className="text-xs text-indigo-700 block uppercase font-sans">Net Profit Rolled to Retained Earnings</span>
                                        <span className="font-bold text-indigo-950">LKR {lastClose.netProfit.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                                    </div>
                                </div>
                            </div>
                        )}

                    </main>
                </div>
            </div>
        </RoleGuard>
    );
}
