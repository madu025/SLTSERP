import * as XLSX from 'xlsx';
import { inferTierFromRates, type BoqLineInput, type SupplyTier } from './pricing';

/**
 * Reads the SLT BOQ workbooks that the planning team already produces. Three layouts exist:
 *  - STANDARD  customer request / rehabilitation: sheet "BOQ" (+ "JOB" approval form), one quantity, P0/P1/P2 rates
 *  - CLUSTER   FTTH cluster / apartment: sheets "BOQ-1" and "BOQ-2", the quantity sits in the P0, P1 or P2 column
 *  - INVOICE   marketing: the BOQ is a PDF, but the invoice workbook ("In Sum-03") carries designators, rates and
 *              the invoiced quantities per tier
 */

export type BoqWorkbookFormat = 'STANDARD' | 'CLUSTER' | 'INVOICE_SUMMARY';

export interface ParsedBoqMeta {
    title?: string;
    rtom?: string;
    road?: string;
    workOrderNo?: string;
    contingencyByPart?: Record<string, number>;
    invoiceNo?: string;
    sltRef?: string;
    contractNo?: string;
}

export interface ParsedBoq {
    format: BoqWorkbookFormat;
    meta: ParsedBoqMeta;
    lines: BoqLineInput[];
    warnings: string[];
}

type Row = unknown[];

const text = (v: unknown): string => String(v ?? '').replace(/\s+/g, ' ').trim();
const num = (v: unknown): number | null => {
    if (v === '' || v === null || v === undefined) return null;
    if (typeof v === 'number') return Number.isFinite(v) ? v : null;
    const n = Number(String(v).replace(/,/g, '').trim());
    return Number.isFinite(n) ? n : null;
};

function rowsOf(wb: XLSX.WorkBook, sheet: string): Row[] {
    const ws = wb.Sheets[sheet];
    if (!ws) return [];
    return XLSX.utils.sheet_to_json<Row>(ws, { header: 1, defval: '', blankrows: false });
}

export function readWorkbook(data: Buffer | ArrayBuffer | Uint8Array): XLSX.WorkBook {
    return XLSX.read(data, { type: 'buffer', cellDates: false });
}

export function detectBoqFormat(wb: XLSX.WorkBook): BoqWorkbookFormat | null {
    const names = new Set(wb.SheetNames.map((n) => n.trim()));
    if (names.has('BOQ-1') || names.has('BOQ-2')) return 'CLUSTER';
    if (names.has('BOQ') && names.has('JOB')) return 'STANDARD';
    if (wb.SheetNames.some((n) => /^in sum/i.test(n.trim()))) return 'INVOICE_SUMMARY';
    if (names.has('BOQ')) return 'STANDARD';
    return null;
}

function findRow(rows: Row[], predicate: (r: Row) => boolean): number {
    return rows.findIndex(predicate);
}

/** STANDARD: Item No. | Unit Designator | Description | Unit | Qty | P0 | P1 | P2 | ... totals */
function parseStandard(wb: XLSX.WorkBook): ParsedBoq {
    const rows = rowsOf(wb, 'BOQ');
    const warnings: string[] = [];
    const header = findRow(rows, (r) => /item no/i.test(text(r[0])));
    if (header < 0) throw new Error('BOQ sheet: the "Item No." header row was not found');

    const meta: ParsedBoqMeta = { title: text(rows[0]?.[0]) || undefined };
    for (const r of rows.slice(0, header)) {
        const label = text(r[0]).toLowerCase();
        if (label.startsWith('rtom')) meta.rtom = text(r[2]);
        if (label.startsWith('road')) meta.road = text(r[2]);
    }
    const job = rowsOf(wb, 'JOB');
    for (const r of job) {
        const hit = r.map(text).find((c) => /^\d{4}\/[A-Z0-9]+\/[A-Z0-9]+\/[A-Z]+\/\d+/.test(c));
        if (hit) { meta.workOrderNo = hit; break; }
    }

    const lines: BoqLineInput[] = [];
    for (const r of rows.slice(header + 1)) {
        const first = text(r[0]);
        if (/^total amount/i.test(first)) break;
        const designator = text(r[1]);
        const qty = num(r[4]);
        const p0 = num(r[5]);
        const p1 = num(r[6]);
        const p2 = num(r[7]);
        if (!designator || qty === null || p0 === null) continue; // column sub-headers and blank spacer rows
        if (qty <= 0) { warnings.push(`${designator}: quantity ${qty} skipped`); continue; }
        const rateP1 = p1 ?? p0;
        const rateP2 = p2 ?? rateP1;
        lines.push({
            udNo: num(r[0]) !== null ? Math.trunc(num(r[0]) as number) : null,
            unitDesignator: designator,
            description: text(r[2]),
            unit: text(r[3]),
            quantity: qty,
            supplyTier: inferTierFromRates(p0, rateP1, rateP2),
            rateP0: p0,
            rateP1,
            rateP2,
            boqPart: 'BOQ',
        });
    }
    if (!lines.length) warnings.push('No BOQ lines were found');
    return { format: 'STANDARD', meta, lines, warnings };
}

/** CLUSTER: UD No | Designator | Description | Unit | Qty P0 | P1 | P2 | Rate P0 | P1 | P2 | Total ... */
function parseCluster(wb: XLSX.WorkBook): ParsedBoq {
    const warnings: string[] = [];
    const lines: BoqLineInput[] = [];
    const meta: ParsedBoqMeta = { contingencyByPart: {} };

    for (const sheet of ['BOQ-1', 'BOQ-2']) {
        const rows = rowsOf(wb, sheet);
        if (!rows.length) { warnings.push(`${sheet} sheet is missing or empty`); continue; }
        for (const r of rows) {
            const t = text(r[1]) ? '' : text(r[3]);
            const cont = /contingency\s*\(\s*(\d+(?:\.\d+)?)\s*%\s*\)/i.exec(t);
            if (cont) meta.contingencyByPart![sheet] = Number(cont[1]);
            if (/boq & estimate/i.test(text(r[0]))) meta.title = text(r[0]);
            if (/^rtom/i.test(text(r[0]))) meta.rtom = text(r[0]).replace(/^rtom:?\s*/i, '');
        }
        const header = findRow(rows, (r) => /ud no/i.test(text(r[0])));
        if (header < 0) { warnings.push(`${sheet}: header row not found`); continue; }
        for (const r of rows.slice(header + 2)) {
            const designator = text(r[1]);
            const rates = [num(r[7]), num(r[8]), num(r[9])];
            if (!designator || rates[0] === null) continue;
            const qtys: Array<[SupplyTier, number | null]> = [['P0', num(r[4])], ['P1', num(r[5])], ['P2', num(r[6])]];
            const filled = qtys.filter(([, q]) => q !== null && q > 0);
            if (filled.length === 0) continue;
            if (filled.length > 1) warnings.push(`${sheet} ${designator}: quantity in more than one tier column, split into separate lines`);
            for (const [tier, q] of filled) {
                lines.push({
                    udNo: num(r[0]) !== null ? Math.trunc(num(r[0]) as number) : null,
                    unitDesignator: designator,
                    description: text(r[2]),
                    unit: text(r[3]),
                    quantity: q as number,
                    supplyTier: tier,
                    rateP0: rates[0] as number,
                    rateP1: (rates[1] ?? rates[0]) as number,
                    rateP2: (rates[2] ?? rates[1] ?? rates[0]) as number,
                    boqPart: sheet,
                });
            }
        }
    }
    if (!lines.length) warnings.push('No BOQ lines were found');
    return { format: 'CLUSTER', meta, lines, warnings };
}

/**
 * INVOICE_SUMMARY ("In Sum-03"): SLT Item No | Designator | Unit | Qty Material | Accessories | Services | rate P0 | P1 | P2.
 * The tier follows which quantity columns are filled (material -> P0, accessories only -> P1, services only -> P2).
 */
function parseInvoiceSummary(wb: XLSX.WorkBook): ParsedBoq {
    const sheet = wb.SheetNames.find((n) => /^in sum/i.test(n.trim()));
    const rows = sheet ? rowsOf(wb, sheet) : [];
    const warnings: string[] = [];
    const meta: ParsedBoqMeta = {};
    for (const r of rows) {
        const joined = r.map(text).filter(Boolean).join(' ');
        const inv = /SLT INVOICE NO:\s*(\S+)/i.exec(joined);
        if (inv) meta.invoiceNo = inv[1];
        const ref = /SLT REF:\s*(\S+)/i.exec(joined);
        if (ref) meta.sltRef = ref[1];
        const rtom = /RTOM\s*:\s*(\S+)/i.exec(joined);
        if (rtom) meta.rtom = rtom[1];
    }
    const header = findRow(rows, (r) => /slt item no/i.test(text(r[0])));
    if (header < 0) throw new Error('Invoice summary: header row not found');
    const lines: BoqLineInput[] = [];
    for (const r of rows.slice(header + 2)) {
        const designator = text(r[1]).replace(/\s*\(.*$/, '');
        const rates = [num(r[6]), num(r[7]), num(r[8])];
        if (!designator || rates[0] === null) continue;
        const main = num(r[3]);
        const acc = num(r[4]);
        const svc = num(r[5]);
        const tier: SupplyTier = main ? 'P0' : acc ? 'P1' : 'P2';
        const quantity = (tier === 'P0' ? main : tier === 'P1' ? acc : svc) ?? 0;
        if (quantity <= 0) continue;
        lines.push({
            udNo: num(r[0]) !== null ? Math.trunc(num(r[0]) as number) : null,
            unitDesignator: designator,
            description: text(r[1]),
            unit: text(r[2]),
            quantity,
            supplyTier: tier,
            rateP0: rates[0] as number,
            rateP1: (rates[1] ?? rates[0]) as number,
            rateP2: (rates[2] ?? rates[1] ?? rates[0]) as number,
            boqPart: 'BOQ',
        });
    }
    if (!lines.length) warnings.push('No lines were found');
    return { format: 'INVOICE_SUMMARY', meta, lines, warnings };
}

export function parseBoqWorkbook(data: Buffer | ArrayBuffer | Uint8Array): ParsedBoq {
    const wb = readWorkbook(data);
    const format = detectBoqFormat(wb);
    if (!format) throw new Error('Unrecognised workbook: expected a BOQ sheet, BOQ-1/BOQ-2 sheets or an invoice summary sheet');
    if (format === 'CLUSTER') return parseCluster(wb);
    if (format === 'INVOICE_SUMMARY') return parseInvoiceSummary(wb);
    return parseStandard(wb);
}
