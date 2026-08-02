import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log("Starting GRN Refactoring...");

    const grns = await prisma.gRN.findMany({
        where: { purchaseOrderId: null, requestId: { not: null } },
        include: {
            request: {
                include: {
                    purchaseOrders: {
                        include: { items: true }
                    }
                }
            },
            items: true
        }
    });

    console.log(`Found ${grns.length} GRNs to refactor.`);

    let updatedCount = 0;

    for (const grn of grns) {
        if (!grn.request || !grn.request.purchaseOrders || grn.request.purchaseOrders.length === 0) {
            continue;
        }

        let selectedPoId = grn.request.purchaseOrders[0].id;

        if (selectedPoId) {
            await prisma.gRN.update({
                where: { id: grn.id },
                data: { purchaseOrderId: selectedPoId }
            });
            console.log(`Updated GRN ${grn.grnNumber} with PO ID ${selectedPoId}`);
            updatedCount++;
        }
    }

    console.log(`Successfully refactored ${updatedCount} GRNs.`);
}

main()
    .catch(e => console.error(e))
    .finally(() => prisma.$disconnect());
