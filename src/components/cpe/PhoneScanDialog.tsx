"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Smartphone, X } from "lucide-react";

/**
 * "Scan with phone": shows a QR code; the phone opens it, scans with its camera and the serials arrive here. A single scan (an order
 * field) closes this window with the serial; a batch (an SLT receipt) passes every serial on as it arrives until the window is closed.
 */
function QrSvg({ text }: { text: string }) {
    const [cells, setCells] = useState<{ size: number; on: [number, number][] } | null>(null);
    useEffect(() => {
        let cancelled = false;
        (async () => {
            const { QRCodeWriter, BarcodeFormat, EncodeHintType } = await import("@zxing/library");
            const hints = new Map(); hints.set(EncodeHintType.MARGIN, 2);
            const m = new QRCodeWriter().encode(text, BarcodeFormat.QR_CODE, 0, 0, hints);
            const on: [number, number][] = [];
            for (let y = 0; y < m.getHeight(); y++) for (let x = 0; x < m.getWidth(); x++) if (m.get(x, y)) on.push([x, y]);
            if (!cancelled) setCells({ size: m.getWidth(), on });
        })().catch(() => undefined);
        return () => { cancelled = true; };
    }, [text]);
    if (!cells) return <div className="flex h-56 w-56 items-center justify-center text-sm text-slate-700"><Loader2 className="mr-2 h-4 w-4 animate-spin" />Making the QR code...</div>;
    return (
        <svg role="img" aria-label="QR code to open the scan page on the phone" viewBox={`0 0 ${cells.size} ${cells.size}`} className="h-56 w-56 bg-white" shapeRendering="crispEdges">
            <rect width={cells.size} height={cells.size} fill="#ffffff" />
            <path fill="#000000" d={cells.on.map(([x, y]) => `M${x} ${y}h1v1h-1z`).join("")} />
        </svg>
    );
}

export function PhoneScanDialog({ mode, label, onSerial, onClose }: {
    mode: "single" | "batch"; label: string; onSerial: (serial: string) => void; onClose: () => void;
}) {
    const [token, setToken] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [count, setCount] = useState(0);
    const [lastSerial, setLastSerial] = useState<string | null>(null);
    const after = useRef(0);
    const serialRef = useRef(onSerial);
    useEffect(() => { serialRef.current = onSerial; }, [onSerial]);
    const closeRef = useRef(onClose);
    useEffect(() => { closeRef.current = onClose; }, [onClose]);

    useEffect(() => {
        let cancelled = false;
        fetch("/api/cpe-serials/phone-scan", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mode, label }) })
            .then(async (r) => {
                const b = await r.json().catch(() => ({}));
                if (!r.ok) throw new Error(b.error || b.message || "Could not start the phone scan");
                if (!cancelled) setToken((b.data ?? b).token);
            })
            .catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : "Could not start the phone scan"); });
        return () => { cancelled = true; };
    }, [mode, label]);

    // pick up what the phone sent
    useEffect(() => {
        if (!token) return;
        let stop = false;
        const tick = async () => {
            try {
                const r = await fetch(`/api/cpe-serials/phone-scan/${token}?after=${after.current}`);
                const b = await r.json().catch(() => ({}));
                if (!r.ok) { if (r.status === 404) setError("The phone scan has ended (30 minutes). Close and open it again."); return; }
                const d = b.data ?? b;
                const items: string[] = d.items ?? [];
                if (items.length && !stop) {
                    after.current += items.length;
                    setCount(after.current);
                    setLastSerial(items[items.length - 1]);
                    for (const s of items) serialRef.current(s);
                    if (mode === "single") { stop = true; closeRef.current(); return; }
                }
            } catch { /* try again on the next tick */ }
        };
        const id = setInterval(() => { if (!stop) void tick(); }, 1500);
        return () => {
            stop = true;
            clearInterval(id);
            fetch(`/api/cpe-serials/phone-scan/${token}`, { method: "DELETE" }).catch(() => undefined);
        };
    }, [token, mode]);

    const url = token && typeof window !== "undefined" ? `${window.location.origin}/public/cpe-scan/${token}` : null;
    return (
        <div role="dialog" aria-modal="true" aria-label="Scan with phone" className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 p-4">
            <div className="w-full max-w-sm rounded-lg bg-white p-4 text-slate-900 shadow-xl">
                <div className="mb-2 flex items-center justify-between">
                    <h2 className="flex items-center text-sm font-bold text-slate-900"><Smartphone className="mr-1.5 h-4 w-4" />Scan with phone: {label}</h2>
                    <button type="button" onClick={onClose} aria-label="Close" className="rounded p-1 text-slate-700 hover:bg-slate-100"><X className="h-5 w-5" /></button>
                </div>
                {error ? (
                    <p role="alert" className="rounded border border-red-700 bg-red-50 p-2 text-sm font-semibold text-red-900">{error}</p>
                ) : !url ? (
                    <p className="flex items-center text-sm text-slate-700"><Loader2 className="mr-2 h-4 w-4 animate-spin" />Starting...</p>
                ) : (
                    <>
                        <div className="flex justify-center rounded border border-slate-300 bg-white p-2"><QrSvg text={url} /></div>
                        <ol className="mt-2 list-decimal space-y-0.5 pl-5 text-sm text-slate-800">
                            <li>Open the phone camera and scan this QR code.</li>
                            <li>On the page that opens, allow the camera and scan the {mode === "batch" ? "serials one after another" : "serial"}.</li>
                        </ol>
                        <p data-testid="phone-scan-status" className={`mt-2 rounded border p-2 text-sm font-semibold ${count ? "border-emerald-700 bg-emerald-50 text-emerald-900" : "border-slate-300 bg-slate-50 text-slate-800"}`}>
                            {count ? <>Received {count} from the phone{lastSerial ? <>; last <span className="font-mono">{lastSerial}</span></> : null}</> : <><Loader2 className="mr-1 inline h-3.5 w-3.5 animate-spin" />Waiting for the phone...</>}
                        </p>
                        {mode === "batch" && <button type="button" onClick={onClose} className="mt-3 w-full rounded-md bg-slate-900 py-2 text-sm font-bold text-white hover:bg-slate-800">Finish phone scan</button>}
                        <p className="mt-2 text-xs text-slate-700">The link works for 30 minutes and only sends serials to this window.</p>
                    </>
                )}
            </div>
        </div>
    );
}
