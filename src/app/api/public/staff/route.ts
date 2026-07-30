import { apiHandler } from "@/lib/api-handler";
import { StaffService } from "@/services/hr/staff.service";
import { rateLimit, getClientIp } from "@/lib/agent-auth";
import { NextResponse } from "next/server";

export const dynamic = 'force-dynamic';

export const GET = apiHandler(async (req) => {
  const ip = getClientIp(req);
  
  const isAllowed = await rateLimit(ip, 10, 60);
  if (!isAllowed) {
    return NextResponse.json(
      { success: false, message: "Too many requests. Please try again later." },
      { status: 429 }
    );
  }

  const url = new URL(req.url);
  const employeeNo = url.searchParams.get("employeeNo") || "";

  if (!employeeNo.trim()) {
    return { success: false, error: "Employee Number is required" };
  }

  return await StaffService.findPublicStaffByEmployeeId(employeeNo);
});
