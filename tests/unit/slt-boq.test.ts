import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { parseBoqWorkbook } from '../../src/lib/slt-boq/excel-import';
import {
  STANDARD_INCREMENT, NO_INCREMENT, invoiceTierTotals, invoiceUnitRate, summarizePart, summarizeStandardBoq, taxBreakdown, round2,
} from '../../src/lib/slt-boq/pricing';

// The sample workbooks are real SLT documents (contract and customer data), so they are NOT copied into the repo.
// Set SLT_SAMPLE_DIR to the folder that holds them; the reconciliation tests are skipped when it is missing.
const SAMPLE_DIR = process.env.SLT_SAMPLE_DIR
  || [path.resolve(__dirname, '../../../../../PROJECT'), 'D:/MyProject/SLTSERP/PROJECT'].find((d) => fs.existsSync(d));
const sample = (...p: string[]) => (SAMPLE_DIR ? path.join(SAMPLE_DIR, ...p) : '');
const CR = sample('CR - Customer request', 'CR2304-BOQ.xlsx');
const CLUSTER = sample('Cluster & Apartment', 'BOQ-CEN-AMR-0517.xlsx');
const MKT = sample('Marketing', 'CAPITAL TRUST MKT-928.xlsx');
const have = (f: string) => Boolean(f) && fs.existsSync(f);
const near = (a: number, b: number, eps = 0.01) => assert.ok(Math.abs(a - b) <= eps, `${a} != ${b}`);

test('CR BOQ: lines, tiers and totals match the SLT workbook (gross 44,634.91, net 54,017.53)', { skip: !have(CR) }, async () => {
  const p = parseBoqWorkbook(fs.readFileSync(CR));
  assert.equal(p.format, 'STANDARD');
  assert.equal(p.lines.length, 4);
  assert.deepEqual(p.lines.map((l) => l.unitDesignator), ['UC-50V-T', 'UC-RP-50V', 'PL-XR-6.7', 'DP-P-XR-UG']);
  assert.deepEqual(p.lines.map((l) => l.supplyTier), ['P0', 'P0', 'P2', 'P2']);
  assert.equal(p.meta.workOrderNo, '2026/MD/MD/CR/2304/SLTS');
  const s = summarizeStandardBoq(p.lines, STANDARD_INCREMENT);
  near(s.components.material, 10840.7);
  near(s.withIncrement.material, 12249.991);
  near(s.withIncrement.services, 29604.344);
  near(s.gross, 44634.9147);
  near(s.tax.sscl, 1142.6538);
  near(s.tax.net, 54017.5308);
});

test('CR invoice rates carry the increment: 3,267.18 / 1,517.18 / 994.84 for UC-50V-T', { skip: !have(CR) }, async () => {
  const lines = parseBoqWorkbook(fs.readFileSync(CR)).lines;
  const l = lines[0];
  near(invoiceUnitRate(l, STANDARD_INCREMENT), 3267.18, 0.1);
  near(invoiceUnitRate({ ...l, supplyTier: 'P1' }, STANDARD_INCREMENT), 1517.18, 0.1);
  near(invoiceUnitRate({ ...l, supplyTier: 'P2' }, STANDARD_INCREMENT), 994.84, 0.1);
  const t = invoiceTierTotals(lines, STANDARD_INCREMENT);
  near(t.P0, 18961.05, 0.1);
  near(t.P2, 25673.87, 0.1);
});

test('Cluster BOQ: BOQ-1 / BOQ-2 tiers and contingency match the workbook', { skip: !have(CLUSTER) }, async () => {
  const p = parseBoqWorkbook(fs.readFileSync(CLUSTER));
  assert.equal(p.format, 'CLUSTER');
  assert.deepEqual(p.meta.contingencyByPart, { 'BOQ-1': 15, 'BOQ-2': 5 });
  const part1 = summarizePart('BOQ-1', p.lines.filter((l) => l.boqPart === 'BOQ-1'), 15);
  near(part1.total, 414862.9945);
  near(part1.withSscl, 425483.4872);
  near(part1.withVat, 502070.5148);
  const part2 = summarizePart('BOQ-2', p.lines.filter((l) => l.boqPart === 'BOQ-2'), 5);
  near(part2.total, 437728.662);
  near(part2.withVat, 529742.7286);
  const oc12 = p.lines.find((l) => l.unitDesignator === 'OC-12');
  assert.equal(oc12?.supplyTier, 'P1');
  assert.equal(oc12?.quantity, 2);
});

test('Marketing invoice summary: tier follows the filled quantity columns, totals match (131,178.45)', { skip: !have(MKT) }, async () => {
  const p = parseBoqWorkbook(fs.readFileSync(MKT));
  assert.equal(p.format, 'INVOICE_SUMMARY');
  assert.equal(p.meta.invoiceNo?.startsWith('SLTS/HK/MKT/'), true);
  const t = invoiceTierTotals(p.lines, NO_INCREMENT);
  near(t.P0, 42113.29);
  near(t.P1, 89065.16);
  near(t.P0 + t.P1 + t.P2, 131178.45);
  const tax = taxBreakdown(t.P0 + t.P1 + t.P2);
  near(tax.sscl, 3358.17);
  near(tax.net, 158753.21, 0.1);
});

test('tax order is SSCL on gross, then VAT on gross + SSCL', () => {
  const t = taxBreakdown(1000);
  assert.equal(round2(t.sscl), 25.6);
  assert.equal(round2(t.vat), 184.61);
  assert.equal(round2(t.net), 1210.21);
});

import * as XLSX from 'xlsx';
import { buildDocumentPack, resolveDocumentProfile } from '../../src/lib/slt-boq/document-pack';

const packOf = async (file: string, profile: string) => {
  const parsed = parseBoqWorkbook(fs.readFileSync(file));
  const buf = await buildDocumentPack({
    profile: resolveDocumentProfile(profile),
    project: { name: 'Sample', code: 'P-1', rtom: 'MD', poNumber: '1', contractRef: 'L/0585/2023', sltRef: 'REF' },
    lines: parsed.lines, invoiceNumber: 'SLTS/MD/CR/2026/28', invoiceDate: new Date('2026-10-26'), invoiceKind: 'FINAL',
    materialBalance: [{ description: 'Cable', received: 100, invoiced: 90, wasted: 5 }],
  });
  return XLSX.read(buf, { type: 'buffer' });
};
const cell = (wb: XLSX.WorkBook, sheet: string, label: string): unknown[] | undefined =>
  XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[sheet], { header: 1, defval: '' }).find((r) => String(r[0]).startsWith(label));

test('STANDARD pack (CR): invoice sheets exist and the tax invoice nets 54,017.53', { skip: !have(CR) }, async () => {
  const wb = await packOf(CR, 'STANDARD');
  assert.deepEqual(wb.SheetNames, ['BOQ', 'MS -1', 'WPS- 1', 'In Sum-03', 'In-02', 'Tax Inv-01', 'IN Detail', 'Check List']);
  near(Number(cell(wb, 'Tax Inv-01', 'Net Total Payable')?.[5]), 54017.53, 0.05);
  near(Number(cell(wb, 'Tax Inv-01', 'Gross Invoice Value')?.[5]), 44634.92, 0.05);
});

test('MARKETING pack: material balance sheet included, nets 158,753.21', { skip: !have(MKT) }, async () => {
  const wb = await packOf(MKT, 'MARKETING');
  assert.ok(wb.SheetNames.includes('MBS'));
  near(Number(cell(wb, 'Tax Inv-01', 'Net Total Payable')?.[5]), 158753.21, 0.05);
  const mbs = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets['MBS'], { header: 1, defval: '' }).find((r) => r[4] === 'Cable');
  assert.equal(mbs?.[9], 5); // 100 received - (90 invoiced + 5 wasted)
});

test('CLUSTER pack: BOQ-0/1/2, executive summary and front sheet; BOQ-1 total 414,862.99', { skip: !have(CLUSTER) }, async () => {
  const wb = await packOf(CLUSTER, 'CLUSTER');
  assert.deepEqual(wb.SheetNames, ['BOQ-0', 'BOQ-1', 'BOQ-2', 'EX Summery', 'Front Sheet']);
  const total = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets['BOQ-1'], { header: 1, defval: '' }).find((r) => String(r[3]).startsWith('Total Price (Rs.)'));
  near(Number(total?.[12]), 414862.99, 0.05);
});

test('a project type without a profile uses the STANDARD layout', () => {
  assert.equal(resolveDocumentProfile(null).code, 'STANDARD');
  assert.equal(resolveDocumentProfile('cluster').code, 'CLUSTER');
});

// ---- print layout and tax footing (synthetic data: runs without the SLT sample files)
import ExcelJS from 'exceljs';
import { invoiceTax } from '../../src/lib/slt-boq/pricing';

const synthLines = Array.from({ length: 70 }, (_, i) => ({
  udNo: i + 1, unitDesignator: `UD${i}`, description: `Long description of an assembly unit number ${i} `.repeat(4), unit: 'Nos',
  quantity: 3 + i, supplyTier: 'P0' as const, rateP0: 3000 + i, rateP1: 1500, rateP2: 900, boqPart: 'BOQ-1',
}));
const synthPack = (profile: string) => buildDocumentPack({
  profile: resolveDocumentProfile(profile),
  project: { name: 'A very long project name '.repeat(5), code: 'P-1', rtom: 'MD', poNumber: '77', poDate: new Date('2026-01-02'), contractRef: 'C/1', sltRef: 'R' },
  lines: synthLines, invoiceNumber: 'SLTS/MD/CR/2026/01', invoiceDate: new Date('2026-10-26'), invoiceKind: 'FINAL',
  materialBalance: [{ description: 'Cable', received: 100, invoiced: 90, wasted: 5 }],
});

test('every sheet of every profile is set up for A4 printing', async () => {
  for (const profile of ['STANDARD', 'MARKETING', 'CLUSTER']) {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load((await synthPack(profile)) as unknown as ArrayBuffer);
    assert.ok(wb.worksheets.length >= 4);
    for (const ws of wb.worksheets) {
      assert.equal(ws.pageSetup.paperSize, 9, `${profile}/${ws.name} paper`);
      assert.equal(ws.pageSetup.fitToPage, true, `${profile}/${ws.name} fit`);
      assert.equal(ws.pageSetup.fitToWidth, 1, `${profile}/${ws.name} width`);
      assert.ok(ws.pageSetup.printArea, `${profile}/${ws.name} print area`);
      assert.ok(ws.headerFooter.oddFooter?.includes('&P'), `${profile}/${ws.name} page numbers`);
    }
  }
});

test('long tables repeat their headings on every printed page and money has thousands separators', async () => {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load((await synthPack('STANDARD')) as unknown as ArrayBuffer);
  const boq = wb.getWorksheet('BOQ')!;
  assert.equal(boq.pageSetup.orientation, 'landscape');
  assert.equal(boq.pageSetup.printTitlesRow, '5:5');
  assert.equal(boq.getRow(6).getCell(9).numFmt, '#,##0.00');
});

test('invoice tax is rounded step by step so gross + SSCL + VAT always equals the net total', () => {
  for (let g = 100; g < 100000; g += 37.77) {
    const t = invoiceTax(g);
    assert.equal(round2(t.gross + t.sscl + t.vat), t.net, `gross ${g}`);
  }
  const cr = invoiceTax(44634.92);
  assert.equal(cr.net, 54017.53);
});
