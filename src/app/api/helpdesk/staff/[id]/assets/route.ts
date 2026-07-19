import { apiHandler } from "@/lib/api-handler";
import { prisma } from "@/lib/prisma";

export const dynamic = 'force-dynamic';

export const GET = apiHandler(
  async (req, params) => {
    const { id } = await params;
    
    // Fetch Staff Profile
    const staff = await prisma.staff.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        employeeId: true,
        designation: true,
        area: true
      }
    });

    if (!staff) {
      throw new Error("STAFF_NOT_FOUND");
    }

    // Fetch currently assigned IT assets
    const activeAssets = await prisma.iTAsset.findMany({
      where: { assignedStaffId: id },
      select: {
        id: true,
        assetNumber: true,
        serialNumber: true,
        deviceType: true,
        brand: true,
        model: true,
        status: true,
        physicallyInStores: true
      }
    });

    // Fetch custody handover logs
    const handovers = await prisma.assetHandoverLog.findMany({
      where: { targetStaffId: id },
      include: {
        performedBy: { select: { name: true, username: true } },
        asset: { select: { assetNumber: true, brand: true, model: true } }
      },
      orderBy: { date: "desc" }
    });

    return {
      staff,
      activeAssets,
      handovers
    };
  },
  {
    roles: ["SUPER_ADMIN", "ADMIN", "ENGINEER", "OFFICE_ADMIN", "OFFICE_ADMIN_ASSISTANT"]
  }
);
