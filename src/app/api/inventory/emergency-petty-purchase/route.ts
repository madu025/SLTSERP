import { apiHandler } from '@/lib/api-handler';
import { prisma } from '@/lib/prisma';
import { AppError } from '@/lib/error';
import { ROLE_GROUPS } from '@/config/roles';
import { AuditLedgerService } from '@/services/inventory/audit-ledger.service';

export const dynamic = 'force-dynamic';

export const POST = apiHandler(async (request, _params, body) => {
  const requestId = body.requestId as string | undefined;
  const userId = request.headers.get('x-user-id') || 'SYSTEM';

  if (!requestId) {
    throw AppError.badRequest('requestId is required');
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
      throw AppError.notFound(`Stock Request #${requestId} not found`);
    }

    // Replay guard: a duplicate POST must not re-increment stock or re-create
    // the petty cash voucher. Fulfilled requests are rejected with 409.
    if (stockReq.status === 'COMPLETED' || stockReq.workflowStage === 'EMERGENCY_FULFILLED') {
      throw AppError.conflict('EMERGENCY_ALREADY_FULFILLED: This stock request has already been fulfilled via the emergency petty purchase flow.');
    }

    const storeId = stockReq.fromStoreId || '';
    let totalVal = 0;
    const itemsProcessed: { itemId: string; qty: number; unitPrice: number; quantityBefore: number; quantityAfter: number }[] = [];

    // Increment stock in the requesting store directly (Emergency GRN)
    for (const item of stockReq.items) {
      const qty = item.requestedQty ? Number(item.requestedQty) : 0;
      const unitPrice = item.item?.unitPrice ? Number(item.item.unitPrice) : 0;
      totalVal += qty * unitPrice;

      if (qty > 0) {
        // Capture the true pre-increment balance for the immutable ledger chain
        const existingStock = await tx.inventoryStock.findUnique({
          where: { storeId_itemId: { storeId, itemId: item.itemId } },
          select: { quantity: true }
        });
        const quantityBefore = existingStock ? Number(existingStock.quantity) : 0;

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
          unitPrice,
          quantityBefore,
          quantityAfter: quantityBefore + qty
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

    // Write immutable SHA-256 chained ledger entries via the ONLY approved
    // ledger write path (AuditLedgerService.recordEntry) — one entry per item
    // with the true quantityBefore read from current stock.
    for (const processed of itemsProcessed) {
      await AuditLedgerService.recordEntry({
        storeId,
        itemId: processed.itemId,
        transactionType: 'EMERGENCY_LOCAL_PURCHASE',
        referenceType: 'StockRequest',
        referenceId: stockReq.id,
        quantityBefore: processed.quantityBefore,
        quantityChange: processed.qty,
        quantityAfter: processed.quantityAfter,
        unitPrice: processed.unitPrice,
        performedById: userId,
        idempotencyKey: `emergency-petty-${stockReq.id}-${processed.itemId}`
      }, tx);
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
