import { apiHandler } from "@/lib/api-handler";
import { prisma } from "@/lib/prisma";
import { rateLimit, getClientIp } from "@/lib/agent-auth";
import { NextResponse } from "next/server";

export const dynamic = 'force-dynamic';

export const GET = apiHandler(async (req) => {
  const ip = getClientIp(req);

  // Rate limit: 5 searches per minute per IP
  const isAllowed = await rateLimit(ip, 5, 60);
  if (!isAllowed) {
    return NextResponse.json(
      { success: false, message: "Too many requests. Please try again later." },
      { status: 429 }
    );
  }

  const url = new URL(req.url);
  const serial = url.searchParams.get("serialNumber") || "";

  if (!serial.trim()) {
    return { success: false, error: "Serial number is required" };
  }

  const asset = await prisma.iTAsset.findFirst({
    where: {
      serialNumber: {
        equals: serial.trim(),
        mode: 'insensitive'
      }
    },
    include: {
      assignedStaff: {
        select: {
          employeeId: true,
          name: true
        }
      }
    }
  });

  if (!asset) {
    return { found: false };
  }

  return {
    found: true,
    asset: {
      id: asset.id,
      assetNumber: asset.assetNumber,
      serialNumber: asset.serialNumber,
      deviceType: asset.deviceType,
      brand: asset.brand,
      model: asset.model,
      status: asset.status,
      assignedStaff: asset.assignedStaff ? {
        employeeId: asset.assignedStaff.employeeId,
        name: asset.assignedStaff.name
      } : null
    }
  };
});
