import { UpdateAssetSchema } from "./src/lib/validations/helpdesk.schema";
import { HelpdeskService } from "./src/services/helpdesk.service";

async function main() {
  const assetId = "cmrmyppck000ksilgfvirfg8x"; // ID of PF57H2YJ
  const userId = "cmqm18ue00000sivorz72d6wz"; // some user ID from DB
  
  // Let's retrieve the asset's current data first
  const currentAsset = await HelpdeskService.getAssetById(assetId);
  console.log("Current asset from service:", currentAsset);

  // This is the payload typically sent by Edit form if they don't change anything or submit changes
  const payload = {
    assetNumber: "248/2025/CA/LAP/015",
    serialNumber: "PF57H2YJ",
    deviceType: "LAPTOP",
    brand: "Lenovo",
    model: "ThinkPad L14",
    assignedStaffId: "cmrmxgirh007fsi3srb5ie1xx",
    department: "GQ",
    siteOfficeId: null,
    location: "OSP Field",
    status: "ACTIVE",
    purchaseDate: "2025-03-22", // formatInputDate splits ISO string
    warrantyExpiry: "",
    purchaseCost: 0,
    agreementReceived: false,
    newCustodianName: "",
    newCustodianEmpNo: "",
    isExchange: false,
    oldLaptopSerial: "",
    oldLaptopStatus: "DECOMMISSIONED",
    repairRemarks: ""
  };

  console.log("\nValidating payload with UpdateAssetSchema...");
  const validated = UpdateAssetSchema.safeParse(payload);
  if (!validated.success) {
    console.error("Zod Validation Failed:", validated.error.format());
    return;
  }
  console.log("Zod Validation Passed:", validated.data);

  console.log("\nCalling HelpdeskService.updateAsset...");
  try {
    const result = await HelpdeskService.updateAsset(userId, assetId, validated.data);
    console.log("Success! Updated Asset:", result);
  } catch (err: any) {
    console.error("Update Failed with Error:", err);
  }
}

main().catch(console.error);
