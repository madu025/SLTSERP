'use client';

import { useState, useEffect, useCallback } from 'react';
import RoleGuard from '@/components/RoleGuard';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import { toast } from 'sonner';
import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';

interface Box {
  id: string; name: string; opmcId: string; site: string; status: string;
  limit: number; balance: number; iouOut: number; billsWaiting: number; cashInHand: number; replenishAmount: number; unaccounted: number;
  draftBills: number; floatPending: number; floatRoom: number; pendingReimbursement: { reimbursementNumber: string; totalAmount: number | string } | null;
}
interface Bill {
  id: string; voucherNumber: string; date: string; title: string; category: string; amount: number | string; status: string; recipientName?: string | null;
  description?: string | null; receiptUrl?: string | null; createdById?: string | null; iouId?: string | null; rejectionReason?: string | null; cancelledReason?: string | null; carriedToNumber?: string | null;
}
interface Opmc { id: string; name?: string; rtom?: string }

const CATEGORIES = ['Subsistence', 'Staff welfare', 'Travelling and transport', 'Fuel', 'Stationery and printing', 'Telephone', 'Electricity', 'Water', 'Office expenses', 'Repair and maintenance', 'Equipment hiring', 'Parking', 'Other'];
const money = (n: number | string) => Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const field = 'w-full rounded-lg border border-slate-400 bg-white p-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-600';
const lbl = 'mb-1 block text-sm font-semibold text-slate-900';
const STATUS: Record<string, [string, string]> = {
  DRAFT: ['Waiting for approval', 'bg-slate-200 text-slate-900'], APPROVED: ['Approved, not reimbursed', 'bg-amber-100 text-amber-900'],
  REIMBURSED: ['Reimbursed', 'bg-emerald-100 text-emerald-900'], REJECTED: ['Rejected', 'bg-red-100 text-red-900'], CANCELLED: ['Cancelled', 'bg-slate-300 text-slate-900'],
};

async function failure(res: Response, fallback: string) {
  try {
    const j = await res.json();
    const m = j?.error?.message ?? j?.message ?? (typeof j?.error === 'string' ? j.error : '');
    return String(m || '').replace(/^[A-Z_]+:\s*/, '') || fallback;
  } catch { return fallback; }
}
const rows = <T,>(j: unknown): T[] => { const p = j as { data?: unknown }; const d = Array.isArray(j) ? j : Array.isArray(p?.data) ? p.data : (p?.data as { data?: unknown })?.data; return Array.isArray(d) ? (d as T[]) : []; };

export default function PettyCashPage() {
  const [boxes, setBoxes] = useState<Box[]>([]);
  const [boxId, setBoxId] = useState('');
  const [bills, setBills] = useState<Bill[]>([]);
  const [opmcs, setOpmcs] = useState<Opmc[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [me, setMe] = useState<{ id: string; permissions: string[] }>({ id: '', permissions: [] });
  const [dialog, setDialog] = useState<'' | 'bill' | 'box' | 'float' | 'reject' | 'cancel'>('');
  const [target, setTarget] = useState<Bill | null>(null);
  const [billForm, setBillForm] = useState({ title: '', amount: '', category: CATEGORIES[0], recipientName: '', description: '', receiptUrl: '' });
  const [boxForm, setBoxForm] = useState({ opmcId: '', name: '', imprestLimit: '', openingBalance: '0' });
  const [floatAmount, setFloatAmount] = useState('');
  const [newBoxOffice, setNewBoxOffice] = useState('');
  const [reason, setReason] = useState('');
  const [carried, setCarried] = useState('');

  useEffect(() => { try { const u = JSON.parse(localStorage.getItem('user') || 'null'); if (u) setMe({ id: u.id, permissions: u.permissions ?? [] }); } catch { /* not signed in */ } }, []);
  const canWrite = me.permissions.includes(RBAC_PERMISSIONS.FINANCE_WRITE);
  const canApprove = me.permissions.includes(RBAC_PERMISSIONS.FINANCE_APPROVE);
  const canAskHo = me.permissions.includes(RBAC_PERMISSIONS.FINANCE_HO_SUBMIT);

  const loadBoxes = useCallback(async () => {
    try {
      const res = await fetch(`/api/finance/petty-cash/accounts?summary=1&_t=${Date.now()}`);
      if (res.ok) { const list = rows<Box>(await res.json()); setBoxes(list); setBoxId((cur) => (list.some((b) => b.id === cur) ? cur : list[0]?.id ?? '')); }
    } catch (e) { console.error('Error loading the petty cash boxes:', e); } finally { setLoading(false); }
  }, []);
  const loadBills = useCallback(async (id: string) => {
    if (!id) { setBills([]); return; }
    try { const res = await fetch(`/api/finance/petty-cash/vouchers?accountId=${id}&_t=${Date.now()}`); if (res.ok) setBills(rows<Bill>(await res.json())); } catch (e) { console.error('Error loading the bills:', e); }
  }, []);
  useEffect(() => { loadBoxes(); }, [loadBoxes]);
  useEffect(() => { loadBills(boxId); }, [boxId, loadBills]);
  useEffect(() => { fetch('/api/opmcs').then((r) => (r.ok ? r.json() : [])).then((j) => setOpmcs(Array.isArray(j) ? j : (j?.data ?? []))).catch(() => undefined); }, []);

  useEffect(() => { const made = boxes.find((b) => b.opmcId === newBoxOffice); if (made) { setBoxId(made.id); setNewBoxOffice(''); } }, [boxes, newBoxOffice]);
  const box = boxes.find((b) => b.id === boxId);
  const refresh = async () => { await loadBoxes(); await loadBills(boxId); };
  const call = async (key: string, fn: () => Promise<Response>, ok: string, fallback: string, done?: () => void) => {
    if (busy) return;
    setBusy(key);
    try {
      const res = await fn();
      if (!res.ok) throw new Error(await failure(res, fallback));
      toast.success(ok); done?.(); await refresh();
    } catch (err) { toast.error(err instanceof Error ? err.message : fallback); } finally { setBusy(''); }
  };
  const post = (url: string, body: unknown, method = 'POST') => fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

  const addBill = (e: React.FormEvent) => { e.preventDefault(); if (!box) return; call('bill', () => post('/api/finance/petty-cash/vouchers', { accountId: box.id, title: billForm.title.trim(), amount: Number(billForm.amount), category: billForm.category, recipientName: billForm.recipientName.trim() || null, description: billForm.description.trim() || null, receiptUrl: billForm.receiptUrl.trim() || null }), 'Bill recorded. It waits for the approval.', 'The bill was not saved', () => { setDialog(''); setBillForm({ title: '', amount: '', category: CATEGORIES[0], recipientName: '', description: '', receiptUrl: '' }); }); };
  const approve = (b: Bill) => call(`a${b.id}`, () => post('/api/finance/petty-cash/vouchers', { id: b.id, action: 'APPROVE' }, 'PATCH'), 'Bill approved', 'The approval failed');
  const reject = (e: React.FormEvent) => { e.preventDefault(); if (!target) return; call('reject', () => post('/api/finance/petty-cash/vouchers', { id: target.id, action: 'REJECT', rejectionReason: reason.trim() }, 'PATCH'), 'Bill rejected', 'The rejection failed', () => { setDialog(''); setReason(''); }); };
  const cancel = (e: React.FormEvent) => { e.preventDefault(); if (!target) return; call('cancel', () => post('/api/finance/petty-cash/vouchers/cancel', { id: target.id, reason: reason.trim(), carriedToNumber: carried.trim() || undefined }), 'Bill cancelled', 'The cancel failed', () => { setDialog(''); setReason(''); setCarried(''); }); };
  const replenish = () => box && call('rep', () => post('/api/finance/petty-cash/reimbursements', { accountId: box.id }), 'Replenishment asked of Head Office', 'The request failed');
  const createBox = (e: React.FormEvent) => { e.preventDefault(); call('box', () => post('/api/finance/petty-cash/accounts', { name: boxForm.name.trim(), opmcId: boxForm.opmcId, imprestLimit: Number(boxForm.imprestLimit), openingBalance: Number(boxForm.openingBalance || 0) }), 'Petty cash box created', 'The box was not created', () => { setDialog(''); setNewBoxOffice(boxForm.opmcId); }); };
  const askFloat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!box || busy) return;
    setBusy('float');
    try {
      const made = await post('/api/finance/ho/funding', { action: 'CREATE', purpose: 'PETTY_CASH_FLOAT', requestedAmount: Number(floatAmount), pettyCashAccountId: box.id, remarks: `Float for ${box.name}` });
      if (!made.ok) throw new Error(await failure(made, 'The request was not saved'));
      const j = await made.json(); const id = j?.data?.id ?? j?.id;
      const sent = await post('/api/finance/ho/funding', { action: 'SUBMIT', id });
      if (!sent.ok) throw new Error(await failure(sent, 'The request was saved but not sent'));
      toast.success('Float asked of Head Office'); setDialog(''); await refresh();
    } catch (err) { toast.error(err instanceof Error ? err.message : 'The request failed'); } finally { setBusy(''); }
  };

  const stat = (title: string, value: string, hint?: string, bad = false) => (
    <div className="rounded-xl border border-slate-300 bg-white p-4"><p className="text-xs font-semibold uppercase tracking-wide text-slate-800">{title}</p><p className={`mt-1 text-xl font-bold ${bad ? 'text-red-800' : 'text-slate-900'}`}>{value}</p>{hint && <p className="mt-1 text-xs text-slate-700">{hint}</p>}</div>
  );
  const boxesWithout = opmcs.filter((o) => !boxes.some((b) => b.opmcId === o.id));
  const btn = 'rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-50';

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
                  <h1 className="text-2xl font-bold text-slate-900">Petty cash</h1>
                  <p className="text-sm text-slate-700">The cash box of a site office: the float from Head Office, IOUs, bills and replenishment.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {boxes.length > 1 && (
                    <select aria-label="Site office" className={`${field} w-auto`} value={boxId} onChange={(e) => setBoxId(e.target.value)}>
                      {boxes.map((b) => <option key={b.id} value={b.id}>{b.site || b.name}</option>)}
                    </select>
                  )}
                  {canApprove && <button onClick={() => { setBoxForm({ opmcId: '', name: '', imprestLimit: '', openingBalance: '0' }); setDialog('box'); }} className={`${btn} border border-slate-500 bg-white text-slate-900 hover:bg-slate-100`}>New box</button>}
                </div>
              </div>

              {loading ? (
                <p className="rounded-xl border border-slate-300 bg-white p-4 text-sm font-medium text-slate-800">Loading the petty cash box...</p>
              ) : !box ? (
                <p className="rounded-xl border border-slate-300 bg-white p-4 text-sm font-medium text-slate-800">No petty cash box is set up for your site offices.{canApprove ? ' Use "New box" to create one.' : ' The Finance Manager sets it up.'}</p>
              ) : (
                <>
                  <section aria-label="Cash position" className="space-y-3">
                    <div className="flex flex-wrap items-baseline gap-2"><h2 className="text-lg font-bold text-slate-900">{box.name}</h2><span className="text-sm text-slate-700">{box.site}{box.status !== 'ACTIVE' ? ' (not active)' : ''}</span></div>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                      {stat('Imprest limit', money(box.limit))}
                      {stat('Cash in hand', money(box.cashInHand), 'what is in the box now')}
                      {stat('Out on IOUs', money(box.iouOut), 'cash with people, to be settled')}
                      {stat('Bills waiting', money(box.billsWaiting), 'approved, not yet reimbursed')}
                      {stat('Not accounted', money(box.unaccounted), box.unaccounted === 0 ? 'the imprest adds up' : box.unaccounted > 0 ? 'the float can still be filled up to this' : 'more has gone out than the limit: check it', box.unaccounted < 0)}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {canWrite && <button onClick={() => setDialog('bill')} className={`${btn} bg-indigo-700 text-white hover:bg-indigo-800`}>+ Add a bill</button>}
                      {canAskHo && box.floatRoom > 0 && <button onClick={() => { setFloatAmount(String(box.floatRoom)); setDialog('float'); }} className={`${btn} border border-slate-500 bg-white text-slate-900 hover:bg-slate-100`}>Ask Head Office for the float</button>}
                      {canWrite && box.billsWaiting > 0 && !box.pendingReimbursement && <button onClick={replenish} disabled={!!busy} className={`${btn} border border-slate-500 bg-white text-slate-900 hover:bg-slate-100`}>{busy === 'rep' ? 'Sending...' : `Ask Head Office to replenish ${money(box.replenishAmount)}`}</button>}
                    </div>
                    {box.floatPending > 0 && <p className="rounded-lg border border-amber-400 bg-amber-50 p-3 text-sm font-medium text-slate-900">A float of {money(box.floatPending)} is with Head Office. It is on the <a className="font-semibold text-indigo-800 underline" href="/finance/ho-funding">Head Office funding</a> page.</p>}
                    {box.pendingReimbursement && <p className="rounded-lg border border-amber-400 bg-amber-50 p-3 text-sm font-medium text-slate-900">Replenishment {box.pendingReimbursement.reimbursementNumber} of {money(box.pendingReimbursement.totalAmount)} is with Head Office. It is on the <a className="font-semibold text-indigo-800 underline" href="/finance/ho-funding">Head Office funding</a> page.</p>}
                  </section>

                  <section aria-label="Bills" className="overflow-hidden rounded-xl border border-slate-300 bg-white">
                    <div className="overflow-x-auto">
                      <table className="w-full whitespace-nowrap text-left text-sm">
                        <thead className="border-b border-slate-300 bg-slate-100"><tr>{['Bill', 'Date', 'Title', 'Category', 'Amount (LKR)', 'Status', 'Actions'].map((h) => <th key={h} className="p-3 text-xs font-bold uppercase tracking-wide text-slate-900">{h}</th>)}</tr></thead>
                        <tbody className="divide-y divide-slate-200">
                          {bills.length === 0 ? <tr><td colSpan={7} className="p-4 text-center text-slate-800">No bills yet</td></tr> : bills.map((b) => {
                            const [text, cls] = STATUS[b.status] ?? [b.status, 'bg-slate-200 text-slate-900'];
                            const mine = !!me.id && b.createdById === me.id;
                            return (
                              <tr key={b.id}>
                                <td className="p-3 font-semibold text-slate-900">{b.voucherNumber}</td>
                                <td className="p-3 text-slate-900">{new Date(b.date).toLocaleDateString()}</td>
                                <td className="max-w-xs truncate p-3 text-slate-900" title={b.title}>{b.title}{b.iouId ? <span className="ml-2 rounded bg-sky-100 px-1.5 py-0.5 text-xs font-semibold text-sky-900">IOU</span> : null}</td>
                                <td className="p-3 text-slate-900">{b.category}</td>
                                <td className="p-3 font-semibold text-slate-900">{money(b.amount)}</td>
                                <td className="p-3"><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${cls}`}>{text}</span>{b.status === 'CANCELLED' && <p className="mt-1 whitespace-normal text-xs text-slate-800">{b.cancelledReason}{b.carriedToNumber ? `${/[.!?]$/.test(b.cancelledReason ?? '') ? '' : '.'} Carried to ${b.carriedToNumber}.` : ''}</p>}{b.status === 'REJECTED' && b.rejectionReason && <p className="mt-1 whitespace-normal text-xs text-slate-800">{b.rejectionReason}</p>}</td>
                                <td className="space-x-2 p-3">
                                  {b.status === 'DRAFT' && canApprove && !mine && <><button onClick={() => approve(b)} disabled={!!busy} className="rounded bg-indigo-700 px-3 py-1 text-xs font-semibold text-white hover:bg-indigo-800 disabled:opacity-50">{busy === `a${b.id}` ? 'Approving...' : 'Approve'}</button><button onClick={() => { setTarget(b); setReason(''); setDialog('reject'); }} className="rounded border border-slate-600 bg-white px-3 py-1 text-xs font-semibold text-slate-900 hover:bg-slate-100">Reject</button></>}
                                  {b.status === 'DRAFT' && mine && <span className="text-xs text-slate-800">Awaiting another approver</span>}
                                  {b.status === 'DRAFT' && canWrite && <button onClick={() => { setTarget(b); setReason(''); setCarried(''); setDialog('cancel'); }} className="text-xs font-semibold text-red-800 underline">Cancel</button>}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </section>
                </>
              )}
            </div>
          </main>
        </div>
      </div>

      {dialog === 'bill' && box && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-label="New bill">
          <form onSubmit={addBill} className="max-h-[90vh] w-full max-w-md space-y-3 overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
            <h2 className="text-xl font-bold text-slate-900">New bill</h2>
            <div><label className={lbl}>What was it for</label><input required className={field} value={billForm.title} onChange={(e) => setBillForm({ ...billForm, title: e.target.value })} /></div>
            <div><label className={lbl}>Amount (LKR)</label><input required type="number" min="0.01" step="0.01" className={field} value={billForm.amount} onChange={(e) => setBillForm({ ...billForm, amount: e.target.value })} /></div>
            <div><label className={lbl}>Category</label><select className={field} value={billForm.category} onChange={(e) => setBillForm({ ...billForm, category: e.target.value })}>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></div>
            <div><label className={lbl}>Paid to</label><input className={field} value={billForm.recipientName} onChange={(e) => setBillForm({ ...billForm, recipientName: e.target.value })} /></div>
            <div><label className={lbl}>Receipt link</label><input className={field} value={billForm.receiptUrl} onChange={(e) => setBillForm({ ...billForm, receiptUrl: e.target.value })} placeholder="optional" /></div>
            <div><label className={lbl}>Notes</label><textarea rows={2} className={field} value={billForm.description} onChange={(e) => setBillForm({ ...billForm, description: e.target.value })} /></div>
            <div className="flex justify-end gap-2 border-t border-slate-200 pt-3"><button type="button" onClick={() => setDialog('')} className={`${btn} text-slate-900 hover:bg-slate-100`}>Cancel</button><button type="submit" disabled={!!busy} className={`${btn} bg-indigo-700 text-white hover:bg-indigo-800`}>{busy === 'bill' ? 'Saving...' : 'Record bill'}</button></div>
          </form>
        </div>
      )}

      {dialog === 'box' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-label="New petty cash box">
          <form onSubmit={createBox} className="w-full max-w-md space-y-3 rounded-xl bg-white p-6 shadow-xl">
            <h2 className="text-xl font-bold text-slate-900">New petty cash box</h2>
            <p className="text-xs text-slate-700">One box for each site office. It starts with what is really in it (0 when Head Office will fund the float).</p>
            <div><label className={lbl}>Site office</label><select required className={field} value={boxForm.opmcId} onChange={(e) => setBoxForm({ ...boxForm, opmcId: e.target.value })}><option value="">Choose...</option>{boxesWithout.map((o) => <option key={o.id} value={o.id}>{o.name ?? o.rtom}</option>)}</select></div>
            <div><label className={lbl}>Name</label><input required className={field} value={boxForm.name} onChange={(e) => setBoxForm({ ...boxForm, name: e.target.value })} placeholder="e.g. Kaduwela petty cash" /></div>
            <div><label className={lbl}>Imprest limit (LKR)</label><input required type="number" min="1" step="0.01" className={field} value={boxForm.imprestLimit} onChange={(e) => setBoxForm({ ...boxForm, imprestLimit: e.target.value })} /></div>
            <div><label className={lbl}>Cash in the box now (LKR)</label><input required type="number" min="0" step="0.01" className={field} value={boxForm.openingBalance} onChange={(e) => setBoxForm({ ...boxForm, openingBalance: e.target.value })} /></div>
            <div className="flex justify-end gap-2 border-t border-slate-200 pt-3"><button type="button" onClick={() => setDialog('')} className={`${btn} text-slate-900 hover:bg-slate-100`}>Cancel</button><button type="submit" disabled={!!busy} className={`${btn} bg-indigo-700 text-white hover:bg-indigo-800`}>{busy === 'box' ? 'Saving...' : 'Create box'}</button></div>
          </form>
        </div>
      )}

      {dialog === 'float' && box && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-label="Ask for the float">
          <form onSubmit={askFloat} className="w-full max-w-md space-y-3 rounded-xl bg-white p-6 shadow-xl">
            <h2 className="text-xl font-bold text-slate-900">Ask Head Office for the float</h2>
            <p className="text-xs text-slate-700">The float can fill up to {money(box.floatRoom)}: the limit less the cash in hand, the cash on IOUs, the bills waiting and floats already asked.</p>
            <div><label className={lbl}>Amount (LKR)</label><input required type="number" min="0.01" max={box.floatRoom} step="0.01" className={field} value={floatAmount} onChange={(e) => setFloatAmount(e.target.value)} /></div>
            <div className="flex justify-end gap-2 border-t border-slate-200 pt-3"><button type="button" onClick={() => setDialog('')} className={`${btn} text-slate-900 hover:bg-slate-100`}>Cancel</button><button type="submit" disabled={!!busy} className={`${btn} bg-indigo-700 text-white hover:bg-indigo-800`}>{busy === 'float' ? 'Sending...' : 'Send to Head Office'}</button></div>
          </form>
        </div>
      )}

      {(dialog === 'reject' || dialog === 'cancel') && target && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-label={dialog === 'reject' ? 'Reject the bill' : 'Cancel the bill'}>
          <form onSubmit={dialog === 'reject' ? reject : cancel} className="w-full max-w-md space-y-3 rounded-xl bg-white p-6 shadow-xl">
            <h2 className="text-xl font-bold text-slate-900">{dialog === 'reject' ? 'Reject' : 'Cancel'} bill {target.voucherNumber}</h2>
            <div><label className={lbl}>Reason</label><textarea required minLength={3} rows={3} className={field} value={reason} onChange={(e) => setReason(e.target.value)} /></div>
            {dialog === 'cancel' && <div><label className={lbl}>Carried to bill number (if any)</label><input className={field} value={carried} onChange={(e) => setCarried(e.target.value)} /></div>}
            <div className="flex justify-end gap-2 border-t border-slate-200 pt-3"><button type="button" onClick={() => setDialog('')} className={`${btn} text-slate-900 hover:bg-slate-100`}>Back</button><button type="submit" disabled={!!busy} className={`${btn} bg-red-800 text-white hover:bg-red-900`}>{busy === 'reject' || busy === 'cancel' ? 'Saving...' : dialog === 'reject' ? 'Reject the bill' : 'Cancel the bill'}</button></div>
          </form>
        </div>
      )}
    </RoleGuard>
  );
}
