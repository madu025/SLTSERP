import { apiHandler } from '@/lib/api-handler';
import { prisma } from '@/lib/prisma';
import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';

export const dynamic = 'force-dynamic';

// GET /api/procurement/vendors/list
// Active vendors for the purchase-order and invoice screens. Procurement users can read the list without finance access;
// creating and editing vendors stays with finance (/api/vendors).
export const GET = apiHandler(async () => {
    const vendors = await prisma.vendor.findMany({
        where: { status: { equals: 'ACTIVE', mode: 'insensitive' } },
        select: { id: true, code: true, name: true, paymentTerms: true },
        orderBy: { name: 'asc' },
        take: 1000,
    });
    return vendors;
}, { permissions: [RBAC_PERMISSIONS.PROCUREMENT_READ] });
