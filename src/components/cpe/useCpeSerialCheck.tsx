"use client";

import { useEffect, useState } from "react";
import { Camera, Smartphone } from "lucide-react";
import { PhoneScanDialog } from "./PhoneScanDialog";
import { normalizeSerial, serialFormatProblem, type CpeType } from "@/lib/cpe-serial-rules";
import { CameraScanDialog, CpeCheckBadge } from "./CpeSerialInput";

export interface CpeCheckResult { ok: boolean; code: string; message: string; enforcement: string }

/**
 * Asks the CPE register whether a serial may be used on an order (GET /api/cpe-serials/check), half a second after typing stops.
 * Phase 1: the answer is shown only; the save is never blocked here.
 */
export function useCpeSerialCheck(serial: string, ctx: { serviceOrderId?: string | null; cpeType: CpeType; contractorId?: string | null; reuse?: boolean }) {
    const [result, setResult] = useState<CpeCheckResult | null>(null);
    const [loading, setLoading] = useState(false);
    const s = normalizeSerial(serial);
    useEffect(() => {
        if (!ctx.serviceOrderId || !s || serialFormatProblem(s)) { setResult(null); setLoading(false); return; }
        let cancelled = false;
        setLoading(true);
        const t = setTimeout(async () => {
            try {
                const qs = new URLSearchParams({ serial: s, serviceOrderId: ctx.serviceOrderId!, cpeType: ctx.cpeType });
                if (ctx.contractorId) qs.set("contractorId", ctx.contractorId);
                if (ctx.reuse) qs.set("reuse", "1");
                const res = await fetch(`/api/cpe-serials/check?${qs}`);
                const body = await res.json().catch(() => ({}));
                if (!cancelled) setResult(res.ok ? ((body.data ?? body) as CpeCheckResult) : null);
            } catch {
                if (!cancelled) setResult(null);
            } finally {
                if (!cancelled) setLoading(false);
            }
        }, 500);
        return () => { cancelled = true; clearTimeout(t); };
    }, [s, ctx.serviceOrderId, ctx.cpeType, ctx.contractorId, ctx.reuse]);
    return { result, loading };
}

/** Camera button + register answer for an existing serial field of the Confirm Completion form (ONT, STB). */
export function CpeSerialAssist({ serial, onScanned, serviceOrderId, cpeType, contractorId, reuse }: {
    serial: string; onScanned: (s: string) => void; serviceOrderId?: string | null; cpeType: CpeType; contractorId?: string | null; reuse?: boolean;
}) {
    const [camera, setCamera] = useState(false);
    const [phone, setPhone] = useState(false);
    const { result, loading } = useCpeSerialCheck(serial, { serviceOrderId, cpeType, contractorId, reuse });
    return (
        <>
            <button type="button" onClick={() => setCamera(true)} title="Scan with the camera (QR code or barcode)" aria-label={`Scan the ${cpeType} serial with the camera`}
                className="inline-flex h-7 shrink-0 items-center justify-center rounded border border-slate-400 bg-white px-2 text-slate-800 hover:bg-slate-100">
                <Camera className="h-3.5 w-3.5" />
            </button>
            <button type="button" onClick={() => setPhone(true)} title="Scan with your phone: shows a QR code to open the scanner on the phone" aria-label={`Scan the ${cpeType} serial with your phone`}
                className="inline-flex h-7 shrink-0 items-center justify-center rounded border border-slate-400 bg-white px-2 text-slate-800 hover:bg-slate-100">
                <Smartphone className="h-3.5 w-3.5" />
            </button>
            {camera && <CameraScanDialog onClose={() => setCamera(false)} onResult={(t) => { setCamera(false); onScanned(normalizeSerial(t)); }} />}
            {phone && <PhoneScanDialog mode="single" label={`${cpeType} serial`} onClose={() => setPhone(false)} onSerial={(s) => onScanned(normalizeSerial(s))} />}
            <div className="basis-full"><CpeCheckBadge result={result} loading={loading} /></div>
        </>
    );
}
