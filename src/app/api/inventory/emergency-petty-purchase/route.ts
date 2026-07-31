import { apiHandler } from '@/lib/api-handler';
import { prisma } from '@/lib/prisma';
import { ROLE_GROUPS } from '@/config/roles';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

export const POST = apiHandler(async (request, _params, body) => {
  const requestId = body.requestId as string | undefined;
  const userId = request.headers.get('x-user-id') || 'SYSTEM';

  if (!requestId) {
    throw new Error('requestId is required');
  }

  // Mandatory $transaction for multi-table financial/stock write (financial integrity compliance)
  const result = await prisma.$transaction(async (tx) => {
    const stockReq = await tx.stockRequest.findUnique({
      where: { id: requestId },
      include: {
        fromStore: true,
        items: { include: { item: true } }
      }
    });

    if (!stockReq) {
      throw new Error(`Stock Request #${requestId} not found`);
    }

    const storeId = stockReq.fromStoreId || '';
    let totalVal = 0;
    const itemsProcessed = [];

    // Increment stock in the requesting store directly (Emergency GRN)
    for (const item of stockReq.items) {
      const qty = item.requestedQty ? Number(item.requestedQty) : 0;
      const unitPrice = item.item?.unitPrice ? Number(item.item.unitPrice) : 0;
      totalVal += qty * unitPrice;

      if (qty > 0) {
        // Upsert stock in store using InventoryStock model
        await tx.inventoryStock.upsert({
          where: {
            storeId_itemId: {
              storeId: storeId,
              itemId: item.itemId
            }
          },
          update: {
            quantity: { increment: qty }
          },
          create: {
            storeId: storeId,
            itemId: item.itemId,
            quantity: qty
          }
        });

        itemsProcessed.push({
          itemId: item.itemId,
          qty,
          unitPrice
        });
      }
    }

    // Generate Petty Cash Voucher record if amount > 0 and account exists
    let voucherId: string | undefined = undefined;
    if (totalVal > 0) {
      const pettyAccount = await tx.pettyCashAccount.findFirst();

      if (pettyAccount) {
        const voucher = await tx.pettyCashVoucher.create({
          data: {
            accountId: pettyAccount.id,
            voucherNumber: `EMG-VOUCHER-${Date.now().toString().slice(-6)}`,
            title: `Emergency Purchase for Requisition #${stockReq.requestNr}`,
            amount: totalVal,
            category: 'EMERGENCY_PURCHASE',
            description: `Emergency Fast-Track Purchase for Requisition #${stockReq.requestNr}`,
            status: 'APPROVED',
            approvedById: userId,
            createdById: stockReq.requestedById || undefined
          }
        });
        voucherId = voucher.id;
      }
    }

    // Update StockRequest status
    const updatedReq = await tx.stockRequest.update({
      where: { id: requestId },
      data: {
        status: 'COMPLETED',
        workflowStage: 'EMERGENCY_FULFILLED',
        remarks: `${stockReq.remarks || ''} [Emergency Fast-Track Fulfilled. Voucher: ${voucherId || 'N/A'}]`
      }
    });

    // Write SHA-256 Checksum Audit Ledger Entry
    const checksumStr = `${updatedReq.id}_${storeId}_${totalVal}_${Date.now()}`;
    const hash = crypto.createHash('sha256').update(checksumStr).digest('hex');

    if (itemsProcessed.length > 0) {
      await tx.inventoryLedger.create({
        data: {
          storeId: storeId,
          itemId: itemsProcessed[0].itemId,
          transactionType: 'EMERGENCY_LOCAL_PURCHASE',
          referenceType: 'STOCK_REQUEST',
          referenceId: stockReq.id,
          quantityBefore: 0,
          quantityChange: itemsProcessed[0].qty,
          quantityAfter: itemsProcessed[0].qty,
          unitPrice: itemsProcessed[0].unitPrice,
          totalValue: itemsProcessed[0].qty * itemsProcessed[0].unitPrice,
          performedById: userId,
          checksum: hash
        }
      });
    }

    return {
      success: true,
      requestNr: updatedReq.requestNr,
      itemsCount: itemsProcessed.length,
      totalAmount: totalVal,
      voucherId
    };
  });

  return result;
}, {
  roles: ROLE_GROUPS.MATERIAL_REQUESTERS,
  audit: { action: 'EMERGENCY_FULFILL', entity: 'STOCK_REQUEST' },
  rawResponse: true
});
