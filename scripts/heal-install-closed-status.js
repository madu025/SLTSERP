const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

const ACTIVE = ['PENDING', 'INPROGRESS', 'PROV_CLOSED', 'ASSIGNED', 'ASSIGN', 'OFFLINE'];

async function main() {
    const stale = await p.serviceOrder.findMany({
        where: {
            sltsStatus: 'INSTALL_CLOSED',
            status: { in: ACTIVE }
        },
        select: { soNum: true, status: true, sltsStatus: true }
    });
    console.log('Stale rows:', JSON.stringify(stale));

    const res = await p.serviceOrder.updateMany({
        where: { sltsStatus: 'INSTALL_CLOSED', status: { in: ACTIVE } },
        data: { status: 'INSTALL_CLOSED' }
    });
    console.log('Healed:', res.count);
}

main().catch(console.error).finally(() => p.$disconnect());
