"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, X, Loader2, Smartphone } from "lucide-react";
import { normalizeSerial } from "@/lib/cpe-serial-rules";
import { PhoneScanDialog } from "./PhoneScanDialog";

/**
 * One way to enter a CPE serial everywhere (docs/plans/cpe-serial-locator.md, section 6):
 *  - typing: normalised when the field is left or Enter is pressed;
 *  - USB / Bluetooth barcode scanner: these type the code fast and end with Enter, which commits the serial at once (the Enter never submits the form);
 *  - camera: the camera button reads a QR code or a barcode (open-source @zxing/browser, loaded only when the camera is opened).
 */
export function CpeSerialInput({
    value, onChange, onCommit, placeholder = "Scan or type the serial", disabled, autoFocus, ariaLabel, className, testId, phone,
}: {
    /** adds a "Scan with phone" button (QR code): one serial, or a batch passed to onCommit one by one */
    phone?: { mode: "single" | "batch"; label: string };
    value: string;
    onChange: (v: string) => void;
    /** called with the normalised serial when a scan ends, Enter is pressed or the field is left */
    onCommit?: (serial: string) => void;
    placeholder?: string;
    disabled?: boolean;
    autoFocus?: boolean;
    ariaLabel?: string;
    className?: string;
    testId?: string;
}) {
    const [camera, setCamera] = useState(false);
    const [phoneOpen, setPhoneOpen] = useState(false);
    const commit = (raw: string) => {
        const s = normalizeSerial(raw);
        if (s !== raw) onChange(s);
        if (s) onCommit?.(s);
    };
    return (
        <div className={`flex items-stretch gap-1 ${className ?? ""}`}>
            <input
                data-testid={testId}
                aria-label={ariaLabel ?? placeholder}
                value={value}
                disabled={disabled}
                autoFocus={autoFocus}
                autoComplete="off"
                spellCheck={false}
                placeholder={placeholder}
                onChange={(e) => onChange(e.target.value)}
                onKeyDown={(e) => {
                    if (e.key === "Enter") {
                        e.preventDefault();
                        e.stopPropagation();
                        commit((e.target as HTMLInputElement).value);
                    }
                }}
                onBlur={(e) => { if (e.target.value) commit(e.target.value); }}
                className="min-w-0 flex-1 rounded-md border border-slate-400 bg-white px-3 py-2 font-mono text-sm uppercase text-slate-900 placeholder:normal-case placeholder:text-slate-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-700 disabled:bg-slate-100"
            />
            <button
                type="button"
                disabled={disabled}
                onClick={() => setCamera(true)}
                title="Scan with the camera (QR code or barcode)"
                aria-label="Scan with the camera"
                className="inline-flex items-center justify-center rounded-md border border-slate-400 bg-white px-2.5 text-slate-800 hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-700 disabled:opacity-50"
            >
                <Camera className="h-4 w-4" />
            </button>
            {phone && (
                <button
                    type="button"
                    disabled={disabled}
                    onClick={() => setPhoneOpen(true)}
                    title="Scan with your phone: shows a QR code to open the scanner on the phone"
                    aria-label="Scan with phone"
                    data-testid={testId ? `${testId}-phone` : undefined}
                    className="inline-flex items-center justify-center rounded-md border border-slate-400 bg-white px-2.5 text-slate-800 hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-700 disabled:opacity-50"
                >
                    <Smartphone className="h-4 w-4" />
                </button>
            )}
            {camera && (
                <CameraScanDialog
                    onClose={() => setCamera(false)}
                    onResult={(text) => { setCamera(false); const s = normalizeSerial(text); onChange(s); if (s) onCommit?.(s); }}
                />
            )}
            {phone && phoneOpen && (
                <PhoneScanDialog
                    mode={phone.mode}
                    label={phone.label}
                    onClose={() => setPhoneOpen(false)}
                    onSerial={(s) => { if (phone.mode === "single") onChange(s); onCommit?.(s); }}
                />
            )}
        </div>
    );
}

/** Reads one QR code or barcode from the camera, then closes. Needs HTTPS (or localhost) and the person's permission to use the camera. */
export function CameraScanDialog({ onClose, onResult }: { onClose: () => void; onResult: (text: string) => void }) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [error, setError] = useState<string | null>(null);
    const [starting, setStarting] = useState(true);
    // the latest callback, so a re-render of the parent does not restart the camera
    const resultRef = useRef(onResult);
    useEffect(() => { resultRef.current = onResult; }, [onResult]);
    useEffect(() => {
        let stopped = false;
        let controls: { stop: () => void } | null = null;
        (async () => {
            try {
                if (!navigator.mediaDevices?.getUserMedia) throw new Error("This browser cannot use a camera here (it needs HTTPS).");
                const { BrowserMultiFormatReader } = await import("@zxing/browser");
                const reader = new BrowserMultiFormatReader();
                const c = await reader.decodeFromConstraints({ video: { facingMode: { ideal: "environment" } } }, videoRef.current!, (result) => {
                    if (result && !stopped) { stopped = true; controls?.stop(); resultRef.current(result.getText()); }
                });
                controls = c;
                if (stopped) c.stop();
            } catch (e) {
                setError(e instanceof Error && /Permission|NotAllowed/i.test(e.name + e.message) ? "Camera permission was refused. Allow the camera in the browser, or type or use the barcode scanner." : (e instanceof Error ? e.message : "Could not open the camera"));
            } finally {
                setStarting(false);
            }
        })();
        return () => { stopped = true; controls?.stop(); };
    }, []);
    return (
        <div role="dialog" aria-modal="true" aria-label="Scan a serial with the camera" className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 p-4">
            <div className="w-full max-w-md rounded-lg bg-white p-4 shadow-xl">
                <div className="mb-2 flex items-center justify-between">
                    <h2 className="text-sm font-bold text-slate-900">Point the camera at the serial barcode or QR code</h2>
                    <button type="button" onClick={onClose} aria-label="Close the camera" className="rounded p-1 text-slate-700 hover:bg-slate-100"><X className="h-5 w-5" /></button>
                </div>
                <div className="relative overflow-hidden rounded-md bg-slate-900">
                    <video ref={videoRef} className="aspect-video w-full object-cover" muted playsInline />
                    {starting && <div className="absolute inset-0 flex items-center justify-center text-sm font-semibold text-white"><Loader2 className="mr-2 h-4 w-4 animate-spin" />Opening the camera...</div>}
                </div>
                {error && <p role="alert" className="mt-2 rounded border border-red-700 bg-red-50 p-2 text-sm font-semibold text-red-900">{error}</p>}
                <p className="mt-2 text-xs text-slate-700">The serial is filled in as soon as it is read. A USB barcode scanner works without this window: click the serial field and scan.</p>
            </div>
        </div>
    );
}

/** The answer of /api/cpe-serials/check shown under a serial field. */
export function CpeCheckBadge({ result, loading }: { result: { ok: boolean; message: string; enforcement?: string } | null; loading?: boolean }) {
    if (loading) return <p className="mt-1 flex items-center text-xs font-semibold text-slate-700"><Loader2 className="mr-1 h-3 w-3 animate-spin" />Checking the CPE register...</p>;
    if (!result) return null;
    const tone = result.ok ? "border-emerald-700 bg-emerald-50 text-emerald-900" : "border-amber-600 bg-amber-50 text-amber-950";
    return (
        <p data-testid="cpe-check" className={`mt-1 rounded border px-2 py-1 text-xs font-semibold ${tone}`}>
            {result.ok ? "SLT serial: " : "CPE register: "}{result.message}
            {!result.ok && result.enforcement !== "ENFORCE" && <span className="font-normal"> (not blocked yet)</span>}
        </p>
    );
}
