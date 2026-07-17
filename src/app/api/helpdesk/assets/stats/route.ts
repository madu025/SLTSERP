import { apiHandler } from "@/lib/api-handler";
import { prisma } from "@/lib/prisma";

export const dynamic = 'force-dynamic';

export const GET = apiHandler(async () => {
  const counts = await prisma.iTAsset.groupBy({
    by: ['status'],
    _count: {
      id: true
    }
  });

  const stats = {
    total: 0,
    ACTIVE: 0,
    SPARE: 0,
    UNDER_REPAIR: 0,
    FAULTY: 0,
    DECOMMISSIONED: 0,
    DISPOSED: 0,
    TRANSFERRED: 0
  };

  for (const c of counts) {
    const status = c.status;
    const count = c._count.id;
    if (status in stats) {
      (stats as any)[status] = count;
    }
    stats.total += count;
  }

  return stats;
});
