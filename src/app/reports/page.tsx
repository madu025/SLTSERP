"use client";

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Search, Play, Download, Plus, Trash2, ShieldCheck, FileText, Database } from 'lucide-react';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import { Button } from '@/components/ui/button';
import { REPORT_CATALOG, type ReportCategory } from '@/config/report-catalog';
import { resolvePageCapability } from '@/config/page-capabilities';

interface FieldMeta { path: string; label: string; kind: 'number' | 'date' | 'text'; groupable: boolean }
interface EntityMeta { id: string; label: string; description: string; fields: FieldMeta[] }
interface FilterRow { field: string; operator: string; value: string }
/** The table shows the first SCREEN_ROWS; the CSV carries everything the server returned (up to EXPORT_ROWS). */
const SCREEN_ROWS = 500;
const EXPORT_ROWS = 10_000;

interface ReportResult { columns: string[]; rows: Record<string, unknown>[]; totalRows: number; truncated: boolean; search: string; verified: boolean }

const OPERATORS: { id: string; label: string }[] = [
    { id: 'equals', label: 'is' }, { id: 'contains', label: 'contains' }, { id: 'startsWith', label: 'starts with' },
    { id: 'gt', label: 'greater than' }, { id: 'gte', label: 'at least' }, { id: 'lt', label: 'less than' }, { id: 'lte', label: 'at most' },
];
const CATEGORIES: ('All' | ReportCategory)[] = ['All', 'Operations', 'Finance', 'Inventory', 'Procurement', 'Projects', 'Fleet', 'Helpdesk'];
const selectCls = 'w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900 focus:border-sky-600 focus:outline-none';
const inputCls = selectCls;

const unwrap = <T,>(json: unknown): T => ((json as { data?: T })?.data ?? json) as T;
const fmt = (v: unknown) => (v === null || v === undefined ? '' : typeof v === 'number' ? v.toLocaleString('en-US', { maximumFractionDigits: 2 }) : String(v));

export default function ReportCenterPage() {
    const [tab, setTab] = useState<'catalog' | 'builder'>('catalog');
    const [permissions, setPermissions] = useState<string[]>([]);
    const [query, setQuery] = useState('');
    const [category, setCategory] = useState<'All' | ReportCategory>('All');

    // builder
    const [entities, setEntities] = useState<EntityMeta[]>([]);
    const [metaError, setMetaError] = useState('');
    const [entityId, setEntityId] = useState('');
    const [mode, setMode] = useState<'summary' | 'rows'>('summary');
    const [columns, setColumns] = useState<string[]>([]);
    const [groupBy, setGroupBy] = useState('');
    const [measure, setMeasure] = useState<'COUNT' | 'SUM' | 'AVG'>('COUNT');
    const [target, setTarget] = useState('');
    const [filters, setFilters] = useState<FilterRow[]>([]);
    const [running, setRunning] = useState(false);
    const [result, setResult] = useState<ReportResult | null>(null);

    useEffect(() => {
        try { setPermissions((JSON.parse(localStorage.getItem('user') || '{}').permissions as string[]) ?? []); } catch { setPermissions([]); }
    }, []);

    useEffect(() => {
        fetch('/api/reports/custom').then(async (r) => {
            const json = await r.json();
            if (!r.ok) throw new Error(r.status === 401 ? 'Your session has expired. Please sign in again.' : (json.message || 'The report builder could not be loaded.'));
            const list = unwrap<{ entities: EntityMeta[] }>(json).entities ?? [];
            setEntities(list);
            if (list[0]) setEntityId(list[0].id);
        }).catch((e) => setMetaError(e instanceof Error ? e.message : 'The report builder could not be loaded.'));
    }, []);

    const visible = useMemo(() => REPORT_CATALOG.filter((r) => {
        const cap = resolvePageCapability(r.path);
        if (!cap || !permissions.includes(cap)) return false;
        if (category !== 'All' && r.category !== category) return false;
        const q = query.trim().toLowerCase();
        return !q || `${r.title} ${r.description} ${r.category}`.toLowerCase().includes(q);
    }), [permissions, query, category]);

    const entity = entities.find((e) => e.id === entityId);
    const numeric = entity?.fields.filter((f) => f.kind === 'number') ?? [];

    useEffect(() => { setColumns([]); setGroupBy(entity?.fields.find((f) => f.groupable)?.path ?? ''); setTarget(''); setFilters([]); setResult(null); }, [entityId, entity]);

    const run = async () => {
        if (!entity) return;
        if (mode === 'summary' && !groupBy) return toast.error('Choose what to group by.');
        if (mode === 'summary' && measure !== 'COUNT' && !target) return toast.error('Choose the number to add up or average.');
        if (mode === 'rows' && columns.length === 0) return toast.error('Choose at least one column.');
        setRunning(true);
        try {
            const body = {
                entity: entity.id,
                columns: mode === 'rows' ? columns : [],
                filters: filters.filter((f) => f.field && f.value.trim() !== ''),
                aggregation: mode === 'summary' ? { groupBy, targetField: measure === 'COUNT' ? 'id' : target, type: measure } : undefined,
                maxRows: EXPORT_ROWS,
            };
            const res = await fetch('/api/reports/custom', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
            const json = await res.json();
            if (!res.ok) throw new Error(json.message || json.error || 'The report could not be built.');
            setResult(unwrap<ReportResult>(json));
        } catch (e) {
            setResult(null);
            toast.error(e instanceof Error ? e.message : 'The report could not be built.');
        } finally { setRunning(false); }
    };

    const exportCsv = () => {
        if (!result) return;
        const esc = (v: unknown) => `"${fmt(v).replace(/"/g, '""')}"`;
        const csv = [result.columns.map(esc).join(','), ...result.rows.map((r) => result.columns.map((c) => esc(r[c])).join(','))].join('\n');
        const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
        const a = document.createElement('a');
        a.href = url; a.download = `report-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
        URL.revokeObjectURL(url);
    };

    const label = (path: string) => {
        if (path.startsWith('COUNT_OF_')) return 'Rows';
        const m = path.match(/^(SUM|AVG)_OF_(.+)$/);
        if (m) return `${m[1] === 'SUM' ? 'Total' : 'Average'} ${(entity?.fields.find((f) => f.path === m[2].split('_').join('.'))?.label ?? m[2]).toLowerCase()}`;
        return entity?.fields.find((f) => f.path === path)?.label ?? path;
    };

    return (
        <div className="flex h-screen bg-slate-50 overflow-hidden">
            <Sidebar />
            <main className="flex-1 flex flex-col min-w-0 h-full overflow-y-auto">
                <Header />
                <div className="p-6 space-y-6 max-w-[1400px] mx-auto w-full">
                    <div>
                        <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Report Center</h1>
                        <p className="text-slate-700 mt-1">Every report in the system in one place, and a builder for any question the data can answer. Figures come straight from the database and are checked before they are shown.</p>
                    </div>

                    <div className="flex gap-2 border-b border-slate-300">
                        {([['catalog', 'All reports', FileText], ['builder', 'Build a report', Database]] as const).map(([id, text, Icon]) => (
                            <button key={id} onClick={() => setTab(id)} className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold border-b-2 -mb-px ${tab === id ? 'border-sky-700 text-sky-800' : 'border-transparent text-slate-700 hover:text-slate-900'}`}>
                                <Icon className="w-4 h-4" />{text}
                            </button>
                        ))}
                    </div>

                    {tab === 'catalog' && (
                        <div className="space-y-4">
                            <div className="flex flex-col md:flex-row gap-3">
                                <div className="relative flex-1">
                                    <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-600" />
                                    <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search reports (for example aging, stock, SLA)" className={`${inputCls} pl-9`} />
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {CATEGORIES.map((c) => (
                                        <button key={c} onClick={() => setCategory(c)} className={`rounded-full border px-3 py-1 text-xs font-semibold ${category === c ? 'border-sky-700 bg-sky-700 text-white' : 'border-slate-300 bg-white text-slate-800 hover:border-sky-600'}`}>{c}</button>
                                    ))}
                                </div>
                            </div>
                            {visible.length === 0 ? (
                                <p className="rounded-lg border border-slate-300 bg-white p-6 text-sm text-slate-800">No reports match. You only see reports your role has access to.</p>
                            ) : (
                                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                                    {visible.map((r) => (
                                        <Link key={r.path} href={r.path} className="group rounded-xl border border-slate-300 bg-white p-4 hover:border-sky-600 hover:shadow-sm">
                                            <div className="text-[11px] font-bold uppercase tracking-wide text-sky-800">{r.category}</div>
                                            <div className="mt-1 text-base font-semibold text-slate-900 group-hover:text-sky-800">{r.title}</div>
                                            <p className="mt-1 text-sm text-slate-700">{r.description}</p>
                                        </Link>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {tab === 'builder' && (
                        <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
                            <div className="rounded-xl border border-slate-300 bg-white p-4 space-y-4 h-fit">
                                {entities.length === 0 ? <p className="text-sm text-slate-900">{metaError || 'No data sets are available for your role.'}</p> : (<>
                                    <div>
                                        <label className="text-xs font-bold text-slate-900">Data</label>
                                        <select value={entityId} onChange={(e) => setEntityId(e.target.value)} className={selectCls}>{entities.map((e) => <option key={e.id} value={e.id}>{e.label}</option>)}</select>
                                        {entity?.description && <p className="mt-1 text-xs text-slate-700">{entity.description}</p>}
                                    </div>
                                    <div className="flex gap-2">
                                        {([['summary', 'Summarise'], ['rows', 'List rows']] as const).map(([id, text]) => (
                                            <button key={id} onClick={() => setMode(id)} className={`flex-1 rounded-md border px-2 py-1.5 text-sm font-semibold ${mode === id ? 'border-sky-700 bg-sky-700 text-white' : 'border-slate-300 bg-white text-slate-900'}`}>{text}</button>
                                        ))}
                                    </div>
                                    {mode === 'summary' ? (
                                        <div className="space-y-3">
                                            <div><label className="text-xs font-bold text-slate-900">Group by</label>
                                                <select value={groupBy} onChange={(e) => setGroupBy(e.target.value)} className={selectCls}>{entity?.fields.filter((f) => f.groupable).map((f) => <option key={f.path} value={f.path}>{f.label}</option>)}</select></div>
                                            <div className="grid grid-cols-2 gap-2">
                                                <div><label className="text-xs font-bold text-slate-900">Measure</label>
                                                    <select value={measure} onChange={(e) => setMeasure(e.target.value as 'COUNT' | 'SUM' | 'AVG')} className={selectCls}><option value="COUNT">Count of rows</option>{numeric.length > 0 && <option value="SUM">Total</option>}{numeric.length > 0 && <option value="AVG">Average</option>}</select></div>
                                                {measure !== 'COUNT' && <div><label className="text-xs font-bold text-slate-900">Of</label>
                                                    <select value={target} onChange={(e) => setTarget(e.target.value)} className={selectCls}><option value="">Choose…</option>{numeric.map((f) => <option key={f.path} value={f.path}>{f.label}</option>)}</select></div>}
                                            </div>
                                        </div>
                                    ) : (
                                        <div><label className="text-xs font-bold text-slate-900">Columns</label>
                                            <div className="mt-1 max-h-48 overflow-y-auto rounded-md border border-slate-300 p-2 space-y-1">
                                                {entity?.fields.map((f) => (
                                                    <label key={f.path} className="flex items-center gap-2 text-sm text-slate-900"><input type="checkbox" checked={columns.includes(f.path)} onChange={(e) => setColumns((c) => e.target.checked ? [...c, f.path] : c.filter((x) => x !== f.path))} />{f.label}</label>
                                                ))}
                                            </div></div>
                                    )}
                                    <div>
                                        <div className="flex items-center justify-between"><label className="text-xs font-bold text-slate-900">Filters</label>
                                            <button onClick={() => setFilters((f) => [...f, { field: entity?.fields[0]?.path ?? '', operator: 'equals', value: '' }])} className="flex items-center gap-1 text-xs font-semibold text-sky-800 hover:underline"><Plus className="w-3 h-3" />Add</button></div>
                                        <div className="mt-1 space-y-2">
                                            {filters.map((f, i) => (
                                                <div key={i} className="grid grid-cols-[1fr_auto] gap-1 rounded-md border border-slate-300 p-2">
                                                    <select value={f.field} onChange={(e) => setFilters((all) => all.map((x, j) => j === i ? { ...x, field: e.target.value } : x))} className={selectCls}>{entity?.fields.map((fl) => <option key={fl.path} value={fl.path}>{fl.label}</option>)}</select>
                                                    <button onClick={() => setFilters((all) => all.filter((_, j) => j !== i))} className="px-1 text-slate-700 hover:text-rose-700" aria-label="Remove filter"><Trash2 className="w-4 h-4" /></button>
                                                    <div className="col-span-2 grid grid-cols-2 gap-1">
                                                        <select value={f.operator} onChange={(e) => setFilters((all) => all.map((x, j) => j === i ? { ...x, operator: e.target.value } : x))} className={selectCls}>{OPERATORS.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}</select>
                                                        <input value={f.value} onChange={(e) => setFilters((all) => all.map((x, j) => j === i ? { ...x, value: e.target.value } : x))} placeholder={entity?.fields.find((fl) => fl.path === f.field)?.kind === 'date' ? 'YYYY-MM-DD' : 'value'} className={inputCls} />
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                    <Button onClick={run} disabled={running} className="w-full bg-sky-700 text-white hover:bg-sky-800"><Play className="w-4 h-4 mr-2" />{running ? 'Running…' : 'Run report'}</Button>
                                </>)}
                            </div>

                            <div className="rounded-xl border border-slate-300 bg-white p-4 min-w-0">
                                {!result ? <p className="text-sm text-slate-800">Choose what to see and press <b>Run report</b>. Dates are Sri Lanka days; a date without a time means that whole day.</p> : (
                                    <div className="space-y-3">
                                        <div className="rounded-lg bg-slate-900 px-3 py-2 text-xs text-slate-100">
                                            <span className="font-bold text-sky-300">Searched: </span>{result.search}
                                        </div>
                                        <div className="flex items-center justify-between gap-2">
                                            <div className="flex items-center gap-2 text-sm text-slate-900">
                                                <b>{result.totalRows.toLocaleString('en-US')}</b> row{result.totalRows === 1 ? '' : 's'}
                                                {result.verified && <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-900"><ShieldCheck className="w-3 h-3" />Totals reconciled</span>}
                                                {result.rows.length > SCREEN_ROWS && <span className="rounded-full bg-sky-100 px-2 py-0.5 text-xs font-semibold text-sky-900">Screen shows the first {SCREEN_ROWS.toLocaleString('en-US')}; CSV has all {result.rows.length.toLocaleString('en-US')}</span>}
                                                {result.truncated && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900">Limited to {result.rows.length.toLocaleString('en-US')} rows; narrow with a filter</span>}
                                            </div>
                                            <Button onClick={exportCsv} variant="outline" className="border-slate-400 text-slate-900"><Download className="w-4 h-4 mr-2" />CSV</Button>
                                        </div>
                                        <div className="overflow-auto max-h-[60vh] rounded-md border border-slate-300">
                                            <table className="w-full text-sm">
                                                <thead><tr>{result.columns.map((c) => <th key={c} className="sticky top-0 border-b border-slate-300 !bg-slate-100 px-3 py-2 text-left text-xs font-bold !text-slate-900">{label(c)}</th>)}</tr></thead>
                                                <tbody>{result.rows.slice(0, SCREEN_ROWS).map((r, i) => (
                                                    <tr key={i} className="border-b border-slate-200 odd:bg-white even:bg-slate-50">{result.columns.map((c) => <td key={c} className={`px-3 py-1.5 text-slate-900 ${typeof r[c] === 'number' ? 'text-right tabular-nums' : ''}`}>{fmt(r[c])}</td>)}</tr>
                                                ))}</tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}
