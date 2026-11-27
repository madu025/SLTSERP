"use client";
import { Fragment, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import RoleGuard from "@/components/RoleGuard";
import GatePanel from "@/components/purchase/GatePanel";
import { RBAC_PERMISSIONS } from "@/config/rbac-permissions";
import { OPENING_TEMPLATE_HEADERS, readOpeningRows, openingSubmitGate, openingApproveGate, linesTotal, type OpeningItem, type OpeningRow } from "@/lib/opening-stock-rules";

interface Store { id: string; name: string }
interface Load {
    id: string; loadNumber: string; storeId: string; store: string; status: string; countDate: string; countSheetUrl: string; remarks: string | null;
    totalQty: number; totalValue: number; createdById: string; createdBy: string | null; createdAt: string; approvedBy: string | null; approvedAt: string | null;
    rejectedBy: string | null; rejectionReason: string | null;
    lines: { code: string; name: string; unit: string | null; quantity: number; unitCost: number; batchNumber: string | null; expiryDate: string | null }[];
}

const money = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const qtyText = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 4 });
const today = () => new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 10);
const day = (s: string | null) => (s ? new Date(s).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Colombo" }) : "-");
const STATUS_STYLE: Record<string, string> = { SUBMITTED: "border-amber-300 bg-amber-50 text-amber-900", APPROVED: "border-emerald-300 bg-emerald-50 text-emerald-900", REJECTED: "border-red-300 bg-red-50 text-red-900" };
const STATUS_LABEL: Record<string, string> = { SUBMITTED: "Waiting for approval", APPROVED: "Approved: in stock", REJECTED: "Rejected" };

async function getJson<T>(url: string): Promise<T> {
    const res = await fetch(url, { cache: "no-store" });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json?.error?.message || "Could not load");
    const d = json.data ?? json;
    return (Array.isArray(d) ? d : d.items ?? d.data ?? d.stores ?? d.stock ?? d) as T;
}

/**
 * Opening stock (go-live): the store's physical count is uploaded from Excel with its cost, submitted, and approved by another person
 * (lib/opening-stock-rules.ts, the server checks the same). Approval creates the FIFO batches, the store stock and the ledger entries.
 */
export default function OpeningStockPage() {
    const qc = useQueryClient();
    const [me] = useState<{ id: string; canApprove: boolean }>(() => {
        if (typeof window === "undefined") return { id: "", canApprove: false };
        try { const u = JSON.parse(localStorage.getItem("user") || "{}"); return { id: String(u.id ?? ""), canApprove: Array.isArray(u.permissions) && u.permissions.includes(RBAC_PERMISSIONS.INVENTORY_APPROVE) }; } catch { return { id: "", canApprove: false }; }
    });
    const [storeId, setStoreId] = useState("");
    const [countDate, setCountDate] = useState("");
    const [rows, setRows] = useState<OpeningRow[]>([]);
    const [fileName, setFileName] = useState("");
    const [sheetUrl, setSheetUrl] = useState("");
    const [uploading, setUploading] = useState(false);
    const [remarks, setRemarks] = useState("");
    const [open, setOpen] = useState<string | null>(null);
    const [decision, setDecision] = useState<"APPROVE" | "REJECT">("APPROVE");
    const [reason, setReason] = useState("");

    const { data: stores = [] } = useQuery<Store[]>({ queryKey: ["os-stores"], queryFn: () => getJson<Store[]>("/api/stores?page=1&limit=1000") });
    const { data: items = [] } = useQuery<OpeningItem[]>({ queryKey: ["os-items"], queryFn: () => getJson<OpeningItem[]>("/api/inventory/items?page=1&limit=5000") });
    const { data: loads = [], isLoading } = useQuery<Load[]>({ queryKey: ["opening-loads"], queryFn: () => getJson<Load[]>("/api/inventory/opening-stock") });
    const { data: storeStock = [] } = useQuery<{ itemId: string; quantity: number | string }[]>({
        queryKey: ["os-stock", storeId], enabled: !!storeId,
        queryFn: () => getJson<{ itemId: string; quantity: number | string }[]>(`/api/inventory/stock?storeId=${storeId}`),
    });

    const lines = useMemo(() => readOpeningRows(rows, items), [rows, items]);
    const already = useMemo(() => {
        const inStock = (Array.isArray(storeStock) ? storeStock : []).filter((s) => Number(s.quantity) !== 0).map((s) => s.itemId);
        const pending = loads.filter((l) => l.storeId === storeId && l.status === "SUBMITTED").flatMap((l) => l.lines.map((x) => items.find((i) => i.code === x.code)?.id)).filter((x): x is string => !!x);
        return [...new Set([...inStock, ...pending])];
    }, [storeStock, loads, storeId, items]);
    const checks = openingSubmitGate({ storeChosen: !!storeId, lines, countDate: countDate || null, today: today(), countSheetAttached: !!sheetUrl, alreadyLoaded: already });
    const totals = linesTotal(lines);

    const downloadTemplate = () => {
        // every item of the item list, with its unit and its master cost as a starting value; the store fills in what was counted
        const data = [OPENING_TEMPLATE_HEADERS as unknown as string[], ...items.map((i) => [i.code, i.name, i.unit ?? "", "", Number(i.costPrice ?? 0) > 0 ? Number(i.costPrice) : "", "", ""])];
        const ws = XLSX.utils.aoa_to_sheet(data);
        ws["!cols"] = [{ wch: 18 }, { wch: 40 }, { wch: 8 }, { wch: 10 }, { wch: 14 }, { wch: 16 }, { wch: 12 }];
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Opening stock");
        XLSX.writeFile(wb, `opening-stock-template-${today()}.xlsx`);
    };

    const readSheet = async (file: File) => {
        const wb = XLSX.read(await file.arrayBuffer(), { cellDates: true });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const grid = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: "" });
        const head = (grid[0] ?? []).map((h) => String(h).trim().toLowerCase());
        const col = (name: string) => head.findIndex((h) => h.startsWith(name));
        const [c, q, u, b, e] = [col("item code"), col("quantity"), col("unit cost"), col("batch"), col("expiry")];
        if (c < 0 || q < 0 || u < 0) { toast.error("The sheet needs the columns Item code, Quantity and Unit cost (Rs.): use the template"); return; }
        // rows with no quantity are items the store does not hold: they are left out
        const read: OpeningRow[] = grid.slice(1).map((r, i) => ({ row: i + 2, code: String(r[c] ?? ""), quantity: r[q], unitCost: r[u], batchNumber: b >= 0 ? r[b] : "", expiryDate: e >= 0 ? r[e] : "" }))
            .filter((r) => String(r.quantity ?? "").trim() !== "" && String(r.quantity) !== "0");
        setRows(read);
        setFileName(file.name);
    };

    const uploadScan = async (file: File) => {
        setUploading(true);
        try {
            const fd = new FormData();
            fd.append("file", file);
            fd.append("bucket", "inventory");
            const res = await fetch("/api/upload", { method: "POST", body: fd });
            const json = await res.json().catch(() => ({}));
            const url = json?.url ?? json?.data?.url;
            if (!res.ok || !url) throw new Error(json?.error?.message || "Upload failed");
            setSheetUrl(url);
        } catch (e) { toast.error((e as Error).message); setSheetUrl(""); } finally { setUploading(false); }
    };

    const submit = useMutation({
        mutationFn: async () => {
            const res = await fetch("/api/inventory/opening-stock", {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ storeId, countDate, countSheetUrl: sheetUrl, remarks: remarks || null, rows: rows.map((r) => ({ row: r.row, code: r.code, quantity: r.quantity === "" ? null : (r.quantity as string | number), unitCost: r.unitCost === "" ? null : (r.unitCost as string | number), batchNumber: (r.batchNumber as string | number) || null, expiryDate: r.expiryDate instanceof Date ? r.expiryDate.toISOString().slice(0, 10) : (r.expiryDate as string | number) || null })) }),
            });
            const json = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(json?.error?.message || "Could not submit");
            return json.data ?? json;
        },
        onSuccess: (d) => { toast.success(`${d.loadNumber} submitted: another person approves it`); setRows([]); setFileName(""); setSheetUrl(""); setRemarks(""); qc.invalidateQueries({ queryKey: ["opening-loads"] }); },
        onError: (e: Error) => toast.error(e.message),
    });
    const decide = useMutation({
        mutationFn: async (v: { id: string; action: "APPROVE" | "REJECT"; reason?: string }) => {
            const res = await fetch(`/api/inventory/opening-stock/${v.id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: v.action, reason: v.reason }) });
            const json = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(json?.error?.message || "The action failed");
            return json;
        },
        onSuccess: (_d, v) => { toast.success(v.action === "APPROVE" ? "Approved: the stock is in the store" : "Rejected: the submitter is told why"); setOpen(null); setReason(""); qc.invalidateQueries({ queryKey: ["opening-loads"] }); qc.invalidateQueries({ queryKey: ["os-stock"] }); },
        onError: (e: Error) => toast.error(e.message),
    });

    const th = "px-2 py-1.5 text-left text-xs font-bold !bg-slate-100 !text-slate-800";
    const thNum = `${th} !text-right`;
    const td = "px-2 py-1.5 text-sm text-slate-900 align-top";
    const tdNum = `${td} text-right tabular-nums whitespace-nowrap`;

    return (
        <RoleGuard>
        <div className="flex h-screen overflow-hidden bg-slate-50">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto">
        <div className="pf mx-auto max-w-7xl space-y-4 p-4 sm:p-6" data-testid="opening-stock-page">
            <div>
                <h1 className="text-xl font-black text-slate-900">Opening stock</h1>
                <p className="max-w-3xl text-sm text-slate-700">Load what each store holds when it starts on Nexus: count the store, fill the template, upload it with the signed count sheet. Another person checks and approves it; only then does the stock enter the store, valued at the cost you give. An item is loaded once per store; later differences are corrected with a cycle count.</p>
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
                <div className="space-y-4">
                    <section className="pf-step">
                        <div className="pf-step-title"><b>1</b>Store and count date</div>
                        <p className="pf-step-note">The store that was counted, and the day it was counted.</p>
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            <div className="pf-field"><label htmlFor="os-store">Store</label>
                                <select id="os-store" className="pf-input" aria-invalid={!storeId && rows.length > 0} value={storeId} onChange={(e) => setStoreId(e.target.value)}>
                                    <option value="">Select store...</option>
                                    {stores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                                </select></div>
                            <div className="pf-field"><label htmlFor="os-date">Count date</label>
                                <input id="os-date" type="date" max={today()} className="pf-input" aria-invalid={!!countDate && countDate > today()} value={countDate} onChange={(e) => setCountDate(e.target.value)} /></div>
                        </div>
                    </section>

                    <section className="pf-step">
                        <div className="pf-step-title"><b>2</b>Count sheet (Excel)</div>
                        <p className="pf-step-note">Download the template: it lists every item with its unit and its cost from the item list. Fill in Quantity and check the Unit cost for what the store holds; leave the other rows empty. Batch number and expiry date are optional.</p>
                        <div className="flex flex-wrap items-end gap-3">
                            <button type="button" data-testid="os-template" onClick={downloadTemplate} disabled={items.length === 0} className="rounded-md border border-slate-400 bg-white px-3 py-2 text-sm font-bold text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-700 disabled:opacity-50">Download template</button>
                            <div className="pf-field"><label htmlFor="os-file">Filled count sheet (.xlsx)</label>
                                <input id="os-file" data-testid="os-file" type="file" accept=".xlsx,.xls,.csv" className="pf-input py-1" onChange={(e) => { const f = e.target.files?.[0]; if (f) void readSheet(f); }} /></div>
                        </div>
                        {lines.length > 0 && (
                            <div className="mt-3 overflow-x-auto rounded-md border border-slate-300">
                                <table className="w-full min-w-[44rem]" data-testid="os-preview">
                                    <caption className="px-2 py-1.5 text-left text-xs font-semibold text-slate-800">{fileName}: {lines.length} item(s), {qtyText(totals.qty)} units, Rs. {money(totals.value)}</caption>
                                    <thead><tr><th className={th}>Row</th><th className={th}>Item</th><th className={thNum}>Quantity</th><th className={thNum}>Unit cost (Rs.)</th><th className={thNum}>Value (Rs.)</th><th className={th}>Batch / expiry</th></tr></thead>
                                    <tbody>
                                        {lines.map((l) => {
                                            const dup = l.itemId && already.includes(l.itemId);
                                            const bad = l.errors.length > 0 || dup;
                                            return (
                                                <tr key={l.row} className={`border-t border-slate-200 ${bad ? "bg-red-50" : ""}`} data-testid="os-line">
                                                    <td className={td}>{l.row}</td>
                                                    <td className={td}><b>{l.code}</b> {l.name}{bad && <span className="block text-xs font-semibold text-red-800">{[...l.errors, ...(dup ? ["Already has stock or an open load in this store"] : [])].join("; ")}</span>}</td>
                                                    <td className={tdNum}>{qtyText(l.quantity)} <span className="text-xs text-slate-700">{l.unit ?? ""}</span></td>
                                                    <td className={tdNum}>{money(l.unitCost)}</td>
                                                    <td className={tdNum}>{money(l.quantity * l.unitCost)}</td>
                                                    <td className={td}>{l.batchNumber ?? "Given at approval"}{l.expiryDate ? <span className="block text-xs text-slate-700">Expires {l.expiryDate}</span> : null}</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </section>

                    <section className="pf-step">
                        <div className="pf-step-title"><b>3</b>Signed count sheet</div>
                        <p className="pf-step-note">The printed count sheet signed by the people who counted. It stays with the load as the evidence.</p>
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            <div className="pf-field"><label htmlFor="os-scan">Scan of the signed count sheet</label>
                                <input id="os-scan" data-testid="os-scan" type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" className="pf-input py-1" onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadScan(f); }} />
                                <span className="text-xs text-slate-700">{uploading ? "Uploading..." : sheetUrl ? "Attached" : "PDF or image"}</span></div>
                            <div className="pf-field"><label htmlFor="os-remarks">Remarks (optional)</label>
                                <input id="os-remarks" className="pf-input" value={remarks} onChange={(e) => setRemarks(e.target.value)} /></div>
                        </div>
                    </section>
                </div>
                <div className="lg:sticky lg:top-4 lg:self-start">
                    <GatePanel testId="os-submit" checks={checks} action="Submit for approval" busy={submit.isPending || uploading} onAction={() => submit.mutate()} />
                </div>
            </div>

            <section className="rounded-lg border border-slate-300 bg-white">
                <h2 className="px-3 pt-3 text-base font-black text-slate-900">Opening stock loads</h2>
                <div className="overflow-x-auto p-3">
                    <table className="w-full min-w-[52rem]">
                        <thead><tr><th className={th}>Load</th><th className={th}>Store</th><th className={th}>Counted</th><th className={th}>Status</th><th className={thNum}>Items</th><th className={thNum}>Value (Rs.)</th><th className={th}>Submitted / decided</th><th className={th}><span className="sr-only">Open</span></th></tr></thead>
                        <tbody>
                            {isLoading && <tr><td className={td} colSpan={8}>Loading…</td></tr>}
                            {!isLoading && loads.length === 0 && <tr><td className={td} colSpan={8}>No opening stock has been loaded yet.</td></tr>}
                            {loads.map((l) => {
                                const isOpen = open === l.id;
                                const approveChecks = openingApproveGate({ status: l.status, actorId: me.id, createdById: l.createdById, isAdmin: false, rejecting: decision === "REJECT", reason, alreadyLoaded: [] });
                                return (
                                    <Fragment key={l.id}>
                                        <tr className="border-t border-slate-200" data-testid="os-load">
                                            <td className={td}><b>{l.loadNumber}</b></td>
                                            <td className={td}>{l.store}</td>
                                            <td className={td}>{day(l.countDate)}</td>
                                            <td className={td}><span className={`inline-block rounded border px-2 py-0.5 text-xs font-bold ${STATUS_STYLE[l.status] ?? ""}`}>{STATUS_LABEL[l.status] ?? l.status}</span>{l.rejectionReason && <span className="block text-xs text-red-800">{l.rejectionReason}</span>}</td>
                                            <td className={tdNum}>{l.lines.length}</td>
                                            <td className={tdNum}>{money(l.totalValue)}</td>
                                            <td className={td}>{l.createdBy ?? "-"}<span className="block text-xs text-slate-700">{l.approvedBy ? `Approved by ${l.approvedBy}` : l.rejectedBy ? `Rejected by ${l.rejectedBy}` : "Not decided yet"}</span></td>
                                            <td className={`${td} whitespace-nowrap`}><button type="button" aria-expanded={isOpen} data-testid="os-open" onClick={() => { setOpen(isOpen ? null : l.id); setDecision("APPROVE"); setReason(""); }} className="rounded border border-slate-400 bg-white px-2 py-1 text-xs font-bold text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-700">{isOpen ? "Close" : l.status === "SUBMITTED" && me.canApprove ? "Check and decide" : "View"}</button></td>
                                        </tr>
                                        {isOpen && (
                                            <tr data-testid="os-detail"><td colSpan={8} className="bg-slate-50 px-2 pb-3">
                                                <div className="grid grid-cols-1 gap-3 pt-2 lg:grid-cols-[minmax(0,1fr)_20rem]">
                                                    <div>
                                                        <table className="w-full">
                                                            <thead><tr><th className={th}>Item</th><th className={thNum}>Quantity</th><th className={thNum}>Unit cost (Rs.)</th><th className={thNum}>Value (Rs.)</th><th className={th}>Batch</th></tr></thead>
                                                            <tbody>{l.lines.map((x) => <tr key={x.code} className="border-t border-slate-200"><td className={td}><b>{x.code}</b> {x.name}</td><td className={tdNum}>{qtyText(x.quantity)} <span className="text-xs text-slate-700">{x.unit ?? ""}</span></td><td className={tdNum}>{money(x.unitCost)}</td><td className={tdNum}>{money(x.quantity * x.unitCost)}</td><td className={td}>{x.batchNumber ?? "Given at approval"}</td></tr>)}</tbody>
                                                        </table>
                                                        <p className="mt-2 text-sm text-slate-800"><a href={l.countSheetUrl} target="_blank" rel="noreferrer" className="font-semibold text-blue-800 underline">Signed count sheet</a>{l.remarks ? ` · ${l.remarks}` : ""}</p>
                                                    </div>
                                                    {l.status === "SUBMITTED" && me.canApprove && (
                                                        <div className="space-y-2">
                                                            <fieldset className="rounded-md border border-slate-300 bg-white p-3">
                                                                <legend className="px-1 text-sm font-bold text-slate-900">Your decision</legend>
                                                                <label className="mr-4 text-sm text-slate-900"><input type="radio" name={`d-${l.id}`} checked={decision === "APPROVE"} onChange={() => setDecision("APPROVE")} className="mr-1" />Approve</label>
                                                                <label className="text-sm text-slate-900"><input type="radio" name={`d-${l.id}`} checked={decision === "REJECT"} onChange={() => setDecision("REJECT")} className="mr-1" />Reject</label>
                                                                {decision === "REJECT" && <div className="pf-field mt-2"><label htmlFor={`r-${l.id}`}>Why it is rejected</label><textarea id={`r-${l.id}`} data-testid="os-reason" rows={2} className="pf-input" value={reason} onChange={(e) => setReason(e.target.value)} /></div>}
                                                            </fieldset>
                                                            <GatePanel testId="os-decide" checks={approveChecks} busy={decide.isPending} action={decision === "APPROVE" ? "Approve: put the stock in the store" : "Reject and tell the submitter"} onAction={() => decide.mutate({ id: l.id, action: decision, reason })} />
                                                        </div>
                                                    )}
                                                </div>
                                            </td></tr>
                                        )}
                                    </Fragment>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </section>
        </div>
        </main>
        </div>
        </div>
        </RoleGuard>
    );
}
