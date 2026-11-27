"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import RoleGuard from "@/components/RoleGuard";
import { Fragment, useState } from "react";
import GatePanel from "@/components/purchase/GatePanel";
import { signaturesGate, docsChainGate, reasonGate } from "@/lib/purchase-flow-gates";
import { RBAC_PERMISSIONS } from "@/config/rbac-permissions";

type Mode = "SIGNED" | "NOT_SIGNED" | "DOCS_SENT" | "DOCS_RECEIVED" | "DOCS_NOT_RECEIVED";

interface ChainRow {
    id: string; pvNumber: string; status: string; amount: number; payee: string; waitingFor: string; stage: string | null;
    docsStatus: string | null; docsRemarks: string | null; signedVoucherUrl: string | null; invoiceNumber: string | null; match: string | null; poNumber: string | null; vendor: string;
    grnNumber: string | null; oracleGrnNumber: string | null;
    trail: { stage: string | null; action: string; by: string | null; at: string; remarks: string | null }[];
}

const DONE: Record<string, string> = { SIGNED: "Signatures recorded; the vendor invoice is posted. Send the documents to HO next.", NOT_SIGNED: "Back to the Account Officer as not signed", DOCS_SENT: "Documents sent; the HO Account Executive is told", DOCS_RECEIVED: "Documents received; the voucher is with HO for payment", DOCS_NOT_RECEIVED: "Sent back to the OSP Account: documents missing" };
const money = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const PANEL_TITLE: Record<Mode, string> = { SIGNED: "Record the three signatures", NOT_SIGNED: "Not signed", DOCS_SENT: "Documents sent to HO", DOCS_RECEIVED: "Documents received at HO", DOCS_NOT_RECEIVED: "Documents not received" };
const PANEL_NOTE: Record<Mode, string> = {
    SIGNED: "The OSP Account Manager, OSP Manager and Head of Section sign the printed voucher. Upload its scan: the vendor invoice is then posted and the documents can go to HO.",
    NOT_SIGNED: "The voucher goes back to draft with your reason, for the Account Officer to correct.",
    DOCS_SENT: "Send the signed voucher and its documents to the HO Invoice Section, then record it. The HO Account Executive is told.",
    DOCS_RECEIVED: "When the documents arrive at HO, record it: the voucher is then with HO for payment.",
    DOCS_NOT_RECEIVED: "The OSP Account is told what is missing and sends the documents again.",
};
const ACTION_LABEL: Record<Mode, string> = { SIGNED: "Record: signed by all three", NOT_SIGNED: "Send back as not signed", DOCS_SENT: "Record: documents sent to HO", DOCS_RECEIVED: "Record: documents received at HO", DOCS_NOT_RECEIVED: "Send back: documents missing" };
const ACTION: Record<string, string> = { SUBMITTED: "Submitted", SIGNED: "Signed by all three", NOT_SIGNED: "Not signed", APPROVED: "Approved", REJECTED: "Rejected", DOCS_NOT_RECEIVED: "Documents not received", DOCS_RECEIVED_SENT_TO_HO: "Documents received at HO", DOCS_SENT: "Documents sent to HO" };

/**
 * Vendor payment vouchers of the company flow, one row each. The voucher is signed on paper by the OSP Account Manager, OSP Manager and Head of Section;
 * the Account Officer records "Signed by all three" with the scan (or "Not signed", back to draft), then sends the documents; the HO Account Executive
 * marks them received (the voucher is with HO) or not received. Every action is checked by the server against the step.
 */
export default function PaymentApprovalsPage() {
    const qc = useQueryClient();
    // one open panel at a time: the step's checks, then its one action (no browser dialogs)
    const [open, setOpen] = useState<{ id: string; mode: Mode } | null>(null);
    const [file, setFile] = useState<File | null>(null);
    const [reason, setReason] = useState("");
    const [canReceive] = useState<boolean>(() => {
        if (typeof window === "undefined") return false;
        try { const u = JSON.parse(localStorage.getItem("user") || "{}"); return Array.isArray(u.permissions) && u.permissions.includes(RBAC_PERMISSIONS.PROCUREMENT_HO_PAYMENT_RECORD); } catch { return false; }
    });
    const openPanel = (id: string, mode: Mode) => { setOpen({ id, mode }); setFile(null); setReason(""); };
    const { data: rows = [], isLoading } = useQuery<ChainRow[]>({
        queryKey: ["pv-chain"],
        queryFn: async () => {
            const res = await fetch("/api/procurement/payment-approvals", { cache: "no-store" });
            const json = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(json?.error?.message || "Could not load the vouchers");
            return json.data ?? json;
        },
    });
    const act = useMutation({
        mutationFn: async (body: { voucherId: string; action: string; remarks?: string; signedVoucherUrl?: string }) => {
            const res = await fetch("/api/procurement/payment-approvals", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
            const json = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(json?.error?.message || "The action failed");
            return json;
        },
        onSuccess: (_d, v) => { toast.success(DONE[v.action] ?? "Done"); setOpen(null); qc.invalidateQueries({ queryKey: ["pv-chain"] }); },
        onError: (e: Error) => toast.error(e.message),
    });
    const uploadSigned = async (voucherId: string, file: File) => {
        const fd = new FormData();
        fd.append("file", file);
        // an allowed upload bucket (the upload API refuses any other)
        fd.append("bucket", "invoices");
        const res = await fetch("/api/upload", { method: "POST", body: fd });
        const json = await res.json().catch(() => ({}));
        const url = json?.url ?? json?.data?.url;
        if (!res.ok || !url) { toast.error(json?.error?.message || "Upload failed"); return; }
        act.mutate({ voucherId, action: "SIGNED", signedVoucherUrl: url });
    };
    const th = "px-2 py-1.5 text-left text-[11px] font-bold uppercase !bg-slate-100 !text-slate-800";
    const td = "px-2 py-1.5 text-xs text-slate-900 align-top";
    const btn = "mr-1 rounded border px-2 py-0.5 text-[11px] font-bold";

    return (
        <RoleGuard>
        <div className="flex h-screen overflow-hidden bg-slate-50">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-7xl space-y-4 p-4 sm:p-6" data-testid="pv-chain-page">
            <div>
                <h1 className="text-xl font-black text-slate-900">Vendor payment vouchers</h1>
                <p className="text-xs font-semibold text-slate-700">Signed on paper by the OSP Account Manager, OSP Manager and Head of Section → the Account Officer records it with the scan → sends the documents → the HO Account Executive receives them → HO payments. Each step notifies the next.</p>
            </div>
            <div className="overflow-x-auto rounded-xl border border-slate-300 bg-white p-3">
                <table className="w-full">
                    <thead><tr><th className={th}>Voucher</th><th className={th}>Vendor / invoice</th><th className={th}>PO / GRN / Oracle</th><th className={th}>Amount</th><th className={th}>Waiting for</th><th className={th}>Trail</th><th className={th}></th></tr></thead>
                    <tbody>
                        {isLoading && <tr><td className={td} colSpan={7}>Loading…</td></tr>}
                        {!isLoading && rows.length === 0 && <tr><td className={td} colSpan={7}>No vendor payment voucher is in the approval flow.</td></tr>}
                        {rows.map((r) => (
                            <Fragment key={r.id}>
                            <tr className="border-t border-slate-200" data-testid="pv-chain-row">
                                <td className={td}><b>{r.pvNumber}</b><span className="block text-slate-700">{r.status.replace(/_/g, " ")}</span></td>
                                <td className={td}>{r.vendor}<span className="block text-slate-700">{r.invoiceNumber ?? "-"}{r.match && r.match !== "MATCHED" ? ` · ${r.match}` : ""}</span></td>
                                <td className={td}>{r.poNumber ?? "-"}<span className="block text-slate-700">{r.grnNumber ?? "-"} · {r.oracleGrnNumber ?? "-"}</span></td>
                                <td className={td}>{money(r.amount)}</td>
                                <td className={td} data-testid="pv-chain-waiting"><b>{r.waitingFor}</b>{r.signedVoucherUrl ? <a href={r.signedVoucherUrl} target="_blank" rel="noreferrer" className="block text-blue-800 underline">Signed voucher</a> : null}{r.docsRemarks ? <span className="block text-red-800">{r.docsRemarks}</span> : null}</td>
                                <td className={td}>{r.trail.map((t, i) => <span key={i} className="block">{ACTION[t.action] ?? t.action}{t.by ? ` · ${t.by}` : ""}{t.remarks ? `: ${t.remarks}` : ""}</span>)}</td>
                                <td className={`${td} whitespace-nowrap`}>
                                    {r.status === "PENDING_APPROVAL" && r.stage === "SIGNATURES" && (<>
                                        <button type="button" data-testid="pv-sign-open" onClick={() => openPanel(r.id, "SIGNED")} className={`${btn} border-emerald-700 bg-emerald-700 text-white`}>Signed by all three</button>
                                        <button type="button" data-testid="pv-not-signed" onClick={() => openPanel(r.id, "NOT_SIGNED")} className={`${btn} border-red-300 bg-red-50 text-red-900`}>Not signed</button>
                                    </>)}
                                    {r.status === "APPROVED" && (r.docsStatus === "TO_SEND" || r.docsStatus === "NOT_RECEIVED") && (
                                        <button type="button" data-testid="pv-docs-sent" onClick={() => openPanel(r.id, "DOCS_SENT")} className={`${btn} border-indigo-800 bg-indigo-800 text-white`}>Documents sent to HO</button>
                                    )}
                                    {r.status === "APPROVED" && r.docsStatus === "SENT" && (<>
                                        <button type="button" data-testid="pv-docs-received" onClick={() => openPanel(r.id, "DOCS_RECEIVED")} className={`${btn} border-violet-800 bg-violet-800 text-white`}>Received at HO</button>
                                        <button type="button" data-testid="pv-docs-missing" onClick={() => openPanel(r.id, "DOCS_NOT_RECEIVED")} className={`${btn} border-amber-300 bg-amber-50 text-amber-900`}>Not received</button>
                                    </>)}
                                </td>
                            </tr>
                            {open?.id === r.id && (
                                <tr data-testid="pv-panel"><td colSpan={7} className="px-2 pb-3">
                                    <div className="pf grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_20rem]">
                                        <div className="pf-step">
                                            <div className="pf-step-title">{PANEL_TITLE[open.mode]}</div>
                                            <p className="pf-step-note !ml-0">{PANEL_NOTE[open.mode]}</p>
                                            {open.mode === "SIGNED" && (
                                                <div className="pf-field"><label htmlFor={`scan-${r.id}`}>Scan of the signed voucher</label>
                                                    <input id={`scan-${r.id}`} type="file" data-testid="pv-signed" accept=".pdf,.jpg,.jpeg,.png,.webp" className="pf-input py-1" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></div>
                                            )}
                                            {(open.mode === "NOT_SIGNED" || open.mode === "DOCS_NOT_RECEIVED") && (
                                                <div className="pf-field"><label htmlFor={`why-${r.id}`}>{open.mode === "NOT_SIGNED" ? "Why the voucher was not signed" : "Which documents are missing"}</label>
                                                    <textarea id={`why-${r.id}`} data-testid="pv-reason" rows={2} className="pf-input" value={reason} onChange={(e) => setReason(e.target.value)} /></div>
                                            )}
                                            <button type="button" className="mt-3 text-sm font-semibold underline" onClick={() => setOpen(null)}>Close</button>
                                        </div>
                                        <GatePanel
                                            testId="pv-go"
                                            busy={act.isPending}
                                            action={ACTION_LABEL[open.mode]}
                                            checks={open.mode === "SIGNED" ? signaturesGate({ scanAttached: !!file, invoiceMatches: !r.match || r.match === "MATCHED" })
                                                : open.mode === "NOT_SIGNED" ? reasonGate(reason, "why the voucher was not signed")
                                                : open.mode === "DOCS_NOT_RECEIVED" ? reasonGate(reason, "which documents are missing")
                                                : docsChainGate({ step: open.mode === "DOCS_SENT" ? "SENT" : "RECEIVED", voucherApproved: r.status === "APPROVED", docsStatus: r.docsStatus, canReceive })}
                                            onAction={() => {
                                                if (open.mode === "SIGNED" && file) { void uploadSigned(r.id, file); return; }
                                                act.mutate({ voucherId: r.id, action: open.mode, ...(reason.trim() ? { remarks: reason.trim() } : {}) });
                                            }}
                                        />
                                    </div>
                                </td></tr>
                            )}
                            </Fragment>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
        </main>
        </div>
        </div>
        </RoleGuard>
    );
}
