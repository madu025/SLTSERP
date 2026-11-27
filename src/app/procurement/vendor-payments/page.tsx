"use client";
import { Fragment, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import RoleGuard from "@/components/RoleGuard";
import { VENDOR_PAYMENT_STATE_LABEL, type VendorPaymentState } from "@/lib/ho-payment-digest";

interface StatusRow {
    id: string; pvNumber: string; vendor: string; invoiceNumber: string | null; invoiceStatus: string | null; poNumber: string | null;
    amount: number; paid: number; remaining: number; state: VendorPaymentState; lastPaidDate: string | null; lastReference: string | null;
    payments: { amount: number; paidDate: string; reference: string; method: string; recordedBy: string | null; recordedAt: string }[];
}
type Filter = "ALL" | VendorPaymentState;

const money = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const date = (s: string | null) => (s ? new Date(s).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Colombo" }) : "-");
// state colours of the route board: amber waits, route blue is under way, green is done (dark text on light, WCAG AA)
const STATE_STYLE: Record<VendorPaymentState, string> = {
    PENDING: "border-amber-300 bg-amber-50 text-amber-900",
    PARTLY_PAID: "border-blue-300 bg-blue-50 text-blue-900",
    COMPLETED: "border-emerald-300 bg-emerald-50 text-emerald-900",
};
const FILTERS: { id: Filter; label: string }[] = [
    { id: "ALL", label: "All" },
    { id: "PENDING", label: "Pending" },
    { id: "PARTLY_PAID", label: "Partly paid" },
    { id: "COMPLETED", label: "Completed" },
];

/**
 * Vendor Payment Status: what HO has paid on each OSP vendor voucher. OSP does not know when or how much HO pays a vendor; it learns it from the
 * payments the HO Account Executive records. Read only. The OSP Account Manager, OSP Manager and Head of Section also get one notice a day.
 */
export default function VendorPaymentStatusPage() {
    const [filter, setFilter] = useState<Filter>("ALL");
    const [q, setQ] = useState("");
    const [open, setOpen] = useState<string | null>(null);
    const { data: rows = [], isLoading, error } = useQuery<StatusRow[]>({
        queryKey: ["vendor-payment-status"],
        queryFn: async () => {
            const res = await fetch("/api/procurement/vendor-payments", { cache: "no-store" });
            const json = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(json?.error?.message || "Could not load the vendor payments");
            return json.data ?? json;
        },
    });
    const sum = useMemo(() => {
        const of = (s: VendorPaymentState) => rows.filter((r) => r.state === s);
        return {
            pending: { n: of("PENDING").length, rs: of("PENDING").reduce((a, r) => a + r.remaining, 0) },
            partly: { n: of("PARTLY_PAID").length, rs: of("PARTLY_PAID").reduce((a, r) => a + r.remaining, 0) },
            completed: { n: of("COMPLETED").length, rs: of("COMPLETED").reduce((a, r) => a + r.paid, 0) },
        };
    }, [rows]);
    const shown = useMemo(() => {
        const t = q.trim().toLowerCase();
        return rows.filter((r) => (filter === "ALL" || r.state === filter)
            && (!t || [r.vendor, r.pvNumber, r.invoiceNumber, r.poNumber, r.lastReference].some((x) => x?.toLowerCase().includes(t))));
    }, [rows, filter, q]);

    const th = "px-3 py-2 text-left text-xs font-bold !bg-slate-100 !text-slate-800";
    const thNum = `${th} !text-right`;
    const td = "px-3 py-2 text-sm text-slate-900 align-top";
    const tdNum = `${td} text-right tabular-nums whitespace-nowrap`;
    return (
        <RoleGuard>
        <div className="flex h-screen overflow-hidden bg-slate-50">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-7xl space-y-4 p-4 sm:p-6" data-testid="vendor-payment-status">
            <div>
                <h1 className="text-xl font-black text-slate-900">Vendor payment status</h1>
                <p className="max-w-3xl text-sm text-slate-700">What HO has paid on each vendor voucher sent from OSP, as recorded by the HO Account Executive. HO may pay a voucher at once or in parts; the balance is what is still to pay.</p>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {([["PENDING", "Pending at HO", sum.pending, "still to pay"], ["PARTLY_PAID", "Partly paid", sum.partly, "still to pay"], ["COMPLETED", "Completed", sum.completed, "paid by HO"]] as const).map(([id, label, f, what]) => (
                    <button key={id} type="button" onClick={() => setFilter(filter === id ? "ALL" : id)} aria-pressed={filter === id} data-testid={`vps-fig-${id}`}
                        className={`rounded-lg border bg-white p-3 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 ${filter === id ? "border-slate-900" : "border-slate-300"}`}>
                        <span className="block text-sm font-semibold text-slate-800">{label}</span>
                        <span className="block text-2xl font-black tabular-nums text-slate-900">{f.n}</span>
                        <span className="block text-xs tabular-nums text-slate-700">Rs. {money(f.rs)} {what}</span>
                    </button>
                ))}
            </div>

            <div className="flex flex-wrap items-end gap-3">
                <div role="group" aria-label="Show" className="flex flex-wrap gap-1">
                    {FILTERS.map((f) => (
                        <button key={f.id} type="button" aria-pressed={filter === f.id} onClick={() => setFilter(f.id)}
                            className={`rounded-md border px-3 py-1.5 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-700 ${filter === f.id ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 bg-white text-slate-900"}`}>{f.label}</button>
                    ))}
                </div>
                <label className="flex flex-col text-xs font-semibold text-slate-800">Find a vendor, voucher, invoice, PO or reference
                    <input value={q} onChange={(e) => setQ(e.target.value)} data-testid="vps-search" className="mt-1 w-72 max-w-full rounded-md border border-slate-400 bg-white px-2 py-1.5 text-sm text-slate-900" />
                </label>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-300 bg-white">
                <table className="w-full min-w-[56rem]">
                    <thead><tr>
                        <th className={th}>Vendor / invoice</th><th className={th}>Voucher / PO</th><th className={th}>Status</th>
                        <th className={thNum}>Invoice total (Rs.)</th><th className={thNum}>Paid by HO (Rs.)</th><th className={thNum}>Still to pay (Rs.)</th>
                        <th className={th}>Last HO payment</th><th className={th}><span className="sr-only">Payments</span></th>
                    </tr></thead>
                    <tbody>
                        {isLoading && <tr><td className={td} colSpan={8}>Loading…</td></tr>}
                        {error && <tr><td className={`${td} text-red-800`} colSpan={8}>{(error as Error).message}</td></tr>}
                        {!isLoading && !error && shown.length === 0 && <tr><td className={td} colSpan={8}>{rows.length === 0 ? "No vendor voucher has reached HO yet." : "No voucher matches this filter."}</td></tr>}
                        {shown.map((r) => (
                            <Fragment key={r.id}>
                                <tr className="border-t border-slate-200" data-testid="vps-row">
                                    <td className={td}><b>{r.vendor}</b><span className="block text-slate-700">{r.invoiceNumber ?? "-"}</span></td>
                                    <td className={td}>{r.pvNumber}<span className="block text-slate-700">{r.poNumber ?? "-"}</span></td>
                                    <td className={td}><span data-testid="vps-state" className={`inline-block rounded border px-2 py-0.5 text-xs font-bold ${STATE_STYLE[r.state]}`}>{VENDOR_PAYMENT_STATE_LABEL[r.state]}</span></td>
                                    <td className={tdNum}>{money(r.amount)}</td>
                                    <td className={tdNum}>{money(r.paid)}</td>
                                    <td className={`${tdNum} font-bold`} data-testid="vps-remaining">{money(r.remaining)}</td>
                                    <td className={td}>{r.lastPaidDate ? <>{date(r.lastPaidDate)}<span className="block text-slate-700">{r.lastReference}</span></> : <span className="text-slate-700">Not paid yet</span>}</td>
                                    <td className={`${td} whitespace-nowrap`}>
                                        {r.payments.length > 0 && (
                                            <button type="button" aria-expanded={open === r.id} data-testid="vps-open" onClick={() => setOpen(open === r.id ? null : r.id)}
                                                className="rounded border border-slate-400 bg-white px-2 py-1 text-xs font-bold text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-700">
                                                {open === r.id ? "Hide payments" : `${r.payments.length} payment${r.payments.length === 1 ? "" : "s"}`}
                                            </button>
                                        )}
                                    </td>
                                </tr>
                                {open === r.id && (
                                    <tr data-testid="vps-payments"><td colSpan={8} className="bg-slate-50 px-3 pb-3">
                                        <table className="mt-1 w-full max-w-3xl">
                                            <caption className="py-1 text-left text-xs font-bold text-slate-800">HO payments on {r.pvNumber}, as recorded by the HO Account Executive</caption>
                                            <thead><tr><th className={th}>Paid on</th><th className={thNum}>Amount (Rs.)</th><th className={th}>Cheque / transfer</th><th className={th}>Recorded by</th></tr></thead>
                                            <tbody>
                                                {r.payments.map((p, i) => (
                                                    <tr key={i} className="border-t border-slate-200">
                                                        <td className={td}>{date(p.paidDate)}</td>
                                                        <td className={tdNum}>{money(p.amount)}</td>
                                                        <td className={td}>{p.reference}<span className="block text-xs text-slate-700">{p.method.charAt(0) + p.method.slice(1).toLowerCase()}</span></td>
                                                        <td className={td}>{p.recordedBy ?? "-"}<span className="block text-xs text-slate-700">{date(p.recordedAt)}</span></td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
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
