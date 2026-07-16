import * as xlsx from 'xlsx';
import * as path from 'path';
import * as fs from 'fs';

async function main() {
  const filePath = 'D:\\MyProject\\SLTSERP\\LAPTOP DISTRIBUTION.xlsx';
  console.log(`[ANALYSIS] Loading Excel file from: ${filePath}`);

  if (!fs.existsSync(filePath)) {
    console.error(`[ANALYSIS] ERROR: File not found at ${filePath}`);
    return;
  }

  const workbook = xlsx.readFile(filePath);
  console.log('[ANALYSIS] Sheet Names in Workbook:', workbook.SheetNames);

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    // Read raw data and parse as json
    const rows: any[] = xlsx.utils.sheet_to_json(sheet, { defval: "" });
    console.log(`\n=========================================`);
    console.log(`Sheet: "${sheetName}" | Total Rows: ${rows.length}`);
    console.log(`=========================================`);
    
    if (rows.length > 0) {
      const columns = Object.keys(rows[0]);
      console.log('Columns:', columns);
      
      // Let's analyze exchanges / keywords
      console.log('\nSample Rows (First 15):');
      rows.slice(0, 15).forEach((row, i) => {
        console.log(`Row ${i + 1}:`, JSON.stringify(row));
      });

      // Let's filter any row containing exchange details
      console.log('\nScanning for exchanges/returns...');
      const exchangeRows = rows.filter(row => {
        const rowStr = JSON.stringify(row).toLowerCase();
        return rowStr.includes('exchange') || rowStr.includes('handover') || rowStr.includes('return') || rowStr.includes('old') || rowStr.includes('new');
      });
      console.log(`Found ${exchangeRows.length} rows mentioning exchange/transfer/return keywords.`);
      if (exchangeRows.length > 0) {
        console.log('Sample Exchange Rows (First 10):');
        exchangeRows.slice(0, 10).forEach((row, idx) => {
          console.log(`ExMatch ${idx + 1}:`, JSON.stringify(row));
        });
      }
    }
  }
}

main().catch(console.error);
