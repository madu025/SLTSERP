import { test } from 'node:test';
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import { buildContractorInvoiceWorkbook, fitLines, invoiceTotals, overflowReport, MAX_INVOICE_LINES, type ExportLine, type ExportSod } from '../../src/lib/contractor-invoice-excel';

const lines: ExportLine[] = [
  { description: 'FTTH - DW length- (0-100) ', rtom: 'MD', qty: 12, rate: 6750 },
  { description: 'FTTH - DW length- (500 ++) ', rtom: 'HK', qty: 3, rate: 6750 },
  { description: '8.0m Poles Installation (External Boom)', rtom: 'MD', qty: 2, rate: 3200 },
];
const data = {
  invoiceNumber: 'INV/TEST/METRO/26/06-001', invoiceDate: new Date(Date.UTC(2026, 6, 4)), periodYear: 2026, periodMonth: 6,
  contractor: { name: 'Test Contractor (Pvt) Ltd', address: '1 Main Street', contactNumber: '0771234567', registrationNumber: 'SLTS/OSP/1', bankName: 'BOC', bankBranch: 'Colombo', bankAccountNumber: '123' },
  lines,
};
const sods: ExportSod[] = Array.from({ length: 4 }, (_, i) => ({ soNum: `SO${i}`, tpNumber: `07100000${i}`, completedDate: new Date(Date.UTC(2026, 5, 1 + i)), rtom: 'MD', configs: 'NEW', sheet: 'FTTH', materials: { 'DROP WIRE ( M)': 40, 'C-HOOK (NOS)': 2 }, remarks: '' }));

test('Invoice A is 90 percent and Invoice B 10 percent of the same total', () => {
  const a = invoiceTotals(lines, 'A');
  const b = invoiceTotals(lines, 'B');
  assert.equal(a.total, 6750 * 15 + 6400);
  assert.equal(a.amount, Math.round(a.total * 0.9 * 100) / 100);
  assert.equal(b.amount, Math.round(a.total * 0.1 * 100) / 100);
  assert.equal(invoiceTotals(lines, 'A', 100000).deductions, Math.round((a.computed - 100000) * 100) / 100);
});

test('too many lines are merged across RTOMs, and refused only when still too many', () => {
  assert.equal(fitLines(lines).length, 3);
  const many = Array.from({ length: 30 }, (_, i) => ({ description: `D${i % 10}`, rtom: `R${i}`, qty: 1, rate: 100 }));
  const merged = fitLines(many);
  assert.equal(merged.length, 10);
  assert.equal(merged[0].qty, 3);
  const tooMany = Array.from({ length: MAX_INVOICE_LINES + 1 }, (_, i) => ({ description: `D${i}`, rtom: 'MD', qty: 1, rate: 1 }));
  assert.throws(() => fitLines(tooMany));
});

test('the workbook keeps the template layout, fits A4 and carries the A/B part', async () => {
  for (const part of ['A', 'B'] as const) {
    const { buffer, warnings } = await buildContractorInvoiceWorkbook(data, part, sods);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer as never);
    const ws = wb.getWorksheet('INVOICE')!;
    assert.equal(ws.getCell('H9').value, part);
    assert.equal(ws.getCell('F32').value, part === 'A' ? 0.9 : 0.1);
    assert.equal(ws.getCell('H31').value, 107650);
    assert.equal(ws.getCell('H32').value, part === 'A' ? 96885 : 10765);
    assert.equal(ws.getCell('H5').value, `INV/TEST/METRO/26/06-001-${part}`);
    assert.equal(ws.getCell('C12').value, 'FTTH - DW length- (0-100) ');
    assert.equal(ws.getCell('C15').value, null);
    assert.equal(ws.pageSetup.paperSize, 9);
    assert.equal(ws.pageSetup.orientation, 'portrait');
    assert.equal(ws.pageSetup.fitToPage, true);
    assert.equal(ws.pageSetup.printArea, 'B1:H54');
    assert.deepEqual(overflowReport(ws), []);
    const ftth = wb.getWorksheet('FTTH')!;
    assert.equal(ftth.getCell('E5').value, 'MD');
    assert.equal(ftth.getCell('B5').numFmt, 'dd-mmm-yy');
    assert.equal(ftth.getCell('F5').numFmt, '#,##0.##'); // a quantity, never a date
    assert.equal(ftth.pageSetup.orientation, 'landscape');
    assert.equal(ftth.pageSetup.printArea, 'A1:R8');
    assert.equal(wb.getWorksheet('MATERIAL BALANCE SHEET')!.getCell('E11').value, 160);
    assert.deepEqual(warnings, []);
  }
});

test('the download route and buttons are wired', async () => {
  const fs = await import('node:fs');
  assert.match(fs.readFileSync('src/app/api/invoices/[id]/excel/route.ts', 'utf8'), /SOD_INVOICE/);
  assert.match(fs.readFileSync('src/services/invoice/invoice-excel.service.ts', 'utf8'), /resolveOpmcScope/);
  assert.match(fs.readFileSync('src/app/invoices/page.tsx', 'utf8'), /downloadContractorWorkbook\(inv\.id, 'B'\)/);
});
