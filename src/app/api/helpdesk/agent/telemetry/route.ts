import { TelemetryService } from '@/services/helpdesk/telemetry.service';
import { apiHandler } from '@/lib/api-handler';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

export const GET = apiHandler(async () => {
    return await TelemetryService.getRegisteredDevices();
});

export const POST = apiHandler(async (req: Request) => {
    const payload = await req.json();
    
    const schema = z.object({
        serialNumber: z.string(),
        macAddress: z.string(),
        ipAddress: z.string(),
        osVersion: z.string(),
        loggedInUser: z.string(),
    });
    
    const data = schema.parse(payload);
    
    await TelemetryService.ingestTelemetry(data);
    
    return { success: true, timestamp: Date.now() };
});
