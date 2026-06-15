"use client";

import React, { useEffect, useState, useCallback } from 'react';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import ResponsiveTable from '@/components/ResponsiveTable';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { BarChart3, Receipt, DollarSign, Banknote, TrendingUp, RefreshCw } from 'lucide-react';

interface PaymentSummary {
    total_transactions: number;
    total_base_amount: number;
    total_tax: number;
    total_amount: number;
}

interface ByTypeItem {
    payment_type: string;
    count: number;
    total_amount: number;
}

interface Payment {
    id: string;
    invoice_id: string;
    payment_type: string;
    reference_id: string;
    base_amount: number;
    tax_amount: number;
    total_amount: number;
    payment_method: string;
    status: string;
    due_date: string;
    createdAt: string;
    invoice: { id: string; invoice_number: string } | null;
}

export default function FleetReportsPage() {
    const [summary, setSummary] = useState<PaymentSummary | null>(null);
    const [byType, setByType] = useState<ByTypeItem[]>([]);
    const [payments, setPayments] = useState<Payment[]>([]);
    const [loading, setLoading] = useState(true);
    const [fromDate, setFromDate] = useState('');
    const [toDate, setToDate] = useState('');

    const fetchReport = useCallback(async () => {
        try {
            setLoading(true);
            const params = new URLSearchParams();
            if (fromDate) params.append('from_date', fromDate);
            if (toDate) params.append('to_date', toDate);
            const res = await fetch(`/api/reports/payments?${params}`);
            if (!res.ok) throw new Error('Failed');
            const data = await res.json();
            setSummary(data.summary || null);
            setByType(data.by_type || []);
            setPayments(data.recent_payments || []);
        } catch (e) { console.error(e); } finally { setLoading(false); }
    }, [fromDate, toDate]);

    useEffect(() => { fetchReport(); }, [fetchReport]);

    const formatCurrency = (amount?: number | null) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'LKR' }).format(amount || 0);

    return (
        <div className="erp-page-wrapper flex-row overflow-hidden">
            <Sidebar />
            <main className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
                <Header />
                <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
                    <div className="max-w-7xl mx-auto space-y-4">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                            <div className="space-y-0.5">
                                <h1 className="text-xl font-black text-slate-900 tracking-tight">Fleet Reports</h1>
                                <p className="text-xs text-slate-500">Report on fleet payments and transactions.</p>
                            </div>
                            <Button onClick={fetchReport} disabled={loading} className="h-8 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-xs transition-all shadow-sm">
                                <RefreshCw className={`w-4 h-4 mr-1.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
                            </Button>
                        </div>
                        <div className="flex flex-wrap items-end gap-3 p-4 bg-slate-50 rounded-xl border border-slate-200">
                            <div className="space-y-1">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">From Date</Label>
                                <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="h-9 text-xs rounded-lg bg-white border-slate-200" />
                            </div>
                            <div className="space-y-1">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">To Date</Label>
                                <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="h-9 text-xs rounded-lg bg-white border-slate-200" />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                            <Card className="rounded-xl border border-slate-200 bg-white">
                                <CardContent className="p-3 flex items-center justify-between">
                                    <div><p className="text-[10px] font-black uppercase text-slate-400">Total Transactions</p><p className="text-base font-black text-slate-900">{summary?.total_transactions || 0}</p></div>
                                    <div className="h-8 w-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center"><BarChart3 className="w-4 h-4" /></div>
                                </CardContent>
                            </Card>
                            <Card className="rounded-xl border border-slate-200 bg-white">
                                <CardContent className="p-3 flex items-center justify-between">
                                    <div><p className="text-[10px] font-black uppercase text-slate-400">Total Base Amount</p><p className="text-base font-black text-slate-900">{formatCurrency(summary?.total_base_amount)}</p></div>
                                    <div className="h-8 w-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center"><DollarSign className="w-4 h-4" /></div>
                                </CardContent>
                            </Card>
                            <Card className="rounded-xl border border-slate-200 bg-white">
                                <CardContent className="p-3 flex items-center justify-between">
                                    <div><p className="text-[10px] font-black uppercase text-slate-400">Total Tax</p><p className="text-base font-black text-slate-900">{formatCurrency(summary?.total_tax)}</p></div>
                                    <div className="h-8 w-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center"><TrendingUp className="w-4 h-4" /></div>
                                </CardContent>
                            </Card>
                            <Card className="rounded-xl border border-slate-200 bg-white">
                                <CardContent className="p-3 flex items-center justify-between">
                                    <div><p className="text-[10px] font-black uppercase text-slate-400">Total Amount</p><p className="text-base font-black text-slate-900">{formatCurrency(summary?.total_amount)}</p></div>
                                    <div className="h-8 w-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center"><Banknote className="w-4 h-4" /></div>
                                </CardContent>
                            </Card>
                        </div>
                        {byType.length > 0 && (
                            <div>
                                <h2 className="text-sm font-bold text-slate-800 mb-2">Breakdown by Type</h2>
                                <ResponsiveTable>
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr>
                                                <th className="px-3 py-2 text-xs font-semibold text-slate-500 uppercase">Payment Type</th>
                                                <th className="px-3 py-2 text-xs font-semibold text-slate-500 uppercase">Count</th>
                                                <th className="px-3 py-2 text-xs font-semibold text-slate-500 uppercase">Total Amount</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 bg-white">
                                            {byType.map((item, i) => (
                                                <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                                                    <td className="text-slate-700 font-medium">{item.payment_type?.replace(/_/g, ' ')}</td>
                                                    <td className="text-slate-900 font-semibold">{item.count}</td>
                                                    <td className="text-slate-900 font-bold">{formatCurrency(item.total_amount)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </ResponsiveTable>
                            </div>
                        )}
                        <div>
                            <h2 className="text-sm font-bold text-slate-800 mb-2">Recent Payments</h2>
                            {loading ? (
                                <div className="py-16 flex flex-col items-center justify-center text-slate-400 gap-4">
                                    <div className="h-8 w-8 border-3 border-blue-100 border-t-blue-600 rounded-full animate-spin" />
                                    <p className="text-[10px] font-black uppercase tracking-wider animate-pulse">Loading...</p>
                                </div>
                            ) : payments.length === 0 ? (
                                <div className="py-16 flex flex-col items-center justify-center bg-white rounded-xl border border-dashed border-slate-200 text-slate-400">
                                    <Receipt className="w-10 h-10 opacity-20 mb-3" />
                                    <p className="text-xs font-bold">No payments found for selected date range.</p>
                                </div>
                            ) : (
                                <ResponsiveTable>
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr>
                                                <th className="px-3 py-2 text-xs font-semibold text-slate-500 uppercase">Invoice #</th>
                                                <th className="px-3 py-2 text-xs font-semibold text-slate-500 uppercase">Payment Type</th>
                                                <th className="px-3 py-2 text-xs font-semibold text-slate-500 uppercase">Base Amount</th>
                                                <th className="px-3 py-2 text-xs font-semibold text-slate-500 uppercase">Total Amount</th>
                                                <th className="px-3 py-2 text-xs font-semibold text-slate-500 uppercase">Status</th>
                                                <th className="px-3 py-2 text-xs font-semibold text-slate-500 uppercase">Due Date</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 bg-white">
                                            {payments.map((p) => (
                                                <tr key={p.id} className="hover:bg-slate-50/50 transition-colors">
                                                    <td className="font-mono font-bold text-slate-900">{p.invoice?.invoice_number || p.invoice_id?.slice(0,8) || '-'}</td>
                                                    <td className="text-slate-600 font-medium">{p.payment_type?.replace(/_/g, ' ')}</td>
                                                    <td className="font-semibold text-slate-800">{formatCurrency(p.base_amount)}</td>
                                                    <td className="font-bold text-slate-900">{formatCurrency(p.total_amount)}</td>
                                                    <td>{p.status}</td>
                                                    <td className="text-slate-500 text-xs">{p.due_date ? new Date(p.due_date).toLocaleDateString() : '-'}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </ResponsiveTable>
                            )}
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
