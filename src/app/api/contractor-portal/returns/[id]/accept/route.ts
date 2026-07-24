import { apiHandler } from '@/lib/api-handler';
import { prisma } from '@/lib/prisma';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

// POST /api/contractor-portal/returns/[id]/accept - Storekeeper fine-tunes & accepts MRN return request
export const POST = apiHandler(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;
    const body = await req.json();
    const { acceptedQuantity, storekeeperNotes } = body;

    const returnRecord = await prisma.contractorMaterialReturn.findUnique({
        where: { id },
        include: { items: true, contractor: true }
    });

    if (!returnRecord) {
        throw new Error('Material return request not found');
    }

    const userId = req.headers.get('x-user-id');

    // Update Return Items with fine-tuned accepted quantity
    for (const item of returnRecord.items) {
        const finalAcceptedQty = acceptedQuantity !== undefined ? Number(acceptedQuantity) : item.quantity;
        
        await prisma.contractorMaterialReturnItem.update({
            where: { id: item.id },
            data: { acceptedQuantity: finalAcceptedQty }
        });

        // Deduct accepted quantity from Contractor Virtual Stock
        await prisma.contractorStock.updateMany({
            where: {
                contractorId: returnRecord.contractorId,
                itemId: item.itemId,
            },
            data: {
                quantity: { decrement: finalAcceptedQty }
            }
        });
    }

    // Update Return Status to ACCEPTED
    const updatedReturn = await prisma.contractorMaterialReturn.update({
        where: { id },
        data: {
            status: 'ACCEPTED',
            acceptedBy: userId || 'Storekeeper Supervisor',
            acceptedAt: new Date(),
            reason: storekeeperNotes || returnRecord.reason,
        },
        include: { items: { include: { item: true } }, store: true }
    });

    // Create Audit Ledger Entry
    const checksum = crypto
        .createHash('sha256')
        .update(`${updatedReturn.id}:RETURN_ACCEPTED:${Date.now()}`)
        .digest('hex');

    await prisma.inventoryLedger.create({
        data: {
            storeId: returnRecord.storeId,
            transactionType: 'CONTRACTOR_RETURN',
            referenceType: 'ContractorMaterialReturn',
            referenceId: updatedReturn.id,
            itemId: returnRecord.items[0]?.itemId || '',
            performedById: userId || 'STOREKEEPER',
            quantityBefore: 0,
            quantityChange: returnRecord.items[0]?.quantity || 0,
            quantityAfter: 0,
            checksum,
        }
    });

    return updatedReturn;
}, {
    roles: ['SUPER_ADMIN', 'ADMIN', 'STORES_MANAGER', 'CONTRACTOR_SUPERVISOR'],
});
