import ExcelJS from 'exceljs';
import {
    NO_INCREMENT, STANDARD_INCREMENT, SSCL_PERCENT, VAT_PERCENT,
    invoiceTax, invoiceTierTotals, invoiceUnitRate, round2, summarizePart, summarizeStandardBoq, tierRate,
    type BoqLineInput, type IncrementFactors,
} from './pricing';

/**
 * BOQ / invoice document packs. The layout follows the project type's document profile:
 *  STANDARD   customer request, rehabilitation, shifting (BOQ with increment factors; measurement + invoice sheets)
 *  CLUSTER    FTTH cluster / apartment (BOQ-0, BOQ-1, BOQ-2 with contingency, executive summary, front sheet)
 *  MARKETING  as STANDARD without increment, plus the material balance sheet (MBS)
 * A project type without a profile uses STANDARD.
 */

export type DocumentProfileCode = 'STANDARD' | 'CLUSTER' | 'MARKETING';

export interface DocumentProfile {
    code: DocumentProfileCode;
    label: string;
    increment: IncrementFactors;
    /** BOQ part -> contingency % (CLUSTER) */
    contingencyByPart: Record<string, number>;
    includeMaterialBalance: boolean;
}

export const DOCUMENT_PROFILES: Record<DocumentProfileCode, DocumentProfile> = {
    STANDARD: { code: 'STANDARD', label: 'Customer request / rehabilitation / shifting', increment: STANDARD_INCREMENT, contingencyByPart: {}, includeMaterialBalance: false },
    CLUSTER: { code: 'CLUSTER', label: 'FTTH cluster / apartment', increment: NO_INCREMENT, contingencyByPart: { 'BOQ-1': 15, 'BOQ-2': 5 }, includeMaterialBalance: false },
    MARKETING: { code: 'MARKETING', label: 'Marketing', increment: NO_INCREMENT, contingencyByPart: {}, includeMaterialBalance: true },
};

export function resolveDocumentProfile(code: string | null | undefined): DocumentProfile {
    const key = (code || '').toUpperCase() as DocumentProfileCode;
    return DOCUMENT_PROFILES[key] ?? DOCUMENT_PROFILES.STANDARD;
}

export interface MaterialBalanceRow {
    dateReceived?: string;
    irNo?: string;
    drumNo?: string;
    description: string;
    received: number;
    invoiced: number;
    wasted: number;
}

export interface PackProject {
    name: string;
    code: string;
    rtom?: string | null;
    route?: string | null;
    workOrderNo?: string | null;
    poNumber?: string | null;
    poDate?: Date | null;
    contractRef?: string | null;
    sltRef?: string | null;
}

export interface PackInput {
    profile: DocumentProfile;
    project: PackProject;
    /** quantity = quantity to invoice */
    lines: BoqLineInput[];
    invoiceNumber: string;
    invoiceDate: Date;
    invoiceKind: 'FINAL' | 'PART';
    materialBalance?: MaterialBalanceRow[];
    preparedBy?: string;
}

const fmtDate = (d: Date) => `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
const kindLabel = (k: 'FINAL' | 'PART') => (k === 'FINAL' ? 'Final Invoice' : 'Part Invoice');

/** Everything the layout layer needs to know about a sheet */
interface SheetSpec {
    widths: number[];
    landscape?: boolean;
    /** 1-based row of the table's column headings (repeated on every printed page) */
    headerRow?: number;
    /** 1-based last row of the table body */
    tableEnd?: number;
    /** header() sheets: first column of the right-hand block (invoice no / date) */
    rightCol?: number;
    /** merge labels in every row, table rows included (sheets that use blank cells as spacers) */
    mergeAll?: boolean;
    /** 1-based first row of the closing totals / signature block; kept together on one page */
    blockFrom?: number;
}
interface SheetDef { name: string; rows: unknown[][]; spec: SheetSpec }

const HEADER_ROWS = 7;
const HEADER_ROW = 8;

/** Seven heading rows shared by the invoice sheets; the right-hand block starts at column `rightCol` */
function header(input: PackInput, title: string, rightCol: number): unknown[][] {
    const { project, invoiceNumber, invoiceDate, invoiceKind } = input;
    const right = (text: string) => [...Array(rightCol - 2).fill(''), text];
    const po = project.poNumber
        ? ` (PO ${project.poNumber}${project.poDate ? `, ${fmtDate(project.poDate)}` : ''})`
        : '';
    return [
        [title],
        [`Contract No: ${project.contractRef ?? ''}${po}`],
        [`Contract Name :- ${project.name}`],
        [`SLT Ref: ${project.sltRef ?? ''}`],
        ['Contractor : Sri Lanka Telecom(Services)', ...right(`SLT INVOICE NO: ${invoiceNumber}`)],
        [`RTOM : ${project.rtom ?? ''}`, ...right(`Date: ${fmtDate(invoiceDate)}`)],
        ['', ...right(kindLabel(invoiceKind))],
    ];
}

function measurementSheet(input: PackInput): SheetDef {
    const rows: unknown[][] = [...header(input, 'MEASUREMENT & PAT FORM', 6)];
    rows.push(['SLT Item No', 'Unit Designator', 'Description', 'Unit', 'Section/Location', 'Quantity Main Material (SLTS)', 'Quantity Accessories (SLTS)', 'Quantity Services + Overhead']);
    for (const l of input.lines) {
        rows.push([l.udNo ?? '', l.unitDesignator, l.description, l.unit, l.boqPart ?? '',
            l.supplyTier === 'P0' ? l.quantity : '', l.supplyTier !== 'P2' ? l.quantity : '', l.quantity]);
    }
    const end = rows.length;
    rows.push([], ['Approval', '', 'Sri Lanka Telecom(Services)Ltd.', '', '', 'Sri Lanka Telecom PLC'], ['Name in Print'], ['Signature'], ['Date']);
    return { name: 'MS -1', rows, spec: { widths: [12, 16, 50, 8, 16, 18, 18, 18], landscape: true, headerRow: HEADER_ROW, tableEnd: end, rightCol: 6, blockFrom: end + 2 } };
}

function invoicedBoqSummarySheet(input: PackInput): SheetDef {
    const rows: unknown[][] = [...header(input, 'INVOICED BOQ SUMMARY', 5)];
    rows.push(['SLT Serial No', 'Unit Designator', 'Description', 'Unit', 'Material', 'Accessories', 'Services + Overhead']);
    for (const l of input.lines) {
        rows.push([l.udNo ?? '', l.unitDesignator, l.description, l.unit,
            l.supplyTier === 'P0' ? l.quantity : '', l.supplyTier !== 'P2' ? l.quantity : '', l.quantity]);
    }
    const end = rows.length;
    rows.push([], ['We certify that above works have been completed and quantities claimed are correct as per the measurement forms.'],
        ['Prepared By', '', '', 'AE/EAE/SEAE'], ['Checked By', '', '', 'MANAGER OPMC'], ['Project Manager', '', '', 'DGM']);
    return { name: 'WPS- 1', rows, spec: { widths: [14, 16, 50, 8, 14, 14, 18], landscape: true, headerRow: HEADER_ROW, tableEnd: end, rightCol: 5, blockFrom: end + 2 } };
}

function invoiceSummarySheet(input: PackInput): { sheet: SheetDef; totals: ReturnType<typeof invoiceTierTotals> } {
    const inc = input.profile.increment;
    const rows: unknown[][] = [...header(input, 'INVOICE SUMMARY', 8)];
    rows.push(['SLT Item No', 'Unit Designator', 'Unit', 'Qty Main Material', 'Qty Accessories', 'Qty Services + Overhead',
        'Unit Price P0 (Material+Acc+Services)', 'Unit Price P1 (Acc+Services)', 'Unit Price P2 (Services)',
        'Total P0', 'Total P1', 'Total P2']);
    for (const l of input.lines) {
        const rate = invoiceUnitRate(l, inc);
        const p = (tier: 'P0' | 'P1' | 'P2') => invoiceUnitRate({ ...l, supplyTier: tier }, inc);
        const total = round2(rate * l.quantity);
        rows.push([l.udNo ?? '', l.unitDesignator, l.unit,
            l.supplyTier === 'P0' ? l.quantity : '', l.supplyTier !== 'P2' ? l.quantity : '', l.quantity,
            p('P0'), p('P1'), p('P2'),
            l.supplyTier === 'P0' ? total : '-', l.supplyTier === 'P1' ? total : '-', l.supplyTier === 'P2' ? total : '-']);
    }
    const totals = invoiceTierTotals(input.lines, inc);
    const end = rows.length + 2;
    rows.push(['Total', '', '', '', '', '', '', '', '', totals.P0, totals.P1, totals.P2],
        ['Grand Total', '', '', '', '', '', '', '', '', '', '', round2(totals.P0 + totals.P1 + totals.P2)],
        [], ['Prepared By:', '', '', '', '', '', '', 'Checked By:'], ['Manager OPMC:'], ['Project Manager:']);
    return {
        totals,
        sheet: { name: 'In Sum-03', rows, spec: { widths: [12, 16, 8, 10, 10, 12, 14, 14, 14, 16, 16, 16], landscape: true, headerRow: HEADER_ROW, tableEnd: end, rightCol: 8, blockFrom: end - 1 } },
    };
}

function certificationSheet(input: PackInput, totals: ReturnType<typeof invoiceTierTotals>): SheetDef {
    const rows: unknown[][] = [...header(input, 'INVOICE CERTIFICATION', 4)];
    rows.push(['DESCRIPTION', '', 'P0 (Material+Acc+Services)', 'P1 (Acc+Services)', 'P2 (Services)']);
    const t0 = invoiceTax(totals.P0), t1 = invoiceTax(totals.P1), t2 = invoiceTax(totals.P2);
    rows.push(['Grand Total', '', totals.P0, totals.P1, totals.P2],
        [`ADD: SSCL ${SSCL_PERCENT}%`, '', t0.sscl, t1.sscl, t2.sscl],
        ['Total', '', t0.afterSscl, t1.afterSscl, t2.afterSscl],
        [`ADD: V.A.T. ${VAT_PERCENT}%`, '', t0.vat, t1.vat, t2.vat],
        ['NET TOTAL PAYABLE', '', t0.net, t1.net, t2.net],
        [], ['Remarks: We certify the above works have been completed and the quantities claimed are correct.'],
        ['Prepared By:', '', '', 'Checked By:'], ['Project Manager:', '', '', 'Project Manager:']);
    return { name: 'In-02', rows, spec: { widths: [30, 4, 24, 24, 24], headerRow: HEADER_ROW, tableEnd: 13, rightCol: 4, mergeAll: true } };
}

function taxInvoiceSheet(input: PackInput, totals: ReturnType<typeof invoiceTierTotals>): SheetDef {
    const gross = round2(totals.P0 + totals.P1 + totals.P2);
    const tax = invoiceTax(gross);
    const rows: unknown[][] = [...header(input, 'REFERENCE DOCUMENT TO THE INVOICE', 5)];
    rows.push(['Supplier:', '', '', '', '', 'Recipient:'],
        ['Sri Lanka Telecom(Services)Ltd.', '', '', '', '', 'Sri Lanka Telecom Limited.'],
        ['Description', '', '', '', '', 'SLRS'],
        ['', '', '', '', 'ADD/DEDUCT', 'AMOUNT'],
        ['P0 (Main Material + Accessories + Services + Overhead)', '', '', '', 'ADD', totals.P0],
        ['P1 (Accessories + Services + Overhead)', '', '', '', 'ADD', totals.P1],
        ['P2 (Services + Overhead)', '', '', '', 'ADD', totals.P2],
        ['Gross Invoice Value', '', '', '', '', gross],
        [`SSCL ${SSCL_PERCENT}%`, '', '', '', '', tax.sscl],
        ['Gross Invoice Value with SSCL', '', '', '', '', tax.afterSscl],
        [`VAT ${VAT_PERCENT}%`, '', '', '', '', tax.vat],
        ['Net Total Payable', '', '', '', '', tax.net],
        [], ['Signed by : ……………………………………………………']);
    return { name: 'Tax Inv-01', rows, spec: { widths: [50, 4, 4, 4, 16, 26], rightCol: 5, mergeAll: true } };
}

function partInvoiceSheet(input: PackInput, totals: ReturnType<typeof invoiceTierTotals>): SheetDef {
    const withSscl = invoiceTax(totals.P0 + totals.P1 + totals.P2).afterSscl;
    // the PO value is the invoice value until a separate PO amount is recorded on the project
    const poValue = withSscl;
    const rows: unknown[][] = [
        ['Part Invoicing Details'],
        ['', '', '', '', '', `Date: ${fmtDate(input.invoiceDate)}`],
        [`Contract Name :- ${input.project.name}`],
        ['Contractor : Sri Lanka Telecom(Services)'],
        [`RTOM : ${input.project.rtom ?? ''}`, '', '', '', '', `Invoice No: ${input.invoiceNumber}`],
        [`PO Value: Rs ${poValue.toFixed(2)} + VAT (${VAT_PERCENT}%)`],
        ['Slt Ref', 'Notice to Proceed date', 'Notice to Proceed Amount', 'Invoice Order', 'Invoice Number', 'Invoice Amount (Without VAT) Rs', 'Remarks'],
        [input.project.sltRef ?? '', input.project.poDate ? fmtDate(input.project.poDate) : '', poValue, kindLabel(input.invoiceKind), input.invoiceNumber, withSscl, 'This Invoice'],
        ['', '', 'Total (Without VAT)', '', '', withSscl],
        ['', '', 'Balance from LI Value', '', '', round2(poValue - withSscl)],
    ];
    return { name: 'IN Detail', rows, spec: { widths: [24, 22, 24, 16, 26, 32, 16], landscape: true, headerRow: 7, tableEnd: 8 } };
}

const CHECK_LIST = ['Payment Approval Form', 'Tax Invoice', 'Request for Payment', 'Provisional Acceptance Certificate', 'Invoice Certification Sheet',
    'Invoice Summary', 'Invoice BOQ Summary', 'Work Progress', 'Measurement Form', 'Material Balance Sheet', 'Addendum (as per the relevant contract)',
    'Performance Bond', 'Drawings', 'Approved Work Confirmation', 'Approved PO', 'Part Invoice Details', 'Check List'];

function checkListSheet(input: PackInput, totals: ReturnType<typeof invoiceTierTotals>): SheetDef {
    const net = invoiceTax(totals.P0 + totals.P1 + totals.P2).net;
    const rows: unknown[][] = [
        ['Check List'],
        ['Invoice No', input.invoiceNumber, 'Invoice Date', fmtDate(input.invoiceDate), 'Invoice Value', net],
        ['PO No', input.project.poNumber ?? '', 'PO Date', input.project.poDate ? fmtDate(input.project.poDate) : '', 'PO Value', net],
        ['RTOM', input.project.rtom ?? '', 'Contract No', input.project.contractRef ?? '', 'SLT Ref', input.project.sltRef ?? ''],
    ];
    CHECK_LIST.forEach((c, i) => rows.push([i + 1, c]));
    const end = rows.length;
    rows.push([], ['SLT', '___________________', 'Contractor', '___________________'], ['Signature'], ['Name'], ['Designation'], ['Date']);
    return { name: 'Check List', rows, spec: { widths: [14, 44, 16, 22, 14, 28], mergeAll: true, blockFrom: end + 2 } };
}

function materialBalanceSheet(input: PackInput): SheetDef {
    const rows: unknown[][] = [['Material Balance Sheet'],
        [`Project Ref No: ${input.project.code}`, '', '', '', '', '', '', '', `Contractor Ref No: ${input.project.contractRef ?? ''}`],
        [`SLT Ref No: ${input.project.sltRef ?? ''}   RTOM: ${input.project.rtom ?? ''}`, '', '', '', '', '', '', '', `Submission No: ${input.invoiceNumber}`],
        [`Location/Cab/Route: ${input.project.route ?? input.project.name}`, '', '', '', '', '', '', '', `Date: ${fmtDate(input.invoiceDate)}`],
        ['No', 'Date Received', 'IR No', 'Drum No', 'Description', 'Received Quantity', 'Invoiced Quantity', 'Wasted Quantity', 'Used Quantity (Invoiced+Wasted)', 'Balance Quantity', 'Remarks']];
    (input.materialBalance ?? []).forEach((m, i) => {
        const used = m.invoiced + m.wasted;
        rows.push([i + 1, m.dateReceived ?? '', m.irNo ?? '', m.drumNo ?? '', m.description, m.received, m.invoiced, m.wasted, used, round2(m.received - used), '']);
    });
    const end = rows.length;
    rows.push([], ['Approved', '', 'SRI LANKA TELECOM (SERVICES) LTD', '', '', '', '', 'SRI LANKA TELECOM'], ['Name'], ['Designation'], ['Signature'], ['Date']);
    return { name: 'MBS', rows, spec: { widths: [12, 14, 12, 10, 36, 14, 14, 14, 18, 14, 14], landscape: true, headerRow: 5, tableEnd: end, blockFrom: end + 2 } };
}

const CLUSTER_WIDTHS = [8, 16, 50, 8, 8, 8, 8, 12, 12, 12, 16, 16, 16];

function boqSheet(input: PackInput, name: string, lines: BoqLineInput[], contingency: number): SheetDef {
    const rows: unknown[][] = [[name], [`BOQ & Estimate for ${input.project.name}`], [`RTOM: ${input.project.rtom ?? ''}`], [],
        ['UD No.', 'Unit Designator', 'Description of Assembly Unit', 'Unit', 'Qty P0', 'Qty P1', 'Qty P2', 'Rate P0', 'Rate P1', 'Rate P2', 'Total P0', 'Total P1', 'Total P2']];
    for (const l of lines) {
        const amount = round2(tierRate(l, l.supplyTier) * l.quantity);
        rows.push([l.udNo ?? '', l.unitDesignator, l.description, l.unit,
            l.supplyTier === 'P0' ? l.quantity : '', l.supplyTier === 'P1' ? l.quantity : '', l.supplyTier === 'P2' ? l.quantity : '',
            l.rateP0, l.rateP1, l.rateP2,
            l.supplyTier === 'P0' ? amount : '', l.supplyTier === 'P1' ? amount : '', l.supplyTier === 'P2' ? amount : '']);
    }
    const end = rows.length;
    const part = summarizePart(name, lines, contingency);
    if (contingency > 0) {
        rows.push(['', '', '', `Contingency (${contingency}%)`, '', '', '', '', '', '', round2(part.contingency.P0), round2(part.contingency.P1), round2(part.contingency.P2)]);
    }
    rows.push(['', '', '', 'Sub Total (Rs.)', '', '', '', '', '', '', round2(part.subTotal.P0), round2(part.subTotal.P1), round2(part.subTotal.P2)],
        ['', '', '', 'Total Price (Rs.)', '', '', '', '', '', '', '', '', round2(part.total)],
        ['', '', '', `Total Price with SSCL ${SSCL_PERCENT}% (Rs.)`, '', '', '', '', '', '', '', '', round2(part.withSscl)],
        ['', '', '', `Total Price with V.A.T. ${VAT_PERCENT}% (Rs.)`, '', '', '', '', '', '', '', '', round2(part.withVat)]);
    return { name, rows, spec: { widths: CLUSTER_WIDTHS, landscape: true, headerRow: 5, tableEnd: end, blockFrom: end + 1 } };
}

function standardBoqSheet(input: PackInput): SheetDef {
    const inc = input.profile.increment;
    const s = summarizeStandardBoq(input.lines, inc);
    const rows: unknown[][] = [[input.project.name], [`Project Name : ${input.project.name}`], [`RTOM Area : ${input.project.rtom ?? ''}`], [`Road : ${input.project.route ?? ''}`],
        ['Item No.', 'Unit Designator', 'Description of Assembly Unit', 'Unit', 'Qty', 'P0', 'P1', 'P2', 'Main Material', 'Accessories', 'Services +OH']];
    for (const l of input.lines) {
        const a = lineAmountsOf(l);
        rows.push([l.udNo ?? '', l.unitDesignator, l.description, l.unit, l.quantity, l.rateP0, l.rateP1, l.rateP2, round2(a.material), round2(a.accessories), round2(a.services)]);
    }
    const end = rows.length;
    rows.push(['Total Amount (Rs.)', '', '', '', '', '', '', '', round2(s.components.material), round2(s.components.accessories), round2(s.components.services)],
        ['Increment Factor Ratio', '', '', '', '', '', '', '', inc.material, inc.accessories, inc.services],
        ['Total value with Increment Amount', '', '', '', '', '', '', '', round2(s.withIncrement.material), round2(s.withIncrement.accessories), round2(s.withIncrement.services)],
        ['Gross BOQ value', '', '', '', '', '', '', '', '', '', round2(s.gross)],
        [` SSCL(${SSCL_PERCENT}%)`, '', '', '', '', '', '', '', '', '', round2(s.tax.sscl)],
        [`Total with SSCL(${SSCL_PERCENT}%)`, '', '', '', '', '', '', '', '', '', round2(s.tax.afterSscl)],
        [` VAT (${VAT_PERCENT}%)`, '', '', '', '', '', '', '', '', '', round2(s.tax.vat)],
        [`Grand Total with VAT (${VAT_PERCENT}%)`, '', '', '', '', '', '', '', '', '', round2(s.tax.net)]);
    return { name: 'BOQ', rows, spec: { widths: [8, 16, 50, 8, 8, 12, 12, 12, 16, 16, 16], landscape: true, headerRow: 5, tableEnd: end, blockFrom: end + 1 } };
}

function lineAmountsOf(l: BoqLineInput) {
    const material = l.supplyTier === 'P0' ? (l.rateP0 - l.rateP1) * l.quantity : 0;
    const accessories = l.supplyTier === 'P2' ? 0 : (l.rateP1 - l.rateP2) * l.quantity;
    const services = l.rateP2 * l.quantity;
    return { material, accessories, services };
}

function clusterSheets(input: PackInput): SheetDef[] {
    const parts = [...new Set(input.lines.map((l) => l.boqPart || 'BOQ-1'))].sort();
    // BOQ-0 prices every line at the full (P0) rate: the turnkey value before the split into parts
    const turnkey = input.lines.map((l) => ({ ...l, supplyTier: 'P0' as const }));
    const sheets: SheetDef[] = [boqSheet(input, 'BOQ-0', turnkey, 0)];
    for (const part of parts) {
        const cont = input.profile.contingencyByPart[part] ?? 0;
        sheets.push(boqSheet(input, part, input.lines.filter((l) => (l.boqPart || 'BOQ-1') === part), cont));
    }
    const partSummaries = parts.map((p) => summarizePart(p, input.lines.filter((l) => (l.boqPart || 'BOQ-1') === p), input.profile.contingencyByPart[p] ?? 0));
    // the totals add up the figures printed above them, so the sheet always foots
    const sum = (f: (s: ReturnType<typeof summarizePart>) => number) => round2(partSummaries.reduce((a, s) => a + round2(f(s)), 0));
    sheets.push({
        name: 'EX Summery',
        rows: [
            ['Executive Summary of FTTH Development'],
            ['Cluster', input.project.name], ['RTOM Area', input.project.rtom ?? ''], ['Reference', input.project.sltRef ?? input.project.code],
            ['Financial'],
            ...partSummaries.map((s) => [`${s.part} total (without VAT)`, round2(s.total), 'with SSCL & VAT', round2(s.withVat)]),
            ['Total cost (without VAT)', sum((s) => s.total), 'with SSCL & VAT', sum((s) => s.withVat)],
        ],
        spec: { widths: [46, 18, 18, 18], mergeAll: true },
    });
    sheets.push({
        name: 'Front Sheet',
        rows: [
            ['FTTH Development Checklist for BOQ'], [`RTOM Area : ${input.project.rtom ?? ''}`], [`Cluster : ${input.project.name}`],
            [`Req Ref : ${input.project.sltRef ?? ''}`], ['BOQ Certified and Signed'],
            ['Manager/RTO (Confirmation of DP Locations)'], ['Manager/OPMC (Confirmation of Network)'], ['DGM/Province'],
            ['Attachment: Executive Summary, BOQ 0, BOQ 1, BOQ 2'], [`BOQ Created by: ${input.preparedBy ?? ''}`],
        ],
        spec: { widths: [50, 30], mergeAll: true },
    });
    return sheets;
}

// ---------------------------------------------------------------------------------------------------------------------
// Layout: every sheet is set up so Download then Print gives clean A4 pages (fit to width, repeated headings, page numbers)
// ---------------------------------------------------------------------------------------------------------------------

const colLetter = (n: number) => {
    let out = '';
    for (let x = n; x > 0; x = Math.floor((x - 1) / 26)) out = String.fromCharCode(65 + ((x - 1) % 26)) + out;
    return out;
};
const isBlank = (v: unknown) => v === '' || v === null || v === undefined;
const A4 = { portrait: { w: 8.27, h: 11.69 }, landscape: { w: 11.69, h: 8.27 } };
const LINE = { style: 'thin' as const, color: { argb: 'FF475569' } };
const BORDER = { top: LINE, bottom: LINE, left: LINE, right: LINE };
const HEAD_FILL = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FFE2E8F0' } };
const SIGN_ROW = /^(Signature|Name|Name in Print|Designation|Date)$/;

/** Cell ranges to merge so a long label is never cut by its neighbour. Returns [row, fromCol, toCol][] (1-based) */
function planMerges(rows: unknown[][], spec: SheetSpec): Array<[number, number, number]> {
    const last = spec.widths.length;
    const out: Array<[number, number, number]> = [];
    rows.forEach((r, i) => {
        const rowNo = i + 1;
        const filled = r.map((v, c) => (isBlank(v) ? -1 : c + 1)).filter((c) => c > 0);
        if (!filled.length) return;
        if (rowNo === 1) { if (last > 1) out.push([1, 1, last]); return; }
        if (spec.rightCol && rowNo <= HEADER_ROWS) {
            if (rowNo <= 4) { out.push([rowNo, 1, last]); return; }
            if (spec.rightCol > 2) out.push([rowNo, 1, spec.rightCol - 1]);
            if (spec.rightCol < last) out.push([rowNo, spec.rightCol, last]);
            return;
        }
        const inTable = spec.headerRow && spec.tableEnd && rowNo >= spec.headerRow && rowNo <= spec.tableEnd;
        if (inTable && !spec.mergeAll) return;
        filled.forEach((c, k) => {
            const v = r[c - 1];
            if (typeof v !== 'string') return;
            const end = (filled[k + 1] ?? last + 1) - 1;
            if (end > c && v.length > spec.widths[c - 1] * 0.8) out.push([rowNo, c, end]);
        });
    });
    return out;
}

/** Lines a text needs in a cell `width` characters wide (Calibri 10) */
const linesFor = (text: string, width: number, factor = 1) =>
    text.split('\n').reduce((n, part) => n + Math.max(1, Math.ceil((part.length * factor) / Math.max(4, width * 1.12))), 0);

function addSheet(wb: ExcelJS.Workbook, def: SheetDef) {
    const { rows, spec } = def;
    const last = spec.widths.length;
    const landscape = !!spec.landscape;
    const ws = wb.addWorksheet(def.name.slice(0, 31), {
        views: [{ showGridLines: false }],
        pageSetup: {
            paperSize: 9,
            orientation: landscape ? 'landscape' : 'portrait',
            fitToPage: true, fitToWidth: 1, fitToHeight: 0,
            horizontalCentered: true,
            margins: { left: 0.4, right: 0.4, top: 0.75, bottom: 0.75, header: 0.3, footer: 0.3 },
            printArea: `A$1:${colLetter(last)}$${rows.length}`,
            printTitlesRow: spec.headerRow ? `${spec.headerRow}:${spec.headerRow}` : undefined,
        },
        headerFooter: { oddFooter: '&L&8&F - &A&R&8Page &P of &N' },
    });
    spec.widths.forEach((w, i) => { ws.getColumn(i + 1).width = w; });

    // blank means empty: an empty string would stop the neighbouring text from using the space
    rows.forEach((r) => ws.addRow(r.map((v) => (isBlank(v) ? null : v))));
    const spanWidth = new Map<string, number>();
    for (const [r, a, b] of planMerges(rows, spec)) {
        ws.mergeCells(r, a, r, b);
        spanWidth.set(`${r}:${a}`, spec.widths.slice(a - 1, b).reduce((x, y) => x + y, 0));
    }

    const heights: number[] = [];
    rows.forEach((raw, idx) => {
        const rowNo = idx + 1;
        const row = ws.getRow(rowNo);
        const isTitle = rowNo === 1;
        const isHead = spec.headerRow === rowNo;
        const inTable = !!(spec.headerRow && spec.tableEnd && rowNo >= spec.headerRow && rowNo <= spec.tableEnd);
        const hasNumber = raw.some((v) => typeof v === 'number');
        let lines = 1;
        raw.forEach((v, i) => {
            if (isBlank(v)) return;
            const col = i + 1;
            const cell = row.getCell(col);
            const width = spanWidth.get(`${rowNo}:${col}`) ?? spec.widths[i];
            cell.font = { name: 'Calibri', size: isTitle ? 14 : 10, bold: isTitle || isHead };
            if (typeof v === 'number') {
                cell.numFmt = col === 1 && Number.isInteger(v) ? '0' : '#,##0.00';
                cell.alignment = { horizontal: 'right', vertical: 'top' };
            } else {
                const text = String(v);
                const rightBlock = !!spec.rightCol && rowNo > 4 && rowNo <= HEADER_ROWS && col === spec.rightCol;
                cell.alignment = {
                    wrapText: true,
                    vertical: isHead ? 'middle' : 'top',
                    horizontal: isTitle || isHead ? 'center' : rightBlock || text === '-' ? 'right' : 'left',
                };
                lines = Math.max(lines, linesFor(text, width, isTitle ? 1.4 : isHead ? 1.1 : 1));
            }
            if (isHead) cell.fill = HEAD_FILL;
        });
        // a bordered row keeps the grid closed, blank cells included
        const bordered = !isTitle && (inTable || (hasNumber && !spec.rightCol));
        if (bordered) {
            for (let c = 1; c <= last; c++) {
                const cell = row.getCell(c);
                cell.border = BORDER;
                if (isHead) cell.fill = HEAD_FILL;
            }
        }
        const label = typeof raw[0] === 'string' ? raw[0] : '';
        const signRow = SIGN_ROW.test(label);
        if (signRow) {
            for (let c = 2; c <= last; c++) row.getCell(c).border = { bottom: { style: 'hair', color: { argb: 'FF475569' } } };
        }
        const h = Math.max(isTitle || signRow ? 24 : 15, lines * 13.5 + (isHead ? 6 : 2));
        row.height = h;
        heights[rowNo] = h;
    });

    // Keep the closing totals / signature block on one page: it starts on a fresh page when it would be split
    if (spec.blockFrom && spec.blockFrom > 1 && spec.blockFrom <= rows.length) {
        const widthIn = spec.widths.reduce((a, w) => a + w * 7 + 5, 0) / 96;
        const page = landscape ? A4.landscape : A4.portrait;
        const scale = Math.min(1, (page.w - 0.8) / widthIn);
        const pageH = ((page.h - 1.5) * 72) / scale;
        const headH = spec.headerRow ? heights[spec.headerRow] ?? 0 : 0;
        let used = 0;
        for (let r = 1; r < spec.blockFrom; r++) {
            if (used + (heights[r] ?? 15) > pageH) used = headH;
            used += heights[r] ?? 15;
        }
        let block = 0;
        for (let r = spec.blockFrom; r <= rows.length; r++) block += heights[r] ?? 15;
        if (used + block > pageH && block < pageH - headH) ws.getRow(spec.blockFrom - 1).addPageBreak();
    }
}

/** Build the document pack workbook for the profile and return it as an xlsx buffer */
export async function buildDocumentPack(input: PackInput): Promise<Buffer> {
    const wb = new ExcelJS.Workbook();
    wb.creator = 'SLTS ERP';
    wb.created = new Date();
    const sheets: SheetDef[] = [];
    if (input.profile.code === 'CLUSTER') {
        sheets.push(...clusterSheets(input));
    } else {
        if (input.profile.code === 'STANDARD') sheets.push(standardBoqSheet(input));
        const summary = invoiceSummarySheet(input);
        sheets.push(measurementSheet(input), invoicedBoqSummarySheet(input), summary.sheet,
            certificationSheet(input, summary.totals), taxInvoiceSheet(input, summary.totals));
        if (input.profile.includeMaterialBalance) sheets.push(materialBalanceSheet(input));
        sheets.push(partInvoiceSheet(input, summary.totals), checkListSheet(input, summary.totals));
    }
    for (const def of sheets) addSheet(wb, def);
    return Buffer.from(await wb.xlsx.writeBuffer());
}
