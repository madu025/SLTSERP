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

        const stats = syncStats.value;
        const lastSyncDate = new Date(stats.lastSync);
        const nextSyncDate = new Date(lastSyncDate.getTime() + 30 * 60 * 1000); // 30 minutes later

        // Stale if last sync was more than 45 minutes ago
        const isStale = (Date.now() - lastSyncDate.getTime()) > (45 * 60 * 1000);

        return NextResponse.json({
            lastSync: stats.lastSync,
            nextSync: nextSyncDate.toISOString(),
            stats: {
                created: stats.created,
                updated: stats.updated,
                failed: stats.failed,
                patUpdated: stats.patUpdated
            },
            isStale
        });

    } catch (error: any) {
        console.error('Error fetching sync status:', error);
        return NextResponse.json({ message: 'Error fetching sync status' }, { status: 500 });
    }
}
