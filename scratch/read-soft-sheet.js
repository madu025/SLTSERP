const XLSX = require('xlsx');
const path = require('path');

const excelPath = path.join(__dirname, '../NEW FTTH SOFT FORMAT JUNE -2026.xlsm');

try {
    const workbook = XLSX.readFile(excelPath);
    const sheetName = 'SOFT';
    const sheet = workbook.Sheets[sheetName];
    
    if (!sheet) {
        console.error('Sheet "SOFT" not found in workbook!');
        return;
    }

    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    console.log(`--- Sheet: "${sheetName}" ---`);
    console.log(`Total rows: ${rows.length}`);

    // Let's filter out completely empty rows and look at row counts
    const nonEmptyRows = rows.filter(r => r && r.length > 0);
    console.log(`Non-empty rows count: ${nonEmptyRows.length}`);

    console.log('\n--- Headers (Row 1-5 to see if there are merged headers) ---');
    for (let i = 0; i < Math.min(rows.length, 10); i++) {
        console.log(`Row ${i + 1}:`, rows[i].slice(0, 30));
    }

} catch (err) {
    console.error('Error reading excel file:', err);
}
