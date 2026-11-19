'use client';

import React, { useEffect, useState } from 'react';
import { History } from 'lucide-react';

interface Entry { id: string; at: string; by: string; summary: string }

/** Who changed the gate and when, in words. Loaded only when opened. */
export function GateHistoryPanel({ gateId }: { gateId: string }) {
    const [open, setOpen] = useState(false);
    const [rows, setRows] = useState<Entry[] | null>(null);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!open || rows) return;
        fetch(`/api/admin/process-gates/${gateId}/history`, { cache: 'no-store' })
            .then((r) => (r.ok ? r.json() : Promise.reject(new Error('failed'))))
            .then((j) => setRows(((j.data ?? j) as Entry[]) ?? []))
            .catch(() => setError('Could not load the history.'));
    }, [open, rows, gateId]);

    return (
        <div className="mt-2">
            <button type="button" onClick={() => setOpen((v) => !v)} className="flex items-center gap-1 text-[11px] font-bold text-indigo-800 underline hover:text-indigo-950">
                <History className="h-3 w-3" /> {open ? 'Hide history' : 'Change history'}
            </button>
            {open && (
                <div className="mt-2 rounded-xl border border-slate-300 bg-white p-3">
                    {error && <p className="text-xs font-semibold text-red-900">{error}</p>}
                    {!error && !rows && <p className="text-xs text-slate-900">Loading…</p>}
                    {rows && rows.length === 0 && <p className="text-xs text-slate-900">No changes recorded yet. Changes made from now on appear here.</p>}
                    {rows && rows.length > 0 && (
                        <ul className="space-y-1.5">
                            {rows.map((r) => (
                                <li key={r.id} className="border-b border-slate-200 pb-1.5 text-xs text-slate-900 last:border-0">
                                    <span className="font-bold">{new Date(r.at).toLocaleString()}</span> · {r.by}
                                    <p className="mt-0.5">{r.summary}</p>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            )}
        </div>
    );
}
