import { apiHandler } from "@/lib/api-handler";
import { prisma } from "@/lib/prisma";

export const dynamic = 'force-dynamic';

export const GET = apiHandler(async (req) => {
  const url = new URL(req.url);
  const employeeNo = url.searchParams.get("employeeNo") || "";

  if (!employeeNo.trim()) {
    return { success: false, error: "Employee Number is required" };
  }

  const staff = await prisma.staff.findFirst({
    where: {
      employeeId: {
        equals: employeeNo.trim(),
        mode: 'insensitive'
      }
    },
    select: {
      id: true,
      name: true,
      assignedITAssets: {
        select: {
          id: true,
          serialNumber: true,
          assetNumber: true,
          deviceType: true,
          brand: true,
          model: true,
          status: true
        }
      }
    }
  });

  if (!staff) {
    return { found: false };
  }

  return {
    found: true,
    staff: {
      id: staff.id,
      name: staff.name,
      assignedITAssets: staff.assignedITAssets
    }
  };
});
