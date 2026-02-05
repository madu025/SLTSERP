
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    const order = await prisma.serviceOrder.findFirst({
        where: { voiceNumber: '0112418928' }
    });
    if (!order) {
        console.log("Order not found");
        return;
    }
    console.log("Order SO:", order.soNum);
    console.log("Contractor ID:", order.contractorId);
    console.log("Team ID:", order.teamId);
}

main().catch(console.error).finally(() => prisma.$disconnect());
