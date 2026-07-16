import { prisma } from '../src/lib/prisma';
import * as xlsx from 'xlsx';
import * as path from 'path';
import * as fs from 'fs';

async function main() {
  const filePath = path.join(__dirname, '..', 'LAPTOP DISTRIBUTION.xlsx');
  const workbook = xlsx.readFile(filePath);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows: any[] = xlsx.utils.sheet_to_json(sheet, { defval: "" });
  const dataRows = rows.slice(1);

  let matchedByName = 0;
  let notFoundAtAll = 0;

  for (const row of dataRows) {
    const name = row['__EMPTY_4']?.toString().trim();
    const empNo = row['__EMPTY_3']?.toString().trim();
    if (!name || !empNo) continue;

    // Try case-insensitive lookup
    // Split name to search for parts
    const parts = name.split(' ').filter((p: string) => p.length > 2);
    let matchedStaff = null;
    
    if (parts.length > 0) {
      // Find first staff that contains at least one significant part of the name
      const candidates = await prisma.staff.findMany({
        where: {
          OR: parts.map((part: string) => ({
            name: { contains: part, mode: 'insensitive' }
          }))
        }
      });
      if (candidates.length > 0) {
        matchedStaff = candidates[0]; // Take first match
      }
    }

    if (matchedStaff) {
      console.log(`Excel: "${name}" (${empNo}) -> Matches DB Staff: "${matchedStaff.name}" (${matchedStaff.employeeId})`);
      matchedByName++;
    } else {
      console.log(`Excel: "${name}" (${empNo}) -> NOT FOUND IN DB AT ALL`);
      notFoundAtAll++;
    }
  }

  console.log(`\nName matching check:`);
  console.log(`- Matched by name keywords: ${matchedByName}`);
  console.log(`- Not found: ${notFoundAtAll}`);
}

main().catch(console.error);
