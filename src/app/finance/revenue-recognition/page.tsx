"use client";

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import RoleGuard from '@/components/RoleGuard';
import ExportCsvButton from '@/components/ExportCsvButton';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, TrendingUp, AlertTriangle } from 'lucide-react';
import type { RevenueRecognitionReport } from '@/services/finance/revenue-recognition.service';

const fmt = (v: number) => v.toLocaleString('en-US', { maximumFractionDigits: 0 });

export default function RevenueRecognitionPage() {
    const queryClient = useQueryClient();
    const [projectId, setProjectId] = useState('');
    const [value, setValue] = useState('');
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<string | null>(null);

    const { data, isLoading, error } = useQuery<RevenueRecognitionReport>({
        queryKey: ['finance-revenue-recognition'],
        queryFn: async ({ signal }) => {
            const res = await fetch('/api/finance/revenue-recognition', { cache: 'no-store', signal });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error?.message || 'Failed to load revenue recognition');
            return json.data;
        },
        refetchOnWindowFocus: false,
    });

    const save = async () => {
        setSaving(true); setMessage(null);
        try {
            const res = await fetch('/api/finance/revenue-recognition', {
                method: 'PUT', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ projectId, contractValue: value === '' ? null : Number(value) }),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error?.message || 'Could not save the contract value');
            setMessage('Contract value saved.');
            setValue('');
            await queryClient.invalidateQueries({ queryKey: ['finance-revenue-recognition'] });
        } catch (e) {
            setMessage((e as Error).message);
        } finally {
            setSaving(false);
        }
    };

    const missing = data?.withoutContractValue.projects ?? [];

    return (
        <RoleGuard>
            <div className="flex h-screen bg-slate-50 overflow-hidden">
                <Sidebar />
                <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                    <Header />
                    <main className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                                <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
                                    <TrendingUp className="w-7 h-7 text-indigo-600" />Revenue recognition (percentage of completion)
                                </h1>
                                <p className="text-sm text-slate-700 mt-1">Revenue earned to date per contract against what has been billed, with the resulting unbilled (asset) and deferred (liability) position.</p>
                            </div>
                            <ExportCsvButton filename="revenue-recognition.csv" disabled={!data}
                                getRows={() => [['Project code', 'Project', 'Status', 'Contract value', 'Progress %', 'Recognised revenue', 'Billed to date', 'Unbilled (asset)', 'Deferred (liability)', 'Actual cost', 'Estimate at completion', 'Expected profit'],
                                    ...(data?.rows ?? []).map((r) => [r.projectCode, r.name, r.status, r.contractValue, r.progressPct, r.recognisedRevenue, r.billedToDate, r.contractAsset, r.contractLiability, r.actualCost, r.estimateAtCompletion, r.expectedProfit])]} />
                        </div>

                        <div className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-3">
                            <label className="text-xs font-semibold text-slate-900">Set contract value for project
                                <select value={projectId} onChange={(e) => setProjectId(e.target.value)}
                                    className="mt-1 block max-w-[20rem] rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900">
                                    <option value="">Select a project…</option>
                                    {[...(data?.rows.map((r) => ({ projectId: r.projectId, projectCode: r.projectCode, name: r.name })) ?? []), ...missing].map((p) => (
                                        <option key={p.projectId} value={p.projectId}>{p.projectCode} · {p.name}</option>
                                    ))}
                                </select>
                            </label>
                            <label className="text-xs font-semibold text-slate-900">Contract value (LKR, empty = clear)
                                <input type="number" min={0} value={value} onChange={(e) => setValue(e.target.value)}
                                    className="mt-1 block w-44 rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900" />
                            </label>
                            <button onClick={save} disabled={saving || !projectId}
                                className="rounded-md bg-indigo-700 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-800 disabled:opacity-50">
                                {saving ? 'Saving…' : 'Save'}
                            </button>
                        </div>
                        {message && <p className="text-sm text-slate-900">{message}</p>}
                        {isLoading && <div className="flex h-40 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /></div>}
                        {error && <p className="text-sm text-red-700">{(error as Error).message}</p>}

                        {data && (
                            <>
                                <div className="grid grid-cols-2 gap-4 xl:grid-cols-5">
                                    {[['Contract value', data.totals.contractValue], ['Recognised revenue', data.totals.recognisedRevenue], ['Billed to date', data.totals.billedToDate],
                                        ['Unbilled (asset)', data.totals.contractAsset], ['Deferred (liability)', data.totals.contractLiability]].map(([label, v]) => (
                                        <Card key={label as string} className="shadow-sm"><CardContent className="p-4">
                                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-700">{label as string}</p>
                                            <p className="mt-1 text-xl font-bold text-slate-900">{fmt(v as number)}</p>
                                        </CardContent></Card>
                                    ))}
                                </div>

                                {data.totals.expectedLossProjects > 0 && (
                                    <div className="flex items-start gap-2 rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-slate-900">
                                        <AlertTriangle className="mt-0.5 h-4 w-4 text-red-700" />
                                        {data.totals.expectedLossProjects} contract(s) are heading for a loss at their current cost efficiency (estimate at completion above contract value).
                                    </div>
                                )}

                                <Card className="shadow-sm"><CardContent className="p-5 overflow-x-auto">
                                    {data.rows.length === 0 ? (
                                        <p className="text-sm text-slate-900">No project has a contract value yet. Choose a project above and enter its client contract price to start tracking.</p>
                                    ) : (
                                        <table className="w-full text-sm">
                                            <thead><tr className="border-b border-slate-300 text-left text-slate-900">
                                                <th className="py-2 pr-3">Project</th><th className="py-2 pr-3 text-right">Contract</th><th className="py-2 pr-3 text-right">Progress</th>
                                                <th className="py-2 pr-3 text-right">Recognised</th><th className="py-2 pr-3 text-right">Billed</th>
                                                <th className="py-2 pr-3 text-right">Unbilled</th><th className="py-2 pr-3 text-right">Deferred</th><th className="py-2 text-right">Exp. profit</th>
                                            </tr></thead>
                                            <tbody>
                                                {data.rows.map((r) => (
                                                    <tr key={r.projectId} className="border-b border-slate-200 text-slate-900">
                                                        <td className="py-2 pr-3"><a className="font-semibold underline text-blue-800" href={`/projects/${r.projectId}`}>{r.name}</a><span className="block text-xs text-slate-700">{r.projectCode}</span></td>
                                                        <td className="py-2 pr-3 text-right">{fmt(r.contractValue)}</td>
                                                        <td className="py-2 pr-3 text-right">{r.progressPct.toFixed(1)}%</td>
                                                        <td className="py-2 pr-3 text-right">{fmt(r.recognisedRevenue)}</td>
                                                        <td className="py-2 pr-3 text-right">{fmt(r.billedToDate)}</td>
                                                        <td className="py-2 pr-3 text-right">{r.contractAsset ? fmt(r.contractAsset) : '—'}</td>
                                                        <td className="py-2 pr-3 text-right">{r.contractLiability ? fmt(r.contractLiability) : '—'}</td>
                                                        <td className={`py-2 text-right font-semibold ${r.expectedLoss ? 'text-red-700' : ''}`}>{r.expectedProfit === null ? '—' : fmt(r.expectedProfit)}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    )}
                                </CardContent></Card>
                                {data.withoutContractValue.count > 0 && (
                                    <p className="text-xs text-slate-700">{data.withoutContractValue.count} project(s) have no contract value and are not included.</p>
                                )}
                                <p className="text-xs text-slate-700">{data.note}</p>
                            </>
                        )}
                    </main>
                </div>
            </div>
        </RoleGuard>
    );
}
