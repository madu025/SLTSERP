/* eslint-disable */
const XLSX = require('xlsx');
const path = require('path');

const excelPath = path.join(__dirname, '../NEW FTTH SOFT FORMAT JUNE -2026.xlsm');

try {
    const workbook = XLSX.readFile(excelPath);
    const sheetName = 'SOFT';
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });

    if (rows.length < 3) {
        console.error('Not enough rows in SOFT sheet!');
        return;
    }

    const headers = rows[1]; // Row 2 has headers
    const dataRows = rows.slice(2); // From Row 3 onwards is data

    console.log(`Loaded ${dataRows.length} data rows from SOFT sheet.`);

    // 1. Analyze Completed Date
    const completedDateColIdx = headers.indexOf('SOD COMPLETE DATE');
    const monthlyCounts = {};

    // Helper to convert Excel date serial to JS Date
    function parseExcelDate(serial) {
        if (!serial) return null;
        if (typeof serial === 'string') return serial;
        const utc_days  = Math.floor(serial - 25569);
        const utc_value = utc_days * 86400;
        const date_info = new Date(utc_value * 1000);
        return date_info;
    }

    dataRows.forEach(row => {
        if (!row || row.length === 0 || !row[0]) return; // Skip empty rows
        const rawDate = row[completedDateColIdx];
        if (rawDate) {
            const dateObj = parseExcelDate(rawDate);
            if (dateObj instanceof Date && !isNaN(dateObj.getTime())) {
                const monthStr = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}`;
                monthlyCounts[monthStr] = (monthlyCounts[monthStr] || 0) + 1;
            } else if (typeof rawDate === 'string') {
                monthlyCounts[rawDate] = (monthlyCounts[rawDate] || 0) + 1;
            }
        } else {
            monthlyCounts['Unknown/Blank'] = (monthlyCounts['Unknown/Blank'] || 0) + 1;
        }
    });

    console.log('\n--- Completed Count by Month ---');
    console.log(monthlyCounts);

    // 2. Analyze Material Usage Columns (Columns 24 to 50)
    console.log('\n--- Material Usage Summary (Total Quantities) ---');
    const materialSummary = {};
    for (let c = 24; c <= 50; c++) {
        const materialName = headers[c];
        let total = 0;
        let nonZeroRows = 0;

        dataRows.forEach(row => {
            if (!row || row.length === 0 || !row[0]) return; // Skip empty rows
            const val = parseFloat(row[c]);
            if (!isNaN(val) && val > 0) {
                total += val;
                nonZeroRows++;
            }
        });

        if (total > 0) {
            materialSummary[materialName] = {
                total: total.toFixed(2),
                rowsUsed: nonZeroRows
            };
        }
    }

    console.table(materialSummary);

} catch (err) {
    console.error('Error:', err);
}
