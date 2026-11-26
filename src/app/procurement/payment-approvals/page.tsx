"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import RoleGuard from "@/components/RoleGuard";

interface ChainRow {
    id: string; pvNumber: string; status: string; amount: number; payee: string; waitingFor: string; stage: string | null;
    docsStatus: string | null; docsRemarks: string | null; signedVoucherUrl: string | null; invoiceNumber: string | null; match: string | null; poNumber: string | null; vendor: string;
    grnNumber: string | null; oracleGrnNumber: string | null;
    trail: { stage: string | null; action: string; by: string | null; at: string; remarks: string | null }[];
}

const money = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const ACTION: Record<string, string> = { SUBMITTED: "Submitted", SIGNED: "Signed by all three", NOT_SIGNED: "Not signed", APPROVED: "Approved", REJECTED: "Rejected", DOCS_NOT_RECEIVED: "Documents not received", DOCS_RECEIVED_SENT_TO_HO: "Documents received at HO", DOCS_SENT: "Documents sent to HO" };

/**
 * Vendor payment vouchers of the company flow, one row each. The voucher is signed on paper by the OSP Account Manager, OSP Manager and Head of Section;
 * the Account Officer records "Signed by all three" with the scan (or "Not signed", back to draft), then sends the documents; the HO Account Executive
 * marks them received (the voucher is with HO) or not received. Every action is checked by the server against the step.
 */
export default function PaymentApprovalsPage() {
    const qc = useQueryClient();
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
        mutationFn: async (body: { voucherId: string; action: string; remarks?: string; matchOverrideReason?: string; signedVoucherUrl?: string }) => {
            const res = await fetch("/api/procurement/payment-approvals", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
            const json = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(json?.error?.message || "The action failed");
            return json;
        },
        onSuccess: () => { toast.success("Done"); qc.invalidateQueries({ queryKey: ["pv-chain"] }); },
        onError: (e: Error, vars) => {
            if (vars.action === "SIGNED" && /MATCH_OVERRIDE_REASON_REQUIRED/.test(e.message)) {
                const why = window.prompt("The vendor invoice does not match the order and the GRN. Reason for approving it:");
                if (why && why.trim().length >= 5) act.mutate({ ...vars, matchOverrideReason: why.trim() });
                return;
            }
            toast.error(e.message);
        },
    });
    const uploadSigned = async (voucherId: string, file: File) => {
        const fd = new FormData();
        fd.append("file", file);
        fd.append("bucket", "finance");
        const res = await fetch("/api/upload", { method: "POST", body: fd });
        const json = await res.json().catch(() => ({}));
        const url = json?.url ?? json?.data?.url;
        if (!res.ok || !url) { toast.error(json?.error?.message || "Upload failed"); return; }
        act.mutate({ voucherId, action: "SIGNED", signedVoucherUrl: url });
    };
    const withRemarks = (voucherId: string, action: string, question: string) => {
        const remarks = window.prompt(question);
        if (remarks && remarks.trim().length >= 3) act.mutate({ voucherId, action, remarks: remarks.trim() });
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
                            <tr key={r.id} className="border-t border-slate-200" data-testid="pv-chain-row">
                                <td className={td}><b>{r.pvNumber}</b><span className="block text-slate-700">{r.status.replace(/_/g, " ")}</span></td>
                                <td className={td}>{r.vendor}<span className="block text-slate-700">{r.invoiceNumber ?? "-"}{r.match && r.match !== "MATCHED" ? ` · ${r.match}` : ""}</span></td>
                                <td className={td}>{r.poNumber ?? "-"}<span className="block text-slate-700">{r.grnNumber ?? "-"} · {r.oracleGrnNumber ?? "-"}</span></td>
                                <td className={td}>{money(r.amount)}</td>
                                <td className={td} data-testid="pv-chain-waiting"><b>{r.waitingFor}</b>{r.signedVoucherUrl ? <a href={r.signedVoucherUrl} target="_blank" rel="noreferrer" className="block text-blue-800 underline">Signed voucher</a> : null}{r.docsRemarks ? <span className="block text-red-800">{r.docsRemarks}</span> : null}</td>
                                <td className={td}>{r.trail.map((t, i) => <span key={i} className="block">{ACTION[t.action] ?? t.action}{t.by ? ` · ${t.by}` : ""}{t.remarks ? `: ${t.remarks}` : ""}</span>)}</td>
                                <td className={`${td} whitespace-nowrap`}>
                                    {r.status === "PENDING_APPROVAL" && r.stage === "SIGNATURES" && (<>
                                        <label className={`${btn} inline-block cursor-pointer border-emerald-700 bg-emerald-700 text-white`}>
                                            Signed by all three (attach scan)
                                            <input type="file" data-testid="pv-signed" accept=".pdf,.jpg,.jpeg,.png,.webp" className="hidden" disabled={act.isPending} onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadSigned(r.id, f); }} />
                                        </label>
                                        <button type="button" data-testid="pv-not-signed" disabled={act.isPending} onClick={() => withRemarks(r.id, "NOT_SIGNED", "Why was the voucher not signed?")} className={`${btn} border-red-300 bg-red-50 text-red-900`}>Not signed</button>
                                    </>)}
                                    {r.status === "APPROVED" && (r.docsStatus === "TO_SEND" || r.docsStatus === "NOT_RECEIVED") && (
                                        <button type="button" data-testid="pv-docs-sent" disabled={act.isPending} onClick={() => { if (window.confirm("The signed voucher and its documents were sent to the HO Invoice Section?")) act.mutate({ voucherId: r.id, action: "DOCS_SENT" }); }} className={`${btn} border-indigo-800 bg-indigo-800 text-white`}>Documents sent to HO</button>
                                    )}
                                    {r.status === "APPROVED" && r.docsStatus === "SENT" && (<>
                                        <button type="button" data-testid="pv-docs-received" disabled={act.isPending} onClick={() => { if (window.confirm("Documents received by the HO Invoice Section?")) act.mutate({ voucherId: r.id, action: "DOCS_RECEIVED" }); }} className={`${btn} border-violet-800 bg-violet-800 text-white`}>Received at HO</button>
                                        <button type="button" data-testid="pv-docs-missing" disabled={act.isPending} onClick={() => withRemarks(r.id, "DOCS_NOT_RECEIVED", "Which documents are missing?")} className={`${btn} border-amber-300 bg-amber-50 text-amber-900`}>Not received</button>
                                    </>)}
                                </td>
                            </tr>
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
