'use client';

import React from 'react';
import { ArrowDown, CheckCircle2, AlertTriangle, Info, Users } from 'lucide-react';
import type { ProcessApprovalLevel, ProcessGatePolicy } from '@prisma/client';
import { MODULE_STATUS_REGISTRY } from '@/config/process-gate-statuses';
import { describeStep, gateSentence, stepHealth } from '@/lib/gate-plain-language';

export interface StepStats { level: number; waiting: number; holders: number | null; areasWithout: number | null; missingAreas?: string[] }
type Gate = ProcessGatePolicy & { approvalLevels: ProcessApprovalLevel[] };

/** "CREATED (Invoice Generated)" -> "Invoice Generated"; an unknown status is shown humanised. */
export function statusLabel(entityType: string, value: string): string {
    const label = MODULE_STATUS_REGISTRY[entityType]?.find((s) => s.value === value)?.label;
    const inBrackets = label?.match(/\(([^)]+)\)/)?.[1];
    return inBrackets ?? value.toLowerCase().split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

const TONE = {
    ok: { box: 'border-emerald-300 bg-emerald-50 text-emerald-950', Icon: CheckCircle2 },
    warn: { box: 'border-amber-400 bg-amber-50 text-amber-950', Icon: AlertTriangle },
    info: { box: 'border-slate-300 bg-slate-100 text-slate-900', Icon: Info },
} as const;

/** The approval steps of a gate in plain language: who approves each one, how many are waiting, and whether anybody can act on it. */
export function GateSteps({ gate, stats }: { gate: Gate; stats?: StepStats[] }) {
    const levels = [...(gate.approvalLevels ?? [])].sort((a, b) => a.level - b.level);
    const from = statusLabel(gate.entityType, gate.fromStatus);
    const to = statusLabel(gate.entityType, gate.toStatus);
    if (levels.length === 0) {
        return <p className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs font-semibold text-amber-950">No approval steps: this gate lets every {from.toLowerCase()} item through without anybody approving it.</p>;
    }
    const queueMode = Boolean((gate as { queueMode?: boolean }).queueMode);
    return (
        <div className="space-y-2">
            <p className="text-xs font-semibold text-slate-900">{gateSentence(gate.entityType, from, to)}</p>
            <ol className="space-y-1.5">
                {levels.map((lvl, i) => {
                    const step = lvl as ProcessApprovalLevel & { assignee?: string; skipIfNoApprover?: boolean };
                    const d = describeStep({ requiredRole: lvl.requiredRole, assignee: step.assignee, skipIfNoApprover: step.skipIfNoApprover, specificUserId: lvl.specificUserId }, { queueMode, entityType: gate.entityType });
                    const s = stats?.find((x) => x.level === lvl.level);
                    const health = s ? stepHealth({ holders: s.holders, areasWithout: s.areasWithout, missingAreas: s.missingAreas, skipIfNoApprover: Boolean(step.skipIfNoApprover) }) : null;
                    const tone = health ? TONE[health.level] : null;
                    return (
                        <li key={lvl.id}>
                            <div className="rounded-xl border border-slate-300 bg-white p-3">
                                <div className="flex flex-wrap items-center gap-2">
                                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-700 text-xs font-bold text-white">{i + 1}</span>
                                    <span className="text-sm font-bold text-slate-900">{d.title}</span>
                                    {s && s.waiting > 0 && <span className="rounded-full border border-sky-300 bg-sky-100 px-2 py-0.5 text-[11px] font-bold text-sky-950">{s.waiting} waiting here now</span>}
                                </div>
                                <p className="mt-1 flex items-center gap-1 text-xs text-slate-900"><Users className="h-3.5 w-3.5 text-slate-700" />{d.who}</p>
                                {d.rule && <p className="mt-0.5 text-xs font-semibold text-amber-900">{d.rule}</p>}
                                {tone && health && (
                                    <p className={`mt-1.5 inline-flex items-center gap-1 rounded border px-2 py-0.5 text-[11px] font-semibold ${tone.box}`}><tone.Icon className="h-3.5 w-3.5" />{health.text}</p>
                                )}
                            </div>
                            {i < levels.length - 1 && <div className="flex justify-center py-0.5"><ArrowDown className="h-3.5 w-3.5 text-slate-600" /></div>}
                        </li>
                    );
                })}
            </ol>
            <p className="text-xs text-slate-800">Then the item becomes <span className="font-bold text-slate-900">{to}</span>. Anyone who rejects it sends it back to <span className="font-bold text-slate-900">{from}</span>.</p>
        </div>
    );
}
