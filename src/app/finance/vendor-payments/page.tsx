"use client";

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import RoleGuard from '@/components/RoleGuard';
import ExportCsvButton from '@/components/ExportCsvButton';
import { Loader2, Banknote } from 'lucide-react';
import { Panel, compact } from '@/app/dashboard/components/health/HealthCharts';

interface Invoice { id: string; invoiceNumber: string; status: string; totalAmount: number | string; paidAmount: number | string; dueDate: string | null; vendor: { name: string; code: string } }
interface Bank { id: string; bankName: string; accountNumber: string; glAccountCode: string }
interface Voucher { id: string; pvNumber: string; status: string; amount: number | string; taxWithheld: number | string; payeeName: string; supplierInvoiceId: string | null; createdAt: string }

const th = 'py-2 pr-3 text-left text-slate-900';
const TONE: Record<string, string> = { DRAFT: 'bg-slate-100 text-slate-900', PENDING_APPROVAL: 'bg-amber-100 text-amber-900', APPROVED: 'bg-blue-100 text-blue-900', PAID: 'bg-emerald-100 text-emerald-900', REJECTED: 'bg-red-100 text-red-900', CANCELLED: 'bg-red-100 text-red-900' };

async function api<T>(url: string, init?: RequestInit): Promise<T> {
    const res = await fetch(url, { cache: 'no-store', ...init, headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) } });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json?.error?.message || (typeof json?.error === 'string' ? json.error : '') || 'Request failed');
    return (json.data ?? json) as T;
}

function Inner() {
    const qc = useQueryClient();
    const preselect = useSearchParams().get('invoice') ?? '';
    const [invoiceId, setInvoiceId] = useState(preselect);
    const [amount, setAmount] = useState('');
    const [wht, setWht] = useState('0');
    const [bankId, setBankId] = useState('');

    const invoices = useQuery<Invoice[]>({ queryKey: ['vp-invoices'], queryFn: async () => (await api<Invoice[]>('/api/procurement/invoices')).filter((i) => ['APPROVED', 'PARTIALLY_PAID'].includes(i.status)), staleTime: 15_000 });
    const banks = useQuery<Bank[]>({ queryKey: ['vp-banks'], queryFn: async () => { const r = await api<{ accounts: Bank[] }>('/api/finance/bank/reconciliation'); return r.accounts ?? []; }, staleTime: 300_000 });
    const vouchers = useQuery<Voucher[]>({ queryKey: ['vp-vouchers'], queryFn: async () => { const r = await api<Voucher[] | { data: Voucher[] }>('/api/finance/payment-vouchers?type=VENDOR'); return Array.isArray(r) ? r : (r as { data: Voucher[] }).data ?? []; }, staleTime: 10_000 });

    const [bankForm, setBankForm] = useState({ bankName: '', accountNumber: '', glAccountCode: 'BANK-1000' });
    const addBank = useMutation({
        mutationFn: () => api('/api/finance/bank/accounts', { method: 'POST', body: JSON.stringify(bankForm) }),
        onSuccess: () => { toast.success('Bank account added'); qc.invalidateQueries({ queryKey: ['vp-banks'] }); },
        onError: (e: Error) => toast.error(e.message),
    });

    const selected = (invoices.data ?? []).find((i) => i.id === invoiceId);
    const outstanding = selected ? Number(selected.totalAmount) - Number(selected.paidAmount) : 0;
    const refresh = () => { qc.invalidateQueries({ queryKey: ['vp-vouchers'] }); qc.invalidateQueries({ queryKey: ['vp-invoices'] }); };

    const create = useMutation({
        mutationFn: () => api('/api/finance/payment-vouchers', {
            method: 'POST',
            body: JSON.stringify({ supplierInvoiceId: invoiceId, bankAccountId: bankId, title: `Payment of ${selected?.invoiceNumber}`, payeeName: selected?.vendor.name ?? 'Vendor', amount: Number(amount || outstanding), taxWithheld: Number(wht) || 0, paymentMethod: 'BANK_TRANSFER' }),
        }),
        onSuccess: () => { toast.success('Payment voucher created'); setAmount(''); setWht('0'); refresh(); },
        onError: (e: Error) => toast.error(e.message),
    });
    const move = useMutation({
        mutationFn: ({ id, status }: { id: string; status: string }) => api(`/api/finance/payment-vouchers/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status, ...(status === 'CANCELLED' ? { cancelledReason: 'Cancelled by user' } : {}), ...(status === 'REJECTED' ? { rejectionReason: 'Rejected by approver' } : {}) }) }),
        onSuccess: () => { toast.success('Updated'); refresh(); },
        onError: (e: Error) => toast.error(e.message),
    });

    const rows = vouchers.data ?? [];
    const exportRows = () => [['Voucher', 'Payee', 'Amount', 'Withholding tax', 'Status'], ...rows.map((v) => [v.pvNumber, v.payeeName, Number(v.amount), Number(v.taxWithheld), v.status])];
    const next: Record<string, { label: string; status: string }[]> = {
        DRAFT: [{ label: 'Submit', status: 'PENDING_APPROVAL' }, { label: 'Cancel', status: 'CANCELLED' }],
        PENDING_APPROVAL: [{ label: 'Approve', status: 'APPROVED' }, { label: 'Reject', status: 'REJECTED' }],
        APPROVED: [{ label: 'Pay', status: 'PAID' }, { label: 'Cancel', status: 'CANCELLED' }],
    };

    return (
        <RoleGuard>
            <div className="flex h-screen bg-slate-50 overflow-hidden">
                <Sidebar />
                <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                    <Header />
                    <main className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2"><Banknote className="w-7 h-7 text-indigo-600" />Vendor payments</h1>
                            <ExportCsvButton filename="vendor-payments.csv" disabled={rows.length === 0} getRows={exportRows} />
                        </div>

                        <Panel title="Approved invoices to pay">
                            {invoices.isLoading && <Loader2 className="h-5 w-5 animate-spin text-blue-600" />}
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead><tr className="border-b border-slate-300"><th className={th}>Vendor</th><th className={th}>Invoice</th><th className={`${th} text-right`}>Total</th><th className={`${th} text-right`}>Paid</th><th className={`${th} text-right`}>Due</th><th className={th}>Status</th><th /></tr></thead>
                                    <tbody>
                                        {(invoices.data ?? []).length === 0 && !invoices.isLoading && <tr><td colSpan={7} className="py-3 text-slate-700">No approved invoices waiting for payment.</td></tr>}
                                        {(invoices.data ?? []).map((i) => (
                                            <tr key={i.id} className={`border-b border-slate-200 text-slate-900 ${i.id === invoiceId ? 'bg-indigo-50' : ''}`} data-testid="vp-invoice">
                                                <td className="py-2 pr-3 font-medium">{i.vendor.name}</td><td className="py-2 pr-3">{i.invoiceNumber}</td>
                                                <td className="py-2 pr-3 text-right">{compact(Number(i.totalAmount))}</td><td className="py-2 pr-3 text-right">{compact(Number(i.paidAmount))}</td>
                                                <td className={`py-2 pr-3 text-right ${i.dueDate && new Date(i.dueDate) < new Date() ? 'font-bold text-red-700' : ''}`}>{i.dueDate ? i.dueDate.slice(0, 10) : '—'}</td>
                                                <td className="py-2 pr-3">{i.status.replace('_', ' ')}</td>
                                                <td className="py-2 text-right"><button data-testid="vp-select" onClick={() => { setInvoiceId(i.id); setAmount(''); }} className="rounded border border-indigo-300 bg-indigo-50 px-2 py-0.5 text-xs font-bold text-indigo-900 hover:bg-indigo-100">Pay</button></td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </Panel>

                        {banks.isSuccess && (banks.data ?? []).length === 0 && (
                            <Panel title="No bank account is set up">
                                <p className="text-sm text-slate-900">Vendor payments are made from a bank account. Add the account the payments are paid from (it posts to the ledger account shown).</p>
                                <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-4">
                                    <label className="text-xs font-semibold text-slate-900">Bank
                                        <input data-testid="ba-bank" value={bankForm.bankName} onChange={(e) => setBankForm({ ...bankForm, bankName: e.target.value })} className="mt-1 block w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900" />
                                    </label>
                                    <label className="text-xs font-semibold text-slate-900">Account number
                                        <input data-testid="ba-number" value={bankForm.accountNumber} onChange={(e) => setBankForm({ ...bankForm, accountNumber: e.target.value })} className="mt-1 block w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900" />
                                    </label>
                                    <label className="text-xs font-semibold text-slate-900">Ledger account
                                        <input data-testid="ba-gl" value={bankForm.glAccountCode} onChange={(e) => setBankForm({ ...bankForm, glAccountCode: e.target.value })} className="mt-1 block w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900" />
                                    </label>
                                    <div className="flex items-end"><button data-testid="ba-save" disabled={addBank.isPending || !bankForm.bankName || !bankForm.accountNumber} onClick={() => addBank.mutate()} className="rounded-md bg-indigo-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Add bank account</button></div>
                                </div>
                            </Panel>
                        )}

                        {selected && (
                            <Panel title={`New payment voucher: ${selected.vendor.name} · ${selected.invoiceNumber} (outstanding ${outstanding.toLocaleString()})`}>
                                <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                                    <label className="text-xs font-semibold text-slate-900">Amount (gross)
                                        <input data-testid="vp-amount" type="number" value={amount} placeholder={String(outstanding)} onChange={(e) => setAmount(e.target.value)} className="mt-1 block w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900" />
                                    </label>
                                    <label className="text-xs font-semibold text-slate-900">Withholding tax
                                        <input data-testid="vp-wht" type="number" value={wht} onChange={(e) => setWht(e.target.value)} className="mt-1 block w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900" />
                                    </label>
                                    <label className="text-xs font-semibold text-slate-900 md:col-span-2">Pay from bank account
                                        <select data-testid="vp-bank" value={bankId} onChange={(e) => setBankId(e.target.value)} className="mt-1 block w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900">
                                            <option value="">Choose…</option>
                                            {(banks.data ?? []).map((b) => <option key={b.id} value={b.id}>{b.bankName} · {b.accountNumber}</option>)}
                                        </select>
                                    </label>
                                </div>
                                <button data-testid="vp-create" disabled={create.isPending || !bankId} onClick={() => create.mutate()} className="mt-3 rounded-md bg-indigo-700 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-800 disabled:opacity-50">Create payment voucher</button>
                            </Panel>
                        )}

                        <Panel title={`Vendor payment vouchers (${rows.length})`}>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead><tr className="border-b border-slate-300"><th className={th}>Voucher</th><th className={th}>Vendor</th><th className={`${th} text-right`}>Amount</th><th className={`${th} text-right`}>WHT</th><th className={th}>Status</th><th className={`${th} text-right`}>Actions</th></tr></thead>
                                    <tbody>
                                        {rows.length === 0 && <tr><td colSpan={6} className="py-3 text-slate-700">No vendor payment vouchers yet.</td></tr>}
                                        {rows.map((v) => (
                                            <tr key={v.id} className="border-b border-slate-200 text-slate-900" data-testid="vp-voucher">
                                                <td className="py-2 pr-3 font-medium">{v.pvNumber}</td><td className="py-2 pr-3">{v.payeeName}</td>
                                                <td className="py-2 pr-3 text-right">{Number(v.amount).toLocaleString()}</td><td className="py-2 pr-3 text-right">{Number(v.taxWithheld).toLocaleString()}</td>
                                                <td className="py-2 pr-3"><span className={`rounded px-2 py-0.5 font-semibold ${TONE[v.status] ?? ''}`} data-testid="vp-status">{v.status.replace('_', ' ')}</span></td>
                                                <td className="py-2 text-right whitespace-nowrap">
                                                    {(next[v.status] ?? []).map((a) => <button key={a.status} data-testid={`vp-${a.label.toLowerCase()}`} onClick={() => move.mutate({ id: v.id, status: a.status })} disabled={move.isPending} className="ml-1.5 rounded border border-slate-300 bg-white px-2 py-0.5 text-xs font-bold text-slate-900 hover:bg-slate-100 disabled:opacity-50">{a.label}</button>)}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </Panel>
                    </main>
                </div>
            </div>
        </RoleGuard>
    );
}

export default function VendorPaymentsPage() {
    return <Suspense fallback={null}><Inner /></Suspense>;
}
