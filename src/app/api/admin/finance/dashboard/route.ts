import { NextRequest, NextResponse } from "next/server";
import { FinanceDashboardService } from "@/services/finance/dashboard.service";

// GET /api/admin/finance/dashboard - Fetch aggregated metrics and charts data
export async function GET(request: NextRequest) {
    try {
        const data = await FinanceDashboardService.getDashboardMetrics();
        return NextResponse.json(data);
    } catch (error: unknown) {
        console.error("Error fetching finance dashboard details:", error);
        return NextResponse.json({ error: "Failed to fetch dashboard metrics" }, { status: 500 });
    }
}
