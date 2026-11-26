"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import RoleGuard from "@/components/RoleGuard";

interface ChainRow {
    id: string; pvNumber: string; status: string; amount: number; payee: string; waitingFor: string; stage: string | null;
    docsStatus: string | null; docsRemarks: string | null; invoiceNumber: string | null; match: string | null; poNumber: string | null; vendor: string;
    grnNumber: string | null; oracleGrnNumber: string | null;
    trail: { stage: string | null; action: string; by: string | null; at: string; remarks: string | null }[];
}

const money = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const ACTION: Record<string, string> = { SUBMITTED: "Sent for approval", APPROVED: "Approved", REJECTED: "Rejected", DOCS_NOT_RECEIVED: "Documents not received", DOCS_RECEIVED_SENT_TO_HO: "Documents received, sent to HO", DOCS_SENT: "Documents sent to Procurement" };

/**
 * Vendor payment vouchers of the company flow, one row each: OSP Manager and Head of Section approve or reject (with remarks), the Procurement Officer
 * marks the documents received (the voucher then goes to HO) or not received (back to the Account Officer), and the Account Officer sends missing
 * documents again. The OSP Account Manager's step is on Payment requests to Head Office. Every action is checked by the server against the step.
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
        mutationFn: async (body: { voucherId: string; action: string; remarks?: string; matchOverrideReason?: string }) => {
            const res = await fetch("/api/procurement/payment-approvals", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
            const json = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(json?.error?.message || "The action failed");
            return json;
        },
        onSuccess: () => { toast.success("Done"); qc.invalidateQueries({ queryKey: ["pv-chain"] }); },
        onError: (e: Error, vars) => {
            if (vars.action === "APPROVE" && /MATCH_OVERRIDE_REASON_REQUIRED/.test(e.message)) {
                const why = window.prompt("The vendor invoice does not match the order and the GRN. Reason for approving it:");
                if (why && why.trim().length >= 5) act.mutate({ ...vars, matchOverrideReason: why.trim() });
                return;
            }
            toast.error(e.message);
        },
    });
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
                <h1 className="text-xl font-black text-slate-900">Vendor payment approvals</h1>
                <p className="text-xs font-semibold text-slate-700">OSP Account Manager → OSP Manager → Head of Section → OSP Account sends the documents → Procurement Officer checks them → HO. A rejection or missing documents go back to the OSP Account with the remarks. Each step notifies the next.</p>
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
                                <td className={td} data-testid="pv-chain-waiting"><b>{r.waitingFor}</b>{r.docsRemarks ? <span className="block text-red-800">{r.docsRemarks}</span> : null}</td>
                                <td className={td}>{r.trail.map((t, i) => <span key={i} className="block">{ACTION[t.action] ?? t.action}{t.by ? ` · ${t.by}` : ""}{t.remarks ? `: ${t.remarks}` : ""}</span>)}</td>
                                <td className={`${td} whitespace-nowrap`}>
                                    {r.status === "PENDING_APPROVAL" && (r.stage === "OSP_MANAGER" || r.stage === "HEAD_OF_SECTION") && (<>
                                        <button type="button" data-testid="pv-approve" disabled={act.isPending} onClick={() => act.mutate({ voucherId: r.id, action: "APPROVE" })} className={`${btn} border-emerald-700 bg-emerald-700 text-white`}>Approve</button>
                                        <button type="button" data-testid="pv-reject" disabled={act.isPending} onClick={() => withRemarks(r.id, "REJECT", "Why is this voucher rejected?")} className={`${btn} border-red-300 bg-red-50 text-red-900`}>Reject</button>
                                    </>)}
                                    {r.status === "APPROVED" && (r.docsStatus === "TO_SEND" || r.docsStatus === "NOT_RECEIVED") && (
                                        <button type="button" data-testid="pv-docs-sent" disabled={act.isPending} onClick={() => { if (window.confirm("The documents of this voucher were sent to the Procurement Officer?")) act.mutate({ voucherId: r.id, action: "DOCS_SENT" }); }} className={`${btn} border-indigo-800 bg-indigo-800 text-white`}>Documents sent to Procurement</button>
                                    )}
                                    {r.status === "APPROVED" && r.docsStatus === "SENT" && (<>
                                        <button type="button" data-testid="pv-docs-received" disabled={act.isPending} onClick={() => { if (window.confirm("Documents inspected and received: send this voucher to HO?")) act.mutate({ voucherId: r.id, action: "DOCS_RECEIVED" }); }} className={`${btn} border-violet-800 bg-violet-800 text-white`}>Received: send to HO</button>
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
