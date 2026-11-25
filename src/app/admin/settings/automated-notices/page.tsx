"use client";

import { useCallback, useEffect, useState } from 'react';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import RoleGuard from '@/components/RoleGuard';
import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';
import { toast } from 'sonner';

interface AudienceRole { id: string; code: string; name: string; holds: boolean; users: number }
interface Audience {
    id: string; label: string; description: string; areaScope: string; permission: string;
    recipients: number; withEmail: number; byRole: Array<{ role: string; count: number }>; roles: AudienceRole[];
}
interface Notice { job: string; title: string; description: string; schedule: string; channels: string[]; audiences: string[] | null; to: string }
interface Person { id: string; name: string; role: string; email: string | null }

const BIG = 30; // an audience of more people than this gets a warning: is it meant for everybody?
const SCOPE_TEXT: Record<string, string> = { area: 'Each notice goes to the people of the area it is about', company: 'Every notice goes to everyone in the audience (company-wide)', mixed: 'Some notices name the area, some go to everyone' };
const unwrap = (j: { data?: unknown } & Record<string, unknown>) => (j && typeof j === 'object' && 'data' in j && j.data ? j.data : j) as never;

export default function AutomatedNoticesPage() {
    const [notices, setNotices] = useState<Notice[]>([]);
    const [audiences, setAudiences] = useState<Audience[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [busy, setBusy] = useState('');
    const [people, setPeople] = useState<Record<string, Person[] | 'loading'>>({});

    const load = useCallback(async () => {
        try {
            const res = await fetch('/api/admin/automated-notices', { cache: 'no-store' });
            if (!res.ok) throw new Error(`The list was not loaded (${res.status})`);
            const data = unwrap(await res.json()) as { notices: Notice[]; audiences: Audience[] };
            setNotices(data.notices ?? []); setAudiences(data.audiences ?? []); setError('');
        } catch (e) { setError(e instanceof Error ? e.message : 'The list was not loaded'); } finally { setLoading(false); }
    }, []);
    useEffect(() => { load(); }, [load]);

    const showPeople = async (id: string) => {
        if (people[id] && people[id] !== 'loading') { setPeople((p) => { const n = { ...p }; delete n[id]; return n; }); return; }
        setPeople((p) => ({ ...p, [id]: 'loading' }));
        try {
            const res = await fetch(`/api/admin/automated-notices/${id}/people`, { cache: 'no-store' });
            if (!res.ok) throw new Error('The people were not loaded');
            const list = unwrap(await res.json()) as Person[];
            setPeople((p) => ({ ...p, [id]: list }));
        } catch (e) { toast.error(e instanceof Error ? e.message : 'The people were not loaded'); setPeople((p) => { const n = { ...p }; delete n[id]; return n; }); }
    };

    const toggle = async (a: Audience, r: AudienceRole) => {
        const grant = !r.holds;
        const verb = grant ? 'Add' : 'Remove';
        if (!window.confirm(`${verb} the role "${r.name}" (${r.users} user${r.users === 1 ? '' : 's'}) ${grant ? 'to' : 'from'} "${a.label}"?`)) return;
        setBusy(`${a.id}:${r.id}`);
        try {
            const res = await fetch('/api/admin/automated-notices', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ audience: a.id, roleId: r.id, grant }) });
            if (!res.ok) { const j = await res.json().catch(() => ({})); throw new Error(String((j as { error?: { message?: string }; message?: string }).error?.message ?? (j as { message?: string }).message ?? 'The change was not saved')); }
            toast.success(grant ? 'Role added' : 'Role removed');
            setPeople((p) => { const n = { ...p }; delete n[a.id]; return n; });
            await load();
        } catch (e) { toast.error(e instanceof Error ? e.message : 'The change was not saved'); } finally { setBusy(''); }
    };

    const count = (id: string) => audiences.find((a) => a.id === id);

    return (
        <RoleGuard permissionId={RBAC_PERMISSIONS.ADMIN_RBAC}>
            <div className="min-h-screen flex bg-background text-foreground">
                <Sidebar />
                <main className="flex-1 flex flex-col min-w-0 h-full">
                    <Header />
                    <div className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
                        <div className="max-w-6xl mx-auto w-full space-y-8">
                            <div>
                                <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Automated reports and alerts</h1>
                                <p className="mt-1 text-sm text-slate-700 dark:text-slate-300">What the system sends by itself, when, and to whom. Who is in an audience is set here by role; the change is saved at once and written to the audit log.</p>
                            </div>

                            {loading && <p className="text-sm font-medium text-slate-800 dark:text-slate-200">Loading...</p>}
                            {error && <div role="alert" className="rounded-lg border border-red-300 bg-red-50 p-4 text-sm font-semibold text-red-900">{error} <button onClick={() => { setLoading(true); load(); }} className="ml-2 underline">Try again</button></div>}

                            {!loading && !error && (
                                <>
                                    <section aria-label="Scheduled reports">
                                        <h2 className="mb-3 text-lg font-bold text-slate-900 dark:text-slate-100">Scheduled reports and alerts</h2>
                                        <div className="overflow-x-auto rounded-xl border border-slate-300 bg-white shadow-sm">
                                            <table className="min-w-full text-left text-sm">
                                                <thead><tr className="bg-slate-100 text-slate-900">{['What', 'When', 'How', 'To whom', 'Reaches now'].map((h) => <th key={h} className="px-4 py-3 font-bold">{h}</th>)}</tr></thead>
                                                <tbody className="divide-y divide-slate-200 text-slate-900">
                                                    {notices.map((n) => (
                                                        <tr key={n.job} className="align-top">
                                                            <td className="px-4 py-3"><p className="font-semibold">{n.title}</p><p className="mt-1 max-w-md text-xs text-slate-700">{n.description}</p></td>
                                                            <td className="whitespace-nowrap px-4 py-3">{n.schedule}</td>
                                                            <td className="px-4 py-3">{n.channels.map((c) => <span key={c} className="mr-1 inline-block rounded-full bg-slate-200 px-2 py-0.5 text-xs font-semibold text-slate-900">{c === 'email' ? 'Email' : 'In-app'}</span>)}</td>
                                                            <td className="px-4 py-3 max-w-xs">{n.to}</td>
                                                            <td className="px-4 py-3">
                                                                {n.audiences === null ? <span className="text-xs text-slate-700">The people named by the data itself</span> : n.audiences.map((id) => {
                                                                    const a = count(id);
                                                                    return a ? <p key={id} className={a.recipients > BIG ? 'font-bold text-red-800' : 'font-semibold'}>{a.label}: {a.recipients} {a.recipients === 1 ? 'person' : 'people'}</p> : null;
                                                                })}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </section>

                                    <section aria-label="Audiences">
                                        <h2 className="mb-1 text-lg font-bold text-slate-900 dark:text-slate-100">Audiences: who receives what</h2>
                                        <p className="mb-3 text-sm text-slate-700 dark:text-slate-300">Every notice the system sends goes to one audience. Switch a role on or off to change who is in it. A person who holds an override of their own is counted as they are.</p>
                                        <div className="grid gap-4 lg:grid-cols-2">
                                            {audiences.map((a) => {
                                                const list = people[a.id];
                                                return (
                                                    <div key={a.id} className={`rounded-xl border bg-white p-4 shadow-sm ${a.recipients > BIG ? 'border-red-400' : 'border-slate-300'}`}>
                                                        <div className="flex items-start justify-between gap-3">
                                                            <div><h3 className="font-bold text-slate-900">{a.label}</h3><p className="mt-1 text-xs text-slate-700">{a.description}</p></div>
                                                            <div className="shrink-0 text-right"><p className="text-2xl font-bold text-slate-900">{a.recipients}</p><p className="text-xs text-slate-700">{a.withEmail} with email</p></div>
                                                        </div>
                                                        <p className="mt-2 text-xs font-medium text-slate-800">{SCOPE_TEXT[a.areaScope] ?? ''}</p>
                                                        {a.recipients > BIG && <p role="alert" className="mt-2 rounded bg-red-50 px-2 py-1 text-xs font-bold text-red-900">Reaches {a.recipients} people. Check that this is meant for all of them.</p>}
                                                        {a.byRole.length > 0 && <p className="mt-2 text-xs text-slate-800">{a.byRole.slice(0, 6).map((r) => `${r.role.replace(/_/g, ' ').toLowerCase()}: ${r.count}`).join(' · ')}</p>}
                                                        <div className="mt-3 flex flex-wrap gap-2">
                                                            {a.roles.map((r) => (
                                                                <label key={r.id} className={`flex cursor-pointer items-center gap-1.5 rounded-lg border px-2 py-1 text-xs font-semibold ${r.holds ? 'border-indigo-700 bg-indigo-50 text-indigo-950' : 'border-slate-400 bg-white text-slate-900'}`}>
                                                                    <input type="checkbox" checked={r.holds} disabled={busy === `${a.id}:${r.id}`} onChange={() => toggle(a, r)} />
                                                                    {r.name} <span className="font-normal text-slate-700">({r.users})</span>
                                                                </label>
                                                            ))}
                                                            {a.roles.length === 0 && <span className="text-xs text-slate-700">No roles yet. Run the RBAC seed first.</span>}
                                                        </div>
                                                        <button onClick={() => showPeople(a.id)} className="mt-3 text-xs font-semibold text-indigo-800 underline">{list && list !== 'loading' ? 'Hide the people' : 'Show the people'}</button>
                                                        {list === 'loading' && <p className="mt-2 text-xs text-slate-800">Loading...</p>}
                                                        {Array.isArray(list) && (
                                                            <div className="mt-2 max-h-48 overflow-y-auto rounded border border-slate-200 bg-slate-50 p-2">
                                                                {list.length === 0 ? <p className="text-xs text-slate-800">Nobody receives this now.</p> : list.map((p) => <p key={p.id} className="text-xs text-slate-900"><span className="font-semibold">{p.name}</span> · {p.role.replace(/_/g, ' ').toLowerCase()}{p.email ? '' : ' · no email'}</p>)}
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </section>
                                </>
                            )}
                        </div>
                    </div>
                </main>
            </div>
        </RoleGuard>
    );
}
