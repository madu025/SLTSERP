import * as XLSX from 'xlsx';

async function inspectSamaranayakeRow() {
    const filePath = 'd:\\MyProject\\SLTSERP\\FNC CONTRACTOR INFO 2025.xlsx';
    const workbook = XLSX.readFile(filePath);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const json: any[] = XLSX.utils.sheet_to_json(sheet, { header: 1 });

    json.forEach((row, idx) => {
        const rowStr = JSON.stringify(row);
        if (rowStr.toLowerCase().includes('samaranayake') || rowStr.includes('033')) {
            console.log(`Row Index ${idx}:`, row);
        }
    });
}

inspectSamaranayakeRow().catch(console.error);
