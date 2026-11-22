"use client";

import { Fragment, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import RoleGuard from '@/components/RoleGuard';
import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';
import { Loader2, ReceiptText } from 'lucide-react';

interface Step { key: string; label: string; state: 'done' | 'current' | 'waiting' | 'cancelled'; at: string | null; note?: string | null }
interface Track { flow: string; steps: Step[]; currentKey: string | null; stepNumber: number; totalSteps: number; finished: boolean; cancelled: boolean; headline: string; waitingFor: string | null; retentionHeld: boolean }
interface Row { id: string; invoiceNumber: string; contractor: string; rtom: string; month: number | null; year: number | null; orders: number; total: number; retention: number; createdAt: string; daysOpen: number; track: Track; matchedOrder: string | null; hoReference: string | null }
interface Result {
    areas: Array<{ rtom: string; name: string }>; rtom: string; rows: Row[]; summary: { total: number; paid: number; cancelled: number; open: number; byStep: Array<{ key: string; label: string; count: number }> };
    contractors: Array<{ id: string; name: string; count: number }>;
    byContractor: Array<{ id: string; name: string; open: number; openAmount: number; oldestDays: number }>;
    truncated: boolean;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const money = (n: number) => `Rs. ${n.toLocaleString('en-LK', { maximumFractionDigits: 0 })}`;
const day = (d: string | null) => (d ? new Date(d).toLocaleDateString('en-GB') : '');
const th = 'py-2 pr-3 text-left text-xs font-bold uppercase tracking-wide text-slate-900';
const selectCls = 'h-9 rounded-md border border-slate-300 bg-white px-2 text-sm text-slate-900';

function Dots({ t }: { t: Track }) {
    return (
        <div className="flex items-center gap-1" aria-label={`Step ${t.stepNumber} of ${t.totalSteps}`}>
            {t.steps.map((s) => (
                <span key={s.key} title={`${s.label}: ${s.state === 'done' ? 'done' : s.state === 'current' ? 'now' : s.state === 'cancelled' ? 'cancelled' : 'later'}`}
                    className={`h-2.5 w-2.5 rounded-full border ${s.state === 'done' ? 'border-emerald-700 bg-emerald-600' : s.state === 'current' ? 'border-amber-700 bg-amber-400' : s.state === 'cancelled' ? 'border-red-700 bg-red-300' : 'border-slate-400 bg-white'}`} />
            ))}
        </div>
    );
}

export default function InvoiceStatusPage() {
    const [rtom, setRtom] = useState('ALL');
    const [search, setSearch] = useState('');
    const [typed, setTyped] = useState('');
    const [state, setState] = useState('all');
    const [contractorId, setContractorId] = useState('');
    const [contractorText, setContractorText] = useState('');
    const [month, setMonth] = useState('');
    const [year, setYear] = useState(String(new Date().getFullYear()));
    const [minDays, setMinDays] = useState('');
    const [sort, setSort] = useState('newest');
    const [open, setOpen] = useState<string | null>(null);

    const q = useQuery<Result>({
        queryKey: ['invoice-status', rtom, search, state, contractorId, month, year, minDays, sort],
        queryFn: async () => {
            const res = await fetch(`/api/service-orders/invoice-status?rtom=${encodeURIComponent(rtom)}&search=${encodeURIComponent(search)}&state=${encodeURIComponent(state)}&contractorId=${contractorId}&month=${month}&year=${month ? year : ''}&minDays=${minDays}&sort=${sort}`, { cache: 'no-store' });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error?.message || 'Could not load the invoices');
            return (json.data ?? json) as Result;
        },
        staleTime: 30_000, retry: false,
    });
    const d = q.data;

    return (
        <RoleGuard permissionId={RBAC_PERMISSIONS.SOD_READ}>
            <div className="flex h-screen bg-slate-50 overflow-hidden">
                <Sidebar />
                <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                    <Header />
                    <main className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
                        <div>
                            <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2"><ReceiptText className="w-7 h-7 text-indigo-700" />Invoice Status</h1>
                            <p className="mt-1 text-sm text-slate-800">Where the contractor invoices of your RTOMs are on their way to payment. Search by invoice number, contractor or service order number, and tell a contractor which step the invoice is at and what comes next.</p>
                        </div>

                        <form className="flex flex-wrap items-end gap-2" onSubmit={(e) => { e.preventDefault(); setSearch(typed.trim()); }}>
                            {(d?.areas.length ?? 0) > 1 && (
                                <label className="text-xs font-semibold text-slate-900">RTOM
                                    <select value={rtom} onChange={(e) => setRtom(e.target.value)} className={`${selectCls} mt-1 block`}>
                                        <option value="ALL">All my RTOMs</option>
                                        {d!.areas.map((a) => <option key={a.rtom} value={a.rtom}>{a.rtom}</option>)}
                                    </select>
                                </label>
                            )}
                            <label className="text-xs font-semibold text-slate-900">Search
                                <input value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="Invoice, contractor or SO number" className={`${selectCls} mt-1 block w-72 placeholder:text-slate-600`} />
                            </label>
                            <label className="text-xs font-semibold text-slate-900">Show
                                <select value={state} onChange={(e) => setState(e.target.value)} className={`${selectCls} mt-1 block`}>
                                    <option value="all">All invoices</option>
                                    <option value="open">Not yet paid</option>
                                    <option value="paid">Paid</option>
                                    {(d?.summary.byStep ?? []).map((s) => <option key={s.key} value={s.key}>Waiting at: {s.label} ({s.count})</option>)}
                                </select>
                            </label>
                            <label className="text-xs font-semibold text-slate-900">Contractor ({d?.contractors.length ?? 0})
                                <input list="invoice-status-contractors" value={contractorText} placeholder="Type to find a contractor" className={`${selectCls} mt-1 block w-64 placeholder:text-slate-600`}
                                    onChange={(e) => {
                                        const v = e.target.value; setContractorText(v);
                                        const hit = d?.contractors.find((c) => c.name.toLowerCase() === v.trim().toLowerCase());
                                        setContractorId(hit ? hit.id : '');
                                    }} />
                                <datalist id="invoice-status-contractors">{(d?.contractors ?? []).map((c) => <option key={c.id} value={c.name}>{c.count} invoices</option>)}</datalist>
                            </label>
                            <label className="text-xs font-semibold text-slate-900">Billing month
                                <span className="mt-1 flex gap-1">
                                    <select value={month} onChange={(e) => setMonth(e.target.value)} className={selectCls}><option value="">Any</option>{MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}</select>
                                    {month && <select value={year} onChange={(e) => setYear(e.target.value)} className={selectCls}>{[new Date().getFullYear() - 1, new Date().getFullYear()].map((y) => <option key={y} value={y}>{y}</option>)}</select>}
                                </span>
                            </label>
                            <label className="text-xs font-semibold text-slate-900">Open for
                                <select value={minDays} onChange={(e) => setMinDays(e.target.value)} className={`${selectCls} mt-1 block`}>
                                    <option value="">Any time</option><option value="7">7 days or more</option><option value="14">14 days or more</option><option value="30">30 days or more</option><option value="60">60 days or more</option>
                                </select>
                            </label>
                            <label className="text-xs font-semibold text-slate-900">Sort
                                <select value={sort} onChange={(e) => setSort(e.target.value)} className={`${selectCls} mt-1 block`}>
                                    <option value="newest">Newest first</option><option value="oldest">Oldest first</option><option value="days">Longest waiting first</option><option value="amount">Largest amount first</option>
                                </select>
                            </label>
                            <button type="submit" className="h-9 rounded-md bg-indigo-800 px-4 text-sm font-bold text-white">Search</button>
                            <button type="button" onClick={() => { setTyped(''); setSearch(''); setState('all'); setContractorId(''); setContractorText(''); setMonth(''); setMinDays(''); setSort('newest'); }} className="h-9 rounded-md border border-slate-400 bg-white px-3 text-sm font-semibold text-slate-900">Clear</button>
                        </form>

                        {d && (
                            <div className="flex flex-wrap gap-2 text-sm font-semibold text-slate-900">
                                <span className="rounded-full border border-slate-400 bg-white px-3 py-0.5">{d.summary.total} invoices</span>
                                <span className="rounded-full border border-amber-500 bg-amber-50 px-3 py-0.5 text-amber-950">{d.summary.open} not yet paid</span>
                                <span className="rounded-full border border-emerald-600 bg-emerald-50 px-3 py-0.5 text-emerald-950">{d.summary.paid} paid</span>
                                {d.summary.cancelled > 0 && <span className="rounded-full border border-red-500 bg-red-50 px-3 py-0.5 text-red-950">{d.summary.cancelled} cancelled</span>}
                            </div>
                        )}

                        {d && !contractorId && d.byContractor.length > 0 && (
                            <details className="rounded-xl border border-slate-300 bg-white p-3" open={d.contractors.length > 8}>
                                <summary className="cursor-pointer text-sm font-bold text-slate-900">Unpaid invoices by contractor ({d.byContractor.length}{d.byContractor.length >= 60 ? '+' : ''}), longest waiting first</summary>
                                <div className="mt-2 overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead><tr className="border-b border-slate-300"><th className={th}>Contractor</th><th className={th}>Unpaid invoices</th><th className={th}>Amount</th><th className={th}>Oldest waiting</th></tr></thead>
                                        <tbody>
                                            {d.byContractor.map((c) => (
                                                <tr key={c.id} className="cursor-pointer border-b border-slate-200 text-slate-900 hover:bg-slate-50" onClick={() => { setContractorId(c.id); setContractorText(c.name); }}>
                                                    <td className="py-1.5 pr-3 font-semibold">{c.name}</td><td className="py-1.5 pr-3">{c.open}</td><td className="py-1.5 pr-3 whitespace-nowrap">{money(c.openAmount)}</td>
                                                    <td className={`py-1.5 pr-3 whitespace-nowrap ${c.oldestDays >= 30 ? 'font-bold text-red-800' : c.oldestDays >= 14 ? 'font-semibold text-amber-900' : ''}`}>{c.oldestDays} days</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </details>
                        )}
                        {d?.truncated && <p className="text-xs font-semibold text-amber-950">Only the first {d.rows.length} invoices are shown. Narrow the search with a contractor, a month or a step.</p>}

                        {q.isLoading ? <div className="py-8 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-slate-700" /></div>
                            : q.isError ? <p className="text-sm text-red-800">{(q.error as Error).message}</p>
                                : (d?.rows.length ?? 0) === 0 ? <p className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-900">No invoice matches. Invoices appear here once the Engineer creates them.</p>
                                    : (
                                        <div className="overflow-x-auto rounded-xl border border-slate-300 bg-white p-3">
                                            <table className="w-full text-sm">
                                                <thead><tr className="border-b border-slate-300"><th className={th}>Invoice</th><th className={th}>Contractor</th><th className={th}>RTOM</th><th className={th}>Month</th><th className={th}>Orders</th><th className={th}>Amount</th><th className={th}>Where it is now</th><th className={th}>Progress</th><th className={th}>Days</th></tr></thead>
                                                <tbody>
                                                    {d!.rows.map((r) => (
                                                        <Fragment key={r.id}>
                                                            <tr className="cursor-pointer border-b border-slate-200 align-top text-slate-900 hover:bg-slate-50" onClick={() => setOpen(open === r.id ? null : r.id)}>
                                                                <td className="py-2 pr-3 font-semibold whitespace-nowrap">{r.invoiceNumber}{r.matchedOrder && <div className="text-xs font-bold text-indigo-900">has {r.matchedOrder}</div>}</td>
                                                                <td className="py-2 pr-3">{r.contractor}</td>
                                                                <td className="py-2 pr-3">{r.rtom}</td>
                                                                <td className="py-2 pr-3 whitespace-nowrap">{r.month ? `${MONTHS[r.month - 1]} ${r.year ?? ''}` : '-'}</td>
                                                                <td className="py-2 pr-3">{r.orders}</td>
                                                                <td className="py-2 pr-3 whitespace-nowrap">{money(r.total)}</td>
                                                                <td className={`py-2 pr-3 font-semibold ${r.track.finished ? 'text-emerald-900' : r.track.cancelled ? 'text-red-900' : ''}`}>{r.track.headline}</td>
                                                                <td className="py-2 pr-3"><Dots t={r.track} /></td>
                                                                <td className="py-2 pr-3 whitespace-nowrap">{r.track.finished || r.track.cancelled ? '-' : r.daysOpen}</td>
                                                            </tr>
                                                            {open === r.id && (
                                                                <tr className="border-b border-slate-300 bg-slate-50">
                                                                    <td colSpan={9} className="p-4">
                                                                        <ol className="space-y-2">
                                                                            {r.track.steps.map((s, i) => (
                                                                                <li key={s.key} className="flex items-start gap-3 text-sm text-slate-900">
                                                                                    <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[11px] font-black ${s.state === 'done' ? 'border-emerald-700 bg-emerald-600 text-white' : s.state === 'current' ? 'border-amber-700 bg-amber-400 text-slate-900' : s.state === 'cancelled' ? 'border-red-700 bg-red-300 text-slate-900' : 'border-slate-400 bg-white text-slate-900'}`}>{i + 1}</span>
                                                                                    <div>
                                                                                        <div className={s.state === 'current' ? 'font-bold' : 'font-medium'}>{s.label}{s.state === 'current' && <span className="ml-2 rounded bg-amber-100 px-1.5 text-xs font-bold text-amber-950">now</span>}{s.state === 'done' && s.at ? <span className="ml-2 text-xs text-slate-700">{day(s.at)}</span> : null}</div>
                                                                                        {s.note && <div className="text-xs font-semibold text-red-900">{s.note}</div>}
                                                                                    </div>
                                                                                </li>
                                                                            ))}
                                                                        </ol>
                                                                        <p className="mt-3 text-xs text-slate-800">
                                                                            Amount {money(r.total)}{r.retention > 0 ? ` · retention ${money(r.retention)} is held back and released later` : ''}{r.hoReference ? ` · Head Office reference ${r.hoReference}` : ''}. Created {day(r.createdAt)}.
                                                                        </p>
                                                                    </td>
                                                                </tr>
                                                            )}
                                                        </Fragment>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                    </main>
                </div>
            </div>
        </RoleGuard>
    );
}
