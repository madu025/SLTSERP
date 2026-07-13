const XLSX = require('xlsx');
const path = require('path');

const excelPath = path.join(__dirname, '../NEW FTTH SOFT FORMAT JUNE -2026.xlsm');

try {
    const workbook = XLSX.readFile(excelPath);
    const sheetName = 'SOFT';
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });

    if (rows.length < 2) {
        console.error('Not enough rows in SOFT sheet!');
        return;
    }

    const headers = rows[1]; // Row 2 has headers
    console.log(`Total columns: ${headers.length}`);
    console.log('Headers:');
    headers.forEach((h, i) => {
        console.log(`Column ${i}: ${h}`);
    });

} catch (err) {
    console.error('Error:', err);
}
