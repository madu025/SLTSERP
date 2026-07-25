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
            status: 'INSTALL_CLOSED'
        },
        select: {
            soNum: true,
            createdAt: true,
            statusDate: true,
            sltsStatus: true,
            status: true
        }
    });

    console.log(`Found ${installClosed.length} total orders with status='INSTALL_CLOSED' for R-KX.`);
    
    const bySltsStatus = installClosed.reduce((acc, order) => {
        acc[order.sltsStatus] = (acc[order.sltsStatus] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);

    console.log("Distribution by sltsStatus:", bySltsStatus);

    if (installClosed.length > 0) {
        console.log("Sample:");
        console.table(installClosed.slice(0, 10));
    }
}
debug();
