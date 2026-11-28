"use client";

import { useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, ScanBarcode, Upload, Download, Trash2, X } from "lucide-react";
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import RoleGuard from "@/components/RoleGuard";
import { RBAC_PERMISSIONS } from "@/config/rbac-permissions";
import { CpeSerialInput } from "@/components/cpe/CpeSerialInput";
import { CPE_TYPES, CPE_TYPE_LABEL, CPE_STATUS_LABEL, CPE_MAX_LINES, normalizeSerial, type CpeType } from "@/lib/cpe-serial-rules";

interface Options { rtoms: Array<{ id: string; rtom: string; name: string; storeId: string | null; storeName: string | null }>; contractors: Array<{ id: string; name: string; opmcId: string | null; registrationNumber: string | null }> }
interface RegisterRow { id: string; serialNumber: string; cpeType: string; model: string | null; status: string; rtom: string | null; issueCycle: number; holder: string | null; soNum: string | null; receiptNumber: string | null; sltReference: string | null; receivedAt: string | null }
interface Register { total: number; page: number; pageSize: number; counts: Record<string, number>; rows: RegisterRow[] }
interface PreviewLine { row: number; serial: string; decision: "NEW" | "REISSUE" | "ERROR"; message: string }
interface Receipt { id: string; receiptNumber: string; mode: string; rtom: string; store: string; contractor: string | null; cpeType: string; model: string | null; sltReference: string | null; receivedDate: string; quantity: number; issueNumber: string | null; createdBy: string | null; createdAt: string }
interface History { serial: { serialNumber: string; status: string; rtom: string | null; cpeType: string | null; model: string | null; issueCycle: number; holder: string | null; soNum: string | null; sltReference: string | null }; events: Array<{ at: string; eventType: string; fromStatus: string | null; toStatus: string; issueCycle: number; documentType: string | null; documentNumber: string | null; contractor: string | null; soNum: string | null; sltReference: string | null; reason: string | null; by: string | null }> }

const unwrap = async <T,>(res: Response): Promise<T> => {
    const body = await res.json().catch(() => ({}));
    if (!res.ok || body?.success === false) throw new Error(body?.error?.message || body?.error || `Request failed (${res.status})`);
    return (body.data ?? body) as T;
};
const day = (d: string | null) => (d ? new Date(d).toLocaleDateString("en-GB") : "-");
const when = (d: string) => new Date(d).toLocaleString("en-GB", { dateStyle: "short", timeStyle: "short" });
const today = () => new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 10);
const STATUS_TONE: Record<string, string> = {
    IN_STORE: "border-sky-700 bg-sky-50 text-sky-950", ISSUED: "border-emerald-700 bg-emerald-50 text-emerald-950", INSTALLED: "border-slate-600 bg-slate-100 text-slate-900",
    RECOVERED: "border-amber-600 bg-amber-50 text-amber-950", FAULTY: "border-red-700 bg-red-50 text-red-900", RETURNED_TO_SLT: "border-violet-700 bg-violet-50 text-violet-950",
};
const label = "block text-xs font-bold uppercase tracking-wide text-slate-700";
const field = "mt-1 w-full rounded-md border border-slate-400 bg-white px-3 py-2 text-sm text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-700";
const th = "px-3 py-2 text-left text-xs font-bold uppercase tracking-wide text-slate-800";
const td = "px-3 py-2 text-sm text-slate-900";

export default function CpeSerialsPage() {
    const qc = useQueryClient();
    const [canReceive] = useState(() => {
        if (typeof window === "undefined") return false;
        try { const u = JSON.parse(localStorage.getItem("user") || "{}"); return Array.isArray(u.permissions) && u.permissions.includes(RBAC_PERMISSIONS.INVENTORY_CPE_RECEIVE); } catch { return false; }
    });
    const [mode, setMode] = useState<null | "DIRECT_TO_CONTRACTOR" | "TO_STORE">(null);
    const [filters, setFilters] = useState({ opmcId: "", status: "", cpeType: "", q: "" });
    const [search, setSearch] = useState("");
    const [page, setPage] = useState(1);
    const [historyOf, setHistoryOf] = useState<string | null>(null);

    const options = useQuery<Options>({ queryKey: ["cpe-options"], queryFn: async () => unwrap(await fetch("/api/cpe-serials/options")) });
    const register = useQuery<Register>({
        queryKey: ["cpe-register", filters, page],
        queryFn: async () => {
            const qs = new URLSearchParams({ ...Object.fromEntries(Object.entries(filters).filter(([, v]) => v)), page: String(page) });
            return unwrap(await fetch(`/api/cpe-serials?${qs}`));
        },
    });
    const receipts = useQuery<Receipt[]>({ queryKey: ["cpe-receipts"], queryFn: async () => unwrap(await fetch("/api/cpe-serials/receipts")) });

    const counts = register.data?.counts ?? {};
    const pages = register.data ? Math.max(1, Math.ceil(register.data.total / register.data.pageSize)) : 1;

    return (
        <RoleGuard>
            <div className="flex h-screen overflow-hidden bg-slate-50">
                <Sidebar />
                <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
                    <Header />
                    <main className="flex-1 space-y-5 overflow-y-auto p-4 md:p-6">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                                <h1 className="flex items-center gap-2 text-xl font-extrabold text-slate-900"><ScanBarcode className="h-6 w-6 text-blue-800" />CPE Serials</h1>
                                <p className="mt-1 max-w-3xl text-sm text-slate-700">Serials of the CPE devices (ONT, STB, phone) that SLT issues through the CPE Locator, for your RTOMs. Every serial belongs to one RTOM. Scan with a barcode scanner or the camera, or type.</p>
                            </div>
                            {canReceive && (
                                <div className="flex flex-wrap gap-2">
                                    <button type="button" data-testid="cpe-open-direct" onClick={() => setMode("DIRECT_TO_CONTRACTOR")} className="rounded-md bg-blue-800 px-3 py-2 text-sm font-bold text-white hover:bg-blue-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-700">Record SLT issue to contractor</button>
                                    <button type="button" data-testid="cpe-open-store" onClick={() => setMode("TO_STORE")} className="rounded-md border border-blue-800 bg-white px-3 py-2 text-sm font-bold text-blue-900 hover:bg-blue-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-700">Receive CPE bundle (store)</button>
                                </div>
                            )}
                        </div>

                        {mode && options.data && (
                            <ReceiptForm key={mode} mode={mode} options={options.data} onClose={() => setMode(null)} onSaved={() => { qc.invalidateQueries({ queryKey: ["cpe-register"] }); qc.invalidateQueries({ queryKey: ["cpe-receipts"] }); }} />
                        )}

                        <section className="flex flex-wrap gap-2" aria-label="Serials by status">
                            {Object.keys(CPE_STATUS_LABEL).map((s) => (
                                <button key={s} type="button" onClick={() => { setFilters((f) => ({ ...f, status: f.status === s ? "" : s })); setPage(1); }}
                                    className={`rounded-md border px-3 py-1.5 text-xs font-bold ${STATUS_TONE[s]} ${filters.status === s ? "ring-2 ring-blue-700" : ""}`}>
                                    {CPE_STATUS_LABEL[s]}: {counts[s] ?? 0}
                                </button>
                            ))}
                        </section>

                        <section className="rounded-lg border border-slate-300 bg-white">
                            <div className="flex flex-wrap items-end gap-3 border-b border-slate-200 p-3">
                                <div className="w-full sm:w-72">
                                    <span className={label}>Find a serial</span>
                                    <CpeSerialInput className="mt-1" value={search} onChange={setSearch} onCommit={(s) => { setFilters((f) => ({ ...f, q: s })); setPage(1); }} placeholder="Scan or type part of a serial" testId="cpe-search" />
                                </div>
                                <label className="w-40"><span className={label}>RTOM</span>
                                    <select className={field} value={filters.opmcId} onChange={(e) => { setFilters((f) => ({ ...f, opmcId: e.target.value })); setPage(1); }}>
                                        <option value="">All my RTOMs</option>
                                        {(options.data?.rtoms ?? []).map((r) => <option key={r.id} value={r.id}>{r.rtom}</option>)}
                                    </select>
                                </label>
                                <label className="w-40"><span className={label}>Type</span>
                                    <select className={field} value={filters.cpeType} onChange={(e) => { setFilters((f) => ({ ...f, cpeType: e.target.value })); setPage(1); }}>
                                        <option value="">All</option>
                                        {CPE_TYPES.map((t) => <option key={t} value={t}>{CPE_TYPE_LABEL[t]}</option>)}
                                    </select>
                                </label>
                                {(filters.q || filters.opmcId || filters.status || filters.cpeType) && (
                                    <button type="button" onClick={() => { setFilters({ opmcId: "", status: "", cpeType: "", q: "" }); setSearch(""); setPage(1); }} className="rounded-md border border-slate-400 bg-white px-3 py-2 text-sm font-bold text-slate-900 hover:bg-slate-100">Clear</button>
                                )}
                            </div>
                            <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-slate-200">
                                    <thead className="bg-slate-100"><tr>
                                        <th className={th}>Serial</th><th className={th}>Type / model</th><th className={th}>RTOM</th><th className={th}>Status</th><th className={th}>With / on</th><th className={th}>Cycle</th><th className={th}>Receipt</th><th className={th}>Received</th>
                                    </tr></thead>
                                    <tbody className="divide-y divide-slate-200">
                                        {register.isLoading && <tr><td colSpan={8} className={`${td} text-center`}><Loader2 className="mr-2 inline h-4 w-4 animate-spin" />Loading the register...</td></tr>}
                                        {register.error && <tr><td colSpan={8} className={`${td} text-center font-semibold text-red-800`}>{(register.error as Error).message}</td></tr>}
                                        {register.data && register.data.rows.length === 0 && <tr><td colSpan={8} className={`${td} text-center text-slate-700`}>No CPE serials yet{filters.q || filters.status ? " for this filter" : ""}.</td></tr>}
                                        {register.data?.rows.map((r) => (
                                            <tr key={r.id} className="hover:bg-slate-50">
                                                <td className={td}><button type="button" onClick={() => setHistoryOf(r.serialNumber)} className="font-mono font-bold text-blue-900 underline decoration-dotted underline-offset-2">{r.serialNumber}</button></td>
                                                <td className={td}>{CPE_TYPE_LABEL[r.cpeType as CpeType] ?? r.cpeType}{r.model ? <span className="block text-xs text-slate-700">{r.model}</span> : null}</td>
                                                <td className={td}>{r.rtom ?? "-"}</td>
                                                <td className={td}><span className={`rounded border px-2 py-0.5 text-xs font-bold ${STATUS_TONE[r.status] ?? "border-slate-500 bg-white text-slate-900"}`}>{CPE_STATUS_LABEL[r.status] ?? r.status}</span></td>
                                                <td className={td}>{r.holder ?? "-"}</td>
                                                <td className={td}>{r.issueCycle}</td>
                                                <td className={`${td} font-mono text-xs`}>{r.receiptNumber ?? "-"}</td>
                                                <td className={td}>{day(r.receivedAt)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            {register.data && register.data.total > register.data.pageSize && (
                                <div className="flex items-center justify-end gap-2 border-t border-slate-200 p-2 text-sm text-slate-900">
                                    <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="rounded border border-slate-400 px-2 py-1 font-bold disabled:opacity-40">Prev</button>
                                    <span>{page} / {pages} ({register.data.total})</span>
                                    <button type="button" disabled={page >= pages} onClick={() => setPage((p) => p + 1)} className="rounded border border-slate-400 px-2 py-1 font-bold disabled:opacity-40">Next</button>
                                </div>
                            )}
                        </section>

                        <section className="rounded-lg border border-slate-300 bg-white">
                            <h2 className="border-b border-slate-200 px-3 py-2 text-sm font-extrabold text-slate-900">Latest receipts from SLT</h2>
                            <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-slate-200">
                                    <thead className="bg-slate-100"><tr>
                                        <th className={th}>Receipt</th><th className={th}>How</th><th className={th}>RTOM</th><th className={th}>Contractor / store</th><th className={th}>Type</th><th className={th}>Qty</th><th className={th}>SLT reference</th><th className={th}>Received</th><th className={th}>MIN</th><th className={th}>By</th>
                                    </tr></thead>
                                    <tbody className="divide-y divide-slate-200">
                                        {(receipts.data ?? []).length === 0 && <tr><td colSpan={10} className={`${td} text-center text-slate-700`}>{receipts.isLoading ? "Loading..." : "No receipts yet."}</td></tr>}
                                        {(receipts.data ?? []).map((r) => (
                                            <tr key={r.id}>
                                                <td className={`${td} font-mono text-xs font-bold`}>{r.receiptNumber}</td>
                                                <td className={td}>{r.mode === "DIRECT_TO_CONTRACTOR" ? "To the contractor" : "To the store"}</td>
                                                <td className={td}>{r.rtom}</td>
                                                <td className={td}>{r.contractor ?? r.store}</td>
                                                <td className={td}>{CPE_TYPE_LABEL[r.cpeType as CpeType] ?? r.cpeType}{r.model ? ` (${r.model})` : ""}</td>
                                                <td className={td}>{r.quantity}</td>
                                                <td className={td}>{r.sltReference ?? "-"}</td>
                                                <td className={td}>{day(r.receivedDate)}</td>
                                                <td className={`${td} font-mono text-xs`}>{r.issueNumber ?? "-"}</td>
                                                <td className={td}>{r.createdBy ?? "-"}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </section>
                    </main>
                </div>
            </div>
            {historyOf && <HistoryPanel serial={historyOf} onClose={() => setHistoryOf(null)} />}
        </RoleGuard>
    );
}

function ReceiptForm({ mode, options, onClose, onSaved }: { mode: "DIRECT_TO_CONTRACTOR" | "TO_STORE"; options: Options; onClose: () => void; onSaved: () => void }) {
    const direct = mode === "DIRECT_TO_CONTRACTOR";
    const [opmcId, setOpmcId] = useState(options.rtoms.length === 1 ? options.rtoms[0].id : "");
    const [contractorId, setContractorId] = useState("");
    const [cpeType, setCpeType] = useState<CpeType>("ONT");
    const [model, setModel] = useState("");
    const [sltReference, setSltReference] = useState("");
    const [receivedDate, setReceivedDate] = useState(today());
    const [remarks, setRemarks] = useState("");
    const [scan, setScan] = useState("");
    const [serials, setSerials] = useState<Array<{ serial: string; model?: string }>>([]);
    const [preview, setPreview] = useState<PreviewLine[] | null>(null);
    const [busy, setBusy] = useState<"" | "check" | "save">("");
    const [done, setDone] = useState<{ receiptNumber: string; issueNumber: string | null; quantity: number } | null>(null);
    const fileRef = useRef<HTMLInputElement>(null);

    const rtom = options.rtoms.find((r) => r.id === opmcId);
    const contractors = useMemo(() => options.contractors.filter((c) => c.opmcId === opmcId), [options.contractors, opmcId]);
    const errors = preview?.filter((p) => p.decision === "ERROR") ?? [];
    const rows = () => serials.map((s, i) => ({ row: i + 1, serial: s.serial, model: s.model ?? null }));
    const changed = () => { setPreview(null); setDone(null); };

    const add = (raw: string) => {
        const s = normalizeSerial(raw);
        setScan("");
        if (!s) return;
        if (serials.some((x) => x.serial === s)) { toast.warning(`${s} is already in the list`); return; }
        if (serials.length >= CPE_MAX_LINES) { toast.error(`At most ${CPE_MAX_LINES} serials at a time`); return; }
        setSerials((l) => [...l, { serial: s }]);
        changed();
    };

    const template = () => {
        const ws = XLSX.utils.aoa_to_sheet([["Serial number", "CPE type (ONT / STB / PHONE)", "Model"], ["", cpeType, ""]]);
        ws["!cols"] = [{ wch: 26 }, { wch: 28 }, { wch: 20 }];
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "CPE serials");
        XLSX.writeFile(wb, `cpe-serials-template-${today()}.xlsx`);
    };
    const upload = async (file: File) => {
        const wb = XLSX.read(await file.arrayBuffer());
        const grid = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: "" });
        const head = (grid[0] ?? []).map((h) => String(h).toLowerCase());
        const col = (re: RegExp, fallback: number) => { const i = head.findIndex((h) => re.test(h)); return i >= 0 ? i : fallback; };
        const cSerial = col(/serial/, 0), cModel = col(/model/, 2);
        const found = grid.slice(1).map((r) => ({ serial: normalizeSerial(r[cSerial]), model: String(r[cModel] ?? "").trim() || undefined })).filter((r) => r.serial);
        const merged = [...serials];
        for (const f of found) if (!merged.some((m) => m.serial === f.serial)) merged.push(f);
        setSerials(merged.slice(0, CPE_MAX_LINES));
        changed();
        toast.success(`${found.length} serials read from ${file.name}`);
    };

    const check = async () => {
        if (!opmcId) { toast.error("Choose the RTOM"); return; }
        setBusy("check");
        try {
            const res = await fetch("/api/cpe-serials/receipts/preview", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ opmcId, cpeType, rows: rows() }) });
            setPreview(await unwrap<PreviewLine[]>(res));
        } catch (e) { toast.error((e as Error).message); } finally { setBusy(""); }
    };
    const save = async () => {
        setBusy("save");
        try {
            const res = await fetch("/api/cpe-serials/receipts", {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ mode, opmcId, contractorId: direct ? contractorId || null : null, cpeType, model: model || null, sltReference: sltReference || null, receivedDate, remarks: remarks || null, rows: rows() }),
            });
            const r = await unwrap<{ receiptNumber: string; issueNumber: string | null; quantity: number }>(res);
            setDone(r); setSerials([]); setPreview(null); onSaved();
            toast.success(`${r.receiptNumber} saved${r.issueNumber ? `, issued on ${r.issueNumber}` : ""}`);
        } catch (e) { toast.error((e as Error).message); } finally { setBusy(""); }
    };

    return (
        <section data-testid="cpe-receipt-form" className="rounded-lg border-2 border-blue-800 bg-white p-4">
            <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                    <h2 className="text-base font-extrabold text-slate-900">{direct ? "Record SLT issue to a contractor" : "Receive a CPE bundle into the RTOM store"}</h2>
                    <p className="text-sm text-slate-700">{direct ? "Small quantities SLT handed straight to the contractor: the serials are received into the RTOM store and issued to the contractor on a MIN in one step." : "A bundle from SLT into the store of the RTOM; the store then issues the serials to contractors on the normal Goods Issue (MIN), scanning each serial."}</p>
                </div>
                <button type="button" onClick={onClose} aria-label="Close the form" className="rounded p-1 text-slate-800 hover:bg-slate-100"><X className="h-5 w-5" /></button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <label><span className={label}>RTOM</span>
                    <select data-testid="cpe-rtom" className={field} value={opmcId} onChange={(e) => { setOpmcId(e.target.value); setContractorId(""); changed(); }}>
                        <option value="">Choose...</option>
                        {options.rtoms.map((r) => <option key={r.id} value={r.id}>{r.rtom}{r.name ? ` - ${r.name}` : ""}</option>)}
                    </select>
                </label>
                {direct && (
                    <label><span className={label}>Contractor</span>
                        <select data-testid="cpe-contractor" className={field} value={contractorId} disabled={!opmcId} onChange={(e) => { setContractorId(e.target.value); changed(); }}>
                            <option value="">{opmcId ? (contractors.length ? "Choose..." : "No active contractor in this RTOM") : "Choose the RTOM first"}</option>
                            {contractors.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                    </label>
                )}
                <label><span className={label}>CPE type</span>
                    <select data-testid="cpe-type" className={field} value={cpeType} onChange={(e) => { setCpeType(e.target.value as CpeType); changed(); }}>
                        {CPE_TYPES.map((t) => <option key={t} value={t}>{CPE_TYPE_LABEL[t]}</option>)}
                    </select>
                </label>
                <label><span className={label}>Model (optional)</span><input className={field} value={model} onChange={(e) => setModel(e.target.value)} placeholder="e.g. TP LINK, PROLINK" /></label>
                <label><span className={label}>SLT reference (optional)</span><input className={field} value={sltReference} onChange={(e) => setSltReference(e.target.value)} placeholder="SLT issue note / reference" /></label>
                <label><span className={label}>Received on</span><input type="date" className={field} value={receivedDate} max={today()} onChange={(e) => { setReceivedDate(e.target.value); changed(); }} /></label>
                <label className="sm:col-span-2"><span className={label}>Remarks (optional)</span><input className={field} value={remarks} onChange={(e) => setRemarks(e.target.value)} /></label>
            </div>
            {rtom && !rtom.storeId && (
                <p role="alert" className="mt-3 rounded border border-amber-600 bg-amber-50 p-2 text-sm font-semibold text-amber-950">{rtom.rtom} has no store linked yet. The administrator links it in Inventory / Stores (store form, RTOMs) before serials can be recorded here.</p>
            )}

            <div className="mt-4 grid gap-4 lg:grid-cols-2">
                <div>
                    <span className={label}>Serials ({serials.length})</span>
                    <CpeSerialInput className="mt-1" value={scan} onChange={setScan} onCommit={add} autoFocus testId="cpe-scan" placeholder="Scan with the barcode scanner, the camera, or type and press Enter" />
                    <div className="mt-2 flex flex-wrap gap-2">
                        <button type="button" onClick={template} className="inline-flex items-center gap-1 rounded-md border border-slate-400 bg-white px-3 py-1.5 text-xs font-bold text-slate-900 hover:bg-slate-100"><Download className="h-3.5 w-3.5" />Template</button>
                        <button type="button" onClick={() => fileRef.current?.click()} className="inline-flex items-center gap-1 rounded-md border border-slate-400 bg-white px-3 py-1.5 text-xs font-bold text-slate-900 hover:bg-slate-100"><Upload className="h-3.5 w-3.5" />Upload Excel</button>
                        <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ""; }} />
                        {serials.length > 0 && <button type="button" onClick={() => { setSerials([]); changed(); }} className="rounded-md border border-slate-400 bg-white px-3 py-1.5 text-xs font-bold text-slate-900 hover:bg-slate-100">Clear list</button>}
                    </div>
                </div>
                <div className="max-h-72 overflow-y-auto rounded-md border border-slate-300">
                    <table className="min-w-full divide-y divide-slate-200">
                        <thead className="sticky top-0 bg-slate-100"><tr><th className={th}>#</th><th className={th}>Serial</th><th className={th}>Check</th><th className={th}><span className="sr-only">Remove</span></th></tr></thead>
                        <tbody className="divide-y divide-slate-200">
                            {serials.length === 0 && <tr><td colSpan={4} className={`${td} text-center text-slate-700`}>No serials yet: scan, type or upload.</td></tr>}
                            {serials.map((s, i) => {
                                const p = preview?.find((x) => x.row === i + 1);
                                const tone = !p ? "text-slate-700" : p.decision === "ERROR" ? "font-semibold text-red-800" : "text-emerald-800";
                                return (
                                    <tr key={s.serial} data-testid="cpe-line">
                                        <td className={td}>{i + 1}</td>
                                        <td className={`${td} font-mono`}>{s.serial}</td>
                                        <td className={`${td} text-xs ${tone}`}>{p ? p.message : "Not checked yet"}</td>
                                        <td className={td}><button type="button" aria-label={`Remove ${s.serial}`} onClick={() => { setSerials((l) => l.filter((x) => x.serial !== s.serial)); changed(); }} className="rounded p-1 text-slate-800 hover:bg-slate-100"><Trash2 className="h-4 w-4" /></button></td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
                <button type="button" data-testid="cpe-check-list" disabled={!serials.length || !opmcId || !!busy} onClick={check} className="inline-flex items-center gap-1 rounded-md border border-blue-800 bg-white px-4 py-2 text-sm font-bold text-blue-900 hover:bg-blue-50 disabled:opacity-50">{busy === "check" && <Loader2 className="h-4 w-4 animate-spin" />}Check the list</button>
                <button type="button" data-testid="cpe-save" disabled={!preview || errors.length > 0 || !!busy || (direct && !contractorId) || !rtom?.storeId} onClick={save} className="inline-flex items-center gap-1 rounded-md bg-blue-800 px-4 py-2 text-sm font-bold text-white hover:bg-blue-900 disabled:opacity-50">{busy === "save" && <Loader2 className="h-4 w-4 animate-spin" />}Save {serials.length || ""} serial{serials.length === 1 ? "" : "s"}</button>
                {preview && errors.length > 0 && <span className="text-sm font-semibold text-red-800">{errors.length} line{errors.length === 1 ? "" : "s"} to fix or remove before saving</span>}
                {preview && errors.length === 0 && <span className="text-sm font-semibold text-emerald-800">All {preview.length} serials are fine</span>}
                {done && <span data-testid="cpe-done" className="rounded border border-emerald-700 bg-emerald-50 px-2 py-1 text-sm font-bold text-emerald-900">Saved: {done.receiptNumber}{done.issueNumber ? ` and issue note ${done.issueNumber}` : ""} ({done.quantity})</span>}
            </div>
        </section>
    );
}

function HistoryPanel({ serial, onClose }: { serial: string; onClose: () => void }) {
    const q = useQuery<History>({ queryKey: ["cpe-history", serial], queryFn: async () => unwrap(await fetch(`/api/cpe-serials/history?serial=${encodeURIComponent(serial)}`)) });
    return (
        <div role="dialog" aria-modal="true" aria-label={`History of ${serial}`} className="fixed inset-0 z-50 flex justify-end bg-slate-950/50" onClick={onClose}>
            <div className="h-full w-full max-w-xl overflow-y-auto bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-start justify-between">
                    <h2 className="font-mono text-lg font-extrabold text-slate-900">{serial}</h2>
                    <button type="button" onClick={onClose} aria-label="Close" className="rounded p-1 text-slate-800 hover:bg-slate-100"><X className="h-5 w-5" /></button>
                </div>
                {q.isLoading && <p className="mt-3 text-sm text-slate-700"><Loader2 className="mr-1 inline h-4 w-4 animate-spin" />Loading...</p>}
                {q.error && <p className="mt-3 text-sm font-semibold text-red-800">{(q.error as Error).message}</p>}
                {q.data && (
                    <>
                        <dl className="mt-3 grid grid-cols-2 gap-2 text-sm text-slate-900">
                            <div><dt className={label}>Status</dt><dd className="font-semibold">{CPE_STATUS_LABEL[q.data.serial.status] ?? q.data.serial.status}</dd></div>
                            <div><dt className={label}>RTOM</dt><dd>{q.data.serial.rtom ?? "-"}</dd></div>
                            <div><dt className={label}>Type / model</dt><dd>{CPE_TYPE_LABEL[q.data.serial.cpeType as CpeType] ?? "-"}{q.data.serial.model ? ` (${q.data.serial.model})` : ""}</dd></div>
                            <div><dt className={label}>With / on</dt><dd>{q.data.serial.holder ?? q.data.serial.soNum ?? "-"}</dd></div>
                            <div><dt className={label}>Issue cycle</dt><dd>{q.data.serial.issueCycle}</dd></div>
                            <div><dt className={label}>SLT reference</dt><dd>{q.data.serial.sltReference ?? "-"}</dd></div>
                        </dl>
                        <h3 className="mt-5 text-sm font-extrabold text-slate-900">History</h3>
                        <ol className="mt-2 space-y-2">
                            {q.data.events.map((e, i) => (
                                <li key={i} className="rounded border border-slate-300 bg-slate-50 p-2 text-sm text-slate-900">
                                    <div className="flex flex-wrap justify-between gap-2"><span className="font-bold">{e.eventType.replaceAll("_", " ").toLowerCase().replace(/^./, (c) => c.toUpperCase())}</span><span className="text-xs text-slate-700">{when(e.at)}</span></div>
                                    <div className="text-xs text-slate-800">
                                        {e.fromStatus ? `${CPE_STATUS_LABEL[e.fromStatus] ?? e.fromStatus} -> ` : ""}{CPE_STATUS_LABEL[e.toStatus] ?? e.toStatus} - cycle {e.issueCycle}
                                        {e.documentNumber ? ` - ${e.documentType} ${e.documentNumber}` : ""}{e.contractor ? ` - ${e.contractor}` : ""}{e.soNum ? ` - order ${e.soNum}` : ""}{e.sltReference ? ` - SLT ${e.sltReference}` : ""}{e.by ? ` - by ${e.by}` : ""}
                                    </div>
                                    {e.reason && <div className="text-xs italic text-slate-800">{e.reason}</div>}
                                </li>
                            ))}
                        </ol>
                    </>
                )}
            </div>
        </div>
    );
}
