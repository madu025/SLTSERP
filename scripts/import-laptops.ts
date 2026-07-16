import { prisma } from '../src/lib/prisma';
import * as xlsx from 'xlsx';
import * as path from 'path';
import * as fs from 'fs';

async function main() {
  const filePath = path.join(__dirname, '..', 'LAPTOP DISTRIBUTION.xlsx');
  console.log(`[IMPORT] Loading Excel file from: ${filePath}`);

  if (!fs.existsSync(filePath)) {
    console.error(`[IMPORT] ERROR: File not found at ${filePath}`);
    process.exit(1);
  }

  const workbook = xlsx.readFile(filePath);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows: any[] = xlsx.utils.sheet_to_json(sheet, { defval: "" });
  
  // Skip headers row
  const dataRows = rows.slice(1);

  let newLaptopsCreated = 0;
  let oldLaptopsCreated = 0;
  let skippedCount = 0;

  console.log(`[IMPORT] Processing ${dataRows.length} rows...`);

  for (const row of dataRows) {
    const rowNum = row['__EMPTY'];
    if (!rowNum || isNaN(Number(rowNum))) continue;

    const dateStr = row['__EMPTY_1']?.toString().trim();
    const rtom = row['__EMPTY_2']?.toString().trim();
    const newEmpNo = row['__EMPTY_3']?.toString().trim();
    const newName = row['__EMPTY_4']?.toString().trim();
    const newSerial = row['__EMPTY_5']?.toString().trim();
    const newAssetNumber = row['__EMPTY_8']?.toString().trim();

    const oldSerial = row['__EMPTY_9']?.toString().trim();
    const oldCondition = row['__EMPTY_10']?.toString().trim();
    const oldBrand = row['RE DISTRIBUTE']?.toString().trim() || "HP";
    const redistributeName = row['__EMPTY_11']?.toString().trim();
    const redistributeEmpNo = row['__EMPTY_12']?.toString().trim();

    // Parse date if valid
    let purchaseDate: Date | null = null;
    if (dateStr) {
      const parts = dateStr.split('/');
      if (parts.length === 3) {
        purchaseDate = new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));
      }
    }

    // 1. Process New Laptop
    if (newSerial && newAssetNumber) {
      // Check if serial already exists
      const existingSerial = await prisma.iTAsset.findUnique({
        where: { serialNumber: newSerial }
      });
      const existingAssetNo = await prisma.iTAsset.findUnique({
        where: { assetNumber: newAssetNumber }
      });

      if (!existingSerial) {
        let finalAssetNo = newAssetNumber;
        if (existingAssetNo) {
          finalAssetNo = `${newAssetNumber}-DUP`;
          console.warn(`[IMPORT] WARNING: Duplicate asset number "${newAssetNumber}" found for serial "${newSerial}". Importing with fallback "${finalAssetNo}".`);
        }

        // Try to match staff member by employee number
        let staffId: string | null = null;
        if (newEmpNo) {
          const staff = await prisma.staff.findFirst({
            where: { employeeId: newEmpNo }
          });
          if (staff) staffId = staff.id;
        }

        await prisma.iTAsset.create({
          data: {
            assetNumber: finalAssetNo,
            serialNumber: newSerial,
            deviceType: "LAPTOP",
            brand: "Lenovo",
            model: "ThinkPad L14",
            assignedStaff: staffId ? { connect: { id: staffId } } : undefined,
            department: rtom,
            status: "ACTIVE",
            purchaseDate: purchaseDate,
            location: "OSP Field"
          }
        });
        newLaptopsCreated++;
      } else {
        // Update user assignments if serial number already exists
        let staffId: string | null = null;
        if (newEmpNo) {
          const staff = await prisma.staff.findFirst({
            where: { employeeId: newEmpNo }
          });
          if (staff) staffId = staff.id;
        }

        await prisma.iTAsset.update({
          where: { id: existingSerial.id },
          data: {
            assignedStaff: staffId ? { connect: { id: staffId } } : { disconnect: true },
            department: rtom,
            status: "ACTIVE"
          }
        });
        skippedCount++;
      }
    }

    // 2. Process Old Laptop
    if (oldSerial && oldSerial !== "yes" && oldSerial !== "no") {
      // Check if old serial already exists
      const existingOld = await prisma.iTAsset.findUnique({
        where: { serialNumber: oldSerial }
      });

      if (!existingOld) {
        let oldStaffId: string | null = null;
        let oldStatus: any = "SPARE";
        let location = "Stores";

        if (redistributeName) {
          const dest = redistributeName.toLowerCase();
          if (dest.includes('head office') || dest.includes('ho') || dest.includes('head')) {
            oldStatus = "DECOMMISSIONED";
            location = "Head Office";
          } else {
            // Find redistributed user staff
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
          }
        }

        const generatedAssetNumber = `SLT-OLD-LAP-${Math.floor(100000 + Math.random() * 900000)}`;

        await prisma.iTAsset.create({
          data: {
            assetNumber: generatedAssetNumber,
            serialNumber: oldSerial,
            deviceType: "LAPTOP",
            brand: oldBrand,
            model: "Notebook",
            assignedStaff: oldStaffId ? { connect: { id: oldStaffId } } : undefined,
            status: oldStatus,
            location: `Stores | Old Custodian: ${newName} (${newEmpNo})`
          }
        });
        oldLaptopsCreated++;
      } else {
        // Update user assignments if serial number already exists for old laptop
        let oldStaffId: string | null = null;
        let oldStatus: any = "SPARE";
        let location = `Stores | Old Custodian: ${newName} (${newEmpNo})`;

        if (redistributeName) {
          const dest = redistributeName.toLowerCase();
          if (dest.includes('head office') || dest.includes('ho') || dest.includes('head')) {
            oldStatus = "DECOMMISSIONED";
            location = "Head Office";
          } else {
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
          }
        }

        await prisma.iTAsset.update({
          where: { id: existingOld.id },
          data: {
            assignedStaff: oldStaffId ? { connect: { id: oldStaffId } } : { disconnect: true },
            status: oldStatus,
            location: location
          }
        });
        skippedCount++;
      }
    }
  }

  console.log(`[IMPORT] SUCCESSFUL!`);
  console.log(`- New Lenovo Laptops registered: ${newLaptopsCreated}`);
  console.log(`- Old returned HP/DELL Laptops registered: ${oldLaptopsCreated}`);
  console.log(`- Already existing records skipped: ${skippedCount}`);
}

main().catch(console.error);
