import * as XLSX from 'xlsx';
import * as path from 'path';

async function inspectFNCContractorExcel() {
    const filePath = 'd:\\MyProject\\SLTSERP\\FNC CONTRACTOR INFO 2025.xlsx';
    console.log(`🔍 Inspecting Excel File: ${filePath}\n`);

    const workbook = XLSX.readFile(filePath);
    console.log(`Sheet Names (${workbook.SheetNames.length}):`, workbook.SheetNames);

    for (const sheetName of workbook.SheetNames) {
        console.log(`\n=================== SHEET: ${sheetName} ===================`);
        const sheet = workbook.Sheets[sheetName];
        const json: any[] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
        
        console.log(`Total Rows: ${json.length}`);
        if (json.length > 0) {
            console.log('Header Row (Row 0):', json[0]);
            console.log('Sample Row 1:', json[1]);
            console.log('Sample Row 2:', json[2]);
            console.log('Sample Row 3:', json[3]);
        }
    }
}

inspectFNCContractorExcel().catch(console.error);
