import { prisma } from '../src/lib/prisma';

const missingAssets = [
  {
    serialNumber: "PF0EG8PQ",
    brand: "Lenovo",
    model: "Notebook",
    empNo: "1195",
    name: "D.H.M WIJESINGHE",
    status: "ACTIVE"
  },
  {
    serialNumber: "5CG8155DK",
    brand: "HP",
    model: "Notebook",
    empNo: "1724",
    name: "D.R LAKSARA",
    status: "ACTIVE"
  },
  {
    serialNumber: "CND4465DBJ",
    brand: "HP",
    model: "Notebook",
    empNo: "717",
    name: "D.U.K JAYATHILAKE",
    status: "ACTIVE"
  },
  {
    serialNumber: "CND9123DSP",
    brand: "HP",
    model: "Notebook",
    empNo: "1939",
    name: "S.N Hewavitharana",
    status: "ACTIVE"
  }
];

async function main() {
  console.log("[IMPORT-MISSING] Importing the 4 shifted serial numbers...");

  for (const item of missingAssets) {
    // Check if it already exists
    const existing = await prisma.iTAsset.findUnique({
      where: { serialNumber: item.serialNumber }
    });

    if (!existing) {
      // Find staff custodian by employee ID
      let staffId: string | null = null;
      if (item.empNo) {
        const staff = await prisma.staff.findFirst({
          where: { employeeId: item.empNo.toString() }
        });
        if (staff) {
          staffId = staff.id;
        }
      }

      const generatedAssetNumber = `SLT-OLD-LAP-${Math.floor(100000 + Math.random() * 900000)}`;

      await prisma.iTAsset.create({
        data: {
          assetNumber: generatedAssetNumber,
          serialNumber: item.serialNumber,
          deviceType: "LAPTOP",
          brand: item.brand,
          model: item.model,
          assignedStaff: staffId ? { connect: { id: staffId } } : undefined,
          status: "ACTIVE",
          location: `OSP Field | Owner: ${item.name} (${item.empNo})`
        }
      });
      console.log(`[IMPORT-MISSING] Registered: ${item.serialNumber} -> assigned to staffId: ${staffId}`);
    } else {
      console.log(`[IMPORT-MISSING] Already exists: ${item.serialNumber}`);
    }
  }

  console.log("[IMPORT-MISSING] Done!");
}

main().catch(console.error);
