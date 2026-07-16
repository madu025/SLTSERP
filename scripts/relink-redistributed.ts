import { prisma } from '../src/lib/prisma';
import * as xlsx from 'xlsx';
import * as path from 'path';
import * as fs from 'fs';

async function main() {
  const filePath = path.join(__dirname, '..', 'LAPTOP DISTRIBUTION.xlsx');
  console.log(`[REDISTRIBUTE-SYNC] Loading Excel file from: ${filePath}`);

  if (!fs.existsSync(filePath)) {
    console.error(`[REDISTRIBUTE-SYNC] ERROR: File not found at ${filePath}`);
    return;
  }

  const workbook = xlsx.readFile(filePath);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows: any[] = xlsx.utils.sheet_to_json(sheet, { defval: "" });
  const dataRows = rows.slice(1);

  let staffCreated = 0;
  let staffUpdated = 0;
  let staffExisted = 0;

  console.log(`[REDISTRIBUTE-SYNC] Syncing redistributed custodians...`);

  for (const row of dataRows) {
    const redistributeName = row['__EMPTY_11']?.toString().trim();
    const redistributeEmpNo = row['__EMPTY_12']?.toString().trim();

    if (!redistributeName || !redistributeEmpNo) continue;

    // Filter out destination words or status notes
    const lowerName = redistributeName.toLowerCase();
    if (
      lowerName.includes('head office') || 
      lowerName.includes('ho') || 
      lowerName.includes('head') || 
      lowerName.includes('stores') || 
      lowerName.includes('repair') || 
      lowerName.includes('cant repair') || 
      lowerName.includes('ok') || 
      lowerName.includes('hand') ||
      redistributeEmpNo.toUpperCase() === 'OK' || 
      redistributeEmpNo.toUpperCase() === 'HAND'
    ) {
      continue;
    }

    // Check if Staff already exists
    const existing = await prisma.staff.findUnique({
      where: { employeeId: redistributeEmpNo }
    });

    if (existing) {
      staffExisted++;
      continue;
    }

    // Match by name keyword
    let matchedStaff = null;
    const cleanParts = redistributeName.split(/[\s\.]+/).filter((p: string) => p.length > 3);
    
    if (cleanParts.length > 0) {
      const candidates = await prisma.staff.findMany({
        where: {
          OR: cleanParts.map((part: string) => ({
            name: { contains: part, mode: 'insensitive' }
          }))
        }
      });
      if (candidates.length > 0) {
        matchedStaff = candidates[0];
      }
    }

    if (matchedStaff) {
      await prisma.staff.update({
        where: { id: matchedStaff.id },
        data: { employeeId: redistributeEmpNo }
      });
      console.log(`[REDISTRIBUTE-SYNC] Updated Staff ID: "${matchedStaff.name}" -> numeric EPF "${redistributeEmpNo}"`);
      staffUpdated++;
    } else {
      await prisma.staff.create({
        data: {
          name: redistributeName,
          employeeId: redistributeEmpNo,
          designation: "ENGINEER"
        }
      });
      console.log(`[REDISTRIBUTE-SYNC] Created Staff Profile: "${redistributeName}" with EPF "${redistributeEmpNo}"`);
      staffCreated++;
    }
  }

  console.log(`\n[REDISTRIBUTE-SYNC] Sync complete:`);
  console.log(`- Created profiles: ${staffCreated}`);
  console.log(`- Updated profiles: ${staffUpdated}`);
  console.log(`- Unchanged profiles: ${staffExisted}`);

  // Now update old laptops assignments
  console.log(`\n[REDISTRIBUTE-SYNC] Updating old laptop custodians in DB...`);
  let laptopsAssigned = 0;

  for (const row of dataRows) {
    const oldSerial = row['__EMPTY_9']?.toString().trim();
    const redistributeName = row['__EMPTY_11']?.toString().trim();
    const redistributeEmpNo = row['__EMPTY_12']?.toString().trim();

    if (oldSerial && oldSerial !== "yes" && oldSerial !== "no" && redistributeName && redistributeEmpNo) {
      // Find old laptop in DB
      const dbOldLaptop = await prisma.iTAsset.findUnique({
        where: { serialNumber: oldSerial }
      });

      if (dbOldLaptop) {
        // Find custodian staff in DB
        const staff = await prisma.staff.findFirst({
          where: { employeeId: redistributeEmpNo }
        });

        if (staff) {
          await prisma.iTAsset.update({
            where: { id: dbOldLaptop.id },
            data: {
              assignedStaff: { connect: { id: staff.id } },
              status: "ACTIVE",
              location: "OSP Field"
            }
          });
          console.log(`[REDISTRIBUTE-SYNC] Re-assigned S/N ${oldSerial} -> ${staff.name} (${redistributeEmpNo}) | Status: ACTIVE`);
          laptopsAssigned++;
        }
      }
    }
  }

  console.log(`\n[REDISTRIBUTE-SYNC] Laptop reassignments complete: ${laptopsAssigned} devices updated to ACTIVE.`);
}

main().catch(console.error);
