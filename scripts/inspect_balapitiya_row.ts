import * as XLSX from 'xlsx';

async function findBalapitiyaRow() {
    const filePath = 'd:\\MyProject\\SLTSERP\\FNC CONTRACTOR INFO 2025.xlsx';
    const workbook = XLSX.readFile(filePath);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const json: any[] = XLSX.utils.sheet_to_json(sheet, { header: 1 });

    console.log('Searching for Balapitiya or 398 in Excel file...\n');
    json.forEach((row, idx) => {
        const rowStr = JSON.stringify(row);
        if (rowStr.toLowerCase().includes('balapitiya') || rowStr.includes('398') || rowStr.includes('781148142')) {
            console.log(`Row Index ${idx}:`, row);
        }
    });
}

findBalapitiyaRow().catch(console.error);
