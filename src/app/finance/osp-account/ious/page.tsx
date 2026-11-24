'use client';

import { useState, useEffect, useCallback } from 'react';
import RoleGuard from '@/components/RoleGuard';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import { toast } from 'sonner';
import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';

interface Settlement { id: string; kind: string; amount: number; reference: string | null; settleDate: string; remarks: string | null }
interface IOU {
  id: string; iouNumber: string; staffName: string; amount: number; reason?: string | null; status: string; createdAt: string;
  floatId?: string | null; createdById?: string | null; outstanding: number; daysOutstanding: number; settlementStatus: string; settlements: Settlement[];
}
interface Float { id: string; opmcId: string; type: string; name: string; limitAmount: number; maxDaysOutstanding: number; status: string; outstanding: number; available: number }
interface Opmc { id: string; name?: string; rtom?: string }

const FLOAT_TYPES: Array<[string, string]> = [['PETTY_CASH', 'Petty cash'], ['PROJECT_ADVANCE', 'Project advance'], ['FUEL', 'Fuel advance'], ['OTHER', 'Other']];
const KIND_LABEL: Record<string, string> = { BILLS: 'Bills handed in', REFUND: 'Cash returned', REMINDER: 'Reminder' };
const money = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const input = 'w-full rounded-lg border border-slate-400 bg-white p-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-600';
const label = 'mb-1 block text-sm font-semibold text-slate-900';

/** The message the server gave, not a generic one. */
async function failure(res: Response, fallback: string) {
  try {
    const j = await res.json();
    const m = j?.error?.message ?? j?.message ?? (typeof j?.error === 'string' ? j.error : '');
    const text = String(m || '').replace(/^[A-Z_]+:\s*/, '');
    return text || fallback;
  } catch { return fallback; }
}
const unwrap = <T,>(payload: unknown): T[] => {
  const p = payload as { data?: unknown };
  const d = p?.data as { data?: unknown } | unknown[] | undefined;
  const rows = Array.isArray(d) ? d : (d as { data?: unknown })?.data;
  return Array.isArray(rows) ? (rows as T[]) : [];
};

export default function IOUPage() {
  const [ious, setIous] = useState<IOU[]>([]);
  const [floats, setFloats] = useState<Float[]>([]);
  const [opmcs, setOpmcs] = useState<Opmc[]>([]);
  const [loading, setLoading] = useState(true);
  const [me, setMe] = useState<{ id: string; permissions: string[] }>({ id: '', permissions: [] });
  const [iouOpen, setIouOpen] = useState(false);
  const [floatOpen, setFloatOpen] = useState(false);
  const [settling, setSettling] = useState<IOU | null>(null);
  const [busy, setBusy] = useState(false);
  const [approving, setApproving] = useState('');

  const [iouForm, setIouForm] = useState({ iouNumber: '', staffName: '', amount: '', reason: '', floatId: '' });
  const [floatForm, setFloatForm] = useState({ opmcId: '', type: 'PETTY_CASH', name: '', limitAmount: '', maxDaysOutstanding: '30' });
  const [setForm, setSetForm] = useState({ kind: 'BILLS', amount: '', reference: '', settleDate: new Date().toISOString().slice(0, 10), remarks: '' });

  useEffect(() => {
    try { const u = JSON.parse(localStorage.getItem('user') || 'null'); if (u) setMe({ id: u.id, permissions: u.permissions ?? [] }); } catch { /* not signed in */ }
  }, []);
  const canWrite = me.permissions.includes(RBAC_PERMISSIONS.FINANCE_WRITE);
  const canApprove = me.permissions.includes(RBAC_PERMISSIONS.FINANCE_APPROVE);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [a, b] = await Promise.all([fetch(`/api/finance/osp-account/ious?_t=${Date.now()}`), fetch(`/api/finance/osp-account/floats?_t=${Date.now()}`)]);
      if (a.ok) setIous(unwrap<IOU>(await a.json()));
      if (b.ok) setFloats(unwrap<Float>(await b.json()));
    } catch (e) { console.error('Error loading the IOUs:', e); } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    fetch('/api/opmcs').then((r) => (r.ok ? r.json() : [])).then((j) => setOpmcs(Array.isArray(j) ? j : (j?.data ?? []))).catch(() => undefined);
  }, []);

  const floatName = (id?: string | null) => floats.find((f) => f.id === id)?.name ?? '-';
  const opmcName = (id: string) => { const o = opmcs.find((x) => x.id === id); return o?.name ?? o?.rtom ?? id.slice(0, 8); };

  const createIou = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await fetch('/api/finance/osp-account/ious', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ iouNumber: iouForm.iouNumber.trim(), staffName: iouForm.staffName.trim(), amount: Number(iouForm.amount), reason: iouForm.reason.trim() || undefined, floatId: iouForm.floatId || undefined }),
      });
      if (!res.ok) throw new Error(await failure(res, 'The IOU was not saved'));
      toast.success('IOU recorded. It waits for the approval.');
      setIouOpen(false); setIouForm({ iouNumber: '', staffName: '', amount: '', reason: '', floatId: '' }); load();
    } catch (err) { toast.error(err instanceof Error ? err.message : 'The IOU was not saved'); } finally { setBusy(false); }
  };

  const approve = async (id: string) => {
    if (approving) return;
    setApproving(id);
    try {
      const res = await fetch(`/api/finance/osp-account/ious/${id}/approve`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'APPROVE' }) });
      if (!res.ok) throw new Error(await failure(res, 'The approval failed'));
      toast.success('IOU approved and issued'); load();
    } catch (err) { toast.error(err instanceof Error ? err.message : 'The approval failed'); } finally { setApproving(''); }
  };

  const saveFloat = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await fetch('/api/finance/osp-account/floats', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ opmcId: floatForm.opmcId, type: floatForm.type, name: floatForm.name.trim(), limitAmount: Number(floatForm.limitAmount), maxDaysOutstanding: Number(floatForm.maxDaysOutstanding) }),
      });
      if (!res.ok) throw new Error(await failure(res, 'The float was not saved'));
      toast.success('Float saved'); setFloatOpen(false); load();
    } catch (err) { toast.error(err instanceof Error ? err.message : 'The float was not saved'); } finally { setBusy(false); }
  };

  const openSettle = (iou: IOU) => { setSettling(iou); setSetForm({ kind: 'BILLS', amount: '', reference: '', settleDate: new Date().toISOString().slice(0, 10), remarks: '' }); };
  const settle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settling) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/finance/osp-account/ious/${settling.id}/settlements`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: setForm.kind, amount: setForm.kind === 'REMINDER' ? 0 : Number(setForm.amount), reference: setForm.reference.trim() || undefined, settleDate: setForm.settleDate || undefined, remarks: setForm.remarks.trim() || undefined }),
      });
      if (!res.ok) throw new Error(await failure(res, 'The entry was not saved'));
      toast.success(`${KIND_LABEL[setForm.kind]} recorded`);
      setSettling(null); load();
    } catch (err) { toast.error(err instanceof Error ? err.message : 'The entry was not saved'); } finally { setBusy(false); }
  };

  const statusBadge = (iou: IOU) => {
    if (iou.status === 'APPROVED') {
      if (iou.settlementStatus === 'SETTLED') return ['Settled', 'bg-emerald-100 text-emerald-900'];
      if (iou.settlementStatus === 'PARTIALLY_SETTLED') return ['Part settled', 'bg-sky-100 text-sky-900'];
      return ['Issued, open', 'bg-amber-100 text-amber-900'];
    }
    if (iou.status === 'REJECTED') return ['Rejected', 'bg-red-100 text-red-900'];
    return ['Waiting for approval', 'bg-slate-200 text-slate-900'];
  };

  return (
    <RoleGuard>
      <div className="flex h-screen overflow-hidden bg-slate-50">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <Header />
          <main className="flex-1 overflow-y-auto p-4 md:p-6">
            <div className="mx-auto max-w-7xl space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h1 className="text-2xl font-bold text-slate-900">Petty Cash IOUs and floats</h1>
                  <p className="text-sm text-slate-700">An IOU is issued against a float, then settled with bills and returned cash.</p>
                </div>
                <div className="flex gap-2">
                  {canApprove && <button onClick={() => setFloatOpen(true)} className="rounded-lg border border-slate-500 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100">Set a float</button>}
                  {canWrite && <button onClick={() => setIouOpen(true)} className="rounded-lg bg-indigo-700 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-800">+ Add New IOU</button>}
                </div>
              </div>

              <section aria-label="Floats">
                <h2 className="mb-2 text-base font-bold text-slate-900">Floats</h2>
                {loading ? (
                  <p className="rounded-xl border border-slate-300 bg-white p-4 text-sm font-medium text-slate-800">Loading the floats...</p>
                ) : floats.length === 0 ? (
                  <p className="rounded-xl border border-slate-300 bg-white p-4 text-sm font-medium text-slate-800">No float is set yet.{canApprove ? ' Use "Set a float" to create the first one.' : ' The Finance Manager sets the floats.'}</p>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {floats.map((f) => (
                      <div key={f.id} className="rounded-xl border border-slate-300 bg-white p-4">
                        <div className="flex items-baseline justify-between gap-2">
                          <p className="font-bold text-slate-900">{f.name}</p>
                          <span className="text-xs font-semibold text-slate-800">{FLOAT_TYPES.find(([c]) => c === f.type)?.[1] ?? f.type}</span>
                        </div>
                        <p className="text-xs text-slate-700">{opmcName(f.opmcId)}{f.status !== 'ACTIVE' ? ' (not active)' : ''}</p>
                        <dl className="mt-3 grid grid-cols-3 gap-2 text-sm">
                          <div><dt className="text-xs text-slate-700">Limit</dt><dd className="font-semibold text-slate-900">{money(f.limitAmount)}</dd></div>
                          <div><dt className="text-xs text-slate-700">Out</dt><dd className="font-semibold text-slate-900">{money(f.outstanding)}</dd></div>
                          <div><dt className="text-xs text-slate-700">Available</dt><dd className={`font-bold ${f.available < 0 ? 'text-red-800' : 'text-emerald-900'}`}>{money(f.available)}</dd></div>
                        </dl>
                        <p className="mt-2 text-xs text-slate-700">{f.maxDaysOutstanding > 0 ? `No new IOU for a person whose IOU is open over ${f.maxDaysOutstanding} days` : 'No limit of days'}</p>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <section aria-label="IOUs" className="overflow-hidden rounded-xl border border-slate-300 bg-white">
                <div className="overflow-x-auto">
                  <table className="w-full whitespace-nowrap text-left text-sm">
                    <thead className="border-b border-slate-300 bg-slate-100">
                      <tr>
                        {['IOU number', 'Staff', 'Amount (LKR)', 'Outstanding', 'Days open', 'Float', 'Status', 'Actions'].map((h) => <th key={h} className="p-3 text-xs font-bold uppercase tracking-wide text-slate-900">{h}</th>)}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {loading ? (
                        <tr><td colSpan={8} className="p-4 text-center text-slate-800">Loading...</td></tr>
                      ) : ious.length === 0 ? (
                        <tr><td colSpan={8} className="p-4 text-center text-slate-800">No IOUs found</td></tr>
                      ) : ious.map((iou) => {
                        const [text, cls] = statusBadge(iou);
                        const mine = !!me.id && iou.createdById === me.id;
                        return (
                          <tr key={iou.id}>
                            <td className="p-3 font-semibold text-slate-900">{iou.iouNumber}</td>
                            <td className="p-3 text-slate-900">{iou.staffName}</td>
                            <td className="p-3 font-semibold text-slate-900">{money(iou.amount)}</td>
                            <td className="p-3 font-semibold text-slate-900">{iou.status === 'APPROVED' ? money(iou.outstanding) : '-'}</td>
                            <td className={`p-3 ${(() => { const lim = floats.find((f) => f.id === iou.floatId)?.maxDaysOutstanding ?? 0; return lim > 0 && iou.daysOutstanding > lim ? 'font-bold text-red-800' : 'text-slate-900'; })()}`}>{iou.status === 'APPROVED' && iou.outstanding > 0 ? iou.daysOutstanding : '-'}</td>
                            <td className="p-3 text-slate-900">{floatName(iou.floatId)}</td>
                            <td className="p-3"><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${cls}`}>{text}</span></td>
                            <td className="space-x-2 p-3">
                              {iou.status === 'PENDING' && canApprove && !mine && <button onClick={() => approve(iou.id)} disabled={!!approving} className="rounded bg-indigo-700 px-3 py-1 text-xs font-semibold text-white hover:bg-indigo-800 disabled:opacity-50">{approving === iou.id ? 'Approving...' : 'Approve'}</button>}
                              {iou.status === 'PENDING' && mine && <span className="text-xs text-slate-800" title="You recorded it; someone else approves it">Awaiting another approver</span>}
                              {iou.status === 'APPROVED' && canWrite && iou.outstanding > 0 && <button onClick={() => openSettle(iou)} className="rounded border border-slate-600 bg-white px-3 py-1 text-xs font-semibold text-slate-900 hover:bg-slate-100">Settle</button>}
                              {iou.status === 'APPROVED' && iou.settlements.length > 0 && <button onClick={() => openSettle(iou)} className="text-xs font-semibold text-indigo-800 underline">History</button>}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>
          </main>
        </div>
      </div>

      {iouOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-label="New IOU">
          <form onSubmit={createIou} className="w-full max-w-md space-y-3 rounded-xl bg-white p-6 shadow-xl">
            <h2 className="text-xl font-bold text-slate-900">New IOU</h2>
            <div><label className={label}>IOU number</label><input required className={input} value={iouForm.iouNumber} onChange={(e) => setIouForm({ ...iouForm, iouNumber: e.target.value })} placeholder="e.g. 12345" /></div>
            <div><label className={label}>Staff name</label><input required className={input} value={iouForm.staffName} onChange={(e) => setIouForm({ ...iouForm, staffName: e.target.value })} /></div>
            <div><label className={label}>Amount (LKR)</label><input required type="number" min="0.01" step="0.01" className={input} value={iouForm.amount} onChange={(e) => setIouForm({ ...iouForm, amount: e.target.value })} /></div>
            <div>
              <label className={label}>Float</label>
              <select className={input} value={iouForm.floatId} onChange={(e) => setIouForm({ ...iouForm, floatId: e.target.value })}>
                <option value="">No float (old style)</option>
                {floats.filter((f) => f.status === 'ACTIVE').map((f) => <option key={f.id} value={f.id}>{f.name}, available {money(f.available)}</option>)}
              </select>
            </div>
            <div><label className={label}>Reason</label><textarea rows={2} className={input} value={iouForm.reason} onChange={(e) => setIouForm({ ...iouForm, reason: e.target.value })} /></div>
            <div className="flex justify-end gap-2 border-t border-slate-200 pt-3">
              <button type="button" onClick={() => setIouOpen(false)} className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100">Cancel</button>
              <button type="submit" disabled={busy} className="rounded-lg bg-indigo-700 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-800 disabled:opacity-50">{busy ? 'Saving...' : 'Record IOU'}</button>
            </div>
          </form>
        </div>
      )}

      {floatOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-label="Set a float">
          <form onSubmit={saveFloat} className="w-full max-w-md space-y-3 rounded-xl bg-white p-6 shadow-xl">
            <h2 className="text-xl font-bold text-slate-900">Set a float</h2>
            <p className="text-xs text-slate-700">One float for each site office and type. Saving again changes its limit.</p>
            <div>
              <label className={label}>Site office</label>
              <select required className={input} value={floatForm.opmcId} onChange={(e) => setFloatForm({ ...floatForm, opmcId: e.target.value })}>
                <option value="">Choose...</option>
                {opmcs.map((o) => <option key={o.id} value={o.id}>{o.name ?? o.rtom}</option>)}
              </select>
            </div>
            <div>
              <label className={label}>Type</label>
              <select className={input} value={floatForm.type} onChange={(e) => setFloatForm({ ...floatForm, type: e.target.value })}>{FLOAT_TYPES.map(([c, l]) => <option key={c} value={c}>{l}</option>)}</select>
            </div>
            <div><label className={label}>Name</label><input required className={input} value={floatForm.name} onChange={(e) => setFloatForm({ ...floatForm, name: e.target.value })} placeholder="e.g. Kaduwela petty cash" /></div>
            <div><label className={label}>Limit (LKR)</label><input required type="number" min="0" step="0.01" className={input} value={floatForm.limitAmount} onChange={(e) => setFloatForm({ ...floatForm, limitAmount: e.target.value })} /></div>
            <div><label className={label}>Days an IOU may stay open (0 = no limit)</label><input required type="number" min="0" max="365" step="1" className={input} value={floatForm.maxDaysOutstanding} onChange={(e) => setFloatForm({ ...floatForm, maxDaysOutstanding: e.target.value })} /></div>
            <div className="flex justify-end gap-2 border-t border-slate-200 pt-3">
              <button type="button" onClick={() => setFloatOpen(false)} className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100">Cancel</button>
              <button type="submit" disabled={busy} className="rounded-lg bg-indigo-700 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-800 disabled:opacity-50">{busy ? 'Saving...' : 'Save float'}</button>
            </div>
          </form>
        </div>
      )}

      {settling && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-label="Settle the IOU">
          <div className="max-h-[90vh] w-full max-w-lg space-y-3 overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
            <h2 className="text-xl font-bold text-slate-900">IOU {settling.iouNumber}, {settling.staffName}</h2>
            <p className="text-sm text-slate-900">Issued {money(settling.amount)}. Outstanding <strong>{money(settling.outstanding)}</strong>.</p>
            {settling.settlements.length > 0 && (
              <ul className="divide-y divide-slate-200 rounded-lg border border-slate-300 text-sm">
                {settling.settlements.map((s) => (
                  <li key={s.id} className="flex justify-between gap-3 p-2 text-slate-900">
                    <span>{KIND_LABEL[s.kind] ?? s.kind}{s.reference ? `, ${s.reference}` : ''}{s.remarks ? `: ${s.remarks}` : ''}<span className="ml-2 text-xs text-slate-700">{new Date(s.settleDate).toLocaleDateString()}</span></span>
                    <span className="font-semibold">{s.kind === 'REMINDER' ? '-' : money(s.amount)}</span>
                  </li>
                ))}
              </ul>
            )}
            {canWrite && settling.outstanding > 0 && (
              <form onSubmit={settle} className="space-y-3 border-t border-slate-200 pt-3">
                <div>
                  <label className={label}>What happened</label>
                  <select className={input} value={setForm.kind} onChange={(e) => setSetForm({ ...setForm, kind: e.target.value })}>
                    <option value="BILLS">Bills handed in (expense)</option>
                    <option value="REFUND">Cash returned</option>
                    <option value="REMINDER">Reminder / follow-up note</option>
                  </select>
                </div>
                {setForm.kind !== 'REMINDER' && <div><label className={label}>Amount (LKR)</label><input required type="number" min="0.01" step="0.01" className={input} value={setForm.amount} onChange={(e) => setSetForm({ ...setForm, amount: e.target.value })} /></div>}
                <div><label className={label}>{setForm.kind === 'REFUND' ? 'Receipt number' : setForm.kind === 'BILLS' ? 'Bill / voucher number' : 'Reference'}</label><input className={input} value={setForm.reference} onChange={(e) => setSetForm({ ...setForm, reference: e.target.value })} /></div>
                <div><label className={label}>Date</label><input type="date" className={input} value={setForm.settleDate} onChange={(e) => setSetForm({ ...setForm, settleDate: e.target.value })} /></div>
                <div><label className={label}>{setForm.kind === 'REMINDER' ? 'Note' : 'Remarks'}</label><textarea required={setForm.kind === 'REMINDER'} rows={2} className={input} value={setForm.remarks} onChange={(e) => setSetForm({ ...setForm, remarks: e.target.value })} /></div>
                <div className="flex justify-end gap-2">
                  <button type="button" onClick={() => setSettling(null)} className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100">Close</button>
                  <button type="submit" disabled={busy} className="rounded-lg bg-indigo-700 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-800 disabled:opacity-50">{busy ? 'Saving...' : 'Record'}</button>
                </div>
              </form>
            )}
            {!(canWrite && settling.outstanding > 0) && <div className="flex justify-end"><button type="button" onClick={() => setSettling(null)} className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100">Close</button></div>}
          </div>
        </div>
      )}
    </RoleGuard>
  );
}
