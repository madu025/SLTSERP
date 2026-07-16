import { prisma } from '../src/lib/prisma';
import * as xlsx from 'xlsx';
import * as path from 'path';
import * as fs from 'fs';

async function main() {
  const filePath = path.join(__dirname, '..', 'LAPTOP DISTRIBUTION.xlsx');
  console.log(`[HANDOVER-LOGS] Loading Excel file from: ${filePath}`);

  if (!fs.existsSync(filePath)) {
    console.error(`[HANDOVER-LOGS] ERROR: File not found at ${filePath}`);
    return;
  }

  // Get administrative user to set as performer
  const adminUser = await prisma.user.findFirst({
    where: { role: "SUPER_ADMIN" }
  }) || await prisma.user.findFirst();

  if (!adminUser) {
    console.error(`[HANDOVER-LOGS] ERROR: No administrator user found in database. Run login/seeding first.`);
    return;
  }

  const workbook = xlsx.readFile(filePath);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows: any[] = xlsx.utils.sheet_to_json(sheet, { defval: "" });
  const dataRows = rows.slice(1);

  let logsCreated = 0;

  console.log(`[HANDOVER-LOGS] Clearing old distribution logs to prevent duplicate logs...`);
  await prisma.assetHandoverLog.deleteMany({
    where: {
      remarks: { contains: "OSP Notebook Distribution Plan Seeding" }
    }
  });

  console.log(`[HANDOVER-LOGS] Creating historical logs for ${dataRows.length} distribution entries...`);

  for (const row of dataRows) {
    const rowNum = row['__EMPTY'];
    if (!rowNum || isNaN(Number(rowNum))) continue;

    const dateStr = row['__EMPTY_1']?.toString().trim();
    const newEmpNo = row['__EMPTY_3']?.toString().trim();
    const newName = row['__EMPTY_4']?.toString().trim();
    const newSerial = row['__EMPTY_5']?.toString().trim();

    const oldSerial = row['__EMPTY_9']?.toString().trim();
    const oldCondition = row['__EMPTY_10']?.toString().trim();
    const redistributeEmpNo = row['__EMPTY_12']?.toString().trim();
    const redistributeName = row['__EMPTY_11']?.toString().trim();

    // Parse date if valid
    let logDate = new Date();
    if (dateStr) {
      const parts = dateStr.split(/[\/\.]+/);
      if (parts.length === 3) {
        logDate = new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));
      }
    }

    // 1. Log for New Laptop Issue
    if (newSerial) {
      const dbLaptop = await prisma.iTAsset.findUnique({
        where: { serialNumber: newSerial }
      });

      if (dbLaptop) {
        let staffId: string | null = null;
        if (newEmpNo) {
          const staff = await prisma.staff.findFirst({
            where: { employeeId: newEmpNo }
          });
          if (staff) staffId = staff.id;
        }

        await prisma.assetHandoverLog.create({
          data: {
            assetId: dbLaptop.id,
            transactionType: "ISSUED_TO_USER",
            performedById: adminUser.id,
            targetStaffId: staffId,
            condition: "Good / Working",
            remarks: `New laptop issued under OSP Notebook Distribution Plan Seeding. Recipient: ${newName} (${newEmpNo})`,
            date: logDate
          }
        });
        logsCreated++;
      }
    }

    // 2. Log for Old Laptop Return and Redistribution
    if (oldSerial && oldSerial !== "yes" && oldSerial !== "no") {
      const dbOldLaptop = await prisma.iTAsset.findUnique({
        where: { serialNumber: oldSerial }
      });

      if (dbOldLaptop) {
        // Find staff who returned it
        let returningStaffId: string | null = null;
        if (newEmpNo) {
          const staff = await prisma.staff.findFirst({
            where: { employeeId: newEmpNo }
          });
          if (staff) returningStaffId = staff.id;
        }

        // A. Return transaction log
        await prisma.assetHandoverLog.create({
          data: {
            assetId: dbOldLaptop.id,
            transactionType: "RETURNED_TO_STORE",
            performedById: adminUser.id,
            targetStaffId: returningStaffId,
            condition: oldCondition || "Returned old unit",
            remarks: `Returned old device to Stores under OSP Notebook Distribution Plan Seeding. Custodian returning: ${newName} (${newEmpNo})`,
            date: logDate
          }
        });
        logsCreated++;

        // B. Re-issue redistribution transaction log (if applicable)
        if (redistributeName && redistributeName.toLowerCase() !== "send to head office") {
          let targetStaffId: string | null = null;
          if (redistributeEmpNo) {
            const staff = await prisma.staff.findFirst({
              where: { employeeId: redistributeEmpNo }
            });
            if (staff) targetStaffId = staff.id;
          }

          await prisma.assetHandoverLog.create({
            data: {
              assetId: dbOldLaptop.id,
              transactionType: "ISSUED_TO_USER",
              performedById: adminUser.id,
              targetStaffId: targetStaffId,
              condition: "Working",
              remarks: `Exchanged old laptop redistributed to new Custodian under OSP Notebook Distribution Plan Seeding. Assigned target: ${redistributeName} (${redistributeEmpNo})`,
              date: logDate
            }
          });
          logsCreated++;
        }
      }
    }
  }

  console.log(`[HANDOVER-LOGS] SUCCESSFUL! Created ${logsCreated} historical transaction log entries.`);
}

main().catch(console.error);
