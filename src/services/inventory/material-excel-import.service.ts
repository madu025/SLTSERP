import { prisma } from '@/lib/prisma';
import * as XLSX from 'xlsx';
import path from 'path';

// ─────────────────────────────────────────────────────────────────────────────
// Material Excel Import Service
// Parses D:\MyProject\SLTSERP\Material Report Summary -From  June.xlsx
// All Island Main Central Store Scope
// ─────────────────────────────────────────────────────────────────────────────

export interface ImportResult {
  success: boolean;
  totalRecordsProcessed: number;
  itemsMapped: number;
  monthsProcessed: number;
  opmcId: string | null;
  errors: string[];
}

const ITEM_ALIAS_MAP: Record<string, { code: string; name: string }> = {
  'FAC CONNECTORS': { code: 'FAC_CONN', name: 'FAC Connectors' },
  'FIBER ROSSETTE': { code: 'FIBER_ROSETTE', name: 'Fiber Rosette' },
  'HOOK C': { code: 'HOOK_C', name: 'Hook C' },
  'HOOK L': { code: 'HOOK_L', name: 'Hook L' },
  'BOLT & NUT': { code: 'BOLT_NUT', name: 'Bolt & Nut' },
  'DROP WIRE RETAINER': { code: 'DW_RETAINER', name: 'Drop Wire Retainer' },
  'CABLE CAT5E': { code: 'CAT5E', name: 'Cable CAT5E' },
  'CABLE TWIN WIRE': { code: 'TWIN_WIRE', name: 'Cable Twin Wire' },
  'FIBER DROP WIRE - F1+G1': { code: 'FIBER_DROP_F1G1', name: 'Fiber Drop Wire - F1+G1' },
  '5.6': { code: 'POLE_5.6M', name: 'Pole 5.6m' },
  '6.7': { code: 'POLE_6.7M', name: 'Pole 6.7m' },
  '8': { code: 'POLE_8M', name: 'Pole 8m' },
  'CAT BOX': { code: 'CAT_BOX', name: 'CAT Box' },
};

function normalizeMonthName(raw: string): string {
  const s = raw.trim().toUpperCase();
  if (s.includes('JULY') || s.includes('JUL')) return 'JULY';
  if (s.includes('AUG')) return 'AUG';
  if (s.includes('SEP')) return 'SEP';
  if (s.includes('OCT')) return 'OCT';
  if (s.includes('NOV')) return 'NOV';
  if (s.includes('DEC')) return 'DEC';
  if (s.includes('JAN')) return 'JAN';
  if (s.includes('FEB')) return 'FEB';
  if (s.includes('MAR')) return 'MARCH';
  if (s.includes('APR')) return 'APRIL';
  if (s.includes('MAY')) return 'MAY';
  if (s.includes('JUN')) return 'JUNE';
  return s;
}

export class MaterialExcelImportService {
  /**
   * Parse the Excel report and import/sync monthly records into PreErpMaterialBalance.
   */
  static async importMaterialReport(
    filePath: string,
    opmcId: string | null = null,
    createdById: string = 'system-import'
  ): Promise<ImportResult> {
    const errors: string[] = [];
    const absolutePath = path.isAbsolute(filePath)
      ? filePath
      : path.join(process.cwd(), filePath);

    let workbook: XLSX.WorkBook;
    try {
      workbook = XLSX.readFile(absolutePath);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown file error';
      throw new Error(`Failed to read Excel file at ${absolutePath}: ${msg}`);
    }

    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as (string | number | null)[][];

    if (data.length < 3) {
      throw new Error('Excel sheet has insufficient rows for parsing.');
    }

    // Row 1 (index 0) contains standard unit rates per item
    const rateRow = data[0] || [];
    // Row 2 (index 1) contains item header names
    const itemHeaderRow = data[1] || [];

    const columnsToProcess: { colIndex: number; itemCode: string; itemName: string; unitRate: number }[] = [];

    for (let c = 2; c < itemHeaderRow.length; c++) {
      const headerRaw = itemHeaderRow[c];
      if (headerRaw !== null && headerRaw !== undefined) {
        const headerStr = String(headerRaw).trim().toUpperCase();
        const matched = ITEM_ALIAS_MAP[headerStr];
        if (matched) {
          const rawRate = rateRow[c];
          const unitRate = typeof rawRate === 'number' ? rawRate : parseFloat(String(rawRate ?? 0)) || 0;
          columnsToProcess.push({
            colIndex: c,
            itemCode: matched.code,
            itemName: matched.name,
            unitRate,
          });
        }
      }
    }

    if (columnsToProcess.length === 0) {
      throw new Error('No matching material items identified in Excel header row.');
    }

    // Upsert InventoryItems
    const dbItems = new Map<string, string>(); // code -> id
    for (const col of columnsToProcess) {
      const item = await prisma.inventoryItem.upsert({
        where: { code: col.itemCode },
        update: { name: col.itemName, unitPrice: col.unitRate || undefined },
        create: {
          code: col.itemCode,
          name: col.itemName,
          unit: col.itemCode.includes('POLE') || col.itemCode.includes('CONN') || col.itemCode.includes('HOOK') || col.itemCode.includes('BOX') || col.itemCode.includes('ROSETTE') || col.itemCode.includes('RETAINER') ? 'NOS' : 'MTRS',
          category: 'OSP_FTTH',
          type: 'SLTS',
          source: 'SLT',
          isOspFtth: true,
          unitPrice: col.unitRate || 0,
        },
      });
      dbItems.set(col.itemCode, item.id);
    }

    // Group rows into Month Blocks
    let currentYear = 2024;
    let currentMonth = 'JULY';
    let totalRecordsProcessed = 0;

    interface MetricBlock {
      year: number;
      month: string;
      carryForward: Record<string, number>;
      received: Record<string, number>;
      totalInHand: Record<string, number>;
      usage: Record<string, number>;
      wastage: Record<string, number>;
      totalUsage: Record<string, number>;
      receivedRs: Record<string, number>;
      usageRs: Record<string, number>;
    }

    let activeBlock: MetricBlock | null = null;
    const blocksToUpsert: MetricBlock[] = [];

    const flushBlock = () => {
      if (activeBlock) {
        blocksToUpsert.push(activeBlock);
        activeBlock = null;
      }
    };

    data.forEach((row, idx) => {
      if (!row || row.length === 0) return;
      const col0 = row[0] ? String(row[0]).trim() : '';
      const col1 = row[1] ? String(row[1]).trim() : '';

      // Ignore bottom Grand Summary Totals rows (Row 198+)
      if (idx >= 196 || col0 === 'Total') return;

      if (col0 === '2024') currentYear = 2024;
      if (col0 === '2025') currentYear = 2025;
      if (col0 === '2026') currentYear = 2026;

      if (col0 && !['Month', 'Received Rs', 'Usage Rs', 'Total', '2024', '2025', '2026', '31 Inhand'].includes(col0)) {
        flushBlock();
        currentMonth = normalizeMonthName(col0);
        activeBlock = {
          year: currentYear,
          month: currentMonth,
          carryForward: {},
          received: {},
          totalInHand: {},
          usage: {},
          wastage: {},
          totalUsage: {},
          receivedRs: {},
          usageRs: {},
        };
      }

      if (!activeBlock && (col1 || col0 === 'Received Rs' || col0 === 'Usage Rs')) {
        activeBlock = {
          year: currentYear,
          month: currentMonth,
          carryForward: {},
          received: {},
          totalInHand: {},
          usage: {},
          wastage: {},
          totalUsage: {},
          receivedRs: {},
          usageRs: {},
        };
      }

      if (activeBlock) {
        columnsToProcess.forEach((col) => {
          const rawVal = row[col.colIndex];
          const numVal = typeof rawVal === 'number' ? rawVal : parseFloat(String(rawVal ?? 0)) || 0;

          if (col1 === 'Carry Forward Balance') activeBlock!.carryForward[col.itemCode] = numVal;
          else if (col1 === 'Received') activeBlock!.received[col.itemCode] = numVal;
          else if (col1 === 'Total Inhand') activeBlock!.totalInHand[col.itemCode] = numVal;
          else if (col1 === 'Usage') activeBlock!.usage[col.itemCode] = numVal;
          else if (col1 === 'Wastage') activeBlock!.wastage[col.itemCode] = numVal;
          else if (col1 === 'Total Usage' || col1 === 'Usage Total') activeBlock!.totalUsage[col.itemCode] = numVal;
          else if (col0 === 'Received Rs') activeBlock!.receivedRs[col.itemCode] = numVal;
          else if (col0 === 'Usage Rs') activeBlock!.usageRs[col.itemCode] = numVal;
        });
      }
    });

    flushBlock();

    // Upsert into PreErpMaterialBalance table
    for (const block of blocksToUpsert) {
      for (const col of columnsToProcess) {
        const itemId = dbItems.get(col.itemCode);
        if (!itemId) continue;

        const carryForward = block.carryForward[col.itemCode] ?? 0;
        const received = block.received[col.itemCode] ?? 0;
        const totalInHand = block.totalInHand[col.itemCode] ?? (carryForward + received);
        const usage = block.usage[col.itemCode] ?? 0;
        const wastage = block.wastage[col.itemCode] ?? 0;
        const totalUsage = block.totalUsage[col.itemCode] ?? (usage + wastage);
        const closingBalance = totalInHand - totalUsage;
        const receivedCost = block.receivedRs[col.itemCode] ?? (received * col.unitRate);
        const usageCost = block.usageRs[col.itemCode] ?? (totalUsage * col.unitRate);
        const unitCost = col.unitRate || (usage > 0 ? usageCost / usage : (received > 0 ? receivedCost / received : 0));

        await (prisma as unknown as Record<string, { upsert: (args: unknown) => Promise<unknown> }>).preErpMaterialBalance.upsert({
          where: {
            itemId_year_month: {
              itemId,
              year: block.year,
              month: block.month,
            },
          },
          update: {
            opmcId,
            carryForwardQuantity: carryForward,
            receivedQuantity: received,
            totalInHandQuantity: totalInHand,
            usageQuantity: usage,
            wastageQuantity: wastage,
            totalUsageQuantity: totalUsage,
            closingBalanceQuantity: closingBalance,
            receivedCostLkr: receivedCost,
            usageCostLkr: usageCost,
            unitCostLkr: unitCost,
          },
          create: {
            opmcId,
            itemId,
            itemCode: col.itemCode,
            itemName: col.itemName,
            year: block.year,
            month: block.month,
            carryForwardQuantity: carryForward,
            receivedQuantity: received,
            totalInHandQuantity: totalInHand,
            usageQuantity: usage,
            wastageQuantity: wastage,
            totalUsageQuantity: totalUsage,
            closingBalanceQuantity: closingBalance,
            receivedCostLkr: receivedCost,
            usageCostLkr: usageCost,
            unitCostLkr: unitCost,
            createdById,
          },
        });

        totalRecordsProcessed++;
      }
    }

    return {
      success: true,
      totalRecordsProcessed,
      itemsMapped: columnsToProcess.length,
      monthsProcessed: blocksToUpsert.length,
      opmcId,
      errors,
    };
  }
}
