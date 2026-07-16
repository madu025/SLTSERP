import { prisma } from '../src/lib/prisma';
import * as xlsx from 'xlsx';
import * as path from 'path';
import * as fs from 'fs';

async function main() {
  const filePath = path.join(__dirname, '..', 'OSP O365 License .xlsx');
  console.log(`[IMPORT] Loading Excel file from: ${filePath}`);

  if (!fs.existsSync(filePath)) {
    console.error(`[IMPORT] ERROR: File not found at ${filePath}`);
    process.exit(1);
  }

  // Load workbook
  const workbook = xlsx.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  console.log(`[IMPORT] Reading sheet: ${sheetName}`);
  const sheet = workbook.Sheets[sheetName];
  
  // Parse rows
  const rows: any[] = xlsx.utils.sheet_to_json(sheet);
  console.log(`[IMPORT] Found ${rows.length} rows to process.`);

  // Pre-cleanup of licenses and assignments to avoid duplicates and ensure clean re-runs
  console.log(`[IMPORT] Cleaning up old Software Licenses and Assignments...`);
  await prisma.softwareLicenseAssignment.deleteMany();
  await prisma.softwareLicense.deleteMany();
  console.log(`[IMPORT] Cleanup completed.`);

  let createdStaffCount = 0;
  let matchedStaffCount = 0;
  let createdLicenseCount = 0;
  let createdAssignmentCount = 0;

  for (const row of rows) {
    const displayName = row['Display name']?.toString().trim();
    const upn = row['User principal name']?.toString().trim();
    const licensesStr = row['Licenses']?.toString().trim();

    if (!displayName || !upn || !licensesStr) {
      console.log(`[IMPORT] Skipping invalid row: ${JSON.stringify(row)}`);
      continue;
    }

    // Split licenses by semicolon or comma in case of multiples
    const licenses = licensesStr.split(/[;,]/).map((l: string) => l.trim()).filter(Boolean);

    for (const licenseName of licenses) {
      // 1. Get or create SoftwareLicense
      let license = await prisma.softwareLicense.findFirst({
        where: { name: licenseName }
      });

      if (!license) {
        license = await prisma.softwareLicense.create({
          data: {
            name: licenseName,
            status: 'ACTIVE',
            totalLicenses: 100 // Default to a larger seat count for imported corporate pools
          }
        });
        createdLicenseCount++;
        console.log(`[IMPORT] Created new Software License: "${licenseName}"`);
      }

      // 2. Find matching User or Staff
      let staffId: string | null = null;

      // Try matching User by email (UPN)
      const matchedUser = await prisma.user.findFirst({
        where: { email: { equals: upn, mode: 'insensitive' } },
        include: { staff: true }
      });

      if (matchedUser && matchedUser.staffId) {
        staffId = matchedUser.staffId;
        matchedStaffCount++;
      } else {
        // Try matching Staff by name
        const matchedStaff = await prisma.staff.findFirst({
          where: { name: { equals: displayName, mode: 'insensitive' } }
        });

        if (matchedStaff) {
          staffId = matchedStaff.id;
          matchedStaffCount++;
        } else {
          // Auto-provision a new Staff member
          const usernamePrefix = upn.split('@')[0].toUpperCase();
          const cleanEmployeeId = `EMP-O365-${usernamePrefix}`;

          // Verify employeeId is unique
          let finalEmployeeId = cleanEmployeeId;
          let counter = 1;
          while (await prisma.staff.findUnique({ where: { employeeId: finalEmployeeId } })) {
            finalEmployeeId = `${cleanEmployeeId}-${counter}`;
            counter++;
          }

          const newStaff = await prisma.staff.create({
            data: {
              name: displayName,
              employeeId: finalEmployeeId,
              designation: 'ENGINEER',
              area: 'OSP'
            }
          });
          staffId = newStaff.id;
          createdStaffCount++;
          console.log(`[IMPORT] Provisioned new Staff member: "${displayName}" (Emp ID: ${finalEmployeeId})`);
        }
      }

      // 3. Create SoftwareLicenseAssignment if it doesn't already exist
      const existingAssignment = await prisma.softwareLicenseAssignment.findFirst({
        where: {
          softwareLicenseId: license.id,
          assignedStaffId: staffId
        }
      });

      if (!existingAssignment) {
        await prisma.softwareLicenseAssignment.create({
          data: {
            softwareLicenseId: license.id,
            assignedStaffId: staffId,
            assignedEmail: upn,
            remarks: `Imported from Office 365 spreadsheet on ${new Date().toLocaleDateString()}`
          }
        });
        createdAssignmentCount++;
      }
    }
  }

  // Adjust totalLicenses for all licenses to match or exceed the number of actual assignments
  const allLicenses = await prisma.softwareLicense.findMany({
    include: {
      _count: {
        select: { assignments: true }
      }
    }
  });

  for (const lic of allLicenses) {
    const assignmentCount = lic._count.assignments;
    if (lic.totalLicenses < assignmentCount) {
      await prisma.softwareLicense.update({
        where: { id: lic.id },
        data: { totalLicenses: assignmentCount + 10 } // give it 10 spare seats
      });
      console.log(`[IMPORT] Adjusted seats for "${lic.name}": set total to ${assignmentCount + 10} (${assignmentCount} assigned)`);
    }
  }

  console.log(`[IMPORT] SUCCESSFUL!`);
  console.log(`- Licenses Created: ${createdLicenseCount}`);
  console.log(`- Staff Matched: ${matchedStaffCount}`);
  console.log(`- Staff Created: ${createdStaffCount}`);
  console.log(`- Assignments Created: ${createdAssignmentCount}`);
}

main()
  .catch((e) => {
    console.error(`[IMPORT] ERROR:`, e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
