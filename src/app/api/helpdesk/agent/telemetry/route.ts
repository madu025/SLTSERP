import { NextResponse } from 'next/server';
import { TelemetryService } from '@/services/helpdesk/telemetry.service';
import { apiHandler } from '@/lib/api-handler';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export const GET = apiHandler(async () => {
    const assets = await prisma.iTAsset.findMany({
        where: {
            status: { in: ['ACTIVE', 'SPARE', 'UNDER_REPAIR'] }
        },
        select: {
            id: true,
            assetNumber: true,
            serialNumber: true,
            model: true,
            brand: true,
            deviceType: true,
            mdmDeviceId: true,
            dataPlanLimit: true,
            updatedAt: true,
            assignedUser: {
                select: { id: true, name: true, email: true }
            },
            siteOffice: {
                select: { id: true, name: true, type: true }
            }
        },
        orderBy: { updatedAt: 'desc' },
        take: 100
    });

    const activeCount = assets.filter(a => a.mdmDeviceId).length;

    const formattedDevices = assets.map(a => ({
        ...a,
        assetTag: a.assetNumber,
        deviceName: `${a.brand} ${a.model}`
    }));

    return {
        devices: formattedDevices,
        stats: {
            totalRegistered: assets.length,
            mdmActive: activeCount,
            unregistered: assets.length - activeCount
        }
    };
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
    
    // Buffer to Redis instead of hitting Postgres immediately
    await TelemetryService.ingestTelemetry(data);
    
    return { success: true, timestamp: Date.now() };
});
