import * as xlsx from 'xlsx';
import * as path from 'path';
import * as fs from 'fs';

async function main() {
  const filePath = 'D:\\MyProject\\SLTSERP\\LAPTOP DISTRIBUTION.xlsx';
  if (!fs.existsSync(filePath)) {
    console.error(`File not found at ${filePath}`);
    return;
  }

  const workbook = xlsx.readFile(filePath);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows: any[] = xlsx.utils.sheet_to_json(sheet, { defval: "" });

  const distributions: any[] = [];
  const returns: any[] = [];
  const redistributions: any[] = [];
  const headOfficeReturns: any[] = [];
  const unrepairable: any[] = [];

  // Skip the header instruction row (Row 0 is the headers we parsed)
  const dataRows = rows.slice(1);

  for (const row of dataRows) {
    const rowNum = row['__EMPTY'];
    if (!rowNum || isNaN(Number(rowNum))) continue;

    const date = row['__EMPTY_1']?.toString().trim();
    const srm = row['45 NOS NOTE BOOK Distribution PLAN ']?.toString().trim();
    const rtom = row['__EMPTY_2']?.toString().trim();
    const empNo = row['__EMPTY_3']?.toString().trim();
    const name = row['__EMPTY_4']?.toString().trim();
    const newSerial = row['__EMPTY_5']?.toString().trim();
    const agreementStatus = row['__EMPTY_6']?.toString().trim();
    const agreementUpdate = row['__EMPTY_7']?.toString().trim();
    const assetNumber = row['__EMPTY_8']?.toString().trim();

    const returnedOld = row['RETURN OLD NOTE BOOK']?.toString().trim();
    const oldSerial = row['__EMPTY_9']?.toString().trim();
    const oldCondition = row['__EMPTY_10']?.toString().trim();
    const redistributeBrand = row['RE DISTRIBUTE']?.toString().trim();
    const redistributeName = row['__EMPTY_11']?.toString().trim();
    const redistributeEmpNo = row['__EMPTY_12']?.toString().trim();
    const redistributeSrm = row['__EMPTY_13']?.toString().trim();
    const redistributeVerifier = row['__EMPTY_14']?.toString().trim();

    // 1. Log New Laptop Distribution
    if (newSerial) {
      distributions.push({
        rowNum,
        date,
        srm,
        rtom,
        empNo,
        name,
        serialNumber: newSerial,
        assetNumber,
        agreementStatus,
        agreementUpdate
      });
    }

    // 2. Log Old Notebook Return & Action
    if (oldSerial || returnedOld?.toUpperCase() === 'YES' || returnedOld?.toUpperCase() === 'Y') {
      const returnRecord = {
        rowNum,
        returnedBy: { name, empNo },
        serialNumber: oldSerial || "UNKNOWN_SERIAL",
        condition: oldCondition,
        redistributeBrand
      };
      
      returns.push(returnRecord);

      // Analyze where it went
      if (redistributeName) {
        const dest = redistributeName.toLowerCase();
        if (dest.includes('head office') || dest.includes('ho') || dest.includes('head')) {
          headOfficeReturns.push({
            ...returnRecord,
            destination: redistributeName
          });
        } else if (dest.includes('cant repair') || dest.includes('damage') || oldCondition.toLowerCase().includes('cant repair')) {
          unrepairable.push({
            ...returnRecord,
            verifier: redistributeVerifier || "Damitha"
          });
        } else {
          redistributions.push({
            ...returnRecord,
            assignedTo: {
              name: redistributeName,
              empNo: redistributeEmpNo,
              srm: redistributeSrm
            }
          });
        }
      } else if (oldCondition.toLowerCase().includes('cant repair')) {
        unrepairable.push({
          ...returnRecord,
          verifier: redistributeVerifier || "Damitha"
        });
      }
    }
  }

  // Write out structured report to an artifact
  console.log(`[ANALYSIS] Done analyzing LAPTOP DISTRIBUTION.xlsx`);
  console.log(`- Total Row entries parsed: ${distributions.length}`);
  console.log(`- New Laptop Distributions logged: ${distributions.length}`);
  console.log(`- Old laptops returned: ${returns.length}`);
  console.log(`- Old laptops redistributed to new users: ${redistributions.length}`);
  console.log(`- Old laptops returned to Head Office: ${headOfficeReturns.length}`);
  console.log(`- Old laptops marked unrepairable / scrap: ${unrepairable.length}`);

  // Write to temp file so we can view it structured
  const resultJson = {
    distributionsCount: distributions.length,
    returnsCount: returns.length,
    redistributionsCount: redistributions.length,
    headOfficeReturnsCount: headOfficeReturns.length,
    unrepairableCount: unrepairable.length,
    sampleRedistributions: redistributions.slice(0, 10),
    sampleHeadOffice: headOfficeReturns.slice(0, 10),
    sampleUnrepairable: unrepairable.slice(0, 10)
  };
  fs.writeFileSync('scripts/laptop-analysis-result.json', JSON.stringify(resultJson, null, 2));
}

main().catch(console.error);
