import { prisma } from '../src/lib/prisma';

async function checkOrder() {
    const order = await prisma.serviceOrder.findFirst({
        where: {
            OR: [
                { voiceNumber: '0112075137' },
                { soNum: '0112075137' },
                { voiceNumber: { contains: '0112075137' } },
                { soNum: { contains: '0112075137' } }
            ]
        },
        include: {
            contractor: true,
            team: true,
            opmc: true
        }
    });

    console.log("Order details:", JSON.stringify(order, null, 2));
}

checkOrder();
