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
    const [status, setStatus] = useState('ALL'); // ALL, PASS, REJECTED
    const [rtom, setRtom] = useState('ALL');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

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
                                <p className="text-slate-500 text-sm mt-1">Track and clear rejected Provisional Acceptance Tests (PAT).</p>
                            </div>
                            <div className="flex items-center gap-2">
                                <button className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors shadow-sm">
                                    <Download className="w-4 h-4" />
                                    Export CSV
                                </button>
                            </div>
                        </div>

                        {/* Filters */}
                        <Card className="border-none shadow-sm">
                            <CardContent className="p-4">
                                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                    <div className="relative">
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
                                        value={status}
                                        onChange={(e) => setStatus(e.target.value)}
                                    >
                                        <option value="ALL">All PAT Status</option>
                                        <option value="PASS">Approved (PASS)</option>
                                        <option value="REJECTED">Rejected (FAIL)</option>
                                        <option value="PENDING">Pending Approval</option>
                                    </select>
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
                                    <div className="flex items-center justify-end gap-2">
                                        <Badge variant="outline" className="bg-red-50 text-red-700 border-red-100 py-1.5 px-3">
                                            {data?.totalRejected || 0} Rejected Found
                                        </Badge>
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
                                            <th className="px-6 py-4 text-left font-semibold text-slate-600">SLTS Status</th>
                                            <th className="px-6 py-4 text-left font-semibold text-slate-600">OPMC PAT</th>
                                            <th className="px-6 py-4 text-left font-semibold text-slate-600">HO PAT</th>
                                            <th className="px-6 py-4 text-left font-semibold text-slate-600">Invoicable</th>
                                            <th className="px-6 py-4 text-right font-semibold text-slate-600">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {isLoading ? (
                                            Array(5).fill(0).map((_, i) => (
                                                <tr key={i}>
                                                    {Array(7).fill(0).map((_, j) => (
                                                        <td key={j} className="px-6 py-4"><Skeleton className="h-4 w-full" /></td>
                                                    ))}
                                                </tr>
                                            ))
                                        ) : data?.orders?.map((order: any) => (
                                            <tr key={order.id} className="hover:bg-slate-50/50 transition-colors">
                                                <td className="px-6 py-4 font-bold text-slate-900">{order.soNum}</td>
                                                <td className="px-6 py-4 text-slate-600">{order.rtom}</td>
                                                <td className="px-6 py-4">
                                                    <Badge variant="outline" className={
                                                        order.sltsStatus === 'COMPLETED' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-slate-50 text-slate-600 border-slate-100'
                                                    }>
                                                        {order.sltsStatus}
                                                    </Badge>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-2">
                                                        {order.opmcPatStatus === 'PASS' ? (
                                                            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                                                        ) : order.opmcPatStatus === 'REJECTED' ? (
                                                            <XCircle className="w-4 h-4 text-red-500" />
                                                        ) : (
                                                            <Clock className="w-4 h-4 text-slate-300" />
                                                        )}
                                                        <span className={order.opmcPatStatus === 'REJECTED' ? 'text-red-600 font-medium' : ''}>
                                                            {order.opmcPatStatus || 'PENDING'}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-2">
                                                        {order.hoPatStatus === 'PASS' ? (
                                                            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                                                        ) : order.hoPatStatus === 'REJECTED' ? (
                                                            <XCircle className="w-4 h-4 text-red-500" />
                                                        ) : (
                                                            <Clock className="w-4 h-4 text-slate-300" />
                                                        )}
                                                        <span className={order.hoPatStatus === 'REJECTED' ? 'text-red-600 font-medium' : ''}>
                                                            {order.hoPatStatus || 'PENDING'}
                                                        </span>
                                                    </div>
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

                        {/* Rejected Alert Section */}
                        {data?.rejectedSummary?.length > 0 && (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {data.rejectedSummary.map((item: any) => (
                                    <Card key={item.rtom} className="border-l-4 border-l-red-500 shadow-sm">
                                        <CardHeader className="pb-2">
                                            <CardTitle className="text-sm font-bold text-slate-800 flex items-center justify-between">
                                                {item.rtom}
                                                <Badge className="bg-red-100 text-red-700 hover:bg-red-100 border-none">{item.count} Rejections</Badge>
                                            </CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            <p className="text-xs text-slate-500">
                                                These SODs have been rejected by OPMC or Head Office and require immediate correction.
                                            </p>
                                            <button
                                                onClick={() => { setRtom(item.rtom); setStatus('REJECTED'); setPage(1); }}
                                                className="mt-3 text-xs font-semibold text-primary hover:underline flex items-center gap-1"
                                            >
                                                Filter this RTOM <ChevronRight className="w-3 h-3" />
                                            </button>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
}
