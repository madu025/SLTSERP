const XLSX = require('xlsx');
const path = require('path');

const excelPath = path.join(__dirname, '../NEW FTTH SOFT FORMAT JUNE -2026.xlsm');

try {
    const workbook = XLSX.readFile(excelPath);
    console.log(`Total sheets: ${workbook.SheetNames.length}`);
    console.log('First 20 sheets:', workbook.SheetNames.slice(0, 20));

    // Let's find any sheet that seems to contain "SOFT" data or actual completed orders list.
    // Let's search for sheet names containing "soft" or "main" or "data" or "summary" or the very first sheet.
    const softSheets = workbook.SheetNames.filter(s => s.toLowerCase().includes('soft') || s.toLowerCase().includes('data') || s.toLowerCase().includes('main'));
    console.log('Sheets matching "soft"/"data"/"main":', softSheets);

    // Let's print data from the very first sheet
    const firstSheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[firstSheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    console.log(`\n--- First Sheet: "${firstSheetName}" ---`);
    console.log(`Total rows: ${rows.length}`);
    console.log('First 10 rows:');
    rows.slice(0, 10).forEach((r, i) => {
        console.log(`Row ${i + 1}:`, r.slice(0, 15));
    });

} catch (err) {
    console.error('Error reading excel file:', err);
}
