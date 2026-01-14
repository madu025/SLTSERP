"use client";

import React, { useState } from 'react';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import { useQuery } from '@tanstack/react-query';
import {
    Search, ChevronLeft, ChevronRight,
    ArrowUpDown, FileDown, Printer, Copy, FileSpreadsheet
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

export default function PATStatusPage() {
    const [page, setPage] = useState(1);
    const [search, setSearch] = useState('');
    const [rtom, setRtom] = useState('ALL');
    const [view, setView] = useState('ACCEPTED'); // ACCEPTED, REJECTED

    const { data, isLoading } = useQuery({
        queryKey: ['pat-orders-v2', page, search, view, rtom],
        queryFn: async () => {
            const params = new URLSearchParams({
                page: page.toString(),
                search,
                status: view,
                rtom,
                limit: '20'
            });
            const resp = await fetch(`/api/service-orders/pat?${params}`);
            if (!resp.ok) throw new Error('Failed to fetch PAT data');
            return resp.json();
        }
    });

    return (
        <div className="min-h-screen flex bg-[#f8f9fc]">
            <Sidebar />
            <main className="flex-1 flex flex-col min-w-0">
                <Header />
                <div className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
                    <div className="max-w-[1400px] mx-auto space-y-6">

                        {/* Tabs matching SLT System */}
                        <div className="flex border-b border-slate-200 gap-1 bg-white p-2 rounded-t-xl shadow-sm">
                            <button
                                onClick={() => { setView('ACCEPTED'); setPage(1); }}
                                className={cn(
                                    "px-10 py-3 text-sm font-bold transition-all border-b-2",
                                    view === 'ACCEPTED'
                                        ? "border-primary text-primary bg-primary/5"
                                        : "border-transparent text-slate-500 hover:text-slate-800"
                                )}
                            >
                                ACCEPTED
                            </button>
                            <button
                                onClick={() => { setView('REJECTED'); setPage(1); }}
                                className={cn(
                                    "px-10 py-3 text-sm font-bold transition-all border-b-2",
                                    view === 'REJECTED'
                                        ? "border-primary text-primary bg-primary/5"
                                        : "border-transparent text-slate-500 hover:text-slate-800"
                                )}
                            >
                                REJECTED
                            </button>
                        </div>

                        {/* Controls Section */}
                        <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white p-4 shadow-sm border-x">
                            <div className="flex items-center gap-2">
                                <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded font-medium text-sm hover:bg-blue-700 transition-all shadow-sm">
                                    <Copy className="w-4 h-4" /> Copy
                                </button>
                                <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded font-medium text-sm hover:bg-blue-700 transition-all shadow-sm">
                                    <FileSpreadsheet className="w-4 h-4" /> Excel
                                </button>
                                <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded font-medium text-sm hover:bg-blue-700 transition-all shadow-sm">
                                    <Printer className="w-4 h-4" /> Print
                                </button>
                            </div>

                            <div className="flex items-center gap-3">
                                <span className="text-sm font-medium text-slate-500">Search:</span>
                                <div className="relative">
                                    <input
                                        type="text"
                                        className="w-64 pl-4 pr-10 py-2 bg-white border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-primary text-sm"
                                        value={search}
                                        onChange={(e) => setSearch(e.target.value)}
                                    />
                                    <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                </div>
                            </div>
                        </div>

                        {/* Main Table */}
                        <Card className="border-none shadow-sm overflow-hidden rounded-t-none">
                            <div className="overflow-x-auto">
                                <table className="w-full text-[13px]">
                                    <thead className="bg-[#f1f3f7] border-y border-slate-200 text-slate-600 uppercase">
                                        <tr>
                                            <th className="px-4 py-4 text-left font-bold min-w-[100px] border-r border-slate-200">
                                                <div className="flex items-center gap-2">RTOM <ArrowUpDown className="w-3 h-3 opacity-40" /></div>
                                            </th>
                                            <th className="px-4 py-4 text-left font-bold min-w-[200px] border-r border-slate-200">
                                                <div className="flex items-center gap-2">SOD <ArrowUpDown className="w-3 h-3 opacity-40" /></div>
                                            </th>
                                            <th className="px-4 py-4 text-left font-bold min-w-[150px] border-r border-slate-200">
                                                <div className="flex items-center gap-2">CIRCUIT <ArrowUpDown className="w-3 h-3 opacity-40" /></div>
                                            </th>
                                            <th className="px-4 py-4 text-left font-bold min-w-[100px] border-r border-slate-200">
                                                <div className="flex items-center gap-2">SERVICE <ArrowUpDown className="w-3 h-3 opacity-40" /></div>
                                            </th>
                                            <th className="px-4 py-4 text-left font-bold min-w-[150px] border-r border-slate-200">
                                                <div className="flex items-center gap-2">ORDER TYPE <ArrowUpDown className="w-3 h-3 opacity-40" /></div>
                                            </th>
                                            <th className="px-4 py-4 text-left font-bold min-w-[150px] border-r border-slate-200">
                                                <div className="flex items-center gap-2">STATUS <ArrowUpDown className="w-3 h-3 opacity-40" /></div>
                                            </th>
                                            <th className="px-4 py-4 text-left font-bold min-w-[150px] border-r border-slate-200">
                                                <div className="flex items-center gap-2">CONTRACTOR <ArrowUpDown className="w-3 h-3 opacity-40" /></div>
                                            </th>
                                            <th className="px-4 py-4 text-left font-bold min-w-[120px] border-r border-slate-200">
                                                <div className="flex items-center gap-2">PAT USER <ArrowUpDown className="w-3 h-3 opacity-40" /></div>
                                            </th>
                                            <th className="px-4 py-4 text-left font-bold min-w-[180px]">
                                                <div className="flex items-center gap-2">COMPLETED ON <ArrowUpDown className="w-3 h-3 opacity-40" /></div>
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 bg-white">
                                        {isLoading ? (
                                            Array(6).fill(0).map((_, i) => (
                                                <tr key={i}>
                                                    {Array(9).fill(0).map((_, j) => (
                                                        <td key={j} className="px-4 py-4"><Skeleton className="h-4 w-full" /></td>
                                                    ))}
                                                </tr>
                                            ))
                                        ) : data?.orders?.length === 0 ? (
                                            <tr>
                                                <td colSpan={9} className="px-4 py-10 text-center text-slate-400 font-medium italic">
                                                    No results found for {view} records.
                                                </td>
                                            </tr>
                                        ) : data?.orders?.map((order: any) => (
                                            <tr key={order.id} className="hover:bg-slate-50 transition-colors">
                                                <td className="px-4 py-3.5 text-slate-600 font-medium">{order.rtom}</td>
                                                <td className="px-4 py-3.5 border-l border-slate-50">
                                                    <a href={`/service-orders/${order.soNum}`} className="text-blue-600 hover:underline font-bold">
                                                        {order.soNum}
                                                    </a>
                                                </td>
                                                <td className="px-4 py-3.5 text-slate-700 border-l border-slate-50 font-mono text-[12px]">
                                                    {order.voiceNumber || 'N/A'}
                                                </td>
                                                <td className="px-4 py-3.5 text-slate-600 border-l border-slate-50">
                                                    {order.sType || 'FTTH'}
                                                </td>
                                                <td className="px-4 py-3.5 text-slate-600 border-l border-slate-50">
                                                    {order.orderType || 'CREATE'}
                                                </td>
                                                <td className="px-4 py-3.5 border-l border-slate-50">
                                                    <span className={cn(
                                                        "font-bold px-2 py-0.5 rounded text-[11px]",
                                                        order.status === 'PAT_PASSED' ? "text-emerald-700 bg-emerald-50 border border-emerald-100" : "text-rose-700 bg-rose-50 border border-rose-100"
                                                    )}>
                                                        {order.status}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3.5 text-slate-600 border-l border-slate-50">
                                                    {order.conName || 'SLTS'}
                                                </td>
                                                <td className="px-4 py-3.5 text-slate-600 border-l border-slate-50 font-medium whitespace-nowrap">
                                                    {order.patUser || '-'}
                                                </td>
                                                <td className="px-4 py-3.5 text-slate-500 border-l border-slate-50 whitespace-nowrap font-medium">
                                                    {order.statusDate ? format(new Date(order.statusDate), 'yyyy-MM-dd HH:mm:ss a') : '-'}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {/* Pagination / Stats bar */}
                            <div className="p-4 border-t border-slate-100 flex items-center justify-between bg-white text-xs text-slate-500">
                                <div className="flex items-center gap-6">
                                    <p>Showing {((page - 1) * 20) + 1} to {Math.min(page * 20, data?.total || 0)} of {data?.total || 0} entries</p>
                                    {data?.orders?.some((o: any) => o.sltsStatus === 'INPROGRESS') && (
                                        <p className="text-amber-600 font-bold bg-amber-50 px-2 py-1 rounded">
                                            Info: Some work is still INPROGRESS in our system.
                                        </p>
                                    )}
                                </div>
                                <div className="flex items-center gap-1">
                                    <button
                                        onClick={() => setPage(p => Math.max(1, p - 1))}
                                        disabled={page === 1}
                                        className="px-3 py-1.5 border border-slate-200 rounded hover:bg-slate-50 disabled:opacity-30 transition-all font-bold"
                                    >
                                        Previous
                                    </button>
                                    <div className="flex gap-1 mx-2">
                                        <span className="bg-primary text-white w-8 h-8 flex items-center justify-center rounded font-bold">{page}</span>
                                    </div>
                                    <button
                                        onClick={() => setPage(p => p + 1)}
                                        disabled={page >= (data?.totalPages || 1)}
                                        className="px-3 py-1.5 border border-slate-200 rounded hover:bg-slate-50 disabled:opacity-30 transition-all font-bold"
                                    >
                                        Next
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
