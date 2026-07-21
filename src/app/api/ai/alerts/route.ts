import { apiHandler } from '@/lib/api-handler';
import { NexusAlertsService } from '@/services/nexus-alerts.service';
import { z } from 'zod';
import { AppError } from '@/lib/error';

const patchAlertSchema = z.object({
    id: z.string().optional(),
    all: z.boolean().optional()
}).refine(data => data.id || data.all, {
    message: "Alert id is required unless 'all' is true"
});

// GET /api/ai/alerts - Run diagnostics and return all unread alerts
export const GET = apiHandler(async () => {
    // Trigger automated alerts check
    await NexusAlertsService.checkAndGenerateAlerts();
    
    const alerts = await NexusAlertsService.getUnreadAlerts();
    return Response.json(alerts);
}, {
    // Assumes accessible by authenticated users
});

// PATCH /api/ai/alerts - Mark an alert (or all) as read
export const PATCH = apiHandler(async (_req, _params, body) => {
    const { id, all } = patchAlertSchema.parse(body);

    if (all) {
        await NexusAlertsService.markAllAsRead();
        return Response.json({ message: "All alerts cleared successfully" });
    }

    if (id) {
        const alert = await NexusAlertsService.markAlertAsRead(id);
        return Response.json({ message: "Alert marked as read", alert });
    }

    throw AppError.badRequest('Invalid request');
}, {
    audit: { action: 'MARK_AI_ALERT_READ', entity: 'AI' }
});
