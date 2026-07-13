const XLSX = require('xlsx');
const path = require('path');

const excelPath = path.join(__dirname, '../NEW FTTH SOFT FORMAT JUNE -2026.xlsm');

try {
    const workbook = XLSX.readFile(excelPath);
    const sheetName = 'SOFT';
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });

    const headers = rows[1];
    console.log('Headers in range (Col 24 to Col 32):');
    for (let c = 24; c <= 32; c++) {
        console.log(`Col ${c}: ${headers[c]}`);
    }

    console.log('\nData sample:');
    rows.slice(2, 12).forEach((row, rIdx) => {
        if (!row || row.length === 0 || !row[0]) return;
        const rowData = {};
        for (let c = 24; c <= 32; c++) {
            rowData[headers[c] || `Col_${c}`] = row[c];
        }
        console.log(`Row ${rIdx + 3}:`, rowData);
    });

} catch (err) {
    console.error('Error:', err);
}
