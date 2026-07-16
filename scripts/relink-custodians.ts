import { prisma } from '../src/lib/prisma';
import * as xlsx from 'xlsx';
import * as path from 'path';
import * as fs from 'fs';

async function main() {
  const filePath = path.join(__dirname, '..', 'LAPTOP DISTRIBUTION.xlsx');
  console.log(`[RELINK] Loading Excel file from: ${filePath}`);

  if (!fs.existsSync(filePath)) {
    console.error(`[RELINK] ERROR: File not found at ${filePath}`);
    return;
  }

  const workbook = xlsx.readFile(filePath);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows: any[] = xlsx.utils.sheet_to_json(sheet, { defval: "" });
  const dataRows = rows.slice(1);

  let staffCreated = 0;
  let staffUpdated = 0;
  let staffExisted = 0;

  console.log(`[RELINK] Processing ${dataRows.length} rows to update Staff directories...`);

  for (const row of dataRows) {
    const newName = row['__EMPTY_4']?.toString().trim();
    const newEmpNo = row['__EMPTY_3']?.toString().trim();

    if (!newName || !newEmpNo) continue;

    // 1. Check if Staff with numeric employeeId already exists
    const existingByEpf = await prisma.staff.findUnique({
      where: { employeeId: newEmpNo }
    });

    if (existingByEpf) {
      staffExisted++;
      continue;
    }

    // 2. Try to locate existing staff by name keywords to update their ID
    let matchedStaff = null;
    const cleanParts = newName.split(/[\s\.]+/).filter((p: string) => p.length > 3);
    
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
      // Update employee ID of the matched staff member
      await prisma.staff.update({
        where: { id: matchedStaff.id },
        data: { employeeId: newEmpNo }
      });
      console.log(`[RELINK] Updated Staff: "${matchedStaff.name}" (ID was "${matchedStaff.employeeId}") -> set numeric EPF "${newEmpNo}"`);
      staffUpdated++;
    } else {
      // Create a brand new Staff member
      await prisma.staff.create({
        data: {
          name: newName,
          employeeId: newEmpNo,
          designation: "ENGINEER"
        }
      });
      console.log(`[RELINK] Created missing Staff profile: "${newName}" with EPF "${newEmpNo}"`);
      staffCreated++;
    }
  }

  console.log(`\n[RELINK] Staff directory synced:`);
  console.log(`- Created profiles: ${staffCreated}`);
  console.log(`- Updated existing profiles: ${staffUpdated}`);
  console.log(`- Unchanged profiles: ${staffExisted}`);

  // Now, let's run the laptop re-import logic to match all the laptops
  console.log(`\n[RELINK] Re-importing laptops to update assignments...`);
  
  let newLaptopsUpdated = 0;
  let oldLaptopsUpdated = 0;

  for (const row of dataRows) {
    const rowNum = row['__EMPTY'];
    if (!rowNum || isNaN(Number(rowNum))) continue;

    const newEmpNo = row['__EMPTY_3']?.toString().trim();
    const newSerial = row['__EMPTY_5']?.toString().trim();
    const oldSerial = row['__EMPTY_9']?.toString().trim();
    const redistributeEmpNo = row['__EMPTY_12']?.toString().trim();

    // Re-link new laptops
    if (newSerial) {
      const dbNewLaptop = await prisma.iTAsset.findUnique({
        where: { serialNumber: newSerial }
      });

      if (dbNewLaptop) {
        let staffId: string | null = null;
        if (newEmpNo) {
          const staff = await prisma.staff.findFirst({
            where: { employeeId: newEmpNo }
          });
          if (staff) staffId = staff.id;
        }

        await prisma.iTAsset.update({
          where: { id: dbNewLaptop.id },
          data: {
            assignedStaff: staffId ? { connect: { id: staffId } } : { disconnect: true },
            status: "ACTIVE"
          }
        });
        newLaptopsUpdated++;
      }
    }

    // Re-link old laptops
    if (oldSerial && oldSerial !== "yes" && oldSerial !== "no") {
      const dbOldLaptop = await prisma.iTAsset.findUnique({
        where: { serialNumber: oldSerial }
      });

      if (dbOldLaptop) {
        let oldStaffId: string | null = null;
        let oldStatus: any = "SPARE";
        let location = dbOldLaptop.location;

        if (redistributeEmpNo) {
          const staff = await prisma.staff.findFirst({
            where: { employeeId: redistributeEmpNo }
          });
          if (staff) {
            oldStaffId = staff.id;
            oldStatus = "ACTIVE";
            location = "OSP Field";
          }
        }

        await prisma.iTAsset.update({
          where: { id: dbOldLaptop.id },
          data: {
            assignedStaff: oldStaffId ? { connect: { id: oldStaffId } } : { disconnect: true },
            status: oldStatus,
            location: location || "Stores"
          }
        });
        oldLaptopsUpdated++;
      }
    }
  }

  console.log(`[RELINK] Laptop assignments update successful!`);
  console.log(`- New Laptops updated: ${newLaptopsUpdated}`);
  console.log(`- Old Laptops updated: ${oldLaptopsUpdated}`);
}

main().catch(console.error);
