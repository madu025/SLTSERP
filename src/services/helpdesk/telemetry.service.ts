import { redis } from '@/lib/redis';
import { prisma } from '@/lib/prisma';

export interface AgentTelemetryPayload {
    serialNumber: string;
    macAddress: string;
    ipAddress: string;
    osVersion: string;
    loggedInUser: string;
}

export class TelemetryService {
    private static readonly REDIS_PREFIX = 'telemetry:agent:';
    
    /**
     * Ingest telemetry via Redis cache (Zero DB regress).
     * This buffers the telemetry data, which can later be synced to PostgreSQL via a cron job
     * or accessed instantly when loading an asset view.
     */
    static async ingestTelemetry(payload: AgentTelemetryPayload): Promise<void> {
        const key = `${this.REDIS_PREFIX}${payload.serialNumber}`;
        const data = {
            ...payload,
            lastSeen: new Date().toISOString()
        };
        
        // Cache telemetry data for 24 hours (86400 seconds)
        await redis.set(key, JSON.stringify(data), 'EX', 86400);
        
        // Push the serial to a Set so a cron job knows which assets need DB sync
        await redis.sadd('telemetry:pending_sync', payload.serialNumber);
    }
    
    /**
     * Syncs cached telemetry from Redis to PostgreSQL.
     * Should be called by a BullMQ cron worker (e.g., every 5 minutes).
     */
    static async syncTelemetryToDB(): Promise<number> {
        const serials = await redis.smembers('telemetry:pending_sync');
        if (!serials || serials.length === 0) return 0;
        
        let syncedCount = 0;
        
        for (const serial of serials) {
            const key = `${this.REDIS_PREFIX}${serial}`;
            const cached = await redis.get(key);
            
            if (cached) {
                const data = JSON.parse(cached) as AgentTelemetryPayload & { lastSeen: string };
                
                await prisma.iTAsset.updateMany({
                    where: { serialNumber: data.serialNumber },
                    data: {
                        macAddress: data.macAddress,
                        ipAddress: data.ipAddress,
                        osVersion: data.osVersion,
                        lastSeenEmployeeUsername: data.loggedInUser,
                        lastSyncedAt: new Date(data.lastSeen)
                    }
                });
                syncedCount++;
            }
            
            // Remove from pending set after processing
            await redis.srem('telemetry:pending_sync', serial);
        }
        
        return syncedCount;
    }

    /**
     * Fetch registered IT Asset devices telemetry summary
     */
    static async getRegisteredDevices() {
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
    }
}
