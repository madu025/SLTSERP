/**
 * CPE serials from the SLT CPE Locator (plan: docs/plans/cpe-serial-locator.md, owner decisions of 28 Nov 2026).
 * Pure rules shared by the screens and the server: reading an upload or a scan, deciding whether a serial may enter the register
 * (new, or issued again by SLT), and whether a serial may be used on an order. No database access here.
 */

export const CPE_TYPES = ['ONT', 'STB', 'PHONE'] as const;
export type CpeType = (typeof CPE_TYPES)[number];

/** The generic serial items (no SLT item codes exist; owner). The model is kept on each serial. */
export const CPE_ITEMS: Record<CpeType, { code: string; name: string }> = {
    ONT: { code: 'CPE-ONT', name: 'CPE - ONT / Router (SLT)' },
    STB: { code: 'CPE-STB', name: 'CPE - IPTV Set-top Box (SLT)' },
    PHONE: { code: 'CPE-PHONE', name: 'CPE - Voice Instrument (SLT)' },
};

export const CPE_TYPE_LABEL: Record<CpeType, string> = { ONT: 'ONT / Router', STB: 'IPTV STB', PHONE: 'Phone' };

export const CPE_STATUSES = ['IN_STORE', 'ISSUED', 'INSTALLED', 'RECOVERED', 'FAULTY', 'RETURNED_TO_SLT'] as const;
export type CpeStatus = (typeof CPE_STATUSES)[number];

export const CPE_STATUS_LABEL: Record<string, string> = {
    IN_STORE: 'In store', ISSUED: 'With contractor', INSTALLED: 'Installed', RECOVERED: 'Recovered from customer', FAULTY: 'Faulty', RETURNED_TO_SLT: 'Returned to SLT',
};

/** A serial that SLT may issue again (a new cycle): taken back from a customer, faulty and repaired, or handed back to SLT. */
export const CPE_REISSUE_STATUSES: readonly string[] = ['RECOVERED', 'FAULTY', 'RETURNED_TO_SLT'];

/** Recording CPE is a service order job (Area Coordinator, QC Officer), not the stores' (owner, 28 Nov 2026): serials are always recorded to a contractor. */
export const CPE_RECEIPT_MODES = ['DIRECT_TO_CONTRACTOR'] as const;
export type CpeReceiptMode = (typeof CPE_RECEIPT_MODES)[number];

export const CPE_MAX_LINES = 500;

/** Enforcement of the order rules, per RTOM (system config CPE_SERIAL_ENFORCEMENT). Phase 1 uses OFF and WARN only. */
export type CpeEnforcement = 'OFF' | 'WARN' | 'ENFORCE';
export function parseEnforcement(value: unknown): CpeEnforcement {
    const v = String(value ?? '').trim().toUpperCase();
    return v === 'WARN' || v === 'ENFORCE' ? v : 'OFF';
}

/**
 * The system config CPE_SERIAL_ENFORCEMENT is either one mode for every RTOM ("WARN") or a JSON map by RTOM with an optional default
 * ({"default":"OFF","R-KX":"WARN"}), so an RTOM moves to ENFORCE when SLT starts CPE Locator there and its serials are loaded.
 */
export function enforcementFor(raw: unknown, rtom: string | null | undefined): CpeEnforcement {
    const text = String(raw ?? '').trim();
    if (!text.startsWith('{')) return parseEnforcement(text);
    try {
        const map = JSON.parse(text) as Record<string, unknown>;
        return parseEnforcement((rtom && map[rtom]) ?? map.default);
    } catch {
        return 'OFF';
    }
}

/** One spelling for a serial: no spaces or control characters, upper case. A scanner may add a prefix like "S/N:" which is removed. */
export function normalizeSerial(raw: unknown): string {
    let s = String(raw ?? '')
        .replace(/[\u0000-\u001f\u007f]/g, '')
        .replace(/\s+/g, '')
        .toUpperCase();
    s = s.replace(/^(S\/?N|SERIAL(NO|NUMBER)?)[:#-]?/, '');
    return s;
}

export function serialFormatProblem(serial: string): string | null {
    if (!serial) return 'No serial number';
    if (serial.length < 4) return 'Serial number is too short (at least 4 characters)';
    if (serial.length > 40) return 'Serial number is too long (at most 40 characters)';
    if (!/^[A-Z0-9][A-Z0-9\-_/.]*$/.test(serial)) return 'Serial number may contain only letters, digits and - _ / .';
    return null;
}

export function parseCpeType(raw: unknown): CpeType | null {
    const v = String(raw ?? '').trim().toUpperCase().replace(/[^A-Z]/g, '');
    if (!v) return null;
    if (v === 'ONT' || v === 'ROUTER' || v === 'ONU' || v.startsWith('ONT')) return 'ONT';
    if (v === 'STB' || v.includes('SETTOP') || v === 'IPTV' || v.startsWith('STB')) return 'STB';
    if (v === 'PHONE' || v === 'VOICE' || v.includes('PHONE') || v === 'TELEPHONE') return 'PHONE';
    return null;
}

export interface CpeInputRow { row: number; serial?: unknown; cpeType?: unknown; model?: unknown }
export interface CpeLine { row: number; serial: string; cpeType: CpeType | null; model: string | null; problem: string | null }

/**
 * Lines of an upload or a scan list. Every line keeps its row number and says what is wrong with it; duplicates inside the same list are
 * marked on the second and later occurrence. The default type applies when a line names none.
 */
export function readCpeLines(rows: CpeInputRow[], defaultType: CpeType | null): CpeLine[] {
    const seen = new Map<string, number>();
    return rows.map((r) => {
        const serial = normalizeSerial(r.serial);
        const typed = r.cpeType === undefined || r.cpeType === null || String(r.cpeType).trim() === '' ? defaultType : parseCpeType(r.cpeType);
        const model = String(r.model ?? '').trim().slice(0, 80) || null;
        let problem = serialFormatProblem(serial);
        if (!problem && !typed) problem = 'CPE type must be ONT, STB or PHONE';
        if (!problem && defaultType && typed !== defaultType) problem = `This list is for ${CPE_TYPE_LABEL[defaultType]}; this line is ${CPE_TYPE_LABEL[typed as CpeType]}`;
        if (!problem && seen.has(serial)) problem = `Same serial as row ${seen.get(serial)}`;
        if (serial && !seen.has(serial)) seen.set(serial, r.row);
        return { row: r.row, serial, cpeType: typed, model, problem };
    });
}

/** What the register says about a serial, as far as these rules need it. */
export interface CpeSerialState {
    serialNumber: string;
    status: string;
    opmcId: string | null;
    rtom?: string | null;
    cpeType: string | null;
    contractorId: string | null;
    contractorName?: string | null;
    sodId: string | null;
    soNum?: string | null;
    issueCycle: number;
}

export type CpeRegisterDecision =
    | { kind: 'NEW' }
    | { kind: 'REISSUE'; nextCycle: number }
    | { kind: 'REFUSED'; code: string; message: string };

/** May this serial enter the register for this RTOM? New serials yes; a known serial only when SLT issues it again in the same RTOM. */
export function registerDecision(existing: CpeSerialState | null, opmcId: string, cpeType: CpeType): CpeRegisterDecision {
    if (!existing) return { kind: 'NEW' };
    if (existing.opmcId && existing.opmcId !== opmcId) {
        return { kind: 'REFUSED', code: 'CPE_SERIAL_WRONG_RTOM', message: `Serial ${existing.serialNumber} belongs to ${existing.rtom ?? 'another RTOM'}; a serial never moves to another area` };
    }
    if (existing.cpeType && existing.cpeType !== cpeType) {
        return { kind: 'REFUSED', code: 'CPE_SERIAL_WRONG_TYPE', message: `Serial ${existing.serialNumber} is registered as ${existing.cpeType}` };
    }
    if (CPE_REISSUE_STATUSES.includes(existing.status)) return { kind: 'REISSUE', nextCycle: (existing.issueCycle || 1) + 1 };
    const where = existing.status === 'INSTALLED' ? ` on order ${existing.soNum ?? ''}`.trimEnd() : existing.status === 'ISSUED' ? `: ${existing.contractorName ?? 'a contractor'}` : '';
    return {
        kind: 'REFUSED', code: 'CPE_SERIAL_ALREADY_REGISTERED',
        message: `Serial ${existing.serialNumber} is already in the register (${CPE_STATUS_LABEL[existing.status] ?? existing.status}${where}). Record its recovery first if SLT issued it again.`,
    };
}

export interface CpeOrderContext {
    opmcId: string | null;
    contractorId: string | null;
    soNum?: string | null;
    serviceOrderId?: string | null;
    /** the field the serial is entered in */
    cpeType: CpeType;
    /** "Existing / Re-use" on an upgrade: the customer keeps the device already installed */
    reuse?: boolean;
    /** reuse: the register shows the serial installed on an earlier order of the same voice number in the same RTOM */
    installedAtSameVoice?: boolean;
    /** reuse: an earlier order of the same voice number carries this serial as free text (devices installed before the register existed) */
    legacyAtSameVoice?: boolean;
}

export interface CpeOrderCheck { ok: boolean; code: string; message: string }

/**
 * May this serial be used on this order? (section 7 of the plan). Phase 1 only shows the answer; phase 2 enforces it on the server.
 */
export function checkSerialForOrder(state: CpeSerialState | null, ctx: CpeOrderContext): CpeOrderCheck {
    if (ctx.reuse) {
        if (state?.status === 'INSTALLED' && ctx.installedAtSameVoice) return { ok: true, code: 'CPE_REUSE_OK', message: 'The device already installed at this customer' };
        if (!state && ctx.legacyAtSameVoice) return { ok: true, code: 'CPE_REUSE_OK', message: 'The device already installed at this customer (recorded before the CPE register)' };
        return { ok: false, code: 'CPE_SERIAL_NOT_AT_CUSTOMER', message: 'Existing / Re-use needs the serial of the device already installed for this voice number' };
    }
    if (!state) return { ok: false, code: 'CPE_SERIAL_NOT_FOUND', message: 'This serial was not issued by SLT (not in the CPE register)' };
    if (state.cpeType && state.cpeType !== ctx.cpeType) return { ok: false, code: 'CPE_SERIAL_WRONG_TYPE', message: `This serial is a ${CPE_TYPE_LABEL[state.cpeType as CpeType] ?? state.cpeType}, not a ${CPE_TYPE_LABEL[ctx.cpeType]}` };
    if (ctx.opmcId && state.opmcId && state.opmcId !== ctx.opmcId) return { ok: false, code: 'CPE_SERIAL_WRONG_RTOM', message: `Serial belongs to ${state.rtom ?? 'another RTOM'}` };
    if (state.status === 'INSTALLED') {
        if (ctx.serviceOrderId && state.sodId === ctx.serviceOrderId) return { ok: true, code: 'CPE_SERIAL_ON_THIS_ORDER', message: 'Already recorded on this order' };
        return { ok: false, code: 'CPE_SERIAL_ALREADY_INSTALLED', message: `Already installed on order ${state.soNum ?? ''}`.trimEnd() };
    }
    if (state.status !== 'ISSUED') return { ok: false, code: 'CPE_SERIAL_NOT_WITH_CONTRACTOR', message: `Serial is ${CPE_STATUS_LABEL[state.status] ?? state.status}, not with a contractor` };
    if (ctx.contractorId && state.contractorId !== ctx.contractorId) {
        return { ok: false, code: 'CPE_SERIAL_NOT_WITH_CONTRACTOR', message: `Serial is with ${state.contractorName ?? 'another contractor'}, not the order's contractor` };
    }
    return { ok: true, code: 'CPE_SERIAL_OK', message: `Issued by SLT to ${state.contractorName ?? 'the contractor'}` };
}

export interface CpeReceiptGateInput {
    mode: string;
    opmcChosen: boolean;
    inScope: boolean;
    storeLinked: boolean;
    contractorChosen: boolean;
    contractorOfRtom: boolean;
    receivedDate: string | null;
    today: string;
    lines: CpeLine[];
    refused: { serial: string; message: string }[];
}

/** Everything a receipt needs before it is saved; the first failure is shown. */
export function cpeReceiptGate(i: CpeReceiptGateInput): { ok: boolean; text: string }[] {
    const bad = i.lines.filter((l) => l.problem);
    return [
        { ok: (CPE_RECEIPT_MODES as readonly string[]).includes(i.mode), text: 'CPE serials are recorded to the contractor who received them' },
        { ok: i.opmcChosen, text: 'Choose the RTOM' },
        { ok: i.inScope, text: 'That RTOM is not one of yours' },
        { ok: i.storeLinked, text: 'This RTOM has no store linked yet: the administrator links it in Inventory / Stores (store form, RTOMs)' },
        { ok: i.mode !== 'DIRECT_TO_CONTRACTOR' || i.contractorChosen, text: 'Choose the contractor who received the devices' },
        { ok: i.mode !== 'DIRECT_TO_CONTRACTOR' || !i.contractorChosen || i.contractorOfRtom, text: 'That contractor does not work in this RTOM' },
        { ok: !!i.receivedDate && i.receivedDate <= i.today, text: 'Enter the date the devices were received (not in the future)' },
        { ok: i.lines.length > 0, text: 'Add at least one serial' },
        { ok: i.lines.length <= CPE_MAX_LINES, text: `At most ${CPE_MAX_LINES} serials at a time` },
        { ok: bad.length === 0, text: bad.length ? `Row ${bad[0].row}: ${bad[0].problem}` : '' },
        { ok: i.refused.length === 0, text: i.refused.length ? i.refused[0].message : '' },
    ];
}
