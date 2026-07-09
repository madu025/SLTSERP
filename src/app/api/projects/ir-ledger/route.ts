import { prisma } from '@/lib/prisma';
import { apiHandler } from '@/lib/api-handler';
import { ProjectIRLedgerService } from '@/services/project-ir-ledger.service';

// GET: Fetch IR Ledger entries
export const GET = apiHandler(async (req) => {
  const { searchParams } = new URL(req.url);
  const history = searchParams.get('history') === 'true';
  const irNumber = searchParams.get('irNumber');
  if (history && irNumber) {
    const txItems = await prisma.inventoryTransactionItem.findMany({
      where: {
        batch: {
          grn: { reference: irNumber }
        }
      },
      include: {
        transaction: {
          include: {
            store: true
          }
        },
        item: true
      },
      orderBy: {
        transaction: { date: 'asc' }
      }
    });

    const projects = await prisma.project.findMany({
      select: { id: true, name: true, projectCode: true }
    });
    const projectMap = new Map(projects.map(p => [p.id, p.name]));

    return txItems.map(txi => ({
      id: txi.id,
      type: txi.transaction.type,
      date: txi.transaction.date,
      quantity: Number(txi.quantity),
      itemUnit: txi.item.unit,
      storeName: txi.transaction.store.name,
      notes: txi.transaction.notes,
      projectName: txi.transaction.referenceId ? (projectMap.get(txi.transaction.referenceId) || txi.transaction.referenceId) : undefined
    }));
  }

  const projectId = searchParams.get('projectId') || undefined;
  const ledger = await ProjectIRLedgerService.getIRLedger(projectId);

  const meta = searchParams.get('meta') === 'true';
  if (meta) {
    const projects = await prisma.project.findMany({
      select: { id: true, name: true, projectCode: true }
    });
    const stores = await prisma.inventoryStore.findMany({
      select: { id: true, name: true, type: true }
    });
    const items = await prisma.inventoryItem.findMany({
      select: { id: true, name: true, code: true, category: true, unit: true },
      where: {
        category: { in: ['Cables', 'Closures', 'PatchPanels'] }
      }
    });
    // Fetch all IR batches to map batchId for project operations
    const batches = await prisma.inventoryBatch.findMany({
      where: { grn: { reference: { not: null } } },
      include: {
        grn: true,
        item: true
      }
    });

    // Fetch physical store inventory (actual quantity > 0)
    const storeBatchStocks = await prisma.inventoryBatchStock.findMany({
      where: { quantity: { gt: 0 } },
      include: {
        batch: {
          include: { grn: true }
        },
        item: true
      }
    });

    const contractors = await prisma.contractor.findMany({
      select: { id: true, name: true }
    });

    return {
      ledger,
      projects,
      stores,
      items,
      contractors,
      batchStocks: batches.map(b => ({
        batchId: b.id,
        batchNumber: b.batchNumber || 'UNKNOWN',
        irNumber: b.grn?.reference || 'UNKNOWN',
        itemId: b.itemId,
        itemCode: b.item.code,
        itemName: b.item.name,
        quantity: 999999,
        storeId: b.grn?.storeId || ''
      })),
      storeBatchStocks: storeBatchStocks.map(sbs => ({
        batchId: sbs.batchId,
        batchNumber: sbs.batch.batchNumber || 'UNKNOWN',
        irNumber: sbs.batch.grn?.reference || 'UNKNOWN',
        itemId: sbs.itemId,
        itemCode: sbs.item.code,
        itemName: sbs.item.name,
        quantity: Number(sbs.quantity),
        storeId: sbs.storeId
      }))
    };
  }

  return ledger;
});

// POST: Record an incoming SLT IR Receipt
export const POST = apiHandler(async (req, _params, body) => {
  const userId = req.headers.get('x-user-id') || 'SYSTEM';

  const result = await ProjectIRLedgerService.recordIRReceipt({
    ...body,
    receivedById: userId
  });
  return result;
}, {
  roles: ['STORES_MANAGER', 'ADMIN', 'SUPER_ADMIN'],
  audit: { action: 'CREATE', entity: 'GRN' }
});
