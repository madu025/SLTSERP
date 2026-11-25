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
interface Rule { module: string; minLevel: string; area: 'company' | 'area' }
interface RuleInfo { rule: Rule; isDefault: boolean; holders: number; withEmail: number; companyWide: number; withArea: number; noArea: number }
interface Notice { job: string; title: string; description: string; schedule: string; channels: string[]; audiences: string[] | null; rule?: Rule; to: string }
interface Option { module: string; label: string; levels: Array<{ value: string; label: string }> }
interface Person { id: string; name: string; role: string; email: string | null; noArea?: boolean }

const BIG = 30; // an audience of more people than this gets a warning: is it meant for everybody?
const SCOPE_TEXT: Record<string, string> = { area: 'Each notice goes to the people of the area it is about', company: 'Every notice goes to everyone in the audience (company-wide)', mixed: 'Some notices name the area, some go to everyone' };
const AREA_TEXT: Record<string, string> = { company: 'Everybody who meets the level (company-wide report)', area: 'The people of the area the report is about, and those who see every area' };
const unwrap = (j: { data?: unknown } & Record<string, unknown>) => (j && typeof j === 'object' && 'data' in j && j.data ? j.data : j) as never;
const errorText = async (res: Response, fallback: string) => { const j = (await res.json().catch(() => ({}))) as { error?: { message?: string }; message?: string }; return String(j.error?.message ?? j.message ?? fallback); };

export default function AutomatedNoticesPage() {
    const [notices, setNotices] = useState<Notice[]>([]);
    const [audiences, setAudiences] = useState<Audience[]>([]);
    const [rules, setRules] = useState<Record<string, RuleInfo>>({});
    const [options, setOptions] = useState<Option[]>([]);
    const [draft, setDraft] = useState<Record<string, Rule>>({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [busy, setBusy] = useState('');
    const [people, setPeople] = useState<Record<string, Person[] | 'loading'>>({});

    const load = useCallback(async () => {
        try {
            const res = await fetch('/api/admin/automated-notices', { cache: 'no-store' });
            if (!res.ok) throw new Error(`The list was not loaded (${res.status})`);
            const data = unwrap(await res.json()) as { notices: Notice[]; audiences: Audience[]; rules: Record<string, RuleInfo>; options: Option[] };
            setNotices(data.notices ?? []); setAudiences(data.audiences ?? []); setRules(data.rules ?? {}); setOptions(data.options ?? []);
            setDraft(Object.fromEntries(Object.entries(data.rules ?? {}).map(([job, r]) => [job, r.rule])));
            setError('');
        } catch (e) { setError(e instanceof Error ? e.message : 'The list was not loaded'); } finally { setLoading(false); }
    }, []);
    useEffect(() => { load(); }, [load]);

    const showPeople = async (key: string, url: string) => {
        if (people[key] && people[key] !== 'loading') { setPeople((p) => { const n = { ...p }; delete n[key]; return n; }); return; }
        setPeople((p) => ({ ...p, [key]: 'loading' }));
        try {
            const res = await fetch(url, { cache: 'no-store' });
            if (!res.ok) throw new Error('The people were not loaded');
            const list = unwrap(await res.json()) as Person[];
            setPeople((p) => ({ ...p, [key]: list }));
        } catch (e) { toast.error(e instanceof Error ? e.message : 'The people were not loaded'); setPeople((p) => { const n = { ...p }; delete n[key]; return n; }); }
    };

    const toggle = async (a: Audience, r: AudienceRole) => {
        const grant = !r.holds;
        if (!window.confirm(`${grant ? 'Add' : 'Remove'} the role "${r.name}" (${r.users} user${r.users === 1 ? '' : 's'}) ${grant ? 'to' : 'from'} "${a.label}"?`)) return;
        setBusy(`${a.id}:${r.id}`);
        try {
            const res = await fetch('/api/admin/automated-notices', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ audience: a.id, roleId: r.id, grant }) });
            if (!res.ok) throw new Error(await errorText(res, 'The change was not saved'));
            toast.success(grant ? 'Role added' : 'Role removed');
            setPeople((p) => { const n = { ...p }; delete n[a.id]; return n; });
            await load();
        } catch (e) { toast.error(e instanceof Error ? e.message : 'The change was not saved'); } finally { setBusy(''); }
    };

    const changeRule = (job: string, patch: Partial<Rule>) => setDraft((d) => {
        const next = { ...d[job], ...patch };
        // a module has its own levels: when the module changes, start at its first level
        if (patch.module && patch.module !== d[job].module) next.minLevel = options.find((o) => o.module === patch.module)?.levels[0]?.value ?? next.minLevel;
        return { ...d, [job]: next };
    });
    const dirty = (job: string) => JSON.stringify(draft[job]) !== JSON.stringify(rules[job]?.rule);
    const saveRule = async (n: Notice) => {
        const rule = draft[n.job];
        if (!window.confirm(`Change who receives "${n.title}"?`)) return;
        setBusy(`rule:${n.job}`);
        try {
            const res = await fetch('/api/admin/automated-notices/rule', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ job: n.job, ...rule }) });
            if (!res.ok) throw new Error(await errorText(res, 'The rule was not saved'));
            toast.success('Saved. The next run uses it.');
            setPeople((p) => { const x = { ...p }; delete x[`rule:${n.job}`]; return x; });
            await load();
        } catch (e) { toast.error(e instanceof Error ? e.message : 'The rule was not saved'); } finally { setBusy(''); }
    };

    const count = (id: string) => audiences.find((a) => a.id === id);
    const field = 'rounded-lg border border-slate-400 bg-white px-2 py-1.5 text-sm font-medium text-slate-900';

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
                                <p className="mt-1 text-sm text-slate-700 dark:text-slate-300">What the system sends by itself, when, and to whom. A report goes to the people who work in its module at a job level you choose (and, for an area report, in that area). Changes are saved at once and written to the audit log.</p>
                            </div>

                            {loading && <p className="text-sm font-medium text-slate-800 dark:text-slate-200">Loading...</p>}
                            {error && <div role="alert" className="rounded-lg border border-red-300 bg-red-50 p-4 text-sm font-semibold text-red-900">{error} <button onClick={() => { setLoading(true); load(); }} className="ml-2 underline">Try again</button></div>}

                            {!loading && !error && (
                                <>
                                    <section aria-label="Scheduled reports">
                                        <h2 className="mb-1 text-lg font-bold text-slate-900 dark:text-slate-100">Scheduled reports and alerts</h2>
                                        <p className="mb-3 text-sm text-slate-700 dark:text-slate-300">For each report below that has a rule, choose the module, the lowest job level that receives it, and the area.</p>
                                        <div className="space-y-4">
                                            {notices.map((n) => {
                                                const info = rules[n.job];
                                                const d = draft[n.job];
                                                const opt = options.find((o) => o.module === d?.module);
                                                const key = `rule:${n.job}`;
                                                const list = people[key];
                                                return (
                                                    <div key={n.job} className="rounded-xl border border-slate-300 bg-white p-4 shadow-sm">
                                                        <div className="flex flex-wrap items-start justify-between gap-3">
                                                            <div className="max-w-2xl"><h3 className="font-bold text-slate-900">{n.title}</h3><p className="mt-1 text-xs text-slate-700">{n.description}</p></div>
                                                            <div className="text-right text-xs text-slate-900"><p className="font-semibold">{n.schedule}</p><p>{n.channels.map((c) => (c === 'email' ? 'Email' : 'In-app')).join(' + ')}</p></div>
                                                        </div>
                                                        <p className="mt-2 text-xs font-medium text-slate-800">To: {n.to}</p>

                                                        {info && d ? (
                                                            <div className="mt-3 rounded-lg bg-slate-50 p-3">
                                                                <div className="flex flex-wrap items-end gap-3">
                                                                    <label className="text-xs font-semibold text-slate-900">Module<select aria-label={`${n.title}: module`} className={`${field} mt-1 block`} value={d.module} onChange={(e) => changeRule(n.job, { module: e.target.value })}>{options.map((o) => <option key={o.module} value={o.module}>{o.label}</option>)}</select></label>
                                                    <label className="text-xs font-semibold text-slate-900">Job level (this and above)<select aria-label={`${n.title}: job level`} className={`${field} mt-1 block`} value={d.minLevel} onChange={(e) => changeRule(n.job, { minLevel: e.target.value })}>{(opt?.levels ?? []).map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}</select></label>
                                                                    <label className="text-xs font-semibold text-slate-900">Area<select aria-label={`${n.title}: area`} className={`${field} mt-1 block`} value={d.area} onChange={(e) => changeRule(n.job, { area: e.target.value as 'company' | 'area' })}><option value="company">Company-wide</option><option value="area">By area</option></select></label>
                                                                    <button onClick={() => saveRule(n)} disabled={!dirty(n.job) || busy === key} className="rounded-lg bg-indigo-700 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-800 disabled:opacity-40">{busy === key ? 'Saving...' : 'Save'}</button>
                                                                    {!info.isDefault && <span className="text-xs font-semibold text-amber-900">Changed from the standard rule</span>}
                                                                </div>
                                                                <p className="mt-2 text-xs text-slate-800">{AREA_TEXT[d.area]}.</p>
                                                                <p className="mt-2 text-sm font-bold text-slate-900">{info.holders} {info.holders === 1 ? 'person' : 'people'} meet this rule <span className="font-normal text-slate-800">({info.withEmail} with email; {info.companyWide} see every area; {info.withArea} work in an area)</span></p>
                                                                {info.holders > BIG && <p role="alert" className="mt-2 rounded bg-red-50 px-2 py-1 text-xs font-bold text-red-900">This reaches {info.holders} people. Check that this is meant for all of them.</p>}
                                                                {info.noArea > 0 && <p role="alert" className="mt-2 rounded bg-amber-50 px-2 py-1 text-xs font-bold text-amber-950">{info.noArea} {info.noArea === 1 ? 'person works' : 'people work'} in this module but {info.noArea === 1 ? 'has' : 'have'} no area set, so {info.noArea === 1 ? 'receives' : 'receive'} none of its area notices. Set their area in Administration, Users.</p>}
                                                                <button onClick={() => showPeople(key, `/api/admin/automated-notices/rule?job=${n.job}`)} className="mt-2 text-xs font-semibold text-indigo-800 underline">{list && list !== 'loading' ? 'Hide the people' : 'Show the people'}</button>
                                                                {list === 'loading' && <p className="mt-2 text-xs text-slate-800">Loading...</p>}
                                                                {Array.isArray(list) && (
                                                                    <div className="mt-2 max-h-48 overflow-y-auto rounded border border-slate-200 bg-white p-2">
                                                                        {list.length === 0 ? <p className="text-xs text-slate-800">Nobody meets this rule now.</p> : list.map((p) => <p key={p.id} className="text-xs text-slate-900"><span className="font-semibold">{p.name}</span> · {p.role.replace(/_/g, ' ').toLowerCase()}{p.noArea ? ' · no area' : ''}{p.email ? '' : ' · no email'}</p>)}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        ) : (
                                                            <p className="mt-3 text-xs text-slate-800">
                                                                {n.audiences === null ? 'Goes to the people named by the data itself, so it has no rule.' : `Goes to: ${n.audiences.map((id) => { const a = count(id); return a ? `${a.label} (${a.recipients})` : id; }).join(', ')}. Change it under Audiences below.`}
                                                            </p>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </section>

                                    <section aria-label="Audiences">
                                        <h2 className="mb-1 text-lg font-bold text-slate-900 dark:text-slate-100">Audiences: who receives the other notices</h2>
                                        <p className="mb-3 text-sm text-slate-700 dark:text-slate-300">Notices sent when something happens (a service order completed, a project approval, a new ticket) go to one audience. Switch a role on or off to change who is in it. A person who holds an override of their own is counted as they are.</p>
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
                                                        <button onClick={() => showPeople(a.id, `/api/admin/automated-notices/${a.id}/people`)} className="mt-3 text-xs font-semibold text-indigo-800 underline">{list && list !== 'loading' ? 'Hide the people' : 'Show the people'}</button>
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
