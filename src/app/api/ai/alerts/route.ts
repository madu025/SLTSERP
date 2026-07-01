import { NextRequest, NextResponse } from "next/server";
import { NexusAlertsService } from "@/services/nexus-alerts.service";

// GET /api/ai/alerts - Run diagnostics and return all unread alerts
export async function GET(_request: NextRequest) {
    try {
        // Trigger automated alerts check
        await NexusAlertsService.checkAndGenerateAlerts();
        
        const alerts = await NexusAlertsService.getUnreadAlerts();
        return NextResponse.json(alerts);
    } catch (error: unknown) {
        console.error("Error executing copilot alert checks:", error);
        return NextResponse.json({ error: "Failed to query alerts" }, { status: 500 });
    }
}

// PATCH /api/ai/alerts - Mark an alert (or all) as read
export async function PATCH(request: NextRequest) {
    try {
        const body = await request.json();
        const { id, all } = body;

        if (all) {
            await NexusAlertsService.markAllAsRead();
            return NextResponse.json({ message: "All alerts cleared successfully" });
        }

        if (!id) {
            return NextResponse.json({ error: "Alert id is required" }, { status: 400 });
        }

        const alert = await NexusAlertsService.markAlertAsRead(id);
        return NextResponse.json({ message: "Alert marked as read", alert });
    } catch (error: unknown) {
        console.error("Error clearing alert:", error);
        const errorMsg = error instanceof Error ? error.message : "Failed to clear alert";
        return NextResponse.json({ error: errorMsg }, { status: 500 });
    }
}
