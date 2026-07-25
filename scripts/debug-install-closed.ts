import { prisma } from '../src/lib/prisma';

async function debug() {
    const rkx = await prisma.oPMC.findFirst({
        where: { rtom: { equals: 'R-KX', mode: 'insensitive' } }
    });

    if (!rkx) {
        console.log("R-KX not found");
        return;
    }

    const installClosed = await prisma.serviceOrder.findMany({
        where: {
            opmcId: rkx.id,
            OR: [
                { sltsStatus: 'INSTALL_CLOSED' },
                { status: 'INSTALL_CLOSED' }
            ],
            sltsStatus: { notIn: ['COMPLETED', 'RETURN'] }
        },
        select: {
            soNum: true,
            createdAt: true,
            statusDate: true,
            sltsStatus: true,
            status: true
        }
    });

    console.log(`Found ${installClosed.length} install closed orders for R-KX.`);
    if (installClosed.length > 0) {
        console.log("Sample:");
        console.table(installClosed.slice(0, 10));
    }
}
debug();
