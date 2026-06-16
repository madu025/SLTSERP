import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
    try {
        const syncStats = await (prisma as any).systemSetting.findUnique({
            where: { key: 'LAST_SYNC_STATS' }
        });

        if (!syncStats) {
            return NextResponse.json({
                lastSync: null,
                nextSync: null,
                stats: null,
                isStale: true
            });
        }

        const stats = syncStats.value as any;
        const lastSync = stats.lastSyncTriggered || stats.lastSync || new Date().toISOString();
        const lastSyncDate = new Date(lastSync);
        const nextSyncDate = new Date(lastSyncDate.getTime() + 30 * 60 * 1000); // 30 minutes later

        // Stale if last sync was more than 45 minutes ago
        const isStale = (Date.now() - lastSyncDate.getTime()) > (45 * 60 * 1000);

        return NextResponse.json({
            lastSync: lastSync,
            nextSync: nextSyncDate.toISOString(),
            stats: {
                created: stats.created || 0,
                updated: stats.updated || 0,
                failed: stats.failed || 0,
                patUpdated: stats.patUpdated || 0,
                queuedCount: stats.queuedCount || 0
            },
            isStale
        });

    } catch (error: any) {
        console.error('Error fetching sync status:', error);
        return NextResponse.json({ message: 'Error fetching sync status' }, { status: 500 });
    }
}
