"use client";

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import RoleGuard from '@/components/RoleGuard';
import ExportCsvButton from '@/components/ExportCsvButton';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, Package } from 'lucide-react';

interface Registration {
    status: string; type: string; registrationNumber: string | null; brNumber: string | null; contactNumber: string | null; email: string | null; address: string | null;
    agreementSigned: boolean; agreementDate: string | null; agreementYears: number | null; registrationFeePaid: boolean;
    armApprovedAt: string | null; ospApprovedAt: string | null; documentStatus: string; registeredAt: string;
    teams: Array<{ name: string; sltCode: string | null; status: string; members: number }>;
}
interface StockResponse {
    areas: Array<{ rtom: string; name: string }>;
    rtom: string;
    contractors: Array<{ contractorId: string; name: string; rtom: string; registration: Registration; items: Array<{ code: string; name: string; unit: string; type: string; quantity: number }> }>;
}

const day = (d: string | null) => (d ? new Date(d).toLocaleDateString('en-GB') : '-');
const yesNo = (b: boolean) => (b ? 'Yes' : 'No');
const STATUS_TONE: Record<string, string> = { ACTIVE: 'border-emerald-600 bg-emerald-50 text-emerald-900', INACTIVE: 'border-slate-500 bg-slate-100 text-slate-900', ARM_PENDING: 'border-amber-500 bg-amber-50 text-amber-950', OSP_PENDING: 'border-amber-500 bg-amber-50 text-amber-950' };

export default function ContractorStockPage() {
    const [rtom, setRtom] = useState('ALL');
    const [search, setSearch] = useState('');
    const { data, isLoading, error } = useQuery<StockResponse>({
        queryKey: ['area-contractor-stock', rtom],
        queryFn: async () => {
            const res = await fetch(`/api/service-orders/contractor-stock?rtom=${encodeURIComponent(rtom)}`);
            if (!res.ok) throw new Error('Could not load the contractors of your area');
            const body = await res.json();
            return (body.data ?? body) as StockResponse;
        },
    });

    const shown = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return data?.contractors ?? [];
        return (data?.contractors ?? []).filter((c) => c.name.toLowerCase().includes(q) || c.items.some((i) => `${i.code} ${i.name}`.toLowerCase().includes(q)));
    }, [data, search]);

    const exportRows = () => [
        ['Contractor', 'RTOM', 'Status', 'Registration number', 'Contact', 'Item code', 'Item', 'Unit', 'In hand'],
        ...shown.flatMap((c) => (c.items.length ? c.items : [null]).map((i) => [c.name, c.rtom, c.registration.status, c.registration.registrationNumber ?? '', c.registration.contactNumber ?? '', i?.code ?? '', i?.name ?? '(no material in hand)', i?.unit ?? '', i?.quantity ?? ''])),
    ];

    return (
        <RoleGuard>
            <div className="flex h-screen bg-slate-50 overflow-hidden">
                <Sidebar />
                <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                    <Header />
                    <main className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                                <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2"><Package className="w-7 h-7 text-indigo-600" />Contractors of my area: registration and material balance</h1>
                                <p className="text-sm text-slate-700 mt-1">How each contractor of your RTOMs is registered, its teams, and the material it holds in hand. View only.</p>
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
                                <ExportCsvButton filename="contractors-of-my-area.csv" disabled={!data} getRows={exportRows} />
                            </div>
                        </div>

                        {isLoading && <div className="flex h-40 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /></div>}
                        {error && <p className="text-sm text-red-700">{(error as Error).message}</p>}
                        {data && shown.length === 0 && <p className="text-sm text-slate-900">No contractor is registered in your RTOMs.</p>}

                        {shown.map((c) => {
                            const r = c.registration;
                            return (
                                <Card key={c.contractorId} className="shadow-sm"><CardContent className="p-5 space-y-3 overflow-x-auto">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <h2 className="font-bold text-slate-900">{c.name}</h2>
                                        <span className="text-xs font-semibold text-slate-700">{c.rtom}</span>
                                        <span className={`rounded-full border px-2 py-0.5 text-[11px] font-bold ${STATUS_TONE[r.status] ?? 'border-slate-500 bg-slate-100 text-slate-900'}`}>{r.status.replace('_', ' ')}</span>
                                        <span className="text-xs font-semibold text-slate-700">{r.type}</span>
                                    </div>
                                    <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm text-slate-900 md:grid-cols-4">
                                        <div><dt className="text-xs font-bold uppercase text-slate-700">Registration no.</dt><dd>{r.registrationNumber ?? '-'}</dd></div>
                                        <div><dt className="text-xs font-bold uppercase text-slate-700">BR number</dt><dd>{r.brNumber ?? '-'}</dd></div>
                                        <div><dt className="text-xs font-bold uppercase text-slate-700">Contact</dt><dd>{r.contactNumber ?? '-'}{r.email ? ` · ${r.email}` : ''}</dd></div>
                                        <div><dt className="text-xs font-bold uppercase text-slate-700">Registered</dt><dd>{day(r.registeredAt)}</dd></div>
                                        <div className="col-span-2"><dt className="text-xs font-bold uppercase text-slate-700">Address</dt><dd>{r.address ?? '-'}</dd></div>
                                        <div><dt className="text-xs font-bold uppercase text-slate-700">Agreement</dt><dd>{yesNo(r.agreementSigned)}{r.agreementDate ? ` · ${day(r.agreementDate)}` : ''}{r.agreementYears ? ` · ${r.agreementYears} yr` : ''}</dd></div>
                                        <div><dt className="text-xs font-bold uppercase text-slate-700">Registration fee paid</dt><dd>{yesNo(r.registrationFeePaid)}</dd></div>
                                        <div><dt className="text-xs font-bold uppercase text-slate-700">Area Manager approved</dt><dd>{day(r.armApprovedAt)}</dd></div>
                                        <div><dt className="text-xs font-bold uppercase text-slate-700">OSP Manager approved</dt><dd>{day(r.ospApprovedAt)}</dd></div>
                                        <div><dt className="text-xs font-bold uppercase text-slate-700">Documents</dt><dd>{r.documentStatus}</dd></div>
                                        <div className="col-span-2"><dt className="text-xs font-bold uppercase text-slate-700">Teams ({r.teams.length})</dt><dd>{r.teams.length === 0 ? '-' : r.teams.map((t) => `${t.sltCode ?? t.name} (${t.members} member${t.members === 1 ? '' : 's'})`).join(', ')}</dd></div>
                                    </dl>
                                    <h3 className="text-sm font-black text-slate-900">Material in hand ({c.items.length} item{c.items.length === 1 ? '' : 's'})</h3>
                                    {c.items.length === 0 ? <p className="text-sm text-slate-900">No material in hand.</p> : (
                                        <table className="w-full text-sm">
                                            <thead><tr className="border-b border-slate-300 text-left text-slate-900"><th className="py-2 pr-3">Code</th><th className="py-2 pr-3">Item</th><th className="py-2 pr-3">Unit</th><th className="py-2 text-right">In hand</th></tr></thead>
                                            <tbody>
                                                {c.items.map((i) => (
                                                    <tr key={i.code} className="border-b border-slate-200 text-slate-900"><td className="py-2 pr-3">{i.code}</td><td className="py-2 pr-3 font-medium">{i.name}</td><td className="py-2 pr-3">{i.unit}</td><td className="py-2 text-right font-semibold">{i.quantity.toLocaleString()}</td></tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    )}
                                </CardContent></Card>
                            );
                        })}
                    </main>
                </div>
            </div>
        </RoleGuard>
    );
}
