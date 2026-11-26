"use client";

import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

interface OpenLine {
    poId: string; poNumber: string; vendor: string; vendorKey: string; hoApprovalRef: string | null;
    storeId: string; storeName: string | null;
    poItemId: string; itemId: string; code: string; name: string; unit: string | null; hasSerial: boolean;
    ordered: number; received: number; remaining: number; unitPrice: number;
}

const money = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * One GRN for the goods of several purchase orders of one vendor (one delivery). Every line is received against its own PO line,
 * up to what is left on it; stock enters at the PO price. Serial-tracked items are received on the main GRN screen.
 */
export default function MultiPoReceiptPage() {
    const queryClient = useQueryClient();
    const { data: lines = [], isLoading } = useQuery<OpenLine[]>({
        queryKey: ["grn-open-po-lines"],
        queryFn: async () => {
            const res = await fetch("/api/inventory/grn/open-po-lines");
            const json = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(json?.error?.message || "Could not load purchase orders");
            return json.data ?? json;
        },
    });
    const vendors = useMemo(() => {
        const m = new Map<string, { key: string; name: string; storeId: string; storeName: string | null }>();
        for (const l of lines) if (!m.has(`${l.vendorKey}|${l.storeId}`)) m.set(`${l.vendorKey}|${l.storeId}`, { key: `${l.vendorKey}|${l.storeId}`, name: l.vendor, storeId: l.storeId, storeName: l.storeName });
        return [...m.values()];
    }, [lines]);
    const [vendorKey, setVendorKey] = useState("");
    const [qty, setQty] = useState<Record<string, string>>({});
    const [deliveryNote, setDeliveryNote] = useState("");
    const chosen = vendors.find((v) => v.key === vendorKey);
    const vendorLines = lines.filter((l) => `${l.vendorKey}|${l.storeId}` === vendorKey);

    const receive = useMutation({
        mutationFn: async () => {
            if (!chosen) throw new Error("Choose the vendor of this delivery");
            const items = vendorLines
                .map((l) => ({ line: l, q: Number(qty[l.poItemId] ?? 0) }))
                .filter((x) => x.q > 0)
                .map((x) => ({ itemId: x.line.itemId, quantity: x.q, poItemId: x.line.poItemId }));
            if (items.length === 0) throw new Error("Enter the quantity received on at least one line");
            const res = await fetch("/api/inventory/grn", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ storeId: chosen.storeId, sourceType: "LOCAL_PURCHASE", supplier: chosen.name, reference: deliveryNote || null, items }),
            });
            const json = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(json?.error?.message || "The GRN could not be saved");
            return json.data ?? json;
        },
        onSuccess: (grn: { grnNumber?: string }) => {
            toast.success(`GRN ${grn?.grnNumber ?? ""} saved: stock received`);
            setQty({});
            setDeliveryNote("");
            queryClient.invalidateQueries({ queryKey: ["grn-open-po-lines"] });
        },
        onError: (e: Error) => toast.error(e.message),
    });

    const th = "px-2 py-1.5 text-left text-[11px] font-bold uppercase !bg-slate-100 !text-slate-800";
    const td = "px-2 py-1.5 text-xs text-slate-900";
    const total = vendorLines.reduce((a, l) => a + Number(qty[l.poItemId] ?? 0) * l.unitPrice, 0);

    return (
        <div className="mx-auto max-w-6xl space-y-4 p-4 sm:p-6" data-testid="multi-po-grn">
            <div>
                <h1 className="text-xl font-black text-slate-900">Receive goods against purchase orders</h1>
                <p className="text-xs font-semibold text-slate-700">One delivery may cover several purchase orders of the same vendor. Each line is received against its own order, up to what is left on it.</p>
            </div>

            <div className="grid grid-cols-1 gap-3 rounded-xl border border-slate-300 bg-white p-4 sm:grid-cols-3">
                <div className="space-y-1 sm:col-span-2">
                    <label htmlFor="grn-vendor" className="text-[11px] font-bold text-slate-800">Vendor and receiving store</label>
                    <select id="grn-vendor" data-testid="grn-vendor" value={vendorKey} onChange={(e) => { setVendorKey(e.target.value); setQty({}); }} className="h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-xs font-semibold text-slate-900">
                        <option value="">{isLoading ? "Loading…" : vendors.length ? "Choose the vendor of this delivery" : "No approved purchase order is waiting for goods"}</option>
                        {vendors.map((v) => <option key={v.key} value={v.key}>{v.name} → {v.storeName ?? "store"}</option>)}
                    </select>
                </div>
                <div className="space-y-1">
                    <label htmlFor="grn-dn" className="text-[11px] font-bold text-slate-800">Supplier delivery note no.</label>
                    <input id="grn-dn" data-testid="grn-dn" value={deliveryNote} onChange={(e) => setDeliveryNote(e.target.value)} className="h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-xs text-slate-900" />
                </div>
            </div>

            {chosen && (
                <div className="rounded-xl border border-slate-300 bg-white p-4">
                    <table className="w-full">
                        <thead><tr><th className={th}>PO</th><th className={th}>Item</th><th className={th}>Ordered</th><th className={th}>Received before</th><th className={th}>Left</th><th className={th}>PO price</th><th className={th}>Receiving now</th></tr></thead>
                        <tbody>
                            {vendorLines.map((l) => (
                                <tr key={l.poItemId} className="border-t border-slate-200" data-testid="grn-po-line">
                                    <td className={td}><span className="font-mono font-bold">{l.poNumber}</span>{l.hoApprovalRef ? <span className="block text-[10px] text-slate-700">HO {l.hoApprovalRef}</span> : null}</td>
                                    <td className={td}>{l.code} {l.name}</td>
                                    <td className={td}>{l.ordered} {l.unit}</td>
                                    <td className={td}>{l.received}</td>
                                    <td className={td}>{l.remaining}</td>
                                    <td className={td}>{money(l.unitPrice)}</td>
                                    <td className={td}>
                                        {l.hasSerial ? <span className="text-[11px] font-semibold text-amber-900">Serial items: use the main GRN screen</span> : (
                                            <input type="number" min={0} max={l.remaining} step="any" data-testid="grn-po-qty" value={qty[l.poItemId] ?? ""} onChange={(e) => setQty((q) => ({ ...q, [l.poItemId]: e.target.value }))} className="h-8 w-28 rounded border border-slate-300 bg-white px-2 text-xs text-slate-900" />
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    <div className="mt-3 flex items-center justify-between">
                        <p className="text-xs font-bold text-slate-900">Value received at PO prices: {money(total)}</p>
                        <button type="button" data-testid="grn-po-submit" disabled={receive.isPending} onClick={() => receive.mutate()} className="rounded-md border border-emerald-700 bg-emerald-700 px-4 py-1.5 text-xs font-bold text-white hover:bg-emerald-800 disabled:opacity-60">{receive.isPending ? "Saving…" : "Save GRN"}</button>
                    </div>
                </div>
            )}
        </div>
    );
}
