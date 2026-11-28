"use client";

import { use, useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2, Loader2, ScanLine, Send, XCircle } from "lucide-react";
import { normalizeSerial } from "@/lib/cpe-serial-rules";

/**
 * The phone side of "Scan with phone" (CPE serials). Opened from the QR code on the computer; the camera keeps reading and every new serial
 * goes straight to the computer. One serial (an order field) ends the scan; a batch (an SLT receipt) keeps going until the computer closes it.
 */
type Info = { label: string; mode: "single" | "batch"; closed: boolean; items: string[] };

function beep() {
    try {
        const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        const ctx = new Ctx();
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.frequency.value = 1200;
        g.gain.value = 0.15;
        o.connect(g); g.connect(ctx.destination);
        o.start(); o.stop(ctx.currentTime + 0.12);
        o.onended = () => ctx.close();
    } catch { /* no sound */ }
    try { navigator.vibrate?.(80); } catch { /* no vibration */ }
}

export default function PhoneScanPage({ params }: { params: Promise<{ token: string }> }) {
    const { token } = use(params);
    const [info, setInfo] = useState<Info | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [camError, setCamError] = useState<string | null>(null);
    const [sent, setSent] = useState<string[]>([]);
    const [last, setLast] = useState<{ text: string; ok: boolean; note?: string } | null>(null);
    const [typed, setTyped] = useState("");
    const [done, setDone] = useState(false);
    const videoRef = useRef<HTMLVideoElement>(null);
    const sentRef = useRef<Set<string>>(new Set());
    const recent = useRef<{ text: string; at: number }>({ text: "", at: 0 });
    const busy = useRef(false);

    useEffect(() => {
        fetch(`/api/public/cpe-scan/${encodeURIComponent(token)}`)
            .then(async (r) => {
                const b = await r.json().catch(() => ({}));
                if (!r.ok) throw new Error(b.error || "This scan link does not work");
                const d = b.data as Info;
                setInfo(d); setSent(d.items); d.items.forEach((s) => sentRef.current.add(s));
                if (d.closed) setDone(true);
            })
            .catch((e) => setError(e instanceof Error ? e.message : "This scan link does not work"));
    }, [token]);

    const send = useCallback(async (raw: string) => {
        const serial = normalizeSerial(raw);
        if (!serial || busy.current) return;
        const now = Date.now();
        if (recent.current.text === serial && now - recent.current.at < 3000) return;
        recent.current = { text: serial, at: now };
        if (sentRef.current.has(serial)) { setLast({ text: serial, ok: true, note: "already sent" }); return; }
        busy.current = true;
        try {
            const r = await fetch(`/api/public/cpe-scan/${encodeURIComponent(token)}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ serials: [serial] }) });
            const b = await r.json().catch(() => ({}));
            if (!r.ok) {
                setLast({ text: serial, ok: false, note: b.error || "Not sent" });
                if (r.status === 404 || r.status === 409) setDone(true);
                return;
            }
            sentRef.current.add(serial);
            setSent((s) => [...s, serial]);
            setLast({ text: serial, ok: true });
            beep();
            if (b.data?.closed) setDone(true);
        } catch {
            setLast({ text: serial, ok: false, note: "No connection; scan it again" });
        } finally {
            busy.current = false;
        }
    }, [token]);

    // the camera keeps reading until the scan is done
    useEffect(() => {
        if (!info || done) return;
        let stopped = false;
        let controls: { stop: () => void } | null = null;
        (async () => {
            try {
                if (!navigator.mediaDevices?.getUserMedia) throw new Error("This browser cannot use the camera here (it needs HTTPS). Type the serial below.");
                const { BrowserMultiFormatReader } = await import("@zxing/browser");
                const reader = new BrowserMultiFormatReader();
                const c = await reader.decodeFromConstraints({ video: { facingMode: { ideal: "environment" } } }, videoRef.current!, (result) => {
                    if (result && !stopped) void send(result.getText());
                });
                controls = c;
                if (stopped) c.stop();
            } catch (e) {
                setCamError(e instanceof Error && /Permission|NotAllowed/i.test(e.name + e.message) ? "Camera permission was refused. Allow the camera for this page, or type the serial below." : (e instanceof Error ? e.message : "Could not open the camera"));
            }
        })();
        return () => { stopped = true; controls?.stop(); };
    }, [info, done, send]);

    if (error) {
        return (
            <main className="flex min-h-screen items-center justify-center bg-slate-100 p-4">
                <div className="w-full max-w-sm rounded-lg border border-red-700 bg-white p-5 text-center">
                    <XCircle className="mx-auto h-10 w-10 text-red-700" />
                    <p className="mt-2 text-base font-bold text-slate-900">{error}</p>
                </div>
            </main>
        );
    }
    if (!info) return <main className="flex min-h-screen items-center justify-center bg-slate-100 text-slate-800"><Loader2 className="mr-2 h-5 w-5 animate-spin" />Opening...</main>;

    return (
        <main className="min-h-screen bg-slate-100 p-3 text-slate-900">
            <div className="mx-auto max-w-md space-y-3">
                <header className="rounded-lg bg-slate-900 p-3 text-white">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-300">SLTS Nexus · Scan with phone</p>
                    <h1 className="text-lg font-bold text-white">{info.label}</h1>
                    <p className="text-sm text-slate-200">{info.mode === "batch" ? "Scan the serials one after another. Each one goes to the computer." : "Scan one serial. It goes to the computer."}</p>
                </header>

                {done ? (
                    <div className="rounded-lg border border-emerald-700 bg-white p-5 text-center">
                        <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-700" />
                        <p className="mt-2 text-base font-bold text-slate-900">{sent.length ? `Done: ${sent.length} serial${sent.length === 1 ? "" : "s"} sent to the computer` : "This scan is finished"}</p>
                        <p className="mt-1 text-sm text-slate-700">You can close this page.</p>
                    </div>
                ) : (
                    <div className="relative overflow-hidden rounded-lg bg-slate-950">
                        <video ref={videoRef} className="aspect-[3/4] w-full object-cover" muted playsInline />
                        <div className="pointer-events-none absolute inset-x-8 top-1/2 h-24 -translate-y-1/2 rounded-md border-2 border-emerald-400" />
                        <p className="absolute inset-x-0 bottom-0 bg-slate-950/80 p-2 text-center text-sm font-semibold text-white"><ScanLine className="mr-1 inline h-4 w-4" />Point at the barcode or QR code</p>
                    </div>
                )}

                {camError && !done && <p role="alert" className="rounded border border-amber-600 bg-amber-50 p-2 text-sm font-semibold text-amber-950">{camError}</p>}

                {last && (
                    <p role="status" className={`rounded border p-2 text-sm font-semibold ${last.ok ? "border-emerald-700 bg-emerald-50 text-emerald-900" : "border-red-700 bg-red-50 text-red-900"}`}>
                        {last.ok ? "Sent: " : "Not sent: "}<span className="font-mono">{last.text}</span>{last.note ? ` (${last.note})` : ""}
                    </p>
                )}

                {!done && (
                    <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); void send(typed); setTyped(""); }}>
                        <input value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="Or type the serial" autoComplete="off" spellCheck={false} aria-label="Type the serial"
                            className="min-w-0 flex-1 rounded-md border border-slate-400 bg-white px-3 py-2 font-mono text-base uppercase text-slate-900 placeholder:normal-case placeholder:text-slate-500" />
                        <button type="submit" className="inline-flex items-center rounded-md bg-blue-700 px-3 py-2 text-sm font-bold text-white hover:bg-blue-800"><Send className="mr-1 h-4 w-4" />Send</button>
                    </form>
                )}

                {sent.length > 0 && (
                    <section className="rounded-lg border border-slate-300 bg-white p-3">
                        <h2 className="text-sm font-bold text-slate-900">Sent to the computer ({sent.length})</h2>
                        <ol className="mt-1 max-h-64 space-y-0.5 overflow-y-auto text-sm">
                            {[...sent].reverse().map((s, i) => <li key={s} className="font-mono text-slate-800">{sent.length - i}. {s}</li>)}
                        </ol>
                    </section>
                )}
            </div>
        </main>
    );
}
