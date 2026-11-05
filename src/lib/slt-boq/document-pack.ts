import * as XLSX from 'xlsx';
import {
    NO_INCREMENT, STANDARD_INCREMENT, SSCL_PERCENT, VAT_PERCENT,
    invoiceTierTotals, invoiceUnitRate, round2, summarizePart, summarizeStandardBoq, taxBreakdown, tierRate,
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

function header(input: PackInput, title: string): unknown[][] {
    const { project, invoiceNumber, invoiceDate, invoiceKind } = input;
    return [
        [title],
        [`Contract No: ${project.contractRef ?? ''}${project.poNumber ? ` (${project.poNumber})` : ''}`],
        [`Contract Name :- ${project.name}`],
        [`SLT Ref: ${project.sltRef ?? ''}`],
        ['Contractor : Sri Lanka Telecom(Services)', '', '', '', `SLT INVOICE NO: ${invoiceNumber}`],
        [`RTOM : ${project.rtom ?? ''}`, '', '', '', `Date: ${fmtDate(invoiceDate)}`],
        ['', '', '', '', kindLabel(invoiceKind)],
    ];
}

function addSheet(wb: XLSX.WorkBook, name: string, rows: unknown[][], widths: number[]) {
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = widths.map((w) => ({ wch: w }));
    XLSX.utils.book_append_sheet(wb, ws, name.slice(0, 31));
}

function measurementSheet(input: PackInput): unknown[][] {
    const rows: unknown[][] = [...header(input, 'MEASUREMENT & PAT FORM')];
    rows.push(['SLT Item No', 'Unit Designator', 'Description', 'Unit', 'Section/Location', 'Quantity Main Material (SLTS)', 'Quantity Accessories (SLTS)', 'Quantity Services + Overhead']);
    for (const l of input.lines) {
        rows.push([l.udNo ?? '', l.unitDesignator, l.description, l.unit, l.boqPart ?? '',
            l.supplyTier === 'P0' ? l.quantity : '', l.supplyTier !== 'P2' ? l.quantity : '', l.quantity]);
    }
    rows.push([], ['Approval', '', 'Sri Lanka Telecom(Services)Ltd.', '', '', 'Sri Lanka Telecom PLC'], ['Name in Print'], ['Signature'], ['Date']);
    return rows;
}

function invoicedBoqSummarySheet(input: PackInput): unknown[][] {
    const rows: unknown[][] = [...header(input, 'INVOICED BOQ SUMMARY')];
    rows.push(['SLT Serial No', 'Unit Designator', 'Description', 'Unit', 'Material', 'Accessories', 'Services + Overhead']);
    for (const l of input.lines) {
        rows.push([l.udNo ?? '', l.unitDesignator, l.description, l.unit,
            l.supplyTier === 'P0' ? l.quantity : '', l.supplyTier !== 'P2' ? l.quantity : '', l.quantity]);
    }
    rows.push([], ['We certify that above works have been completed and quantities claimed are correct as per the measurement forms.'],
        ['Prepared By', '', '', 'AE/EAE/SEAE'], ['Checked By', '', '', 'MANAGER OPMC'], ['Project Manager', '', '', 'DGM']);
    return rows;
}

function invoiceSummarySheet(input: PackInput): { rows: unknown[][]; totals: ReturnType<typeof invoiceTierTotals> } {
    const inc = input.profile.increment;
    const rows: unknown[][] = [...header(input, 'INVOICE SUMMARY')];
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
    rows.push(['Total', '', '', '', '', '', '', '', '', totals.P0, totals.P1, totals.P2],
        ['Grand Total', '', '', '', '', '', '', '', '', '', '', round2(totals.P0 + totals.P1 + totals.P2)],
        [], ['Prepared By:', '', '', '', '', '', '', 'Checked By:'], ['Manager OPMC:'], ['Project Manager:']);
    return { rows, totals };
}

function certificationSheet(input: PackInput, totals: ReturnType<typeof invoiceTierTotals>): unknown[][] {
    const rows: unknown[][] = [...header(input, 'INVOICE CERTIFICATION')];
    rows.push(['DESCRIPTION', '', 'P0 (Material+Acc+Services)', 'P1 (Acc+Services)', 'P2 (Services)']);
    const taxFor = (v: number) => taxBreakdown(v);
    const t0 = taxFor(totals.P0), t1 = taxFor(totals.P1), t2 = taxFor(totals.P2);
    rows.push(['Grand Total', '', totals.P0, totals.P1, totals.P2],
        [`ADD: SSCL ${SSCL_PERCENT}%`, '', t0.sscl, t1.sscl, t2.sscl],
        ['Total', '', t0.afterSscl, t1.afterSscl, t2.afterSscl],
        [`ADD: V.A.T. ${VAT_PERCENT}%`, '', t0.vat, t1.vat, t2.vat],
        ['NET TOTAL PAYABLE', '', t0.net, t1.net, t2.net],
        [], ['Remarks: We certify the above works have been completed and the quantities claimed are correct.'],
        ['Prepared By:', '', '', 'Checked By:'], ['Project Manager:', '', '', 'Project Manager:']);
    return rows;
}

function taxInvoiceSheet(input: PackInput, totals: ReturnType<typeof invoiceTierTotals>): unknown[][] {
    const gross = round2(totals.P0 + totals.P1 + totals.P2);
    const tax = taxBreakdown(gross);
    const rows: unknown[][] = [...header(input, 'REFERENCE DOCUMENT TO THE INVOICE')];
    rows.push(['Supplier:', '', '', '', '', 'Recipient:'],
        ['Sri Lanka Telecom(Services)Ltd.', '', '', '', '', 'Sri Lanka Telecom Limited.'],
        ['Description', '', '', '', '', 'SLRS'],
        ['', '', '', '', 'ADD/DEDUCT', 'AMOUNT'],
        ['P0 (Main Material + Accessories + Services + Overhead)', '', '', '', 'ADD', totals.P0],
        ['P1 (Accessories + Services + Overhead)', '', '', '', 'ADD', totals.P1],
        ['P2 (Services + Overhead)', '', '', '', 'ADD', totals.P2],
        ['Gross Invoice Value', '', '', '', '', gross],
        [`SSCL ${SSCL_PERCENT}%`, '', '', '', '', round2(tax.sscl)],
        ['Gross Invoice Value with SSCL', '', '', '', '', round2(tax.afterSscl)],
        [`VAT ${VAT_PERCENT}%`, '', '', '', '', round2(tax.vat)],
        ['Net Total Payable', '', '', '', '', round2(tax.net)],
        [], ['Signed by : ……………………………………………………']);
    return rows;
}

function partInvoiceSheet(input: PackInput, totals: ReturnType<typeof invoiceTierTotals>): unknown[][] {
    const gross = round2(totals.P0 + totals.P1 + totals.P2);
    const withSscl = round2(taxBreakdown(gross).afterSscl);
    // the PO value is the invoice value until a separate PO amount is recorded on the project
    const poValue = withSscl;
    return [
        ['Part Invoicing Details'],
        ['', '', '', '', '', `Date: ${fmtDate(input.invoiceDate)}`],
        [`Contract Name :- ${input.project.name}`],
        ['Contractor : Sri Lanka Telecom(Services)'],
        [`PO Value: Rs ${poValue.toFixed(2)} + VAT (${VAT_PERCENT}%)`],
        ['Slt Ref', 'Notice to Proceed date', 'Notice to Proceed Amount', 'Invoice Order', 'Invoice Number', 'Invoice Amount (Without VAT) Rs', 'Remarks'],
        [input.project.sltRef ?? '', input.project.poDate ? fmtDate(input.project.poDate) : '', poValue, kindLabel(input.invoiceKind), input.invoiceNumber, withSscl, 'This Invoice'],
        ['', '', 'Total (Without VAT)', '', '', withSscl],
        ['', '', 'Balance from LI Value', '', '', round2(poValue - withSscl)],
    ];
}

const CHECK_LIST = ['Payment Approval Form', 'Tax Invoice', 'Request for Payment', 'Provisional Acceptance Certificate', 'Invoice Certification Sheet',
    'Invoice Summary', 'Invoice BOQ Summary', 'Work Progress', 'Measurement Form', 'Material Balance Sheet', 'Addendum (as per the relevant contract)',
    'Performance Bond', 'Drawings', 'Approved Work Confirmation', 'Approved PO', 'Part Invoice Details', 'Check List'];

function checkListSheet(input: PackInput, totals: ReturnType<typeof invoiceTierTotals>): unknown[][] {
    const net = round2(taxBreakdown(totals.P0 + totals.P1 + totals.P2).net);
    const rows: unknown[][] = [
        ['Check List'],
        ['Invoice No', input.invoiceNumber, 'Invoice Date', fmtDate(input.invoiceDate), 'Invoice Value', net],
        ['PO No', input.project.poNumber ?? '', 'PO Date', input.project.poDate ? fmtDate(input.project.poDate) : '', 'PO Value', net],
    ];
    CHECK_LIST.forEach((c, i) => rows.push([i + 1, c]));
    rows.push([], ['SLT', '___________________', 'Contractor', '___________________'], ['Signature'], ['Name'], ['Designation'], ['Date']);
    return rows;
}

function materialBalanceSheet(input: PackInput): unknown[][] {
    const rows: unknown[][] = [['Material Balance Sheet'],
        [`Project Ref No: ${input.project.code}`, '', '', '', '', '', '', '', `Contractor Ref No:`],
        [`SLT Ref No: ${input.project.sltRef ?? ''}`, '', '', '', '', '', '', '', `Submission No: ${input.invoiceNumber}`],
        [`Location/Cab/Route: ${input.project.route ?? input.project.name}`],
        ['No', 'Date Received', 'IR No', 'Drum No', 'Description', 'Received Quantity', 'Invoiced Quantity', 'Wasted Quantity', 'Used Quantity (Invoiced+Wasted)', 'Balance Quantity', 'Remarks']];
    (input.materialBalance ?? []).forEach((m, i) => {
        const used = m.invoiced + m.wasted;
        rows.push([i + 1, m.dateReceived ?? '', m.irNo ?? '', m.drumNo ?? '', m.description, m.received, m.invoiced, m.wasted, used, round2(m.received - used), '']);
    });
    rows.push([], ['Approved', '', 'SRI LANKA TELECOM (SERVICES) LTD', '', '', '', '', 'SRI LANKA TELECOM'], ['Name'], ['Designation'], ['Signature'], ['Date']);
    return rows;
}

function boqSheet(input: PackInput, name: string, lines: BoqLineInput[], contingency: number): unknown[][] {
    const rows: unknown[][] = [[name], [`BOQ & Estimate for ${input.project.name}`], [`RTOM: ${input.project.rtom ?? ''}`], [],
        ['UD No.', 'Unit Designator', 'Description of Assembly Unit', 'Unit', 'Qty P0', 'Qty P1', 'Qty P2', 'Rate P0', 'Rate P1', 'Rate P2', 'Total P0', 'Total P1', 'Total P2']];
    for (const l of lines) {
        const amount = round2(tierRate(l, l.supplyTier) * l.quantity);
        rows.push([l.udNo ?? '', l.unitDesignator, l.description, l.unit,
            l.supplyTier === 'P0' ? l.quantity : '', l.supplyTier === 'P1' ? l.quantity : '', l.supplyTier === 'P2' ? l.quantity : '',
            l.rateP0, l.rateP1, l.rateP2,
            l.supplyTier === 'P0' ? amount : '', l.supplyTier === 'P1' ? amount : '', l.supplyTier === 'P2' ? amount : '']);
    }
    const part = summarizePart(name, lines, contingency);
    rows.push(['', '', '', `Contingency (${contingency}%)`, '', '', '', '', '', '', round2(part.contingency.P0), round2(part.contingency.P1), round2(part.contingency.P2)],
        ['', '', '', 'Sub Total (Rs.)', '', '', '', '', '', '', round2(part.subTotal.P0), round2(part.subTotal.P1), round2(part.subTotal.P2)],
        ['', '', '', 'Total Price (Rs.)', '', '', '', '', '', '', '', '', round2(part.total)],
        ['', '', '', `Total Price with SSCL ${SSCL_PERCENT}% (Rs.)`, '', '', '', '', '', '', '', '', round2(part.withSscl)],
        ['', '', '', `Total Price with V.A.T. ${VAT_PERCENT}% (Rs.)`, '', '', '', '', '', '', '', '', round2(part.withVat)]);
    return rows;
}

function standardBoqSheet(input: PackInput): unknown[][] {
    const inc = input.profile.increment;
    const s = summarizeStandardBoq(input.lines, inc);
    const rows: unknown[][] = [[input.project.name], [`Project Name : ${input.project.name}`], [`RTOM Area : ${input.project.rtom ?? ''}`], [`Road : ${input.project.route ?? ''}`],
        ['Item No.', 'Unit Designator', 'Description of Assembly Unit', 'Unit', 'Qty', 'P0', 'P1', 'P2', 'Main Material', 'Accessories', 'Services +OH']];
    for (const l of input.lines) {
        const a = lineAmountsOf(l);
        rows.push([l.udNo ?? '', l.unitDesignator, l.description, l.unit, l.quantity, l.rateP0, l.rateP1, l.rateP2, round2(a.material), round2(a.accessories), round2(a.services)]);
    }
    rows.push(['Total Amount (Rs.)', '', '', '', '', '', '', '', round2(s.components.material), round2(s.components.accessories), round2(s.components.services)],
        ['Increment Factor Ratio', '', '', '', '', '', '', '', inc.material, inc.accessories, inc.services],
        ['Total value with Increment Amount', '', '', '', '', '', '', '', round2(s.withIncrement.material), round2(s.withIncrement.accessories), round2(s.withIncrement.services)],
        ['Gross BOQ value', '', '', '', '', '', '', '', '', '', round2(s.gross)],
        [` SSCL(${SSCL_PERCENT}%)`, '', '', '', '', '', '', '', '', '', round2(s.tax.sscl)],
        [`Total with SSCL(${SSCL_PERCENT}%)`, '', '', '', '', '', '', '', '', '', round2(s.tax.afterSscl)],
        [` VAT (${VAT_PERCENT}%)`, '', '', '', '', '', '', '', '', '', round2(s.tax.vat)],
        [`Grand Total with VAT (${VAT_PERCENT}%)`, '', '', '', '', '', '', '', '', '', round2(s.tax.net)]);
    return rows;
}

function lineAmountsOf(l: BoqLineInput) {
    const material = l.supplyTier === 'P0' ? (l.rateP0 - l.rateP1) * l.quantity : 0;
    const accessories = l.supplyTier === 'P2' ? 0 : (l.rateP1 - l.rateP2) * l.quantity;
    const services = l.rateP2 * l.quantity;
    return { material, accessories, services };
}

function clusterSheets(wb: XLSX.WorkBook, input: PackInput) {
    const parts = [...new Set(input.lines.map((l) => l.boqPart || 'BOQ-1'))].sort();
    const all = boqSheet(input, 'BOQ-0', input.lines, 0);
    addSheet(wb, 'BOQ-0', all, [8, 16, 50, 8, 8, 8, 8, 12, 12, 12, 14, 14, 14]);
    for (const part of parts) {
        const cont = input.profile.contingencyByPart[part] ?? 0;
        addSheet(wb, part, boqSheet(input, part, input.lines.filter((l) => (l.boqPart || 'BOQ-1') === part), cont), [8, 16, 50, 8, 8, 8, 8, 12, 12, 12, 14, 14, 14]);
    }
    const partSummaries = parts.map((p) => summarizePart(p, input.lines.filter((l) => (l.boqPart || 'BOQ-1') === p), input.profile.contingencyByPart[p] ?? 0));
    const sum = (f: (s: ReturnType<typeof summarizePart>) => number) => round2(partSummaries.reduce((a, s) => a + f(s), 0));
    const total = sum((s) => s.total);
    addSheet(wb, 'EX Summery', [
        ['Executive Summary of FTTH Development'],
        ['Cluster', input.project.name], ['RTOM Area', input.project.rtom ?? ''], ['Reference', input.project.sltRef ?? input.project.code],
        ['Financial'],
        ...partSummaries.map((s) => [`${s.part} total (without VAT)`, round2(s.total), `with VAT`, round2(s.withVat)]),
        ['Total cost (without VAT)', total], [`Total cost with VAT (${VAT_PERCENT}%)`, round2(total * (1 + VAT_PERCENT / 100))],
    ], [46, 18, 14, 18]);
    addSheet(wb, 'Front Sheet', [
        ['FTTH Development Checklist for BOQ'], [`RTOM Area : ${input.project.rtom ?? ''}`], [`Cluster : ${input.project.name}`],
        [`Req Ref : ${input.project.sltRef ?? ''}`], ['BOQ Certified and Signed'],
        ['Manager/RTO (Confirmation of DP Locations)'], ['Manager/OPMC (Confirmation of Network)'], ['DGM/Province'],
        ['Attachment: Executive Summary, BOQ 0, BOQ 1, BOQ 2'], [`BOQ Created by: ${input.preparedBy ?? ''}`],
    ], [50, 30]);
}

/** Build the document pack workbook for the profile and return it as an xlsx buffer */
export function buildDocumentPack(input: PackInput): Buffer {
    const wb = XLSX.utils.book_new();
    if (input.profile.code === 'CLUSTER') {
        clusterSheets(wb, input);
    } else {
        if (input.profile.code === 'STANDARD') addSheet(wb, 'BOQ', standardBoqSheet(input), [8, 16, 50, 8, 8, 12, 12, 12, 14, 14, 14]);
        const summary = invoiceSummarySheet(input);
        addSheet(wb, 'MS -1', measurementSheet(input), [12, 16, 50, 8, 16, 14, 14, 14]);
        addSheet(wb, 'WPS- 1', invoicedBoqSummarySheet(input), [12, 16, 50, 8, 12, 12, 14]);
        addSheet(wb, 'In Sum-03', summary.rows, [10, 16, 8, 10, 10, 12, 14, 14, 14, 14, 14, 14]);
        addSheet(wb, 'In-02', certificationSheet(input, summary.totals), [30, 4, 22, 22, 22]);
        addSheet(wb, 'Tax Inv-01', taxInvoiceSheet(input, summary.totals), [52, 4, 4, 4, 12, 18]);
        if (input.profile.includeMaterialBalance) addSheet(wb, 'MBS', materialBalanceSheet(input), [5, 14, 12, 10, 28, 14, 14, 14, 18, 14, 14]);
        addSheet(wb, 'IN Detail', partInvoiceSheet(input, summary.totals), [16, 20, 22, 16, 22, 28, 14]);
        addSheet(wb, 'Check List', checkListSheet(input, summary.totals), [6, 40, 14, 14, 14, 14]);
    }
    return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}
