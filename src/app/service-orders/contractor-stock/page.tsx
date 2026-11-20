"use client";

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import RoleGuard from '@/components/RoleGuard';
import ExportCsvButton from '@/components/ExportCsvButton';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, Package } from 'lucide-react';

interface StockResponse {
    areas: Array<{ rtom: string; name: string }>;
    rtom: string;
    contractors: Array<{ contractorId: string; name: string; rtom: string; items: Array<{ code: string; name: string; unit: string; type: string; quantity: number }> }>;
}

export default function ContractorStockPage() {
    const [rtom, setRtom] = useState('ALL');
    const [search, setSearch] = useState('');
    const { data, isLoading, error } = useQuery<StockResponse>({
        queryKey: ['area-contractor-stock', rtom],
        queryFn: async () => {
            const res = await fetch(`/api/service-orders/contractor-stock?rtom=${encodeURIComponent(rtom)}`);
            if (!res.ok) throw new Error('Could not load the contractors\' stock');
            const body = await res.json();
            return (body.data ?? body) as StockResponse;
        },
    });

    const shown = useMemo(() => {
        const q = search.trim().toLowerCase();
        return (data?.contractors ?? [])
            .map((c) => ({ ...c, items: q && !c.name.toLowerCase().includes(q) ? c.items.filter((i) => `${i.code} ${i.name}`.toLowerCase().includes(q)) : c.items }))
            .filter((c) => c.items.length > 0);
    }, [data, search]);

    const exportRows = () => [['Contractor', 'RTOM', 'Item code', 'Item', 'Unit', 'In hand'], ...shown.flatMap((c) => c.items.map((i) => [c.name, c.rtom, i.code, i.name, i.unit, i.quantity]))];

    return (
        <RoleGuard>
            <div className="flex h-screen bg-slate-50 overflow-hidden">
                <Sidebar />
                <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                    <Header />
                    <main className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                                <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2"><Package className="w-7 h-7 text-indigo-600" />Contractor stock in my area</h1>
                                <p className="text-sm text-slate-700 mt-1">The material each contractor of your RTOMs holds in hand. View only.</p>
                            </div>
                            <div className="flex items-end gap-3">
                                {(data?.areas.length ?? 0) > 1 && (
                                    <label className="text-xs font-semibold text-slate-900">RTOM
                                        <select value={rtom} onChange={(e) => setRtom(e.target.value)} className="mt-1 block rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900">
                                            <option value="ALL">All my RTOMs</option>
                                            {data!.areas.map((a) => <option key={a.rtom} value={a.rtom}>{a.rtom}</option>)}
                                        </select>
                                    </label>
                                )}
                                <label className="text-xs font-semibold text-slate-900">Search
                                    <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Contractor or item" className="mt-1 block rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900" />
                                </label>
                                <ExportCsvButton filename="contractor-stock.csv" disabled={!data} getRows={exportRows} />
                            </div>
                        </div>

                        {isLoading && <div className="flex h-40 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /></div>}
                        {error && <p className="text-sm text-red-700">{(error as Error).message}</p>}
                        {data && shown.length === 0 && <p className="text-sm text-slate-900">No contractor of your area holds material in hand.</p>}

                        {shown.map((c) => (
                            <Card key={c.contractorId} className="shadow-sm"><CardContent className="p-5 overflow-x-auto">
                                <h2 className="mb-2 font-bold text-slate-900">{c.name} <span className="ml-2 text-xs font-semibold text-slate-700">{c.rtom} · {c.items.length} items</span></h2>
                                <table className="w-full text-sm">
                                    <thead><tr className="border-b border-slate-300 text-left text-slate-900"><th className="py-2 pr-3">Code</th><th className="py-2 pr-3">Item</th><th className="py-2 pr-3">Unit</th><th className="py-2 text-right">In hand</th></tr></thead>
                                    <tbody>
                                        {c.items.map((i) => (
                                            <tr key={i.code} className="border-b border-slate-200 text-slate-900"><td className="py-2 pr-3">{i.code}</td><td className="py-2 pr-3 font-medium">{i.name}</td><td className="py-2 pr-3">{i.unit}</td><td className="py-2 text-right font-semibold">{i.quantity.toLocaleString()}</td></tr>
                                        ))}
                                    </tbody>
                                </table>
                            </CardContent></Card>
                        ))}
                    </main>
                </div>
            </div>
        </RoleGuard>
    );
}
