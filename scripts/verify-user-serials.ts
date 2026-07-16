import { prisma } from '../src/lib/prisma';
import * as fs from 'fs';

const serialList = [
  "PF57GPJ2", "PF57GJMW", "PF57GGG8", "PF57GGF5", "PF57MMQ7",
  "PF57GE81", "PF57GGG4", "PF57GE45", "PF57G9TJ", "PF57GC1Z",
  "PF57GC02", "PF57GRR9", "PF57GT2J", "PF57G7CT", "PF57H2YJ",
  "PF57GV09", "PF57G9TA", "PF57GGEZ", "PF57H0PJ", "PF57GBZP",
  "PF57GRV7", "PF57GGRP", "PF57VB53", "PF57GRSD", "PF57GM15",
  "PF57MMRL", "PF57GGDZ", "PF57GC2G", "PF57H7E8", "PF57GV0S",
  "PF57VAVC", "PF57H58R", "PF57GE63", "PF57GXR7", "PF57G9S9",
  "PF56VB4M", "PF57MQ51", "PF57GXRM", "PF57GLYE", "PF57H7GY",
  "PF57GC05", "PF57MQ3Y", "PF5TWLG1", "PF57H7E2", "PF57G9QH",
  "T8NRCX06836834C", "T8NRCX068123343", "T8NRCX068317347", "PF582NZ3", "PF584JDM",
  "PF584BM8", "PG04ZS6K", "PF584722", "T8NRCX068380346", "PF5827NL",
  "PF5827N6", "T8NRCX068416341", "T6NRCX05Y467267", "5CD5370K4J", "5CD5370K0F",
  "5CD5370JZL", "5CD5370K4H", "5CD5370K30", "5CD5370K3G", "5CD5370JRZ",
  "5CD5370K31", "5CD5370K46", "5CD5370K59", "5CD5370JZQ", "5CD5370K1H",
  "5CD5370K3Q", "5CD5370K34", "PF5TWLF3", "PF5TW2HZ", "PF5V2DA7",
  "PF5TYC70", "PF5VP6EB", "PF5VN0GQ", "PF5VSAVA", "52GFYM3",
  "5CD5370JZR", "5CD5370OZL", "5CG61110FGK", "5CG6351L7H", "5CG7451HVJ",
  "5CG8155D2F", "5CG8155DK", "CND4465DBJ", "CND61237D8", "CND61Z3780",
  "CND8140H43", "CND836CBTJ", "CND8508MNO", "CND9123D7R", "CND9123DBH",
  "CND9123DSP", "CND9123DXK", "NXA1ESG00V1440BBB0004000", "PF0EG8PQ", "PF0ETVJR",
  "PF3K9WM1", "PF3KT13F"
];

async function main() {
  console.log(`[VERIFY-LIST] Querying DB for ${serialList.length} user-supplied serials...`);

  const results: any[] = [];
  const missing: string[] = [];

  for (const serial of serialList) {
    const asset = await prisma.iTAsset.findUnique({
      where: { serialNumber: serial },
      include: {
        assignedStaff: {
          select: { name: true, employeeId: true }
        }
      }
    });

    if (asset) {
      results.push({
        serialNumber: asset.serialNumber,
        assetNumber: asset.assetNumber,
        brand: asset.brand,
        model: asset.model,
        status: asset.status,
        custodianName: asset.assignedStaff?.name || "None (Spare)",
        custodianEmpNo: asset.assignedStaff?.employeeId || "N/A"
      });
    } else {
      missing.push(serial);
    }
  }

  console.log(`\n--- Verification Results ---`);
  console.log(`Total checked: ${serialList.length}`);
  console.log(`Found in DB: ${results.length}`);
  console.log(`Missing in DB: ${missing.length}`);

  // Write detailed report to a JSON file
  fs.writeFileSync('scripts/user-serials-report.json', JSON.stringify({
    totalChecked: serialList.length,
    foundCount: results.length,
    missingCount: missing.length,
    foundAssets: results,
    missingAssets: missing
  }, null, 2));
}

main().catch(console.error);
