"use client";

import React, { useState } from 'react';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import { useQuery } from '@tanstack/react-query';
import { ArrowUpDown } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { format } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

import { toast } from 'sonner';

interface PATOrder {
    id: string;
    soNum: string;
    rtom: string;
    lea?: string;
    voiceNumber: string | null;
    sType: string;
    orderType: string;
    task?: string;
    package?: string;
    conName?: string;
    patUser: string | null;
    status: string;
    statusDate: string | null;
}

export default function PATStatusPage() {
    const [page, setPage] = useState(1);
    const [search, setSearch] = useState('');
    const [view, setView] = useState('OPMC_REJECTED'); // REJECTED, OPMC_REJECTED


    const tabs = [
        { id: 'OPMC_REJECTED', label: 'OPMC PAT REJECT' },
        { id: 'REJECTED', label: 'SLT REJECTED' }
    ];

    const { data, isLoading } = useQuery({
        queryKey: ['pat-orders-v6', page, search, view],
        queryFn: async () => {
            const params = new URLSearchParams({
                page: page.toString(),
                search,
                status: view,
                limit: '20'
            });
            const resp = await fetch(`/api/service-orders/pat?${params}`);
            if (!resp.ok) throw new Error('Failed to fetch PAT data');
            return resp.json();
        }
    });




    const isOpmcReject = view === 'OPMC_REJECTED';

    return (
        <div className="min-h-screen flex bg-[#f8f9fc]">
            <Sidebar />
            <main className="flex-1 flex flex-col min-w-0">
                <Header />
                <div className="flex-1 overflow-y-auto p-4 lg:p-6">
                    <div className="max-w-full mx-auto space-y-0 shadow-sm border border-slate-200 rounded-sm">

                        {/* Tab Bar - EXACT SLT STYLE */}
                        <div className="flex bg-[#f1f3f7] rounded-t-sm border-b border-slate-200">
                            {tabs.map((tab) => (
                                <button
                                    key={tab.id}
                                    onClick={() => { setView(tab.id); setPage(1); }}
                                    className={cn(
                                        "px-10 py-4 text-[13px] font-bold tracking-tight transition-all relative min-w-fit whitespace-nowrap",
                                        view === tab.id
                                            ? "text-[#673ab7] bg-white border-t-[3px] border-[#673ab7]"
                                            : "text-slate-600 hover:bg-white/50"
                                    )}
                                >
                                    {tab.label.toUpperCase()}
                                </button>
                            ))}
                        </div>

                        {/* Controls Bar - Blue buttons, Search on right */}
                        <div className="bg-white p-4 flex flex-col md:flex-row justify-between items-center gap-4 border-x border-slate-100">
                            <div className="flex items-center gap-2">
                                {view !== 'OPMC_REJECTED' && (
                                    <button
                                        onClick={() => window.print()}
                                        className="px-5 py-2.5 bg-[#1d56d1] text-white rounded-[3px] font-medium text-xs hover:bg-blue-800 transition-all shadow-sm"
                                    >
                                        Print
                                    </button>
                                )}

                            </div>

                            <div className="flex items-center gap-3">
                                <span className="text-[13px] font-medium text-slate-500">Search:</span>
                                <input
                                    type="text"
                                    className="w-48 h-9 px-3 bg-white border border-slate-200 rounded focus:outline-none focus:border-blue-400 text-[13px] shadow-sm"
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                />
                            </div>
                        </div>

                        {/* DATA TABLE */}
                        <Card className="border-none shadow-none rounded-none overflow-hidden bg-white">
                            <div className="overflow-x-auto">
                                <table className="w-full text-[13px] border-collapse">
                                    <thead className="bg-[#f1f3f7] text-[#4a5568] uppercase border-y border-slate-200">
                                        <tr className="divide-x divide-slate-200 h-12">
                                            {isOpmcReject ? (
                                                <>
                                                    <th className="px-4 py-2 text-left font-bold min-w-[80px]">LEA <ArrowUpDown className="inline w-3 h-3 ml-2 opacity-30" /></th>
                                                    <th className="px-4 py-2 text-left font-bold min-w-[180px]">SOD <ArrowUpDown className="inline w-3 h-3 ml-2 opacity-30" /></th>
                                                    <th className="px-4 py-2 text-left font-bold min-w-[140px]">CIRCUIT <ArrowUpDown className="inline w-3 h-3 ml-2 opacity-30" /></th>
                                                    <th className="px-4 py-2 text-left font-bold min-w-[100px]">SERVICE <ArrowUpDown className="inline w-3 h-3 ml-2 opacity-30" /></th>
                                                    <th className="px-4 py-2 text-left font-bold min-w-[140px]">ORDER TYPE <ArrowUpDown className="inline w-3 h-3 ml-2 opacity-30" /></th>
                                                    <th className="px-4 py-2 text-left font-bold min-w-[160px]">TASK <ArrowUpDown className="inline w-3 h-3 ml-2 opacity-30" /></th>
                                                    <th className="px-4 py-2 text-left font-bold min-w-[180px]">RECEIVED ON <ArrowUpDown className="inline w-3 h-3 ml-2 opacity-30" /></th>
                                                    <th className="px-4 py-2 text-left font-bold min-w-[120px]">PACKAGE <ArrowUpDown className="inline w-3 h-3 ml-2 opacity-30" /></th>
                                                    <th className="px-4 py-2 text-left font-bold min-w-[150px]">STATUS <ArrowUpDown className="inline w-3 h-3 ml-2 opacity-30" /></th>
                                                </>
                                            ) : (
                                                <>
                                                    <th className="px-4 py-2 text-left font-bold min-w-[80px]">RTOM <ArrowUpDown className="inline w-3 h-3 ml-2 opacity-30" /></th>
                                                    <th className="px-4 py-2 text-left font-bold min-w-[180px]">SOD <ArrowUpDown className="inline w-3 h-3 ml-2 opacity-30" /></th>
                                                    <th className="px-4 py-2 text-left font-bold min-w-[140px]">CIRCUIT <ArrowUpDown className="inline w-3 h-3 ml-2 opacity-30" /></th>
                                                    <th className="px-4 py-2 text-left font-bold min-w-[100px]">SERVICE <ArrowUpDown className="inline w-3 h-3 ml-2 opacity-30" /></th>
                                                    <th className="px-4 py-2 text-left font-bold min-w-[140px]">ORDER TYPE <ArrowUpDown className="inline w-3 h-3 ml-2 opacity-30" /></th>
                                                    <th className="px-4 py-2 text-left font-bold min-w-[150px]">STATUS <ArrowUpDown className="inline w-3 h-3 ml-2 opacity-30" /></th>
                                                    <th className="px-4 py-2 text-left font-bold min-w-[130px]">CONTRACTOR <ArrowUpDown className="inline w-3 h-3 ml-2 opacity-30" /></th>
                                                    <th className="px-4 py-2 text-left font-bold min-w-[110px]">PAT USER <ArrowUpDown className="inline w-3 h-3 ml-2 opacity-30" /></th>
                                                    <th className="px-4 py-2 text-left font-bold min-w-[180px]">COMPLETED ON <ArrowUpDown className="inline w-3 h-3 ml-2 opacity-30" /></th>
                                                </>
                                            )}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {isLoading ? (
                                            Array(8).fill(0).map((_, i) => (
                                                <tr key={i} className="divide-x divide-slate-50 h-12">
                                                    {Array(9).fill(0).map((_, j) => (
                                                        <td key={j} className="px-4 py-2"><Skeleton className="h-4 w-full" /></td>
                                                    ))}
                                                </tr>
                                            ))
                                        ) : data?.orders?.map((order: PATOrder) => (
                                            <tr key={order.id} className="hover:bg-slate-50 transition-colors divide-x divide-slate-50 h-12">
                                                {isOpmcReject ? (
                                                    <>
                                                        <td className="px-4 py-2 text-slate-600">{order.lea || order.rtom || '-'}</td>
                                                        <td className="px-4 py-2"><a href={`/service-orders/${order.soNum}`} className="text-[#b71c1c] hover:underline font-bold">{order.soNum}</a></td>
                                                        <td className="px-4 py-2 text-slate-700 font-medium">{order.voiceNumber || '-'}</td>
                                                        <td className="px-4 py-2 text-slate-600">{order.sType || '-'}</td>
                                                        <td className="px-4 py-2 text-slate-600">{order.orderType || '-'}</td>
                                                        <td className="px-4 py-2 text-slate-600">{order.task || '-'}</td>
                                                        <td className="px-4 py-2 text-slate-500 whitespace-nowrap">{order.statusDate ? format(new Date(order.statusDate), 'MM/dd/yyyy hh:mm:ss a') : '-'}</td>
                                                        <td className="px-4 py-2 text-slate-600">{order.package || '-'}</td>
                                                        <td className="px-4 py-2 font-bold text-[#d81b60] text-[11px] whitespace-nowrap uppercase">PAT_OPMC_REJECTED</td>
                                                    </>
                                                ) : (
                                                    <>
                                                        <td className="px-4 py-2 text-slate-600">{order.rtom || '-'}</td>
                                                        <td className="px-4 py-2"><a href={`/service-orders/${order.soNum}`} className="text-[#1d56d1] hover:underline font-bold">{order.soNum}</a></td>
                                                        <td className="px-4 py-2 text-slate-700 font-medium">{order.voiceNumber || '-'}</td>
                                                        <td className="px-4 py-2 text-slate-600">{order.sType || '-'}</td>
                                                        <td className="px-4 py-2 text-slate-600">{order.orderType || '-'}</td>
                                                        <td className="px-4 py-2"><span className={cn(
                                                            "font-bold uppercase",
                                                            view === 'ACCEPTED' ? "text-emerald-700" : "text-rose-700"
                                                        )}>{order.status}</span></td>
                                                        <td className="px-4 py-2 text-slate-600">{order.conName || 'SLTS'}</td>
                                                        <td className="px-4 py-2 text-slate-600 font-medium">{order.patUser || '-'}</td>
                                                        <td className="px-4 py-2 text-slate-500 whitespace-nowrap font-medium">{order.statusDate ? format(new Date(order.statusDate), 'MM/dd/yyyy hh:mm:ss a') : '-'}</td>
                                                    </>
                                                )}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {/* Pagination */}
                            <div className="p-4 border-t border-slate-100 flex items-center justify-between bg-white text-xs">
                                <span className="text-slate-500 ml-4">Showing {((page - 1) * 20) + 1} to {Math.min(page * 20, data?.total || 0)} of {data?.total || 0} entries</span>
                                <div className="flex items-center gap-1 mr-4">
                                    <button
                                        onClick={() => setPage(p => Math.max(1, p - 1))}
                                        disabled={page === 1}
                                        className="px-4 py-2 bg-slate-100 text-slate-700 rounded-sm disabled:opacity-30 font-bold hover:bg-slate-200 transition-all font-mono tracking-tighter"
                                    >Previous</button>
                                    <span className="w-10 h-10 flex items-center justify-center bg-[#1d56d1] text-white rounded-sm font-bold shadow-md">{page}</span>
                                    <button
                                        onClick={() => setPage(p => p + 1)}
                                        disabled={page >= (data?.totalPages || 1)}
                                        className="px-4 py-2 bg-slate-100 text-slate-700 rounded-sm disabled:opacity-30 font-bold hover:bg-slate-200 transition-all font-mono tracking-tighter"
                                    >Next</button>
                                </div>
                            </div>
                        </Card>
                    </div>
                </div>
            </main>
        </div>
    );
}
