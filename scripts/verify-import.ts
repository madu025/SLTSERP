import { prisma } from '../src/lib/prisma';
import * as xlsx from 'xlsx';
import * as path from 'path';
import * as fs from 'fs';

async function main() {
  const filePath = path.join(__dirname, '..', 'LAPTOP DISTRIBUTION.xlsx');
  console.log(`[VERIFY] Loading Excel file from: ${filePath}`);

  if (!fs.existsSync(filePath)) {
    console.error(`[VERIFY] ERROR: File not found at ${filePath}`);
    return;
  }

  const workbook = xlsx.readFile(filePath);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows: any[] = xlsx.utils.sheet_to_json(sheet, { defval: "" });
  
  // Skip headers row
  const dataRows = rows.slice(1);

  const expectedNewSerials = new Set<string>();
  const expectedOldSerials = new Set<string>();

  for (const row of dataRows) {
    const rowNum = row['__EMPTY'];
    if (!rowNum || isNaN(Number(rowNum))) continue;

    const newSerial = row['__EMPTY_5']?.toString().trim();
    const oldSerial = row['__EMPTY_9']?.toString().trim();

    if (newSerial) {
      expectedNewSerials.add(newSerial);
    }
    if (oldSerial && oldSerial.toLowerCase() !== "yes" && oldSerial.toLowerCase() !== "no") {
      expectedOldSerials.add(oldSerial);
    }
  }

  console.log(`\n--- Verification Summary from Excel ---`);
  console.log(`Total expected unique NEW serial numbers: ${expectedNewSerials.size}`);
  console.log(`Total expected unique OLD serial numbers: ${expectedOldSerials.size}`);
  console.log(`Combined unique serials expected: ${expectedNewSerials.size + expectedOldSerials.size}`);

  const missingNew: string[] = [];
  const missingOld: string[] = [];
  const foundNew: string[] = [];
  const foundOld: string[] = [];

  // Check new serials in database
  for (const serial of expectedNewSerials) {
    const asset = await prisma.iTAsset.findUnique({
      where: { serialNumber: serial }
    });
    if (asset) {
      foundNew.push(serial);
    } else {
      missingNew.push(serial);
    }
  }

  // Check old serials in database
  for (const serial of expectedOldSerials) {
    const asset = await prisma.iTAsset.findUnique({
      where: { serialNumber: serial }
    });
    if (asset) {
      foundOld.push(serial);
    } else {
      missingOld.push(serial);
    }
  }

  console.log(`\n--- Database Check Results ---`);
  console.log(`New Laptops: ${foundNew.length} Found / ${missingNew.length} Missing`);
  console.log(`Old Laptops: ${foundOld.length} Found / ${missingOld.length} Missing`);

  if (missingNew.length > 0) {
    console.log(`\n[WARNING] Missing New Laptop Serials in DB:`);
    console.log(missingNew);
  }
  if (missingOld.length > 0) {
    console.log(`\n[WARNING] Missing Old Laptop Serials in DB:`);
    console.log(missingOld);
  }

  if (missingNew.length === 0 && missingOld.length === 0) {
    console.log(`\n[SUCCESS] Verification complete! Every single laptop serial number from the Excel sheet has been successfully imported into the database!`);
  }
}

main().catch(console.error);
