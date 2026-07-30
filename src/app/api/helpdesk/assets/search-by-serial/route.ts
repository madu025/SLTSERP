import { apiHandler } from "@/lib/api-handler";

import { rateLimit, getClientIp } from "@/lib/agent-auth";
import { NextResponse } from "next/server";

import { HelpdeskService } from "@/services/helpdesk/helpdesk.service";

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

  return await HelpdeskService.searchAssetBySerial(serial);
});
