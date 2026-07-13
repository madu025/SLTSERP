const XLSX = require('xlsx');
const path = require('path');

const excelPath = path.join(__dirname, '../NEW FTTH SOFT FORMAT JUNE -2026.xlsm');

try {
    console.log(`Loading excel workbook from: ${excelPath}`);
    const workbook = XLSX.readFile(excelPath);
    
    console.log('\n--- Sheet Names ---');
    console.log(workbook.SheetNames);

    // Let's inspect each sheet, its dimensions, and headers
    workbook.SheetNames.forEach(sheetName => {
        const sheet = workbook.Sheets[sheetName];
        const range = sheet['!ref'];
        console.log(`\nSheet: "${sheetName}", Range: ${range}`);

        // Convert the first 5 rows to JSON to inspect columns and structure
        const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
        if (rows.length > 0) {
            console.log('Headers (Row 1):');
            console.log(rows[0].slice(0, 20)); // Print first 20 headers

            console.log('\nSample Row 2:');
            if (rows.length > 1) {
                console.log(rows[1].slice(0, 20));
            }
            console.log('\nSample Row 3:');
            if (rows.length > 2) {
                console.log(rows[2].slice(0, 20));
            }
        } else {
            console.log('Sheet is empty');
        }
    });

} catch (err) {
    console.error('Error reading excel file:', err);
}
