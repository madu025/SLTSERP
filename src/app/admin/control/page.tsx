"use client";

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import RoleGuard from '@/components/RoleGuard';
import ExportCsvButton from '@/components/ExportCsvButton';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, ShieldCheck } from 'lucide-react';
import type { AccessRiskReport, ApprovalAgeingReport, AuditActivityReport, FinanceControlsReport, RiskUser, SodBreachReport } from '@/lib/control-shared';
import { AgeingBars, CompletedTrend, Panel, compact } from '@/app/dashboard/components/health/HealthCharts';

type Tab = 'access' | 'breaches' | 'approvals' | 'finance' | 'audit';
const TABS: { id: Tab; label: string }[] = [
    { id: 'access', label: 'Access risk' }, { id: 'breaches', label: 'SoD breaches' }, { id: 'approvals', label: 'Approval ageing' },
    { id: 'finance', label: 'Finance controls' }, { id: 'audit', label: 'Audit activity' },
];
const th = 'py-2 pr-3 text-left text-slate-900';

function Stat({ label, value, tone = '' }: { label: string; value: string | number; tone?: string }) {
    return (
        <Card className="shadow-sm"><CardContent className="p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-700">{label}</p>
            <p className={`mt-1 text-2xl font-bold text-slate-900 ${tone}`}>{value}</p>
        </CardContent></Card>
    );
}
const bad = (n: number) => (n > 0 ? 'text-red-700' : '');

function UserList({ title, rows, empty }: { title: string; rows: RiskUser[]; empty: string }) {
    return (
        <Panel title={`${title} (${rows.length})`}>
            <div className="max-h-72 overflow-y-auto">
                <table className="w-full text-sm">
                    <thead><tr className="border-b border-slate-300"><th className={th}>User</th><th className={th}>Detail</th></tr></thead>
                    <tbody>
                        {rows.length === 0 && <tr><td colSpan={2} className="py-3 text-slate-700">{empty}</td></tr>}
                        {rows.map((r) => <tr key={r.id} className="border-b border-slate-200 text-slate-900"><td className="py-2 pr-3 font-medium">{r.username}{r.name ? <span className="ml-2 text-xs text-slate-600">{r.name}</span> : null}</td><td className="py-2 text-slate-800">{r.detail}</td></tr>)}
                    </tbody>
                </table>
            </div>
        </Panel>
    );
}

function Access({ d }: { d: AccessRiskReport }) {
    return (
        <>
            <div className="grid grid-cols-2 gap-4 xl:grid-cols-6">
                <Stat label="Active staff" value={d.activeUsers} />
                <Stat label="Privileged" value={d.privileged.length} />
                <Stat label="Manual overrides" value={d.overrides.length} />
                <Stat label="Conflicting rights" value={d.sodConflicts.length} tone={bad(d.sodConflicts.length)} />
                <Stat label="Never signed in" value={d.neverLoggedIn.length} />
                <Stat label="Failed sign-ins (7 d)" value={d.failedLogins7d.total} tone={bad(d.failedLogins7d.total >= 20 ? 1 : 0)} />
            </div>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <UserList title="Privileged accounts" rows={d.privileged} empty="None" />
                <UserList title="Approval or admin rights by manual override" rows={d.overridePrivileged} empty="None" />
                <UserList title="Conflicting permissions (non-admin)" rows={d.sodConflicts} empty="None" />
                <UserList title="Active users with no permissions" rows={d.noPermissions} empty="None" />
                <UserList title="Dormant (60+ days)" rows={d.dormant} empty="None" />
                <UserList title="Never signed in" rows={d.neverLoggedIn} empty="None" />
                <UserList title="No OPMC scope" rows={d.noScope} empty="None" />
                <UserList title="Old passwords" rows={d.oldPasswords} empty="None" />
            </div>
            {d.failedLogins7d.byUser.length > 0 && <Panel title="Most failed sign-ins (7 days)"><AgeingBars data={d.failedLogins7d.byUser.map((f) => ({ name: f.username.slice(0, 10), value: f.count }))} empty="None" color="#ef4444" /></Panel>}
            <ul className="list-disc space-y-1 pl-5 text-xs text-slate-700">{d.notes.map((n) => <li key={n}>{n}</li>)}</ul>
        </>
    );
}

function Breaches({ d }: { d: SodBreachReport }) {
    return (
        <>
            <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
                <Stat label={`Breaches (${d.days} d)`} value={d.total} tone={bad(d.total)} />
                <Stat label="Types" value={d.byKind.length} />
                <Stat label="By administrators" value={d.rows.filter((r) => r.adminExempt).length} />
                <Stat label="Actors" value={d.byActor.length} />
            </div>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <Panel title="By type"><AgeingBars data={d.byKind.map((k) => ({ name: k.label.slice(0, 14), value: k.count }))} empty="No breaches in this window" color="#ef4444" /></Panel>
                <Panel title="By person">
                    <table className="w-full text-sm"><thead><tr className="border-b border-slate-300"><th className={th}>User</th><th className={`${th} text-right`}>Breaches</th><th className={`${th} text-right`}>Admin</th></tr></thead>
                        <tbody>{d.byActor.length === 0 && <tr><td colSpan={3} className="py-3 text-slate-700">None</td></tr>}
                            {d.byActor.map((a) => <tr key={a.actor} className="border-b border-slate-200 text-slate-900"><td className="py-2 pr-3 font-medium">{a.actor}</td><td className="py-2 pr-3 text-right">{a.count}</td><td className="py-2 text-right">{a.adminExempt ? 'yes' : 'no'}</td></tr>)}</tbody></table>
                </Panel>
            </div>
            <Panel title={`Records (${d.rows.length})`}>
                <div className="max-h-96 overflow-auto">
                    <table className="w-full text-sm"><thead><tr className="border-b border-slate-300"><th className={th}>What</th><th className={th}>Reference</th><th className={th}>Person</th><th className={`${th} text-right`}>Amount</th><th className={`${th} text-right`}>Date</th></tr></thead>
                        <tbody>{d.rows.length === 0 && <tr><td colSpan={5} className="py-3 text-slate-700">No breaches found.</td></tr>}
                            {d.rows.map((r, i) => <tr key={i} className="border-b border-slate-200 text-slate-900"><td className="py-2 pr-3">{d.byKind.find((k) => k.kind === r.kind)?.label ?? r.kind}</td><td className="py-2 pr-3 font-medium">{r.reference}</td><td className="py-2 pr-3">{r.actor}{r.adminExempt ? ' (admin)' : ''}</td><td className="py-2 pr-3 text-right">{r.amount === null ? '—' : compact(r.amount)}</td><td className="py-2 text-right">{r.at.slice(0, 10)}</td></tr>)}</tbody></table>
                </div>
            </Panel>
        </>
    );
}

function Approvals({ d }: { d: ApprovalAgeingReport }) {
    return (
        <>
            <div className="grid grid-cols-2 gap-4 xl:grid-cols-3"><Stat label="Pending approvals" value={d.totalPending} /><Stat label="Types waiting" value={d.rows.filter((r) => r.pending > 0).length} /><Stat label="Oldest (days)" value={d.rows[0]?.oldestDays ?? '—'} /></div>
            <Panel title="Oldest waiting item by type (days)"><AgeingBars data={d.rows.filter((r) => r.pending > 0).map((r) => ({ name: r.type.slice(0, 12), value: r.oldestDays ?? 0 }))} empty="Nothing is waiting for approval" /></Panel>
            <Panel title="Pending by type">
                <table className="w-full text-sm"><thead><tr className="border-b border-slate-300"><th className={th}>Type</th><th className={`${th} text-right`}>Pending</th><th className={`${th} text-right`}>Oldest (days)</th></tr></thead>
                    <tbody>{d.rows.map((r) => <tr key={r.type} className="border-b border-slate-200 text-slate-900"><td className="py-2 pr-3 font-medium"><a href={r.href} className="hover:underline">{r.type}</a></td><td className="py-2 pr-3 text-right">{r.pending}</td><td className="py-2 text-right"><span className={`rounded px-2 py-0.5 font-semibold ${(r.oldestDays ?? 0) >= 14 ? 'bg-red-100 text-red-900' : (r.oldestDays ?? 0) >= 7 ? 'bg-amber-100 text-amber-900' : ''}`}>{r.oldestDays ?? '—'}</span></td></tr>)}</tbody></table>
            </Panel>
        </>
    );
}

function Finance({ d }: { d: FinanceControlsReport }) {
    return (
        <>
            <div className="grid grid-cols-2 gap-4 xl:grid-cols-5">
                <Stat label={`Back-dated (${d.days} d)`} value={d.backdated.count} />
                <Stat label="Reversals" value={d.reversals.total} />
                <Stat label="Pending journals" value={d.pendingJournals.count} />
                <Stat label="Past months open" value={d.openPastPeriods} tone={bad(d.openPastPeriods)} />
                <Stat label="Journal chain" value={d.hashChain.breaks === 0 ? `OK (${d.hashChain.checked})` : `${d.hashChain.breaks} differ`} tone={bad(d.hashChain.breaks)} />
            </div>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <Panel title={`Unreconciled bank lines · ${d.bankBacklog.total}`}><AgeingBars data={d.bankBacklog.buckets.map((b) => ({ name: b.bucket, value: b.count }))} empty="Everything is reconciled" /></Panel>
                <Panel title="Fiscal periods">
                    <table className="w-full text-sm"><thead><tr className="border-b border-slate-300"><th className={th}>Period</th><th className={th}>Status</th><th className={`${th} text-right`}>Closed</th></tr></thead>
                        <tbody>{d.periods.map((p) => <tr key={`${p.year}-${p.month}`} className="border-b border-slate-200 text-slate-900"><td className="py-2 pr-3 font-medium">{p.year}-{String(p.month).padStart(2, '0')}</td><td className="py-2 pr-3"><span className={`rounded px-2 py-0.5 font-semibold ${p.status === 'OPEN' ? 'bg-amber-100 text-amber-900' : 'bg-emerald-100 text-emerald-900'}`}>{p.status}</span></td><td className="py-2 text-right">{p.closedAt?.slice(0, 10) ?? '—'}</td></tr>)}</tbody></table>
                </Panel>
            </div>
            {d.backdated.sample.length > 0 && <Panel title="Back-dated postings (sample)"><ul className="space-y-1 text-sm text-slate-900">{d.backdated.sample.map((s) => <li key={s.reference} className="flex justify-between border-b border-slate-200 py-1"><span className="font-medium">{s.reference}</span><span>dated {s.date}, entered {s.enteredAt}</span></li>)}</ul></Panel>}
            <ul className="list-disc space-y-1 pl-5 text-xs text-slate-700">
                <li>The journal chain check recomputes the digest of the latest {d.hashChain.checked} entries; {d.hashChain.firstBreak ? `the first difference is at ${d.hashChain.firstBreak}` : 'no differences were found'}. A difference is for review, not proof of tampering.</li>
                <li>Entries without an OPMC or project: {d.withoutDimension} in the last {d.days} days.</li>
            </ul>
        </>
    );
}

function Audit({ d }: { d: AuditActivityReport }) {
    return (
        <>
            <div className="grid grid-cols-2 gap-4 xl:grid-cols-4"><Stat label={`Audit rows (${d.days} d)`} value={d.total.toLocaleString()} /><Stat label="Access denied (top)" value={d.denied.reduce((a, x) => a + x.count, 0)} /><Stat label="Off-hours actions" value={d.offHours} /><Stat label="Sensitive actions" value={d.sensitive.reduce((a, x) => a + x.count, 0)} /></div>
            <Panel title="Activity per day"><CompletedTrend name="Audit rows" empty="No audit activity" data={d.perDay.map((p) => ({ label: p.day, completed: p.count }))} /></Panel>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <Panel title="Sensitive actions">
                    <table className="w-full text-sm"><thead><tr className="border-b border-slate-300"><th className={th}>Action</th><th className={`${th} text-right`}>Count</th><th className={`${th} text-right`}>Last</th></tr></thead>
                        <tbody>{d.sensitive.length === 0 && <tr><td colSpan={3} className="py-3 text-slate-700">None in this window.</td></tr>}{d.sensitive.map((s) => <tr key={s.action} className="border-b border-slate-200 text-slate-900"><td className="py-2 pr-3 font-medium">{s.action}</td><td className="py-2 pr-3 text-right">{s.count}</td><td className="py-2 text-right">{s.last.slice(0, 10)}</td></tr>)}</tbody></table>
                </Panel>
                <Panel title="Repeated access denials">
                    <table className="w-full text-sm"><thead><tr className="border-b border-slate-300"><th className={th}>Path</th><th className={th}>User</th><th className={`${th} text-right`}>Count</th></tr></thead>
                        <tbody>{d.denied.length === 0 && <tr><td colSpan={3} className="py-3 text-slate-700">None.</td></tr>}{d.denied.map((s, i) => <tr key={i} className="border-b border-slate-200 text-slate-900"><td className="py-2 pr-3 font-medium">{s.path}</td><td className="py-2 pr-3">{s.user}</td><td className="py-2 text-right">{s.count}</td></tr>)}</tbody></table>
                </Panel>
            </div>
            <Panel title="Recent permission and role changes">
                <table className="w-full text-sm"><thead><tr className="border-b border-slate-300"><th className={th}>When</th><th className={th}>By</th><th className={th}>Action</th><th className={th}>Target</th></tr></thead>
                    <tbody>{d.permissionChanges.length === 0 && <tr><td colSpan={4} className="py-3 text-slate-700">None in this window.</td></tr>}{d.permissionChanges.map((c, i) => <tr key={i} className="border-b border-slate-200 text-slate-900"><td className="py-2 pr-3">{c.at.slice(0, 16).replace('T', ' ')}</td><td className="py-2 pr-3 font-medium">{c.actor}</td><td className="py-2 pr-3">{c.action}</td><td className="py-2">{c.target}</td></tr>)}</tbody></table>
            </Panel>
        </>
    );
}

export default function ControlMonitorPage() {
    const [tab, setTab] = useState<Tab>('access');
    const [days, setDays] = useState('30');
    const { data, isLoading, error } = useQuery<unknown>({
        queryKey: ['control-monitor', tab, days],
        queryFn: async ({ signal }) => {
            const res = await fetch(`/api/admin/control?view=${tab}&days=${days}`, { cache: 'no-store', signal });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error?.message || 'Failed to load');
            return json.data;
        },
        staleTime: 60_000,
        refetchOnWindowFocus: false,
    });

    const exportRows = () => {
        if (!data) return [];
        if (tab === 'breaches') return [['Type', 'Reference', 'Person', 'Admin', 'Amount', 'Date'], ...(data as SodBreachReport).rows.map((r) => [r.kind, r.reference, r.actor, r.adminExempt ? 'yes' : 'no', r.amount, r.at.slice(0, 10)])];
        if (tab === 'access') { const a = data as AccessRiskReport; return [['List', 'User', 'Detail'], ...[['privileged', a.privileged], ['override-privileged', a.overridePrivileged], ['sod-conflicts', a.sodConflicts], ['dormant', a.dormant], ['never-signed-in', a.neverLoggedIn], ['no-permissions', a.noPermissions], ['no-scope', a.noScope], ['old-password', a.oldPasswords]].flatMap(([k, rows]) => (rows as RiskUser[]).map((r) => [k as string, r.username, r.detail]))]; }
        if (tab === 'approvals') return [['Type', 'Pending', 'Oldest days'], ...(data as ApprovalAgeingReport).rows.map((r) => [r.type, r.pending, r.oldestDays])];
        return [];
    };

    return (
        <RoleGuard>
            <div className="flex h-screen bg-slate-50 overflow-hidden">
                <Sidebar />
                <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                    <Header />
                    <main className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2"><ShieldCheck className="w-7 h-7 text-indigo-600" />Control monitor</h1>
                            <div className="flex items-end gap-3">
                                {(tab === 'breaches' || tab === 'finance' || tab === 'audit') && (
                                    <label className="text-xs font-semibold text-slate-900">Window
                                        <select value={days} onChange={(e) => setDays(e.target.value)} className="mt-1 block rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900">
                                            <option value="7">7 days</option><option value="30">30 days</option><option value="90">90 days</option>
                                        </select>
                                    </label>
                                )}
                                <ExportCsvButton filename={`control-${tab}.csv`} disabled={!data || exportRows().length === 0} getRows={exportRows} />
                            </div>
                        </div>
                        <div className="flex flex-wrap gap-1 rounded-xl border border-slate-200 bg-white p-1">
                            {TABS.map((t) => <button key={t.id} onClick={() => setTab(t.id)} className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${tab === t.id ? 'bg-indigo-700 text-white' : 'text-slate-900 hover:bg-slate-100'}`}>{t.label}</button>)}
                        </div>
                        {isLoading && <div className="flex h-40 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /></div>}
                        {error && <p className="text-sm text-red-700">{(error as Error).message}</p>}
                        {!!data && tab === 'access' && <Access d={data as AccessRiskReport} />}
                        {!!data && tab === 'breaches' && <Breaches d={data as SodBreachReport} />}
                        {!!data && tab === 'approvals' && <Approvals d={data as ApprovalAgeingReport} />}
                        {!!data && tab === 'finance' && <Finance d={data as FinanceControlsReport} />}
                        {!!data && tab === 'audit' && <Audit d={data as AuditActivityReport} />}
                    </main>
                </div>
            </div>
        </RoleGuard>
    );
}
