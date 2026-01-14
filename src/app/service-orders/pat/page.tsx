"use client";

import React, { useState } from 'react';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import { useQuery } from '@tanstack/react-query';
import {
    Search, Filter, ChevronLeft, ChevronRight,
    CheckCircle2, XCircle, Clock, ExternalLink,
    AlertCircle, Download
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

export default function PATStatusPage() {
    const [page, setPage] = useState(1);
    const [search, setSearch] = useState('');
    const [rtom, setRtom] = useState('ALL');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [status, setStatus] = useState('OPMC_REJECTED'); // OPMC_REJECTED, HO_APPROVED, HO_REJECTED

    const tabs = [
        { id: 'HO_APPROVED', label: 'SLT Head Office Approved', color: 'emerald' },
        { id: 'HO_REJECTED', label: 'SLT Head Office Rejected', color: 'orange' },
        { id: 'OPMC_REJECTED', label: 'OPMC Rejected', color: 'red' }
    ];

    const { data, isLoading } = useQuery({
        queryKey: ['pat-orders', page, search, status, rtom, startDate, endDate],
        queryFn: async () => {
            const params = new URLSearchParams({
                page: page.toString(),
                search,
                status,
                rtom,
                startDate,
                endDate,
                limit: '20'
            });
            const resp = await fetch(`/api/service-orders/pat?${params}`);
            if (!resp.ok) throw new Error('Failed to fetch PAT data');
            return resp.json();
        }
    });

    return (
        <div className="min-h-screen flex bg-slate-50">
            <Sidebar />
            <main className="flex-1 flex flex-col min-w-0">
                <Header />
                <div className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
                    <div className="max-w-7xl mx-auto space-y-6">
                        {/* Header */}
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div>
                                <h1 className="text-2xl font-bold text-slate-900">PAT Status Monitor</h1>
                                <p className="text-slate-500 text-sm mt-1">
                                    Direct results downloaded from SLT Head Office API.
                                    <span className="ml-2 font-medium text-slate-700 underline underline-offset-4 decoration-emerald-300">
                                        Part A Ready: SLTS Internal PASS
                                    </span> |
                                    <span className="ml-1 font-medium text-slate-700 underline underline-offset-4 decoration-blue-300">
                                        Part B Ready: HO PAT PASS
                                    </span>
                                </p>
                            </div>
                            <div className="flex items-center gap-2">
                                <button className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors shadow-sm">
                                    <Download className="w-4 h-4" />
                                    Export CSV
                                </button>
                            </div>
                        </div>

                        {/* Tabs */}
                        <div className="flex bg-slate-100 p-1 rounded-xl w-fit">
                            {tabs.map((tab) => (
                                <button
                                    key={tab.id}
                                    onClick={() => { setStatus(tab.id); setPage(1); }}
                                    className={`px-6 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 ${status === tab.id
                                        ? 'bg-white text-slate-900 shadow-sm'
                                        : 'text-slate-500 hover:text-slate-700'
                                        }`}
                                >
                                    {tab.label}
                                </button>
                            ))}
                        </div>

                        {/* Filters */}
                        <Card className="border-none shadow-sm">
                            <CardContent className="p-4">
                                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                    <div className="relative md:col-span-1">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                        <input
                                            type="text"
                                            placeholder="Search SO Number..."
                                            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                                            value={search}
                                            onChange={(e) => setSearch(e.target.value)}
                                        />
                                    </div>
                                    <select
                                        className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                                        value={rtom}
                                        onChange={(e) => setRtom(e.target.value)}
                                    >
                                        <option value="ALL">All RTOMs</option>
                                        {data?.rtoms?.map((r: string) => (
                                            <option key={r} value={r}>{r}</option>
                                        ))}
                                    </select>
                                    <div className="flex items-center gap-2 col-span-1 md:col-span-2">
                                        <input
                                            type="date"
                                            className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                                            value={startDate}
                                            onChange={(e) => setStartDate(e.target.value)}
                                        />
                                        <span className="text-slate-400">-</span>
                                        <input
                                            type="date"
                                            className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                                            value={endDate}
                                            onChange={(e) => setEndDate(e.target.value)}
                                        />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Main Table */}
                        <Card className="border-none shadow-sm overflow-hidden text-sm">
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead className="bg-slate-50 border-b border-slate-100">
                                        <tr>
                                            <th className="px-6 py-4 text-left font-semibold text-slate-600">SO Number</th>
                                            <th className="px-6 py-4 text-left font-semibold text-slate-600">RTOM</th>
                                            <th className="px-6 py-4 text-left font-semibold text-slate-600">API Date</th>
                                            <th className="px-6 py-4 text-left font-semibold text-slate-600">Internal Status</th>
                                            <th className="px-6 py-4 text-left font-semibold text-slate-600">SLT API Status</th>
                                            <th className="px-6 py-4 text-left font-semibold text-slate-600">System Link</th>
                                            <th className="px-6 py-4 text-left font-semibold text-slate-600">Invoicable</th>
                                            <th className="px-6 py-4 text-right font-semibold text-slate-600">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {isLoading ? (
                                            Array(5).fill(0).map((_, i) => (
                                                <tr key={i}>
                                                    {Array(8).fill(0).map((_, j) => (
                                                        <td key={j} className="px-6 py-4"><Skeleton className="h-4 w-full" /></td>
                                                    ))}
                                                </tr>
                                            ))
                                        ) : data?.orders?.map((order: any) => (
                                            <tr key={order.id} className={`hover:bg-slate-50/50 transition-colors ${order.sltsStatus !== 'COMPLETED' ? 'opacity-80' : ''}`}>
                                                <td className="px-6 py-4 font-bold text-slate-900">{order.soNum}</td>
                                                <td className="px-6 py-4 text-slate-600">{order.rtom}</td>
                                                <td className="px-6 py-4 text-slate-500 whitespace-nowrap">{order.statusDate ? format(new Date(order.statusDate), 'yyyy-MM-dd') : '-'}</td>
                                                <td className="px-6 py-4">
                                                    <div className="flex flex-col gap-1">
                                                        <Badge variant="outline" className={
                                                            order.sltsStatus === 'COMPLETED' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                                                                order.sltsStatus === 'NOT_IN_SYSTEM' ? 'bg-orange-50 text-orange-600 border-orange-100' : 'bg-slate-50 text-slate-600 border-slate-100'
                                                        }>
                                                            {order.sltsStatus}
                                                        </Badge>
                                                        {order.sltsStatus === 'INPROGRESS' && (
                                                            <span className="text-[10px] text-amber-600 font-medium whitespace-nowrap">Wait for Complete</span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-2">
                                                        {order.source === 'HO_APPROVED' ? (
                                                            <div className="flex items-center gap-1.5 px-2 py-1 bg-emerald-50 text-emerald-700 rounded-md border border-emerald-100 font-bold text-[11px]">
                                                                <CheckCircle2 className="w-3.5 h-3.5" /> HO PASS
                                                            </div>
                                                        ) : (
                                                            <div className="flex items-center gap-1.5 px-2 py-1 bg-red-50 text-red-700 rounded-md border border-red-100 font-bold text-[11px]">
                                                                <XCircle className="w-3.5 h-3.5" /> {order.source.replace('_', ' ')}
                                                            </div>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    {order.sltsStatus === 'COMPLETED' ? (
                                                        <div className="flex items-center gap-1 text-emerald-600 font-bold text-xs">
                                                            <CheckCircle2 className="w-4 h-4" /> LINKED
                                                        </div>
                                                    ) : (
                                                        <div className="flex items-center gap-1 text-slate-400 font-medium text-xs">
                                                            <Clock className="w-4 h-4" /> IGNORED
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4">
                                                    {order.isInvoicable ? (
                                                        <Badge className="bg-emerald-500 hover:bg-emerald-600">READY</Badge>
                                                    ) : (
                                                        <Badge variant="outline" className="text-slate-400">WAITING</Badge>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <button className="p-2 text-slate-400 hover:text-primary transition-colors">
                                                        <ExternalLink className="w-4 h-4" />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {/* Pagination */}
                            <div className="p-4 border-t border-slate-100 flex items-center justify-between bg-slate-50/50">
                                <p className="text-xs text-slate-500">
                                    Showing {((page - 1) * 20) + 1} to {Math.min(page * 20, data?.total || 0)} of {data?.total || 0} entries
                                </p>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => setPage(p => Math.max(1, p - 1))}
                                        disabled={page === 1}
                                        className="p-2 border border-slate-200 rounded-lg hover:bg-white disabled:opacity-50 transition-colors"
                                    >
                                        <ChevronLeft className="w-4 h-4" />
                                    </button>
                                    <span className="text-sm font-medium px-4">Page {page} of {data?.totalPages || 1}</span>
                                    <button
                                        onClick={() => setPage(p => p + 1)}
                                        disabled={page >= (data?.totalPages || 1)}
                                        className="p-2 border border-slate-200 rounded-lg hover:bg-white disabled:opacity-50 transition-colors"
                                    >
                                        <ChevronRight className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        </Card>


                    </div>
                </div>
            </main>
        </div>
    );
}
