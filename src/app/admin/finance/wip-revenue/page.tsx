'use client';

import React, { useEffect, useState } from 'react';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import RoleGuard from '@/components/RoleGuard';
import {
    TrendingUp,
    Receipt,
    Clock,
    CheckCircle2,
    DollarSign,
    BarChart3,
    AlertCircle,
    RefreshCw,
    Send,
    PackageCheck,
    PieChart,
    Building2,
    Car,
    Users,
    Calculator,
    Calendar
} from 'lucide-react';
import { WipSummaryMetrics, WipSodItem } from '@/services/finance/sod-wip-revenue.service';

export default function WipRevenueDashboardPage() {
    const [loading, setLoading] = useState(true);
    const [accruing, setAccruing] = useState(false);
    const [metrics, setMetrics] = useState<WipSummaryMetrics | null>(null);
    const [items, setItems] = useState<WipSodItem[]>([]);
    const [filterStatus, setFilterStatus] = useState<string>('ALL');
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    const fetchData = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/finance/wip-revenue?_t=${Date.now()}`, {
                cache: 'no-store',
                headers: { 'Pragma': 'no-cache', 'Cache-Control': 'no-cache' }
            });
            if (res.ok) {
                const data = await res.json();
                setMetrics(data.metrics);
                setItems(data.items);
            }
        } catch (err) {
            console.error('Failed to fetch WIP Revenue data:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleAccrueJournal = async () => {
        setAccruing(true);
        setSuccessMessage(null);
        try {
            const res = await fetch('/api/finance/wip-revenue', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
            const data = await res.json();
            if (data.posted) {
                setSuccessMessage(`Accrual Journal & Inventory COGS Posted Successfully! Total LKR ${data.accruedValue?.toLocaleString()} (COGS: LKR ${data.materialCogs?.toLocaleString() || '0'})`);
                fetchData();
            } else {
                setSuccessMessage(data.message || 'No unbilled revenue to accrue.');
            }
        } catch (err) {
            console.error('Failed to post WIP Accrual Journal:', err);
        } finally {
            setAccruing(false);
        }
    };

    const filteredItems = items.filter(item => {
        if (filterStatus === 'COMPLETED') return item.sltsStatus === 'COMPLETED';
        if (filterStatus === 'INSTALL_CLOSED') return item.sltsStatus === 'INSTALL_CLOSED';
        if (filterStatus === 'INVOICABLE') return item.isInvoicable;
        return true;
    });

    return (
        <RoleGuard allowedRoles={['SUPER_ADMIN', 'ADMIN', 'FINANCE_MANAGER', 'OSP_MANAGER']}>
            <div className="flex h-screen bg-slate-50 overflow-hidden">
                <Sidebar />
                <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                    <Header />
                    <main className="flex-1 overflow-y-auto p-6 space-y-6">
                        
                        {/* Title Header */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                            <div>
                                <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2.5">
                                    <TrendingUp className="w-7 h-7 text-emerald-600" />
                                    Monthly Buildup WIP Revenue & Full Cost Allocation Engine
                                </h1>
                                <p className="text-sm text-slate-500 mt-1">
                                    Status breakdown (COMPLETED vs INSTALL_CLOSED), monthly buildup, earnings, material COGS, vehicle payments, site office expenses, and staff payroll allocation.
                                </p>
                            </div>
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={fetchData}
                                    disabled={loading}
                                    className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition flex items-center gap-2"
                                >
                                    <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                                    Refresh Data
                                </button>
                                <button
                                    onClick={handleAccrueJournal}
                                    disabled={accruing || !metrics || metrics.totalWipValue === 0}
                                    className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-xl transition shadow-sm flex items-center gap-2"
                                >
                                    <Send className="w-4 h-4" />
                                    {accruing ? 'Accruing...' : 'Post Period WIP & COGS Accrual'}
                                </button>
                            </div>
                        </div>

                        {successMessage && (
                            <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl flex items-center gap-3">
                                <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                                <span className="text-sm font-medium">{successMessage}</span>
                            </div>
                        )}

                        {/* Top KPI Cards (Status Breakdown + Total Revenue) */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
                            {/* Card 1: Total Accrued WIP Revenue */}
                            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-2">
                                <div className="flex items-center justify-between text-slate-500">
                                    <span className="text-xs font-semibold uppercase tracking-wider">Total Accrued WIP Revenue</span>
                                    <div className="p-2 bg-emerald-50 rounded-lg text-emerald-600">
                                        <DollarSign className="w-5 h-5" />
                                    </div>
                                </div>
                                <div className="text-2xl font-bold text-slate-900">
                                    LKR {metrics?.totalWipValue ? metrics.totalWipValue.toLocaleString() : '0'}
                                </div>
                                <p className="text-xs text-slate-500">
                                    Across {metrics?.unbilledSodCount || 0} finished field jobs
                                </p>
                            </div>

                            {/* Card 2: COMPLETED SOD Pool */}
                            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-2">
                                <div className="flex items-center justify-between text-slate-500">
                                    <span className="text-xs font-semibold uppercase tracking-wider">COMPLETED Status WIP</span>
                                    <div className="p-2 bg-blue-50 rounded-lg text-blue-600">
                                        <CheckCircle2 className="w-5 h-5" />
                                    </div>
                                </div>
                                <div className="text-2xl font-bold text-blue-700">
                                    LKR {metrics?.completedSodValue ? metrics.completedSodValue.toLocaleString() : '0'}
                                </div>
                                <p className="text-xs text-slate-500">
                                    {metrics?.completedSodCount || 0} SODs (PAT Pending)
                                </p>
                            </div>

                            {/* Card 3: INSTALL_CLOSED SOD Pool */}
                            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-2">
                                <div className="flex items-center justify-between text-slate-500">
                                    <span className="text-xs font-semibold uppercase tracking-wider">INSTALL_CLOSED Status WIP</span>
                                    <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600">
                                        <Clock className="w-5 h-5" />
                                    </div>
                                </div>
                                <div className="text-2xl font-bold text-indigo-700">
                                    LKR {metrics?.installClosedValue ? metrics.installClosedValue.toLocaleString() : '0'}
                                </div>
                                <p className="text-xs text-slate-500">
                                    {metrics?.installClosedCount || 0} SODs (Wiring Done)
                                </p>
                            </div>

                            {/* Card 4: Net WIP Operating Margin */}
                            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-2">
                                <div className="flex items-center justify-between text-slate-500">
                                    <span className="text-xs font-semibold uppercase tracking-wider">Net WIP Operating Margin</span>
                                    <div className="p-2 bg-teal-50 rounded-lg text-teal-600">
                                        <Calculator className="w-5 h-5" />
                                    </div>
                                </div>
                                <div className="text-2xl font-bold text-emerald-600">
                                    LKR {metrics?.netWipMargin ? metrics.netWipMargin.toLocaleString() : '0'}
                                </div>
                                <p className="text-xs text-slate-500">
                                    {metrics?.netWipMarginPercent || 0}% Net Operational Profit
                                </p>
                            </div>
                        </div>

                        {/* Full Cost Matching Breakdown Card */}
                        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                                <PieChart className="w-5 h-5 text-indigo-600" />
                                Comprehensive Job Costing & Operational Overhead Breakdown
                            </h2>
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                                    <div className="flex items-center justify-between text-xs text-slate-500">
                                        <span className="font-semibold text-slate-700">Contractor Fees</span>
                                        <Receipt className="w-4 h-4 text-slate-600" />
                                    </div>
                                    <div className="text-lg font-bold text-slate-900">
                                        LKR {metrics?.totalContractorFees ? metrics.totalContractorFees.toLocaleString() : '0'}
                                    </div>
                                    <div className="text-xs text-slate-500">Direct Subcontractor Cost</div>
                                </div>

                                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                                    <div className="flex items-center justify-between text-xs text-slate-500">
                                        <span className="font-semibold text-purple-700">Material COGS</span>
                                        <PackageCheck className="w-4 h-4 text-purple-600" />
                                    </div>
                                    <div className="text-lg font-bold text-purple-700">
                                        LKR {metrics?.totalMaterialCogs ? metrics.totalMaterialCogs.toLocaleString() : '0'}
                                    </div>
                                    <div className="text-xs text-slate-500">Store Materials Consumed</div>
                                </div>

                                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                                    <div className="flex items-center justify-between text-xs text-slate-500">
                                        <span className="font-semibold text-blue-700">Vehicle & Logistics</span>
                                        <Car className="w-4 h-4 text-blue-600" />
                                    </div>
                                    <div className="text-lg font-bold text-blue-700">
                                        LKR {metrics?.totalVehicleExpenses ? metrics.totalVehicleExpenses.toLocaleString() : '0'}
                                    </div>
                                    <div className="text-xs text-slate-500">Fleet & Fuel Payments</div>
                                </div>

                                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                                    <div className="flex items-center justify-between text-xs text-slate-500">
                                        <span className="font-semibold text-amber-700">Site Office Expenses</span>
                                        <Building2 className="w-4 h-4 text-amber-600" />
                                    </div>
                                    <div className="text-lg font-bold text-amber-700">
                                        LKR {metrics?.totalSiteOfficeExpenses ? metrics.totalSiteOfficeExpenses.toLocaleString() : '0'}
                                    </div>
                                    <div className="text-xs text-slate-500">Petty Cash & Admin Memos</div>
                                </div>

                                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                                    <div className="flex items-center justify-between text-xs text-slate-500">
                                        <span className="font-semibold text-teal-700">Staff Payroll</span>
                                        <Users className="w-4 h-4 text-teal-600" />
                                    </div>
                                    <div className="text-lg font-bold text-teal-700">
                                        LKR {metrics?.totalPayrollExpenses ? metrics.totalPayrollExpenses.toLocaleString() : '0'}
                                    </div>
                                    <div className="text-xs text-slate-500">Field Operator Payroll</div>
                                </div>
                            </div>
                        </div>

                        {/* Monthly Buildup Trend Grid */}
                        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                                <Calendar className="w-5 h-5 text-emerald-600" />
                                Month-by-Month WIP Buildup & Margin Trend
                            </h2>
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                                {metrics?.monthlyBuildup && metrics.monthlyBuildup.length > 0 ? (
                                    metrics.monthlyBuildup.map((m) => (
                                        <div key={m.month} className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                                            <div className="flex items-center justify-between text-xs text-slate-500">
                                                <span className="font-bold px-2 py-0.5 bg-slate-200 rounded text-slate-800 font-mono">{m.month}</span>
                                                <span>{m.sodCount} SODs</span>
                                            </div>
                                            <div className="text-base font-bold text-emerald-600">
                                                LKR {m.wipRevenue.toLocaleString()}
                                            </div>
                                            <div className="text-xs text-slate-500 flex justify-between">
                                                <span>Cost: LKR {(m.contractorCost + m.materialCogs).toLocaleString()}</span>
                                                <span className="font-bold text-indigo-600">Margin: LKR {m.netMargin.toLocaleString()}</span>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="col-span-full py-8 text-center text-slate-400 text-sm">
                                        No monthly WIP buildup data available.
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Invoicable & WIP SOD Pool Table */}
                        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden space-y-4 p-6">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                <div>
                                    <h2 className="text-base font-bold text-slate-900">
                                        Unbilled Service Order (SOD) Pipeline & Inventory COGS
                                    </h2>
                                    <p className="text-xs text-slate-500 mt-0.5">
                                        Filter and inspect individual SOD revenues, contractor fees, material COGS, and SF Audit Split claims.
                                    </p>
                                </div>

                                {/* Filter Buttons */}
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => setFilterStatus('ALL')}
                                        className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
                                            filterStatus === 'ALL'
                                                ? 'bg-slate-900 text-white'
                                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                        }`}
                                    >
                                        All WIP Jobs ({items.length})
                                    </button>
                                    <button
                                        onClick={() => setFilterStatus('COMPLETED')}
                                        className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
                                            filterStatus === 'COMPLETED'
                                                ? 'bg-blue-600 text-white'
                                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                        }`}
                                    >
                                        COMPLETED ({metrics?.completedSodCount || 0})
                                    </button>
                                    <button
                                        onClick={() => setFilterStatus('INSTALL_CLOSED')}
                                        className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
                                            filterStatus === 'INSTALL_CLOSED'
                                                ? 'bg-indigo-600 text-white'
                                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                        }`}
                                    >
                                        INSTALL_CLOSED ({metrics?.installClosedCount || 0})
                                    </button>
                                    <button
                                        onClick={() => setFilterStatus('INVOICABLE')}
                                        className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
                                            filterStatus === 'INVOICABLE'
                                                ? 'bg-emerald-600 text-white'
                                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                        }`}
                                    >
                                        Invoicable Pool ({metrics?.invoicableSodCount || 0})
                                    </button>
                                </div>
                            </div>

                            {/* Data Table */}
                            <div className="overflow-x-auto border border-slate-200 rounded-xl">
                                <table className="min-w-full divide-y divide-slate-200 text-sm text-left">
                                    <thead className="bg-slate-50 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                                        <tr>
                                            <th className="px-4 py-3">SO Number</th>
                                            <th className="px-4 py-3">RTOM</th>
                                            <th className="px-4 py-3">Customer</th>
                                            <th className="px-4 py-3">Status</th>
                                            <th className="px-4 py-3 text-right">Distance (m)</th>
                                            <th className="px-4 py-3 text-right">Accrued Revenue</th>
                                            <th className="px-4 py-3 text-right">Contractor Fee</th>
                                            <th className="px-4 py-3 text-right">Material COGS</th>
                                            <th className="px-4 py-3 text-right">Net Margin</th>
                                            <th className="px-4 py-3 text-center">Claim A ({metrics?.claimAPercent || 90}%)</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-200 bg-white">
                                        {filteredItems.length > 0 ? (
                                            filteredItems.map((item) => (
                                                <tr key={item.id} className="hover:bg-slate-50 transition">
                                                    <td className="px-4 py-3 font-mono font-medium text-slate-900">
                                                        {item.soNum}
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <span className="px-2 py-0.5 bg-slate-100 text-slate-700 font-semibold rounded text-xs">
                                                            {item.rtom}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3 text-slate-700 max-w-[160px] truncate" title={item.customerName || ''}>
                                                        {item.customerName || 'N/A'}
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <span className={`px-2 py-0.5 font-semibold rounded text-xs ${
                                                            item.sltsStatus === 'COMPLETED' ? 'bg-blue-100 text-blue-800' : 'bg-indigo-100 text-indigo-800'
                                                        }`}>
                                                            {item.sltsStatus}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3 text-right font-mono text-slate-600">
                                                        {item.dropWireDistance}m
                                                    </td>
                                                    <td className="px-4 py-3 text-right font-semibold text-emerald-600 font-mono">
                                                        LKR {item.accruedRevenue.toLocaleString()}
                                                    </td>
                                                    <td className="px-4 py-3 text-right font-mono text-slate-600">
                                                        LKR {item.contractorCost.toLocaleString()}
                                                    </td>
                                                    <td className="px-4 py-3 text-right font-mono text-purple-600 font-medium">
                                                        LKR {item.materialCost.toLocaleString()}
                                                    </td>
                                                    <td className="px-4 py-3 text-right font-mono text-indigo-600 font-semibold">
                                                        LKR {item.netMargin.toLocaleString()} ({item.netMarginPercent}%)
                                                    </td>
                                                    <td className="px-4 py-3 text-center font-mono text-teal-700 font-medium">
                                                        LKR {item.claimAAmount.toLocaleString()}
                                                    </td>
                                                </tr>
                                            ))
                                        ) : (
                                            <tr>
                                                <td colSpan={10} className="px-4 py-12 text-center text-slate-400">
                                                    No service orders match the selected filter.
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                    </main>
                </div>
            </div>
        </RoleGuard>
    );
}
