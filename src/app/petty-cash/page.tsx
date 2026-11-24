'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import RoleGuard from '@/components/RoleGuard';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import { toast } from 'sonner';
import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';

interface Box {
  id: string; name: string; siteOfficeId: string | null; opmcId: string | null; site: string; status: string;
  limit: number; balance: number; iouOut: number; billsWaiting: number; cashInHand: number; replenishAmount: number; unaccounted: number;
  draftBills: number; floatPending: number; floatRoom: number; pendingReimbursement: { reimbursementNumber: string; totalAmount: number | string } | null;
  areaManager: { id: string; name: string } | null; custodians: Array<{ id: string; name: string }>;
  me: { isCustodian: boolean; isAreaManager: boolean; canWrite: boolean };
}
interface Bill {
  id: string; voucherNumber: string; date: string; title: string; category: string; amount: number | string; status: string; recipientName?: string | null;
  description?: string | null; receiptUrl?: string | null; createdById?: string | null; iouId?: string | null; rejectionReason?: string | null; cancelledReason?: string | null; carriedToNumber?: string | null;
}
interface PendingSettlement { id: string; bills: number; refund: number; reference?: string | null; receiptUrl?: string | null; remarks?: string | null; submittedById?: string | null }
interface BoxIou { id: string; iouNumber: string; staffName: string; amount: number; reason?: string | null; status: string; outstanding: number; createdById?: string | null; pendingSettlement: PendingSettlement | null; sentBackReason: string | null }
interface SiteOffice { id: string; name: string; type?: string }
interface Candidate { id: string; name: string; role: string; hasAccess: boolean }

const CATEGORIES = ['Subsistence', 'Staff welfare', 'Travelling and transport', 'Fuel', 'Stationery and printing', 'Telephone', 'Electricity', 'Water', 'Office expenses', 'Repair and maintenance', 'Equipment hiring', 'Parking', 'Other'];
const money = (n: number | string) => Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const field = 'w-full rounded-lg border border-slate-400 bg-white p-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-600';
const lbl = 'mb-1 block text-sm font-semibold text-slate-900';
const STATUS: Record<string, [string, string]> = {
  DRAFT: ['Waiting for approval', 'bg-slate-200 text-slate-900'], APPROVED: ['Approved, not reimbursed', 'bg-amber-100 text-amber-900'],
  REIMBURSED: ['Reimbursed', 'bg-emerald-100 text-emerald-900'], REJECTED: ['Rejected', 'bg-red-100 text-red-900'], CANCELLED: ['Cancelled', 'bg-slate-300 text-slate-900'],
};
const IOU_STATUS: Record<string, [string, string]> = {
  PENDING: ['Waiting for the Area Manager', 'bg-slate-200 text-slate-900'], APPROVED: ['Released, to be settled', 'bg-amber-100 text-amber-900'], REJECTED: ['Rejected', 'bg-red-100 text-red-900'],
};
const REFRESH_MS = 15_000;

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
  const [ious, setIous] = useState<BoxIou[]>([]);
  const [offices, setOffices] = useState<SiteOffice[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [me, setMe] = useState<{ id: string; permissions: string[] }>({ id: '', permissions: [] });
  const [dialog, setDialog] = useState<'' | 'bill' | 'box' | 'float' | 'reject' | 'cancel' | 'custodians' | 'release' | 'settle'>('');
  const [target, setTarget] = useState<{ kind: 'bill' | 'iou' | 'settlement'; id: string; label: string } | null>(null);
  const [releaseForm, setReleaseForm] = useState({ staffName: '', amount: '', reason: '', iouNumber: '' });
  const [settleIou, setSettleIou] = useState<BoxIou | null>(null);
  const [settleForm, setSettleForm] = useState({ bills: '', refund: '', reference: '', receiptUrl: '', receiptName: '', remarks: '' });
  const [billForm, setBillForm] = useState({ title: '', amount: '', category: CATEGORIES[0], recipientName: '', description: '', receiptUrl: '', receiptName: '' });
  const [uploading, setUploading] = useState(false);
  const [boxForm, setBoxForm] = useState({ siteOfficeId: '', name: '', imprestLimit: '', openingBalance: '0' });
  const [floatAmount, setFloatAmount] = useState('');
  const [newBoxOffice, setNewBoxOffice] = useState('');
  const [reason, setReason] = useState('');
  const [carried, setCarried] = useState('');
  const [people, setPeople] = useState<{ candidates: Candidate[]; chosen: string[] }>({ candidates: [], chosen: [] });
  const [peopleLoading, setPeopleLoading] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  useEffect(() => { try { const u = JSON.parse(localStorage.getItem('user') || 'null'); if (u) setMe({ id: u.id, permissions: u.permissions ?? [] }); } catch { /* not signed in */ } }, []);
  const canApprove = me.permissions.includes(RBAC_PERMISSIONS.FINANCE_APPROVE);
  const canAskHo = me.permissions.includes(RBAC_PERMISSIONS.FINANCE_HO_SUBMIT);

  const loadBoxes = useCallback(async () => {
    try {
      const res = await fetch(`/api/finance/petty-cash/accounts?summary=1&_t=${Date.now()}`);
      if (res.ok) { const list = rows<Box>(await res.json()); setBoxes(list); setBoxId((cur) => (list.some((b) => b.id === cur) ? cur : list[0]?.id ?? '')); setUpdatedAt(new Date()); }
    } catch (e) { console.error('Error loading the petty cash boxes:', e); } finally { setLoading(false); }
  }, []);
  const loadDetail = useCallback(async (id: string) => {
    if (!id) { setBills([]); setIous([]); return; }
    try {
      const [b, i] = await Promise.all([fetch(`/api/finance/petty-cash/vouchers?accountId=${id}&_t=${Date.now()}`), fetch(`/api/finance/petty-cash/ious?accountId=${id}&_t=${Date.now()}`)]);
      if (b.ok) setBills(rows<Bill>(await b.json()));
      if (i.ok) setIous(rows<BoxIou>(await i.json()));
    } catch (e) { console.error('Error loading the bills:', e); }
  }, []);
  useEffect(() => { loadBoxes(); }, [loadBoxes]);
  useEffect(() => { loadDetail(boxId); }, [boxId, loadDetail]);
  useEffect(() => { if (!canApprove) return; fetch('/api/finance/site-offices').then((r) => (r.ok ? r.json() : [])).then((j) => setOffices(rows<SiteOffice>(j))).catch(() => undefined); }, [canApprove]);

  // a site office sees what the others did without asking: the page refreshes itself, and again when the person comes back to it
  const boxIdRef = useRef(boxId); boxIdRef.current = boxId;
  const refreshing = useRef(false);
  useEffect(() => {
    // one refresh at a time: a slow answer is never overtaken by the next tick
    const tick = async () => { if (document.hidden || refreshing.current) return; refreshing.current = true; try { await Promise.all([loadBoxes(), loadDetail(boxIdRef.current)]); } finally { refreshing.current = false; } };
    const timer = window.setInterval(tick, REFRESH_MS);
    document.addEventListener('visibilitychange', tick);
    return () => { window.clearInterval(timer); document.removeEventListener('visibilitychange', tick); };
  }, [loadBoxes, loadDetail]);

  useEffect(() => { const made = boxes.find((b) => b.siteOfficeId === newBoxOffice); if (made && newBoxOffice) { setBoxId(made.id); setNewBoxOffice(''); } }, [boxes, newBoxOffice]);
  const box = boxes.find((b) => b.id === boxId);
  const refresh = async () => { await loadBoxes(); await loadDetail(boxId); };
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

  const canOperate = !!box && (box.me.isCustodian || box.me.canWrite);
  // a release at a site office is the Area Manager's; a box made before site offices keeps the finance approval
  const canDecide = (maker?: string | null) => !!box && (box.siteOfficeId ? box.me.isAreaManager : canApprove) && !(maker && maker === me.id);

  const uploadFile = async (file: File | null): Promise<string | null> => {
    if (!file) return null;
    setUploading(true);
    try {
      const fd = new FormData(); fd.append('file', file); fd.append('bucket', 'documents');
      const res = await fetch('/api/upload', { method: 'POST', body: fd });
      if (!res.ok) throw new Error(await failure(res, 'The receipt was not uploaded'));
      const j = await res.json();
      const url = j?.url ?? j?.data?.url;
      if (!url) throw new Error('The receipt was not uploaded');
      toast.success('Receipt uploaded');
      return url;
    } catch (err) { toast.error(err instanceof Error ? err.message : 'The receipt was not uploaded'); return null; } finally { setUploading(false); }
  };
  const uploadReceipt = async (file: File | null) => { const url = await uploadFile(file); if (url && file) setBillForm((f) => ({ ...f, receiptUrl: url, receiptName: file.name })); };
  const uploadSettleReceipt = async (file: File | null) => { const url = await uploadFile(file); if (url && file) setSettleForm((f) => ({ ...f, receiptUrl: url, receiptName: file.name })); };

  const addBill = (e: React.FormEvent) => { e.preventDefault(); if (!box) return; call('bill', () => post('/api/finance/petty-cash/vouchers', { accountId: box.id, title: billForm.title.trim(), amount: Number(billForm.amount), category: billForm.category, recipientName: billForm.recipientName.trim() || null, description: billForm.description.trim() || null, receiptUrl: billForm.receiptUrl || null }), 'Bill recorded. It waits for the Area Manager.', 'The bill was not saved', () => { setDialog(''); setBillForm({ title: '', amount: '', category: CATEGORIES[0], recipientName: '', description: '', receiptUrl: '', receiptName: '' }); }); };
  const approveBill = (b: Bill) => call(`a${b.id}`, () => post('/api/finance/petty-cash/vouchers', { id: b.id, action: 'APPROVE' }, 'PATCH'), 'Bill approved', 'The approval failed');
  const approveIou = (i: BoxIou) => call(`i${i.id}`, () => post('/api/finance/petty-cash/ious', { id: i.id, action: 'APPROVE' }, 'PATCH'), 'Release approved. The cash is out of the box.', 'The approval failed');
  const reject = (e: React.FormEvent) => {
    e.preventDefault(); if (!target) return;
    const t = target;
    call('reject', () => (t.kind === 'bill' ? post('/api/finance/petty-cash/vouchers', { id: t.id, action: 'REJECT', rejectionReason: reason.trim() }, 'PATCH') : t.kind === 'iou' ? post('/api/finance/petty-cash/ious', { id: t.id, action: 'REJECT', reason: reason.trim() }, 'PATCH') : post('/api/finance/petty-cash/ious/settlement', { id: t.id, action: 'REJECT', reason: reason.trim() }, 'PATCH')), t.kind === 'settlement' ? 'Settlement sent back' : 'Rejected', 'The rejection failed', () => { setDialog(''); setReason(''); });
  };
  const verifySettlement = (i: BoxIou) => i.pendingSettlement && call(`v${i.id}`, () => post('/api/finance/petty-cash/ious/settlement', { id: i.pendingSettlement!.id, action: 'VERIFY' }, 'PATCH'), 'Settlement verified. The bills and the cash returned are booked.', 'The verification failed');
  const askRelease = (e: React.FormEvent) => {
    e.preventDefault(); if (!box) return;
    call('release', () => post('/api/finance/petty-cash/ious', { accountId: box.id, staffName: releaseForm.staffName.trim(), amount: Number(releaseForm.amount), reason: releaseForm.reason.trim() || undefined, iouNumber: releaseForm.iouNumber.trim() || undefined }), 'Cash asked for. It waits for the Area Manager.', 'The request was not saved', () => { setDialog(''); setReleaseForm({ staffName: '', amount: '', reason: '', iouNumber: '' }); });
  };
  const openSettle = (i: BoxIou) => { setSettleIou(i); setSettleForm({ bills: '', refund: '', reference: '', receiptUrl: '', receiptName: '', remarks: '' }); setDialog('settle'); };
  const submitSettle = (e: React.FormEvent) => {
    e.preventDefault(); if (!settleIou) return;
    call('settle', () => post('/api/finance/petty-cash/ious/settlement', { iouId: settleIou.id, bills: Number(settleForm.bills || 0), refund: Number(settleForm.refund || 0), reference: settleForm.reference.trim() || undefined, receiptUrl: settleForm.receiptUrl || undefined, remarks: settleForm.remarks.trim() || undefined }), 'Settlement sent to the Area Manager', 'The settlement was not saved', () => setDialog(''));
  };
  const cancel = (e: React.FormEvent) => { e.preventDefault(); if (!target) return; call('cancel', () => post('/api/finance/petty-cash/vouchers/cancel', { id: target.id, reason: reason.trim(), carriedToNumber: carried.trim() || undefined }), 'Bill cancelled', 'The cancel failed', () => { setDialog(''); setReason(''); setCarried(''); }); };
  const replenish = () => box && call('rep', () => post('/api/finance/petty-cash/reimbursements', { accountId: box.id }), 'Replenishment asked of Head Office', 'The request failed');
  const createBox = (e: React.FormEvent) => { e.preventDefault(); call('box', () => post('/api/finance/petty-cash/accounts', { name: boxForm.name.trim(), siteOfficeId: boxForm.siteOfficeId, imprestLimit: Number(boxForm.imprestLimit), openingBalance: Number(boxForm.openingBalance || 0) }), 'Petty cash box created', 'The box was not created', () => { setDialog(''); setNewBoxOffice(boxForm.siteOfficeId); }); };
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
  const openCustodians = async () => {
    if (!box) return;
    setDialog('custodians'); setPeopleLoading(true); setPeople({ candidates: [], chosen: [] });
    try {
      const res = await fetch(`/api/finance/petty-cash/custodians?accountId=${box.id}`);
      if (!res.ok) throw new Error(await failure(res, 'The list was not loaded'));
      const j = await res.json(); const d = j?.data?.data ?? j?.data ?? j;
      setPeople({ candidates: d.candidates ?? [], chosen: (d.custodians ?? []).map((c: { id: string }) => c.id) });
    } catch (err) { toast.error(err instanceof Error ? err.message : 'The list was not loaded'); } finally { setPeopleLoading(false); }
  };
  const saveCustodians = (e: React.FormEvent) => { e.preventDefault(); if (!box) return; call('custodians', () => post('/api/finance/petty-cash/custodians', { accountId: box.id, userIds: people.chosen }, 'PUT'), 'Custodians saved', 'The custodians were not saved', () => setDialog('')); };

  const stat = (title: string, value: string, hint?: string, bad = false) => (
    <div className="rounded-xl border border-slate-300 bg-white p-4"><p className="text-xs font-semibold uppercase tracking-wide text-slate-800">{title}</p><p className={`mt-1 text-xl font-bold ${bad ? 'text-red-800' : 'text-slate-900'}`}>{value}</p>{hint && <p className="mt-1 text-xs text-slate-700">{hint}</p>}</div>
  );
  const officesWithout = offices.filter((o) => !boxes.some((b) => b.siteOfficeId === o.id));
  const btn = 'rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-50';
  const waitingForMe = box ? bills.filter((b) => b.status === 'DRAFT' && canDecide(b.createdById)).length + ious.filter((i) => i.status === 'PENDING' && canDecide(i.createdById)).length : 0;

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
                  <p className="text-sm text-slate-700">The cash box of a site office: the float from Head Office, cash released, bills and replenishment.{updatedAt ? ` Updated ${updatedAt.toLocaleTimeString()}, it refreshes by itself.` : ''}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {boxes.length > 1 && (
                    <select aria-label="Site office" className={`${field} w-auto`} value={boxId} onChange={(e) => setBoxId(e.target.value)}>
                      {boxes.map((b) => <option key={b.id} value={b.id}>{b.site || b.name}</option>)}
                    </select>
                  )}
                  {canApprove && <button onClick={() => { setBoxForm({ siteOfficeId: '', name: '', imprestLimit: '', openingBalance: '0' }); setDialog('box'); }} className={`${btn} border border-slate-500 bg-white text-slate-900 hover:bg-slate-100`}>New box</button>}
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
                    <p className="text-sm text-slate-900">
                      Area Manager: <strong>{box.areaManager?.name ?? 'none registered'}</strong>
                      {' · '}Custodian: <strong>{box.custodians.length ? box.custodians.map((c) => c.name).join(', ') : 'none chosen'}</strong>
                      {canApprove && box.siteOfficeId && <button onClick={openCustodians} className="ml-2 text-sm font-semibold text-indigo-800 underline">Choose custodians</button>}
                    </p>
                    {box.siteOfficeId && !box.areaManager && <p role="alert" className="rounded-lg border border-red-400 bg-red-50 p-3 text-sm font-semibold text-red-900">This site office has no Area Manager. Nothing can be released until one is registered (Administration → Users → the Area Manager → Site offices).</p>}
                    {waitingForMe > 0 && <p className="rounded-lg border border-indigo-400 bg-indigo-50 p-3 text-sm font-semibold text-slate-900">{waitingForMe} request{waitingForMe === 1 ? '' : 's'} waiting for your approval.</p>}
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                      {stat('Imprest limit', money(box.limit))}
                      {stat('Cash in hand', money(box.cashInHand), 'what is in the box now')}
                      {stat('Out on IOUs', money(box.iouOut), 'cash with people, to be settled')}
                      {stat('Bills waiting', money(box.billsWaiting), 'approved, not yet reimbursed')}
                      {stat('Not accounted', money(box.unaccounted), box.unaccounted === 0 ? 'the imprest adds up' : box.unaccounted > 0 ? 'the float can still be filled up to this' : 'more has gone out than the limit: check it', box.unaccounted < 0)}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {canOperate && <button onClick={() => setDialog('release')} className={`${btn} bg-indigo-700 text-white hover:bg-indigo-800`}>Release cash to a person</button>}
                      {canOperate && <button onClick={() => setDialog('bill')} className={`${btn} border border-slate-500 bg-white text-slate-900 hover:bg-slate-100`}>+ Add a bill</button>}
                      {canAskHo && box.floatRoom > 0 && <button onClick={() => { setFloatAmount(String(box.floatRoom)); setDialog('float'); }} className={`${btn} border border-slate-500 bg-white text-slate-900 hover:bg-slate-100`}>Ask Head Office for the float</button>}
                      {canOperate && box.billsWaiting > 0 && !box.pendingReimbursement && <button onClick={replenish} disabled={!!busy} className={`${btn} border border-slate-500 bg-white text-slate-900 hover:bg-slate-100`}>{busy === 'rep' ? 'Sending...' : `Ask Head Office to replenish ${money(box.replenishAmount)}`}</button>}
                    </div>
                    {box.floatPending > 0 && <p className="rounded-lg border border-amber-400 bg-amber-50 p-3 text-sm font-medium text-slate-900">A float of {money(box.floatPending)} is with Head Office.</p>}
                    {box.pendingReimbursement && <p className="rounded-lg border border-amber-400 bg-amber-50 p-3 text-sm font-medium text-slate-900">Replenishment {box.pendingReimbursement.reimbursementNumber} of {money(box.pendingReimbursement.totalAmount)} is with Head Office.</p>}
                  </section>

                  <section aria-label="Cash released" className="overflow-hidden rounded-xl border border-slate-300 bg-white">
                    <h2 className="border-b border-slate-300 bg-slate-100 p-3 text-sm font-bold text-slate-900">Cash released to people (IOUs)</h2>
                    <div className="overflow-x-auto">
                      <table className="w-full whitespace-nowrap text-left text-sm">
                        <thead className="border-b border-slate-300 bg-slate-100"><tr>{['IOU', 'Person', 'Amount (LKR)', 'Still out', 'Status', 'Actions'].map((h) => <th key={h} className="p-3 text-xs font-bold uppercase tracking-wide text-slate-900">{h}</th>)}</tr></thead>
                        <tbody className="divide-y divide-slate-200">
                          {ious.length === 0 ? <tr><td colSpan={6} className="p-4 text-center text-slate-800">No cash has been asked for</td></tr> : ious.map((i) => {
                            const [text, cls] = (i.status === 'APPROVED' && i.outstanding <= 0 ? ['Settled', 'bg-emerald-100 text-emerald-900'] : IOU_STATUS[i.status]) ?? [i.status, 'bg-slate-200 text-slate-900'];
                            return (
                              <tr key={i.id}>
                                <td className="p-3 font-semibold text-slate-900">{i.iouNumber}</td>
                                <td className="p-3 text-slate-900">{i.staffName}</td>
                                <td className="p-3 font-semibold text-slate-900">{money(i.amount)}</td>
                                <td className="p-3 text-slate-900">{i.status === 'APPROVED' ? money(i.outstanding) : '-'}</td>
                                <td className="p-3"><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${cls}`}>{text}</span></td>
                                <td className="space-x-2 p-3">
                                  {i.status === 'PENDING' && canDecide(i.createdById) && <>
                                    <button onClick={() => approveIou(i)} disabled={!!busy} className="rounded bg-indigo-700 px-3 py-1 text-xs font-semibold text-white hover:bg-indigo-800 disabled:opacity-50">{busy === `i${i.id}` ? 'Approving...' : 'Approve'}</button>
                                    <button onClick={() => { setTarget({ kind: 'iou', id: i.id, label: `IOU ${i.iouNumber}` }); setReason(''); setDialog('reject'); }} className="rounded border border-slate-600 bg-white px-3 py-1 text-xs font-semibold text-slate-900 hover:bg-slate-100">Reject</button>
                                  </>}
                                  {i.status === 'PENDING' && !canDecide(i.createdById) && <span className="text-xs text-slate-800">Waiting for the Area Manager</span>}
                                  {i.status === 'APPROVED' && i.outstanding > 0 && !i.pendingSettlement && canOperate && <button onClick={() => openSettle(i)} className="rounded border border-slate-600 bg-white px-3 py-1 text-xs font-semibold text-slate-900 hover:bg-slate-100">Settle</button>}
                                  {i.pendingSettlement && (
                                    <span className="inline-flex flex-wrap items-center gap-2">
                                      <span className="text-xs font-semibold text-slate-900">Settlement waiting: bills {money(i.pendingSettlement.bills)}, returned {money(i.pendingSettlement.refund)}{i.pendingSettlement.receiptUrl ? <> · <a href={i.pendingSettlement.receiptUrl} target="_blank" rel="noopener noreferrer" className="text-indigo-800 underline">receipt</a></> : null}</span>
                                      {canDecide(i.pendingSettlement.submittedById) ? <>
                                        <button onClick={() => verifySettlement(i)} disabled={!!busy} className="rounded bg-indigo-700 px-3 py-1 text-xs font-semibold text-white hover:bg-indigo-800 disabled:opacity-50">{busy === `v${i.id}` ? 'Verifying...' : 'Verify'}</button>
                                        <button onClick={() => { setTarget({ kind: 'settlement', id: i.pendingSettlement!.id, label: `the settlement of IOU ${i.iouNumber}` }); setReason(''); setDialog('reject'); }} className="rounded border border-slate-600 bg-white px-3 py-1 text-xs font-semibold text-slate-900 hover:bg-slate-100">Send back</button>
                                      </> : <span className="text-xs text-slate-800">Waiting for the Area Manager</span>}
                                    </span>
                                  )}
                                  {i.sentBackReason && !i.pendingSettlement && <span className="block whitespace-normal text-xs font-semibold text-red-800">Settlement sent back: {i.sentBackReason}</span>}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </section>

                  <section aria-label="Bills" className="overflow-hidden rounded-xl border border-slate-300 bg-white">
                    <h2 className="border-b border-slate-300 bg-slate-100 p-3 text-sm font-bold text-slate-900">Bills</h2>
                    <div className="overflow-x-auto">
                      <table className="w-full whitespace-nowrap text-left text-sm">
                        <thead className="border-b border-slate-300 bg-slate-100"><tr>{['Bill', 'Date', 'Title', 'Category', 'Amount (LKR)', 'Receipt', 'Status', 'Actions'].map((h) => <th key={h} className="p-3 text-xs font-bold uppercase tracking-wide text-slate-900">{h}</th>)}</tr></thead>
                        <tbody className="divide-y divide-slate-200">
                          {bills.length === 0 ? <tr><td colSpan={8} className="p-4 text-center text-slate-800">No bills yet</td></tr> : bills.map((b) => {
                            const [text, cls] = STATUS[b.status] ?? [b.status, 'bg-slate-200 text-slate-900'];
                            return (
                              <tr key={b.id}>
                                <td className="p-3 font-semibold text-slate-900">{b.voucherNumber}</td>
                                <td className="p-3 text-slate-900">{new Date(b.date).toLocaleDateString()}</td>
                                <td className="max-w-xs truncate p-3 text-slate-900" title={b.title}>{b.title}{b.iouId ? <span className="ml-2 rounded bg-sky-100 px-1.5 py-0.5 text-xs font-semibold text-sky-900">IOU</span> : null}</td>
                                <td className="p-3 text-slate-900">{b.category}</td>
                                <td className="p-3 font-semibold text-slate-900">{money(b.amount)}</td>
                                <td className="p-3">{b.receiptUrl ? <a href={b.receiptUrl} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-indigo-800 underline">Open</a> : <span className="text-slate-700">-</span>}</td>
                                <td className="p-3"><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${cls}`}>{text}</span>{b.status === 'CANCELLED' && <p className="mt-1 whitespace-normal text-xs text-slate-800">{b.cancelledReason}{b.carriedToNumber ? `${/[.!?]$/.test(b.cancelledReason ?? '') ? '' : '.'} Carried to ${b.carriedToNumber}.` : ''}</p>}{b.status === 'REJECTED' && b.rejectionReason && <p className="mt-1 whitespace-normal text-xs text-slate-800">{b.rejectionReason}</p>}</td>
                                <td className="space-x-2 p-3">
                                  {b.status === 'DRAFT' && canDecide(b.createdById) && <><button onClick={() => approveBill(b)} disabled={!!busy} className="rounded bg-indigo-700 px-3 py-1 text-xs font-semibold text-white hover:bg-indigo-800 disabled:opacity-50">{busy === `a${b.id}` ? 'Approving...' : 'Approve'}</button><button onClick={() => { setTarget({ kind: 'bill', id: b.id, label: `bill ${b.voucherNumber}` }); setReason(''); setDialog('reject'); }} className="rounded border border-slate-600 bg-white px-3 py-1 text-xs font-semibold text-slate-900 hover:bg-slate-100">Reject</button></>}
                                  {b.status === 'DRAFT' && !canDecide(b.createdById) && <span className="text-xs text-slate-800">Waiting for the Area Manager</span>}
                                  {b.status === 'DRAFT' && canOperate && <button onClick={() => { setTarget({ kind: 'bill', id: b.id, label: `bill ${b.voucherNumber}` }); setReason(''); setCarried(''); setDialog('cancel'); }} className="text-xs font-semibold text-red-800 underline">Cancel</button>}
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
            <div>
              <label className={lbl}>Receipt (photo or PDF)</label>
              <input type="file" accept="image/*,.pdf" className={field} onChange={(e) => uploadReceipt(e.target.files?.[0] ?? null)} />
              {uploading && <p className="mt-1 text-xs font-medium text-slate-800">Uploading...</p>}
              {billForm.receiptUrl && !uploading && <p className="mt-1 text-xs font-semibold text-emerald-900">Attached: {billForm.receiptName}</p>}
            </div>
            <div><label className={lbl}>Notes</label><textarea rows={2} className={field} value={billForm.description} onChange={(e) => setBillForm({ ...billForm, description: e.target.value })} /></div>
            <div className="flex justify-end gap-2 border-t border-slate-200 pt-3"><button type="button" onClick={() => setDialog('')} className={`${btn} text-slate-900 hover:bg-slate-100`}>Cancel</button><button type="submit" disabled={!!busy || uploading} className={`${btn} bg-indigo-700 text-white hover:bg-indigo-800`}>{busy === 'bill' ? 'Saving...' : 'Record bill'}</button></div>
          </form>
        </div>
      )}

      {dialog === 'box' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-label="New petty cash box">
          <form onSubmit={createBox} className="w-full max-w-md space-y-3 rounded-xl bg-white p-6 shadow-xl">
            <h2 className="text-xl font-bold text-slate-900">New petty cash box</h2>
            <p className="text-xs text-slate-700">One box for each site office. It starts with what is really in it (0 when Head Office will fund the float).</p>
            <div><label className={lbl}>Site office</label><select required className={field} value={boxForm.siteOfficeId} onChange={(e) => setBoxForm({ ...boxForm, siteOfficeId: e.target.value })}><option value="">Choose...</option>{officesWithout.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select></div>
            <div><label className={lbl}>Name</label><input required className={field} value={boxForm.name} onChange={(e) => setBoxForm({ ...boxForm, name: e.target.value })} placeholder="e.g. Kaduwela petty cash" /></div>
            <div><label className={lbl}>Imprest limit (LKR)</label><input required type="number" min="1" step="0.01" className={field} value={boxForm.imprestLimit} onChange={(e) => setBoxForm({ ...boxForm, imprestLimit: e.target.value })} /></div>
            <div><label className={lbl}>Cash in the box now (LKR)</label><input required type="number" min="0" step="0.01" className={field} value={boxForm.openingBalance} onChange={(e) => setBoxForm({ ...boxForm, openingBalance: e.target.value })} /></div>
            <div className="flex justify-end gap-2 border-t border-slate-200 pt-3"><button type="button" onClick={() => setDialog('')} className={`${btn} text-slate-900 hover:bg-slate-100`}>Cancel</button><button type="submit" disabled={!!busy} className={`${btn} bg-indigo-700 text-white hover:bg-indigo-800`}>{busy === 'box' ? 'Saving...' : 'Create box'}</button></div>
          </form>
        </div>
      )}

      {dialog === 'release' && box && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-label="Release cash">
          <form onSubmit={askRelease} className="w-full max-w-md space-y-3 rounded-xl bg-white p-6 shadow-xl">
            <h2 className="text-xl font-bold text-slate-900">Release cash to a person</h2>
            <p className="text-xs text-slate-700">The Area Manager of the site office approves it; then the cash leaves the box ({money(box.cashInHand)} in hand). The person settles it later with bills and the cash they return.</p>
            <div><label className={lbl}>Person</label><input required className={field} value={releaseForm.staffName} onChange={(e) => setReleaseForm({ ...releaseForm, staffName: e.target.value })} placeholder="e.g. Nuwan Perera" /></div>
            <div><label className={lbl}>Amount (LKR)</label><input required type="number" min="0.01" step="0.01" className={field} value={releaseForm.amount} onChange={(e) => setReleaseForm({ ...releaseForm, amount: e.target.value })} /></div>
            <div><label className={lbl}>What it is for</label><textarea required rows={2} className={field} value={releaseForm.reason} onChange={(e) => setReleaseForm({ ...releaseForm, reason: e.target.value })} /></div>
            <div><label className={lbl}>IOU number (if you have one)</label><input className={field} value={releaseForm.iouNumber} onChange={(e) => setReleaseForm({ ...releaseForm, iouNumber: e.target.value })} placeholder="left empty, the system numbers it" /></div>
            <div className="flex justify-end gap-2 border-t border-slate-200 pt-3"><button type="button" onClick={() => setDialog('')} className={`${btn} text-slate-900 hover:bg-slate-100`}>Cancel</button><button type="submit" disabled={!!busy} className={`${btn} bg-indigo-700 text-white hover:bg-indigo-800`}>{busy === 'release' ? 'Sending...' : 'Ask for the cash'}</button></div>
          </form>
        </div>
      )}

      {dialog === 'settle' && settleIou && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-label="Settle the IOU">
          <form onSubmit={submitSettle} className="max-h-[90vh] w-full max-w-md space-y-3 overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
            <h2 className="text-xl font-bold text-slate-900">Settle {settleIou.iouNumber}, {settleIou.staffName}</h2>
            <p className="text-sm text-slate-900">Given {money(settleIou.amount)}. Still to settle <strong>{money(settleIou.outstanding)}</strong>.</p>
            <p className="text-xs text-slate-700">Enter the bills the person handed in and the cash they returned. Together they cannot be more than what is to settle. If more was spent than was given, record the extra as a separate bill. The Area Manager verifies the settlement before it is booked.</p>
            <div><label className={lbl}>Bills handed in (LKR)</label><input type="number" min="0" step="0.01" className={field} value={settleForm.bills} onChange={(e) => { const b = e.target.value; setSettleForm({ ...settleForm, bills: b, refund: String(Math.max(0, Math.round((settleIou.outstanding - Number(b || 0)) * 100) / 100)) }); }} /></div>
            <div><label className={lbl}>Cash returned (LKR)</label><input type="number" min="0" step="0.01" className={field} value={settleForm.refund} onChange={(e) => setSettleForm({ ...settleForm, refund: e.target.value })} /></div>
            <div><label className={lbl}>Bill number</label><input className={field} value={settleForm.reference} onChange={(e) => setSettleForm({ ...settleForm, reference: e.target.value })} /></div>
            <div>
              <label className={lbl}>Receipt (photo or PDF)</label>
              <input type="file" accept="image/*,.pdf" className={field} onChange={(e) => uploadSettleReceipt(e.target.files?.[0] ?? null)} />
              {uploading && <p className="mt-1 text-xs font-medium text-slate-800">Uploading...</p>}
              {settleForm.receiptUrl && !uploading && <p className="mt-1 text-xs font-semibold text-emerald-900">Attached: {settleForm.receiptName}</p>}
            </div>
            <div><label className={lbl}>Remarks</label><textarea rows={2} className={field} value={settleForm.remarks} onChange={(e) => setSettleForm({ ...settleForm, remarks: e.target.value })} /></div>
            <div className="flex justify-end gap-2 border-t border-slate-200 pt-3"><button type="button" onClick={() => setDialog('')} className={`${btn} text-slate-900 hover:bg-slate-100`}>Cancel</button><button type="submit" disabled={!!busy || uploading} className={`${btn} bg-indigo-700 text-white hover:bg-indigo-800`}>{busy === 'settle' ? 'Sending...' : 'Send to the Area Manager'}</button></div>
          </form>
        </div>
      )}

      {dialog === 'custodians' && box && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-label="Custodians">
          <form onSubmit={saveCustodians} className="max-h-[90vh] w-full max-w-md space-y-3 overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
            <h2 className="text-xl font-bold text-slate-900">Who looks after the petty cash of {box.site || box.name}</h2>
            <p className="text-xs text-slate-700">Choose from the people who work at this site office. A custodian records bills and asks for replenishment, only for this box. Someone whose role has no petty cash access cannot be chosen: give the role the capability petty-cash.site first.</p>
            {peopleLoading ? <p className="rounded-lg border border-slate-300 bg-slate-50 p-3 text-sm font-medium text-slate-900">Loading the people of this site office...</p> : people.candidates.length === 0 ? <p className="rounded-lg border border-slate-300 bg-slate-50 p-3 text-sm font-medium text-slate-900">No user is registered at this site office. Register the person with this site office as their store.</p> : (
              <ul className="space-y-2">
                {people.candidates.map((c) => (
                  <li key={c.id}>
                    <label className={`flex items-center gap-2 text-sm font-semibold ${c.hasAccess ? 'cursor-pointer text-slate-900' : 'text-slate-600'}`}>
                      <input type="checkbox" disabled={!c.hasAccess} checked={people.chosen.includes(c.id)} onChange={(e) => setPeople((p) => ({ ...p, chosen: e.target.checked ? [...p.chosen, c.id] : p.chosen.filter((x) => x !== c.id) }))} />
                      {c.name} <span className="text-xs font-medium text-slate-700">({c.role.replace(/_/g, ' ').toLowerCase()}{c.hasAccess ? '' : ', no petty cash access'})</span>
                    </label>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex justify-end gap-2 border-t border-slate-200 pt-3"><button type="button" onClick={() => setDialog('')} className={`${btn} text-slate-900 hover:bg-slate-100`}>Cancel</button><button type="submit" disabled={!!busy} className={`${btn} bg-indigo-700 text-white hover:bg-indigo-800`}>{busy === 'custodians' ? 'Saving...' : 'Save custodians'}</button></div>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-label={dialog === 'reject' ? 'Reject the request' : 'Cancel the bill'}>
          <form onSubmit={dialog === 'reject' ? reject : cancel} className="w-full max-w-md space-y-3 rounded-xl bg-white p-6 shadow-xl">
            <h2 className="text-xl font-bold text-slate-900">{dialog === 'reject' ? 'Reject' : 'Cancel'} {target.label}</h2>
            <div><label className={lbl}>Reason</label><textarea required minLength={3} rows={3} className={field} value={reason} onChange={(e) => setReason(e.target.value)} /></div>
            {dialog === 'cancel' && <div><label className={lbl}>Carried to bill number (if any)</label><input className={field} value={carried} onChange={(e) => setCarried(e.target.value)} /></div>}
            <div className="flex justify-end gap-2 border-t border-slate-200 pt-3"><button type="button" onClick={() => setDialog('')} className={`${btn} text-slate-900 hover:bg-slate-100`}>Back</button><button type="submit" disabled={!!busy} className={`${btn} bg-red-800 text-white hover:bg-red-900`}>{busy === 'reject' || busy === 'cancel' ? 'Saving...' : dialog === 'reject' ? 'Reject' : 'Cancel the bill'}</button></div>
          </form>
        </div>
      )}
    </RoleGuard>
  );
}
