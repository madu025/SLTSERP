"use client";

import { useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Download, Loader2, PackageMinus, Printer } from "lucide-react";
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import RoleGuard from "@/components/RoleGuard";
import { RBAC_PERMISSIONS } from "@/config/rbac-permissions";
import { formDate, formMonthTitle, rtomShort, tpNumber, CPE_TYPE_LABEL, type CpeType } from "@/lib/cpe-serial-rules";

interface Options { rtoms: Array<{ id: string; rtom: string; name: string }>; contractors: Array<{ id: string; name: string; opmcId: string | null }> }
interface Row {
    id: string; deviceType: string; serialNumber: string; serialUnreadable: boolean; condition: string; model: string | null; pstnNumber: string | null; status: string;
    collectedDate: string; month: string; contractorId: string; contractor: string; soNum: string; voiceNumber: string | null; rtom: string | null; formNumber: string | null; handedOverDate: string | null;
}

const unwrap = async <T,>(res: Response): Promise<T> => {
    const body = await res.json().catch(() => ({}));
    if (!res.ok || body?.success === false) throw new Error(body?.error?.message || body?.error || `Request failed (${res.status})`);
    return (body.data ?? body) as T;
};
const colombo = () => new Date(Date.now() + 5.5 * 3600_000).toISOString();
const label = "block text-xs font-bold uppercase tracking-wide text-slate-700";
const field = "mt-1 w-full rounded-md border border-slate-400 bg-white px-3 py-2 text-sm text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-700";
const th = "px-3 py-2 text-left text-xs font-bold uppercase tracking-wide text-slate-800";
const td = "px-3 py-2 text-sm text-slate-900";
const esc = (s: unknown) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));

/** The rows of the Collected CPE Handing Over Form, in the layout SLT receives (docs/plans/cpe-serial-locator.md section 7a). */
function formRows(rows: Row[], handedOverDate: string) {
    return rows.map((r, i) => [i + 1, rtomShort(r.rtom), tpNumber(r.voiceNumber), r.pstnNumber && tpNumber(r.pstnNumber) !== tpNumber(r.voiceNumber) ? tpNumber(r.pstnNumber) : "", (r.model ?? "").toUpperCase(), r.serialNumber, formDate(r.handedOverDate ?? handedOverDate)]);
}
const FORM_HEAD = ["NOS", "RTOM Area", "FTTH TP Number", "PSTN TP Number (If Number different only)", "CPE Model", "CPE Serial Number", "CPE Handed over Date"];

export default function CollectedCpePage() {
    const qc = useQueryClient();
    const [canRecord] = useState(() => {
        if (typeof window === "undefined") return false;
        try { const u = JSON.parse(localStorage.getItem("user") || "{}"); return Array.isArray(u.permissions) && u.permissions.includes(RBAC_PERMISSIONS.INVENTORY_CPE_RECEIVE); } catch { return false; }
    });
    const [opmcId, setOpmcId] = useState("");
    const [contractorId, setContractorId] = useState("");
    const [month, setMonth] = useState(colombo().slice(0, 7));
    const [status, setStatus] = useState("PENDING_HANDBACK");
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [handedOverDate, setHandedOverDate] = useState(colombo().slice(0, 10));
    const [reference, setReference] = useState("");
    const [busy, setBusy] = useState(false);

    const options = useQuery<Options>({ queryKey: ["cpe-options"], queryFn: async () => unwrap(await fetch("/api/cpe-serials/options")) });
    const list = useQuery<Row[]>({
        queryKey: ["collected-cpe", opmcId, contractorId, month, status],
        queryFn: async () => {
            const qs = new URLSearchParams(Object.entries({ opmcId, contractorId, month, status }).filter(([, v]) => v));
            return unwrap(await fetch(`/api/cpe-serials/collected?${qs}`));
        },
    });
    const contractors = useMemo(() => (options.data?.contractors ?? []).filter((c) => !opmcId || c.opmcId === opmcId), [options.data, opmcId]);
    const rows = list.data ?? [];
    const pending = rows.filter((r) => r.status === "PENDING_HANDBACK");
    const chosen = rows.filter((r) => selected.has(r.id));
    const rtom = options.data?.rtoms.find((r) => r.id === opmcId);
    const contractor = contractors.find((c) => c.id === contractorId);
    const formReady = !!opmcId && !!contractorId && !!month;
    const formSet = chosen.length ? chosen : (status === "PENDING_HANDBACK" ? pending : rows);

    const toggle = (id: string) => setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
    const reset = () => setSelected(new Set());

    const excel = () => {
        const title = `Collected CPE Handing Over Form (${formMonthTitle(month)})`;
        const aoa: (string | number)[][] = [[title], [], FORM_HEAD, ...formRows(formSet, handedOverDate), [], ["", "", "", "", "", "Certify that CPEs received,"], [], ["", "......................................", "", "", "", "......................................"], ["", "Contractor Signature", "", "", "", "OPMC staff member"], ["", contractor?.name ?? "", "", "", "", "(Official stamp to be placed)"]];
        const ws = XLSX.utils.aoa_to_sheet(aoa);
        ws["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 6 } }];
        ws["!cols"] = [{ wch: 6 }, { wch: 12 }, { wch: 16 }, { wch: 22 }, { wch: 16 }, { wch: 24 }, { wch: 20 }];
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, formMonthTitle(month));
        XLSX.writeFile(wb, `collected-cpe-${rtomShort(rtom?.rtom)}-${(contractor?.name ?? "contractor").replace(/[^A-Za-z0-9]+/g, "-")}-${month}.xlsx`);
    };
    const print = () => {
        const w = window.open("", "_blank");
        if (!w) { toast.error("Allow pop-ups to print the form"); return; }
        const body = formRows(formSet, handedOverDate).map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`).join("");
        w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Collected CPE Handing Over Form</title><style>
            body{font-family:"Times New Roman",serif;color:#000;margin:24px} h1{text-align:center;font-size:24px;margin:16px 0 24px}
            table{border-collapse:collapse;width:100%} th,td{border:1px solid #000;padding:4px 6px;text-align:center;font-size:14px} th{font-weight:bold}
            .sig{display:flex;justify-content:space-between;margin-top:56px;font-size:14px} .sig div{width:40%} .dots{border-top:1px dotted #000;margin-bottom:4px}
            .cert{margin:12px 0 0 55%;font-weight:bold}</style></head><body>
            <h1>Collected CPE Handing Over Form (${esc(formMonthTitle(month))})</h1>
            <table><thead><tr>${FORM_HEAD.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>${body}</tbody></table>
            <div class="cert">Certify that CPEs received,</div>
            <div class="sig"><div><div class="dots"></div><b>Contractor Signature</b><br>${esc(contractor?.name ?? "")}</div><div><div class="dots"></div><b>OPMC staff member</b><br><i>(Official stamp to be placed)</i></div></div>
            </body></html>`);
        w.document.close();
        w.focus();
        w.print();
    };
    const markSent = async () => {
        if (!chosen.length) { toast.error("Tick the devices that were handed over"); return; }
        setBusy(true);
        try {
            const res = await fetch("/api/cpe-serials/collected/handover", {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ opmcId, contractorId, month, ids: chosen.map((r) => r.id), handedOverDate, reference: reference || null }),
            });
            const r = await unwrap<{ formNumber: string; itemCount: number }>(res);
            toast.success(`${r.formNumber}: ${r.itemCount} device(s) marked as handed over`);
            reset(); setReference("");
            qc.invalidateQueries({ queryKey: ["collected-cpe"] });
        } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
    };

    return (
        <RoleGuard>
            <div className="flex h-screen overflow-hidden bg-slate-50">
                <Sidebar />
                <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
                    <Header />
                    <main className="flex-1 space-y-5 overflow-y-auto p-4 md:p-6">
                        <div>
                            <h1 className="flex items-center gap-2 text-xl font-extrabold text-slate-900"><PackageMinus className="h-6 w-6 text-blue-800" />Collected CPE</h1>
                            <p className="mt-1 max-w-3xl text-sm text-slate-700">Old devices taken from customers (faulty, or replaced on an upgrade), entered on Confirm Completion. Choose the RTOM, the contractor and the month to make the Collected CPE Handing Over Form for SLT, then mark the devices as handed over.</p>
                        </div>

                        <section className="grid gap-3 rounded-lg border border-slate-300 bg-white p-3 sm:grid-cols-2 lg:grid-cols-4">
                            <label><span className={label}>RTOM</span>
                                <select data-testid="cc-rtom" className={field} value={opmcId} onChange={(e) => { setOpmcId(e.target.value); setContractorId(""); reset(); }}>
                                    <option value="">All my RTOMs</option>
                                    {(options.data?.rtoms ?? []).map((r) => <option key={r.id} value={r.id}>{r.rtom}</option>)}
                                </select>
                            </label>
                            <label><span className={label}>Contractor</span>
                                <select data-testid="cc-contractor" className={field} value={contractorId} onChange={(e) => { setContractorId(e.target.value); reset(); }}>
                                    <option value="">All contractors</option>
                                    {contractors.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                            </label>
                            <label><span className={label}>Collected in (month)</span><input type="month" className={field} value={month} onChange={(e) => { setMonth(e.target.value); reset(); }} /></label>
                            <label><span className={label}>Show</span>
                                <select className={field} value={status} onChange={(e) => { setStatus(e.target.value); reset(); }}>
                                    <option value="PENDING_HANDBACK">Waiting to be handed over</option>
                                    <option value="HANDED_BACK">Handed over</option>
                                    <option value="">All</option>
                                </select>
                            </label>
                        </section>

                        <section className="rounded-lg border border-slate-300 bg-white">
                            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 p-3">
                                <h2 className="text-sm font-extrabold text-slate-900">{rows.length} device{rows.length === 1 ? "" : "s"}{chosen.length ? `, ${chosen.length} ticked` : ""}</h2>
                                <div className="flex flex-wrap gap-2">
                                    <button type="button" disabled={!formReady || !formSet.length} onClick={excel} title={formReady ? "" : "Choose the RTOM, the contractor and the month"} className="inline-flex items-center gap-1 rounded-md border border-slate-500 bg-white px-3 py-1.5 text-xs font-bold text-slate-900 hover:bg-slate-100 disabled:opacity-50"><Download className="h-3.5 w-3.5" />Handing over form (Excel)</button>
                                    <button type="button" disabled={!formReady || !formSet.length} onClick={print} className="inline-flex items-center gap-1 rounded-md border border-slate-500 bg-white px-3 py-1.5 text-xs font-bold text-slate-900 hover:bg-slate-100 disabled:opacity-50"><Printer className="h-3.5 w-3.5" />Print form</button>
                                </div>
                            </div>
                            {!formReady && <p className="border-b border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-800">The form is made for one RTOM, one contractor and one month (the contractor signs it): choose all three above.</p>}
                            <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-slate-200">
                                    <thead className="bg-slate-100"><tr>
                                        <th className={th}><span className="sr-only">Tick</span></th><th className={th}>Order / voice</th><th className={th}>Contractor</th><th className={th}>Device</th><th className={th}>Model</th><th className={th}>Serial</th><th className={th}>Condition</th><th className={th}>Collected</th><th className={th}>Form</th>
                                    </tr></thead>
                                    <tbody className="divide-y divide-slate-200">
                                        {list.isLoading && <tr><td colSpan={9} className={`${td} text-center`}><Loader2 className="mr-2 inline h-4 w-4 animate-spin" />Loading...</td></tr>}
                                        {list.error && <tr><td colSpan={9} className={`${td} text-center font-semibold text-red-800`}>{(list.error as Error).message}</td></tr>}
                                        {list.data && rows.length === 0 && <tr><td colSpan={9} className={`${td} text-center text-slate-700`}>No collected devices for this choice.</td></tr>}
                                        {rows.map((r) => (
                                            <tr key={r.id} data-testid="cc-row" className="hover:bg-slate-50">
                                                <td className={td}>{r.status === "PENDING_HANDBACK" && canRecord && formReady ? <input type="checkbox" aria-label={`Tick ${r.serialNumber}`} checked={selected.has(r.id)} onChange={() => toggle(r.id)} /> : null}</td>
                                                <td className={td}><span className="font-mono text-xs font-bold">{r.soNum}</span><span className="block text-xs text-slate-700">{r.voiceNumber ?? "-"}</span></td>
                                                <td className={td}>{r.contractor}</td>
                                                <td className={td}>{CPE_TYPE_LABEL[r.deviceType as CpeType] ?? r.deviceType}</td>
                                                <td className={td}>{r.model ?? "-"}</td>
                                                <td className={`${td} font-mono ${r.serialUnreadable ? "font-bold text-amber-900" : ""}`}>{r.serialNumber}</td>
                                                <td className={td}>{r.condition === "WORKING" ? "Working" : "Faulty"}</td>
                                                <td className={td}>{formDate(r.collectedDate)}</td>
                                                <td className={`${td} font-mono text-xs`}>{r.formNumber ? `${r.formNumber} (${formDate(r.handedOverDate)})` : "-"}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </section>

                        {canRecord && formReady && pending.length > 0 && (
                            <section className="rounded-lg border-2 border-blue-800 bg-white p-4">
                                <h2 className="text-base font-extrabold text-slate-900">Mark as handed over</h2>
                                <p className="text-sm text-slate-700">Tick the devices on the signed and stamped form, enter the date they were handed over and the reference, then save. The form gets a CCF number; serials in the CPE register become Returned to SLT.</p>
                                <div className="mt-3 grid gap-3 sm:grid-cols-3">
                                    <label><span className={label}>Handed over on</span><input type="date" className={field} value={handedOverDate} max={colombo().slice(0, 10)} onChange={(e) => setHandedOverDate(e.target.value)} /></label>
                                    <label className="sm:col-span-2"><span className={label}>Reference (optional)</span><input className={field} value={reference} onChange={(e) => setReference(e.target.value)} placeholder="OPMC receipt / note" /></label>
                                </div>
                                <div className="mt-3 flex flex-wrap items-center gap-2">
                                    <button type="button" onClick={() => setSelected(new Set(pending.map((r) => r.id)))} className="rounded-md border border-slate-500 bg-white px-3 py-2 text-sm font-bold text-slate-900 hover:bg-slate-100">Tick all {pending.length}</button>
                                    <button type="button" data-testid="cc-mark" disabled={!chosen.length || busy} onClick={markSent} className="inline-flex items-center gap-1 rounded-md bg-blue-800 px-4 py-2 text-sm font-bold text-white hover:bg-blue-900 disabled:opacity-50">{busy && <Loader2 className="h-4 w-4 animate-spin" />}Mark {chosen.length || ""} as handed over</button>
                                </div>
                            </section>
                        )}
                    </main>
                </div>
            </div>
        </RoleGuard>
    );
}
