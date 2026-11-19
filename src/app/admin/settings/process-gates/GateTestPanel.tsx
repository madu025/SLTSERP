'use client';

import React, { useEffect, useState } from 'react';
import { CheckCircle2, AlertTriangle, SkipForward, FlaskConical, Info } from 'lucide-react';

interface Option { areas: Array<{ id: string; name: string }>; contractors: Array<{ id: string; name: string; opmcId: string | null }> }
interface Step { level: number; role: string; title: string; who: string; outcome: 'ACTIVE' | 'SKIPPED' | 'NOBODY' | 'DEPENDS'; people: string[]; morePeople: number }
interface Result { steps: Step[]; stuckAt: number | null; areaName: string | null; contractorName: string | null }

const OUTCOME = {
    ACTIVE: { Icon: CheckCircle2, box: 'border-emerald-300 bg-emerald-50 text-emerald-950', label: 'Can approve' },
    SKIPPED: { Icon: SkipForward, box: 'border-slate-300 bg-slate-100 text-slate-900', label: 'Skipped: nobody holds it here' },
    DEPENDS: { Icon: Info, box: 'border-slate-300 bg-slate-100 text-slate-900', label: 'Choose a contractor to see who can approve' },
    NOBODY: { Icon: AlertTriangle, box: 'border-red-400 bg-red-50 text-red-950', label: 'Nobody can approve: the item waits here' },
} as const;

/** A dry run of a gate: pick an area (or a contractor) and see which steps an item would go through and who could act. Changes nothing. */
export function GateTestPanel({ gateId, queueMode }: { gateId: string; queueMode: boolean }) {
    const [open, setOpen] = useState(false);
    const [options, setOptions] = useState<Option | null>(null);
    const [opmcId, setOpmcId] = useState('');
    const [contractorId, setContractorId] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [result, setResult] = useState<Result | null>(null);

    useEffect(() => {
        if (!open || options) return;
        fetch(`/api/admin/process-gates/${gateId}/simulate`, { cache: 'no-store' })
            .then((r) => (r.ok ? r.json() : null))
            .then((j) => { if (j) setOptions((j.data ?? j) as Option); })
            .catch(() => setError('Could not load the areas.'));
    }, [open, options, gateId]);

    const contractors = (options?.contractors ?? []).filter((c) => !opmcId || c.opmcId === opmcId);

    async function run() {
        setBusy(true); setError(''); setResult(null);
        try {
            const res = await fetch(`/api/admin/process-gates/${gateId}/simulate`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ opmcId: opmcId || null, contractorId: contractorId || null }) });
            const j = await res.json();
            if (!res.ok) throw new Error(j?.error?.message ?? j?.message ?? 'The test failed');
            setResult((j.data ?? j) as Result);
        } catch (e) { setError(e instanceof Error ? e.message : 'The test failed'); } finally { setBusy(false); }
    }

    return (
        <div className="mt-2">
            <button type="button" onClick={() => setOpen((v) => !v)} className="flex items-center gap-1 text-[11px] font-bold text-indigo-800 underline hover:text-indigo-950">
                <FlaskConical className="h-3 w-3" /> {open ? 'Hide test' : 'Test this gate'}
            </button>
            {open && (
                <div className="mt-2 space-y-2 rounded-xl border border-slate-300 bg-white p-3">
                    <p className="text-xs text-slate-900">Pick where an item would come from and see who could approve each step. Nothing is changed.</p>
                    <div className="flex flex-wrap gap-2">
                        <select aria-label="Area" value={opmcId} onChange={(e) => { setOpmcId(e.target.value); setContractorId(''); }} className="rounded border border-slate-400 bg-white px-2 py-1 text-xs text-slate-900">
                            <option value="">{queueMode ? 'Choose an area…' : 'Any area'}</option>
                            {(options?.areas ?? []).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                        </select>
                        <select aria-label="Contractor" value={contractorId} onChange={(e) => setContractorId(e.target.value)} className="rounded border border-slate-400 bg-white px-2 py-1 text-xs text-slate-900">
                            <option value="">Any contractor</option>
                            {contractors.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                        <button type="button" disabled={busy || (queueMode && !opmcId && !contractorId)} onClick={run} className="rounded bg-indigo-700 px-3 py-1 text-xs font-bold text-white hover:bg-indigo-800 disabled:opacity-50">{busy ? 'Testing…' : 'Run test'}</button>
                    </div>
                    {error && <p className="text-xs font-semibold text-red-900">{error}</p>}
                    {result && (
                        <div className="space-y-1.5">
                            <p className="text-xs font-bold text-slate-900">{[result.contractorName, result.areaName].filter(Boolean).join(' · ') || 'All areas'}</p>
                            {result.steps.map((s, i) => {
                                const o = OUTCOME[s.outcome];
                                return (
                                    <div key={s.level} className={`rounded-lg border p-2 text-xs ${o.box}`}>
                                        <p className="flex items-center gap-1 font-bold"><o.Icon className="h-3.5 w-3.5" />{i + 1}. {s.title}: {o.label}</p>
                                        {s.people.length > 0 && <p className="mt-0.5">{s.people.join(', ')}{s.morePeople > 0 ? ` and ${s.morePeople} more` : ''}</p>}
                                    </div>
                                );
                            })}
                            <p className={`text-xs font-bold ${result.stuckAt ? 'text-red-900' : 'text-emerald-900'}`}>
                                {result.stuckAt ? 'An item here would get stuck: give someone the missing role in this area.' : 'An item here can go all the way through.'}
                            </p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
