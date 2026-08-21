import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();

async function main() {
    try {
        // Test the exact query from getSidebarCounts
        const userId = '019fc74b-12aa-0ef0-4166-64d59b99ad29';
        
        const groupedCounts = await p.$queryRawUnsafe(`
            SELECT
                COUNT(*) FILTER (WHERE link LIKE '/projects%')::int          AS "approvals",
                COUNT(*) FILTER (WHERE link LIKE '/helpdesk%')::int          AS "helpdesk",
                COUNT(*) FILTER (WHERE link LIKE '/admin/inventory%')::int   AS "procurement",
                COUNT(*) FILTER (WHERE link LIKE '/admin/contractors%')::int AS "contractors",
                COUNT(*) FILTER (WHERE link LIKE '/inventory/approvals%')::int AS "material",
                COUNT(*) FILTER (WHERE link LIKE '/service-orders%')::int    AS "serviceOrders"
            FROM "Notification"
            WHERE "userId" = $1::uuid AND "isRead" = false
        `, userId);
        
        console.log('Query OK:', groupedCounts);
    } catch (e: any) {
        console.error('Query ERROR:', e.message);
        console.error('Full error:', e);
    }
    
    await p.$disconnect();
}
main();
