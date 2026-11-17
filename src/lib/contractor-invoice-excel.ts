import path from 'node:path';
import ExcelJS from 'exceljs';

/**
 * Contractor (SOD) invoice workbook, built from the SLTS template in public/templates.
 * The template's INVOICE sheet is formula driven (Invoice A = 90 %, Invoice B = 10 %); here every cell the
 * formulas would produce is written as a value taken from the system, so the result does not depend on the
 * template's hidden rate table or on the viewer's Excel version. Layout, merges and print setup come from the template.
 */
export type InvoicePart = 'A' | 'B';
export const PART_PERCENT: Record<InvoicePart, number> = { A: 0.9, B: 0.1 };
export const MAX_INVOICE_LINES = 19; // rows 12..30 of the template

export interface ExportLine { description: string; rtom: string; qty: number; rate: number }
export interface ExportSod {
    soNum: string; tpNumber: string | null; completedDate: Date | null; rtom: string; configs: string | null;
    sheet: 'FTTH' | 'PSTN' | 'PEO'; materials: Record<string, number>; remarks: string;
}
export interface InvoiceExportData {
    invoiceNumber: string; invoiceDate: Date; periodYear: number | null; periodMonth: number | null;
    contractor: { name: string; address: string | null; contactNumber: string | null; registrationNumber: string | null; bankName: string | null; bankBranch: string | null; bankAccountNumber: string | null };
    lines: ExportLine[];
    /** Amount of this part as the system holds it (after penalties); falls back to total x percent. */
    partAmount?: number | null;
}

export const TEMPLATE_PATH = path.join(process.cwd(), 'public', 'templates', 'contractor-invoice-template.xlsx');
const r2 = (n: number) => Math.round(n * 100) / 100;
/** Give the cell its own style copy: template cells share style objects, so setting numFmt in place would change their neighbours too. */
const setFmt = (cell: ExcelJS.Cell, fmt: string) => { cell.style = { ...cell.style, numFmt: fmt }; };
const norm = (s: string) => s.replace(/\s+/g, '').toUpperCase();

/** Fit the invoice lines into the template's rows: same description at different RTOMs are merged when there are too many. */
export function fitLines(lines: ExportLine[]): ExportLine[] {
    if (lines.length <= MAX_INVOICE_LINES) return lines;
    const merged = new Map<string, ExportLine & { rtoms: Set<string> }>();
    for (const l of lines) {
        const k = `${l.description}|${l.rate}`;
        const m = merged.get(k);
        if (m) { m.qty += l.qty; m.rtoms.add(l.rtom); } else merged.set(k, { ...l, rtoms: new Set([l.rtom]) });
    }
    const out = [...merged.values()].map(({ rtoms, ...l }) => ({ ...l, rtom: [...rtoms].join(',') }));
    if (out.length > MAX_INVOICE_LINES) throw new Error(`The invoice has ${out.length} different work lines; the template has room for ${MAX_INVOICE_LINES}`);
    return out;
}

export function invoiceTotals(lines: ExportLine[], part: InvoicePart, partAmount?: number | null) {
    const total = r2(lines.reduce((a, l) => a + l.qty * l.rate, 0));
    const percent = PART_PERCENT[part];
    const computed = r2(total * percent);
    const amount = partAmount != null ? r2(partAmount) : computed;
    return { total, percent, amount, computed, deductions: r2(computed - amount) };
}

const SHEET_SPEC = {
    FTTH: { first: 5, dateCol: 2, tpCol: 3, configCol: 4, rtomCol: 5, matFrom: 6, matTo: 17, remarksCol: 18, headerRow: 4, invoiceNoCell: 'P1', contractorCell: 'C1', lastCol: 'R' },
    PSTN: { first: 5, dateCol: 5, tpCol: 3, configCol: 0, rtomCol: 4, matFrom: 6, matTo: 16, remarksCol: 17, headerRow: 4, invoiceNoCell: 'Q1', contractorCell: 'D1', lastCol: 'Q' },
    PEO: { first: 5, dateCol: 5, tpCol: 3, configCol: 0, rtomCol: 4, matFrom: 6, matTo: 11, remarksCol: 12, headerRow: 4, invoiceNoCell: 'L1', contractorCell: 'D1', lastCol: 'L' },
} as const;

export async function buildContractorInvoiceWorkbook(data: InvoiceExportData, part: InvoicePart, sods: ExportSod[]): Promise<{ buffer: Buffer; warnings: string[] }> {
    const warnings: string[] = [];
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(TEMPLATE_PATH);
    // exceljs keeps the template's conditional formats as empty elements and rewrites the header-less
    // table on the rate sheet; Excel then refuses the file. Neither is needed for the invoice.
    wb.eachSheet((sheet) => {
        (sheet as unknown as { conditionalFormattings: unknown[] }).conditionalFormattings = [];
        const tables = (sheet as unknown as { tables?: Record<string, unknown> }).tables;
        if (tables) for (const name of Object.keys(tables)) sheet.removeTable(name);
    });
    const lines = fitLines(data.lines);
    const t = invoiceTotals(data.lines, part, data.partAmount);
    if (t.deductions !== 0) warnings.push(`This part includes deductions of ${t.deductions.toFixed(2)} (penalties) against ${(t.percent * 100).toFixed(0)}% of the total`);

    // ---- INVOICE sheet
    const ws = wb.getWorksheet('INVOICE')!;
    const c = data.contractor;
    ws.getCell('B1').value = c.name;
    ws.getCell('B2').value = c.address || '';
    ws.getCell('B3').value = `Contact Numbers:- ${c.contactNumber || ''}`;
    ws.getCell('H5').value = `${data.invoiceNumber}-${part}`;
    ws.getCell('H6').value = c.registrationNumber || '';
    ws.getCell('H7').value = data.invoiceDate;
    ws.getCell('H8').value = data.periodYear && data.periodMonth ? new Date(Date.UTC(data.periodYear, data.periodMonth - 1, 1)) : null;
    ws.getCell('H9').value = part;
    for (let i = 0; i < MAX_INVOICE_LINES; i++) {
        const row = 12 + i;
        const l = lines[i];
        ws.getCell(`B${row}`).value = l ? i + 1 : null;
        ws.getCell(`C${row}`).value = l ? l.description : null;
        ws.getCell(`D${row}`).value = l ? l.rtom : null;
        ws.getCell(`E${row}`).value = l ? l.qty : null;
        ws.getCell(`F${row}`).value = l ? l.rate : null;
        ws.getCell(`H${row}`).value = l ? r2(l.qty * l.rate) : null;
    }
    ws.getCell('H31').value = t.total;
    ws.getCell('F32').value = t.percent;
    ws.getCell('H32').value = t.amount;
    ws.getCell('C40').value = c.name;
    ws.getCell('B42').value = `Cheque should be drawn in favour of "${c.name}"`;
    ws.getCell('C43').value = c.bankAccountNumber || '';
    ws.getCell('C44').value = c.bankName || '';
    ws.getCell('C45').value = c.bankBranch || '';

    // ---- SOD sheets (FTTH / PSTN / PEO): one row per service order
    const invoiceNoText = `${data.invoiceNumber}-${part}`;
    for (const name of ['FTTH', 'PSTN', 'PEO'] as const) {
        const sheet = wb.getWorksheet(name)!;
        const spec = SHEET_SPEC[name];
        const rows = sods.filter((s) => s.sheet === name);
        sheet.getCell(spec.contractorCell).value = c.name;
        const label = sheet.getCell('A1'); // PEO's "Contractor Name:" label is centred in a narrow cell and loses its first letters
        if (label.value) label.style = { ...label.style, alignment: { ...label.alignment, horizontal: 'left' } };
        const cn = sheet.getCell(spec.contractorCell);
        cn.style = { ...cn.style, alignment: { ...cn.alignment, shrinkToFit: true } }; // long contractor names are clipped by the neighbouring cell otherwise
        sheet.getCell(spec.invoiceNoCell).value = invoiceNoText;
        // the FTTH template's date and TP columns are too narrow for the text and show ####### / wrapped digits
        for (const [col, min] of [[spec.dateCol, 11], [spec.tpCol, 13], [spec.remarksCol, 24]] as const) {
            const column = sheet.getColumn(col);
            if ((column.width ?? 0) < min) column.width = min;
        }
        const cap = spec.matTo - spec.matFrom + 1;
        const usage = new Map<string, number>();
        for (const s of rows) for (const [k, q] of Object.entries(s.materials)) usage.set(k, (usage.get(k) ?? 0) + q);
        const cols = [...usage.entries()].sort((a, b) => b[1] - a[1]).slice(0, cap).map(([k]) => k).sort();
        for (let i = 0; i < cap; i++) sheet.getRow(spec.headerRow).getCell(spec.matFrom + i).value = cols[i] ?? null;
        const clearTo = Math.max(sheet.rowCount, spec.first + rows.length);
        for (let r = spec.first; r <= clearTo; r++) {
            const row = sheet.getRow(r);
            const s = rows[r - spec.first];
            row.getCell(1).value = name === 'FTTH' ? (s ? r - spec.first + 1 : null) : row.getCell(1).value;
            if (name !== 'FTTH') row.getCell(2).value = s ? r - spec.first + 1 : null;
            const dc = row.getCell(spec.dateCol);
            dc.value = s?.completedDate ?? null;
            if (s?.completedDate) setFmt(dc, 'dd-mmm-yy');
            row.getCell(spec.tpCol).value = s ? (s.tpNumber || s.soNum) : null;
            if (spec.configCol) row.getCell(spec.configCol).value = s?.configs ?? null;
            row.getCell(spec.rtomCol).value = s?.rtom ?? null;
            const extras: string[] = [];
            for (let i = 0; i < cap; i++) {
                const mc = row.getCell(spec.matFrom + i);
                mc.value = s && cols[i] ? (s.materials[cols[i]] ?? null) : null;
                // some template cells carry a date format; a quantity must not show as a date, and '#,##0.##' would print "2."
                if (mc.value !== null) setFmt(mc, Number.isInteger(Number(mc.value)) ? '#,##0' : '#,##0.00');
            }
            if (s) for (const [k, q] of Object.entries(s.materials)) if (!cols.includes(k)) extras.push(`${k}: ${q}`);
            row.getCell(spec.remarksCol).value = s ? [s.remarks, extras.join(', ')].filter(Boolean).join(' | ') || null : null;
            if (s) {
                // the template's first rows carry rotated text and tall heights, later rows do not: make every service order row read the same
                for (let col = 1; col <= spec.remarksCol; col++) {
                    const cell = row.getCell(col);
                    cell.style = { ...cell.style, font: { ...cell.font, bold: false }, alignment: { horizontal: 'center', vertical: 'middle', textRotation: 0, wrapText: col === spec.remarksCol } };
                }
                const remarkLen = String(row.getCell(spec.remarksCol).value ?? '').length;
                row.height = remarkLen > 22 ? 15 * Math.ceil(remarkLen / 22) : 20;
            }
        }
        const lastRow = Math.max(spec.first + rows.length - 1, spec.first);
        sheet.pageSetup.printArea = `A1:${spec.lastCol}${lastRow}`;
        sheet.pageSetup.paperSize = 9;
        sheet.pageSetup.orientation = 'landscape';
        sheet.pageSetup.fitToPage = true;
        sheet.pageSetup.fitToWidth = 1;
        sheet.pageSetup.fitToHeight = 0;
        sheet.pageSetup.margins = { left: 0.3, right: 0.3, top: 0.4, bottom: 0.4, header: 0.2, footer: 0.2 };
        sheet.views = [{ state: 'frozen', ySplit: spec.headerRow }];
        sheet.pageSetup.printTitlesRow = `1:${spec.headerRow}`;
    }

    // ---- material balance / usage sheets: usage by item name
    const total = new Map<string, number>();
    for (const s of sods) for (const [k, q] of Object.entries(s.materials)) total.set(norm(k), (total.get(norm(k)) ?? 0) + q);
    const mb = wb.getWorksheet('MATERIAL BALANCE SHEET')!;
    mb.getCell('C2').value = c.name;
    mb.getCell('C3').value = invoiceNoText;
    mb.getCell('C4').value = data.periodYear && data.periodMonth ? new Date(Date.UTC(data.periodYear, data.periodMonth - 1, 1)) : null;
    const matched = new Set<string>();
    for (let r = 6; r <= 31; r++) {
        const label = mb.getCell(`B${r}`).value;
        if (typeof label !== 'string') continue;
        const q = total.get(norm(label));
        mb.getCell(`E${r}`).value = q ?? null;
        if (q !== undefined) matched.add(norm(label));
    }
    const us = wb.getWorksheet('INVOICE USAGE')!;
    for (let r = 2; r <= 31; r++) {
        const label = us.getCell(`B${r}`).value;
        if (typeof label === 'string') us.getCell(`C${r}`).value = total.get(norm(label)) ?? null;
    }
    const unmatched = [...total.keys()].filter((k) => !matched.has(k));
    if (unmatched.length) warnings.push(`${unmatched.length} material item(s) are not in the template's material list: ${unmatched.slice(0, 5).join(', ')}`);

    // ---- A4, one page, and recalculate anything left over on open
    ws.pageSetup.paperSize = 9;
    ws.pageSetup.orientation = 'portrait';
    ws.pageSetup.fitToPage = true;
    ws.pageSetup.fitToWidth = 1;
    ws.pageSetup.fitToHeight = 1;
    ws.pageSetup.printArea = 'B1:H54';
    // sheets that carry nothing for this invoice: the hidden rate sheet (rates come from the system) and service order sheets with no rows
    const drop = ['Calculus', ...(['FTTH', 'PSTN', 'PEO'] as const).filter((n) => !sods.some((s) => s.sheet === n))];
    for (const name of drop) { const sheet = wb.getWorksheet(name); if (sheet) wb.removeWorksheet(sheet.id); }
    wb.calcProperties.fullCalcOnLoad = true;
    wb.views = [{ x: 0, y: 0, width: 20000, height: 12000, firstSheet: 0, activeTab: 0, visibility: 'visible' }];
    return { buffer: Buffer.from(await wb.xlsx.writeBuffer()), warnings };
}

/** Cells of the INVOICE sheet the export writes text into, for the fit check. */
export const INVOICE_TEXT_CELLS = [
    'B1', 'B2', 'B3', 'H5', 'H6', 'C40', 'B42', 'C43', 'C44', 'C45',
    ...Array.from({ length: MAX_INVOICE_LINES }, (_, i) => `C${12 + i}`),
    ...Array.from({ length: MAX_INVOICE_LINES }, (_, i) => `D${12 + i}`),
];

/** Rough text-fit check: each written cell's text against its column, merged range, or the free cells to its right. */
export function overflowReport(ws: ExcelJS.Worksheet, addresses: string[] = INVOICE_TEXT_CELLS): string[] {
    const out: string[] = [];
    const width = (col: number) => ws.getColumn(col).width ?? 8.43;
    const merges: string[] = (ws.model.merges as string[] | undefined) ?? [];
    for (const addr of addresses) {
        const cell = ws.getCell(addr);
        const v = cell.value;
        if (typeof v !== 'string' || v.length === 0) continue;
        const range = merges.find((m) => m.split(':')[0] === addr);
        const startCol = Number(cell.col);
        let avail = width(startCol);
        if (range) {
            const endCol = Number(ws.getCell(range.split(':')[1]).col);
            avail = 0;
            for (let k = startCol; k <= endCol; k++) avail += width(k);
        } else if (!cell.alignment?.wrapText) {
            for (let k = startCol + 1; k <= 8; k++) { if (ws.getCell(Number(cell.row), k).value) break; avail += width(k); }
        }
        if (v.length > avail * 1.1) out.push(`${addr}: ${v.length} chars do not fit in ${Math.round(avail)}`);
    }
    return out;
}
