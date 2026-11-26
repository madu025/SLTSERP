"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

interface Dossier {
    po: {
        id: string; poNumber: string; status: string; approvalStage: string | null; vendor: string; currency: string;
        subtotal: number; taxAmount: number; totalAmount: number; orderDate: string; expectedDelivery: string | null; requestNr: string | null;
        ho: { approvalRef: string; approvalDate: string | null; approvedBy: string | null; documentUrl: string | null } | null;
        hoPayment: { invoiceRef: string | null; paymentRef: string; paidAt: string | null; cleared: number } | null;
        values: { orderedGoods: number; tax: number; receivedValue: number; stillToReceive: number };
        createdBy: string | null; approvedBy: string | null; approvedAt: string | null; cancelledBy: string | null; cancelledAt: string | null; cancellationReason: string | null;
        lines: { code: string | null; name: string | null; unit: string | null; quantity: number; receivedQty: number; unitPrice: number; taxAmount: number; totalAmount: number }[];
    };
    approvals: { seq: number; stage: string | null; stageLabel: string | null; action: string; actor: string | null; amount: number; remarks: string | null; at: string; hash: string }[];
    chain: { entries: number; intact: boolean; firstBrokenSeq: number | null };
    receipts: { grnNumber: string; at: string; receivedBy: string | null }[];
    invoices: { id: string; invoiceNumber: string; total: number; status: string; match: string; enteredBy: string | null; financeApprovedBy: string | null; financeApprovedAt: string | null; approvedBy: string | null; approvedAt: string | null; overrideReason: string | null; rejectionReason: string | null }[];
    auditTrail: { at: string; action: string; entity: string; by: string | null; detail: unknown }[];
}

const money = (n: number, c = "LKR") => `${c} ${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const when = (d: string | null) => (d ? new Date(d).toLocaleString() : "-");

const ACTION_LABEL: Record<string, string> = { SUBMITTED: "Sent for approval", APPROVED: "Approved", RETURNED: "Returned with remarks", RESET: "Sent back to step 1 after a change", CANCELLED: "Cancelled", RECORDED: "Recorded as approved in the HO system", HO_PAYMENT: "HO payment recorded" };

/** One purchase order with its whole history: approval steps with remarks, receipts, supplier invoices and the audit trail. Printable for audit. */
export default function PurchaseOrderDossierPage() {
    const { id } = useParams<{ id: string }>();
    const { data, isLoading, error } = useQuery<Dossier>({
        queryKey: ["po-dossier", id],
        queryFn: async () => {
            const res = await fetch(`/api/procurement/purchase-orders/${id}/dossier`);
            const json = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(json?.error?.message || "Could not load the purchase order");
            return json.data ?? json;
        },
    });

    // HO payment: recorded here as well, because a fully received order no longer shows on the Order Processing tabs
    const queryClient = useQueryClient();
    const [payRef, setPayRef] = useState("");
    const [invRef, setInvRef] = useState("");
    const [paidAt, setPaidAt] = useState(() => new Date().toISOString().slice(0, 10));
    const recordPayment = useMutation({
        mutationFn: async () => {
            const res = await fetch("/api/procurement/purchase-orders", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "RECORD_HO_PAYMENT", poId: id, paymentRef: payRef.trim(), invoiceRef: invRef.trim() || undefined, paidAt }),
            });
            const json = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(json?.error?.message || "The HO payment could not be recorded");
            return json;
        },
        onSuccess: () => { toast.success("HO payment recorded"); setPayRef(""); setInvRef(""); queryClient.invalidateQueries({ queryKey: ["po-dossier", id] }); },
        onError: (e: Error) => toast.error(e.message),
    });

    if (isLoading) return <div className="p-6 text-slate-900">Loading purchase order…</div>;
    if (error || !data) return <div className="p-6 text-red-800">{(error as Error)?.message || "Could not load the purchase order"}</div>;
    const { po, approvals, chain, receipts, invoices, auditTrail } = data;
    const card = "rounded-xl border border-slate-300 bg-white p-4 text-slate-900 shadow-sm";
    const th = "px-2 py-1 text-left text-[11px] font-bold uppercase tracking-wide !bg-slate-100 !text-slate-800";
    const td = "px-2 py-1 text-xs text-slate-900";

    return (
        <div className="mx-auto max-w-5xl space-y-4 p-4 sm:p-6" data-testid="po-dossier-page">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                    <h1 className="text-xl font-black text-slate-900">{po.poNumber}</h1>
                    <p className="text-xs font-semibold text-slate-700">Vendor {po.vendor} · Request {po.requestNr ?? "-"} · Raised by {po.createdBy ?? "not recorded (older order)"}</p>
                </div>
                <div className="flex items-center gap-2">
                    <span data-testid="dossier-status" className="rounded bg-slate-200 px-2 py-0.5 text-xs font-bold text-slate-900">{po.status.replace(/_/g, " ")}</span>
                    <button type="button" onClick={() => window.print()} className="rounded-md border border-slate-400 bg-white px-3 py-1 text-xs font-bold text-slate-900 hover:bg-slate-100 print:hidden">Print</button>
                </div>
            </div>

            {po.ho && (
                <section className={card} data-testid="dossier-ho">
                    <h2 className="mb-2 text-sm font-black text-slate-900">HO approval</h2>
                    <p className="text-xs text-slate-900">Reference <b>{po.ho.approvalRef}</b> · dated {po.ho.approvalDate ? new Date(po.ho.approvalDate).toLocaleDateString() : "-"} · approved by {po.ho.approvedBy ?? "-"}</p>
                    {po.ho.documentUrl && <a href={po.ho.documentUrl} target="_blank" rel="noreferrer" data-testid="dossier-ho-doc" className="mt-1 inline-block text-xs font-bold text-blue-800 underline">Open the scanned HO approval document</a>}
                </section>
            )}

            <section className={card} data-testid="dossier-values">
                <h2 className="mb-2 text-sm font-black text-slate-900">Value (at the PO prices)</h2>
                <div className="grid grid-cols-2 gap-2 text-xs text-slate-900 sm:grid-cols-4">
                    <p>Ordered goods <b className="block">{money(po.values.orderedGoods, po.currency)}</b></p>
                    <p>Tax on the order <b className="block">{money(po.values.tax, po.currency)}</b></p>
                    <p>Received so far <b className="block">{money(po.values.receivedValue, po.currency)}</b></p>
                    <p>Still to receive <b className="block">{money(po.values.stillToReceive, po.currency)}</b></p>
                </div>
                {po.ho && ['APPROVED', 'ISSUED', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CLOSED'].includes(po.status) && (
                    <div className="mt-3 grid grid-cols-1 gap-2 rounded-lg border border-slate-300 bg-slate-50 p-3 sm:grid-cols-4 print:hidden" data-testid="ho-payment-form">
                        <input aria-label="HO payment reference" placeholder="HO payment ref (cheque / transfer)" data-testid="ho-pay-ref" value={payRef} onChange={(e) => setPayRef(e.target.value)} className="h-8 rounded border border-slate-300 bg-white px-2 text-xs text-slate-900" />
                        <input aria-label="Supplier invoice number" placeholder="Supplier invoice no. (optional)" data-testid="ho-pay-inv" value={invRef} onChange={(e) => setInvRef(e.target.value)} className="h-8 rounded border border-slate-300 bg-white px-2 text-xs text-slate-900" />
                        <input aria-label="Payment date" type="date" data-testid="ho-pay-date" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} className="h-8 rounded border border-slate-300 bg-white px-2 text-xs text-slate-900" />
                        <button type="button" data-testid="ho-pay-submit" disabled={recordPayment.isPending || payRef.trim().length < 3} onClick={() => recordPayment.mutate()} className="h-8 rounded border border-violet-800 bg-violet-800 px-3 text-xs font-bold text-white hover:bg-violet-900 disabled:opacity-60">{po.hoPayment ? "Update HO payment" : "Record HO payment"}</button>
                    </div>
                )}
                <p className="mt-2 text-xs text-slate-900" data-testid="dossier-ho-payment">{po.hoPayment ? `Paid by HO: payment ${po.hoPayment.paymentRef}${po.hoPayment.invoiceRef ? ', invoice ' + po.hoPayment.invoiceRef : ''}, ${po.hoPayment.paidAt ? new Date(po.hoPayment.paidAt).toLocaleDateString() : ''} (cleared ${money(po.hoPayment.cleared, po.currency)} of goods received)` : "No HO payment recorded yet."}</p>
            </section>

            <section className={card}>
                <h2 className="mb-2 text-sm font-black text-slate-900">Approval steps</h2>
                <p className={`mb-2 text-xs font-bold ${chain.intact ? "text-emerald-800" : "text-red-800"}`} data-testid="dossier-chain">
                    {chain.intact ? `Log intact: ${chain.entries} entries, each sealed with the one before it.` : `Log broken at entry ${chain.firstBrokenSeq}: an earlier record was changed.`}
                </p>
                <table className="w-full">
                    <thead><tr><th className={th}>#</th><th className={th}>Step</th><th className={th}>Action</th><th className={th}>By</th><th className={th}>When</th><th className={th}>Remarks</th></tr></thead>
                    <tbody>
                        {approvals.map((a) => (
                            <tr key={a.seq} className="border-t border-slate-200" data-testid="dossier-approval">
                                <td className={td}>{a.seq}</td><td className={td}>{a.stageLabel ?? "-"}</td><td className={td}>{ACTION_LABEL[a.action] ?? a.action}</td>
                                <td className={td}>{a.actor ?? "-"}</td><td className={td}>{when(a.at)}</td><td className={td}>{a.remarks ?? ""}</td>
                            </tr>
                        ))}
                        {approvals.length === 0 && <tr><td className={td} colSpan={6}>No approval steps recorded (an order raised before the approval chain).</td></tr>}
                    </tbody>
                </table>
            </section>

            <section className={card}>
                <h2 className="mb-2 text-sm font-black text-slate-900">Order lines</h2>
                <table className="w-full">
                    <thead><tr><th className={th}>Item</th><th className={th}>Ordered</th><th className={th}>Received</th><th className={th}>Unit price</th><th className={th}>Tax</th><th className={th}>Total</th></tr></thead>
                    <tbody>
                        {po.lines.map((l, i) => (
                            <tr key={i} className="border-t border-slate-200"><td className={td}>{l.code} {l.name}</td><td className={td}>{l.quantity} {l.unit}</td><td className={td}>{l.receivedQty}</td><td className={td}>{money(l.unitPrice, po.currency)}</td><td className={td}>{money(l.taxAmount, po.currency)}</td><td className={td}>{money(l.totalAmount, po.currency)}</td></tr>
                        ))}
                    </tbody>
                </table>
                <p className="mt-2 text-right text-xs font-black text-slate-900">Total {money(po.totalAmount, po.currency)}</p>
            </section>

            <section className={card}>
                <h2 className="mb-2 text-sm font-black text-slate-900">Goods receipts</h2>
                {receipts.length === 0 ? <p className="text-xs text-slate-700">Nothing received yet.</p> : receipts.map((g) => <p key={g.grnNumber} className="text-xs text-slate-900">{g.grnNumber} · {when(g.at)} · received by {g.receivedBy ?? "-"}</p>)}
            </section>

            <section className={card}>
                <h2 className="mb-2 text-sm font-black text-slate-900">Supplier invoices</h2>
                {invoices.length === 0 ? <p className="text-xs text-slate-700">No invoice entered yet.</p> : invoices.map((i) => (
                    <div key={i.id} className="mb-2 text-xs text-slate-900" data-testid="dossier-invoice">
                        <p className="font-bold">{i.invoiceNumber} · {money(i.total, po.currency)} · {i.status.replace(/_/g, " ")} · match {i.match}</p>
                        <p>Entered by {i.enteredBy ?? "-"} · finance approval {i.financeApprovedBy ?? "-"} ({when(i.financeApprovedAt)}) · final approval {i.approvedBy ?? "-"} ({when(i.approvedAt)})</p>
                        {i.overrideReason && <p>Match override reason: {i.overrideReason}</p>}
                        {i.rejectionReason && <p>Rejected: {i.rejectionReason}</p>}
                    </div>
                ))}
            </section>

            <section className={card}>
                <h2 className="mb-2 text-sm font-black text-slate-900">Audit trail</h2>
                <table className="w-full">
                    <thead><tr><th className={th}>When</th><th className={th}>Action</th><th className={th}>By</th></tr></thead>
                    <tbody>{auditTrail.map((t, i) => <tr key={i} className="border-t border-slate-200"><td className={td}>{when(t.at)}</td><td className={td}>{t.action}</td><td className={td}>{t.by ?? "-"}</td></tr>)}</tbody>
                </table>
            </section>
        </div>
    );
}
