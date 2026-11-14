import { prisma } from '@/lib/prisma';
import { getAccessibleProjectIds } from '@/lib/project-record-access';
import { SodPerformanceService } from '@/services/service-order/sod-performance.service';
import { SPI_ALERT_THRESHOLD } from '@/lib/project-evm';
import { centroid, isPlausibleLocation, pinLevel, type OpsOverlay, type OpsProjectPin, type OpsBacklogMarker } from '@/lib/gis-ops-shared';

const FINISHED = ['COMPLETED', 'CANCELLED', 'SLT_PAT_PASSED', 'PRE_PAT_PASSED'];

/**
 * Operational layer for the national map: where the troubled projects are, and where the backlog sits.
 *
 * Service orders and OPMCs carry no coordinates, so positions are derived: a project sits at the mean of its surveyed
 * poles (or recorded assets), and an RTOM's backlog marker sits at the mean of that RTOM's located projects. The
 * backlog positions are therefore approximate and are labelled so. Nothing is geocoded or guessed beyond that.
 */
export class GisOpsOverlayService {
    static async getOverlay(userId: string | null | undefined, includeBacklog: boolean, now = new Date()): Promise<OpsOverlay> {
        const accessible = await getAccessibleProjectIds(userId);
        const projects = await prisma.project.findMany({
            where: { status: { notIn: FINISHED as never[] }, ...(accessible ? { id: { in: [...accessible] } } : {}) },
            select: { id: true, name: true, projectCode: true, status: true, endDate: true, budget: true, actualCost: true, opmcId: true, evm: { select: { spi: true } } },
        });
        const ids = projects.map((p) => p.id);

        const [poles, assets] = ids.length === 0 ? [[], []] : await Promise.all([
            prisma.$queryRawUnsafe<{ pid: string; lat: number; lng: number; n: bigint | number }[]>(
                `SELECT r."projectId"::text AS pid, avg(gp."latitude")::float AS lat, avg(gp."longitude")::float AS lng, count(*) AS n
                 FROM "GISPole" gp JOIN "GISRoute" r ON r."id" = gp."routeId"
                 WHERE r."projectId" = ANY($1::uuid[]) GROUP BY 1`, ids,
            ),
            prisma.$queryRawUnsafe<{ pid: string; lat: number; lng: number; n: bigint | number }[]>(
                `SELECT "projectId"::text AS pid, avg("latitude")::float AS lat, avg("longitude")::float AS lng, count(*) AS n
                 FROM "ProjectAsset" WHERE "projectId" = ANY($1::uuid[]) AND "latitude" IS NOT NULL AND "longitude" IS NOT NULL GROUP BY 1`, ids,
            ),
        ]);
        const at = new Map<string, { lat: number; lng: number; n: number; source: 'POLES' | 'ASSETS' }>();
        for (const a of assets) at.set(a.pid, { lat: a.lat, lng: a.lng, n: Number(a.n), source: 'ASSETS' });
        for (const p of poles) at.set(p.pid, { lat: p.lat, lng: p.lng, n: Number(p.n), source: 'POLES' }); // surveyed poles win

        const pins: OpsProjectPin[] = [];
        for (const p of projects) {
            const loc = at.get(p.id);
            if (!loc || !isPlausibleLocation(loc.lat, loc.lng)) continue;
            const delayed = !!p.endDate && p.endDate < now;
            const budget = Number(p.budget ?? 0);
            const overBudget = budget > 0 && Number(p.actualCost ?? 0) > budget;
            const spi = p.evm?.spi === null || p.evm?.spi === undefined ? null : Number(p.evm.spi);
            const { level, reasons } = pinLevel({ delayed, overBudget, spi }, SPI_ALERT_THRESHOLD);
            pins.push({ projectId: p.id, name: p.name, projectCode: p.projectCode, status: p.status, lat: loc.lat, lng: loc.lng, source: loc.source, pointCount: loc.n, delayed, overBudget, spi, level, reasons });
        }
        const order = { critical: 0, warning: 1, ok: 2 } as const;
        pins.sort((a, b) => order[a.level] - order[b.level]);

        const backlog: OpsBacklogMarker[] = [];
        if (includeBacklog) {
            const [perf, opmcs] = await Promise.all([
                SodPerformanceService.getReport(userId, new Date(now.getTime() - 30 * 86400000), now, now),
                prisma.oPMC.findMany({ select: { id: true, rtom: true } }),
            ]);
            const rtomOf = new Map(opmcs.map((o) => [o.id, o.rtom]));
            const byRtom = new Map<string, { lat: number; lng: number }[]>();
            for (const p of projects) {
                const loc = at.get(p.id);
                const rtom = p.opmcId ? rtomOf.get(p.opmcId) : undefined;
                if (!loc || !rtom || !isPlausibleLocation(loc.lat, loc.lng)) continue;
                byRtom.set(rtom, [...(byRtom.get(rtom) ?? []), { lat: loc.lat, lng: loc.lng }]);
            }
            for (const a of perf.ageingByRtom) {
                const c = centroid(byRtom.get(a.key) ?? []);
                if (c && a.open > 0) backlog.push({ rtom: a.key, open: a.open, over14: a.over14, lat: c.lat, lng: c.lng, approximate: true });
            }
        }

        return {
            pins, backlog,
            coverage: { activeProjects: projects.length, located: pins.length },
            notes: [
                'A project is placed at the mean of its surveyed poles, or of its recorded assets when it has no poles. Projects with neither cannot be shown.',
                'Backlog circles are placed at the mean position of that RTOM\'s located projects: service orders carry no coordinates, so these positions are approximate.',
            ],
        };
    }
}
