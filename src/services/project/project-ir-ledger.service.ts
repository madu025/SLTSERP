import { AppError } from '@/lib/error';
import { prisma } from '@/lib/prisma';
import { StockService } from '../inventory/stock.service';
import { AuditLedgerService } from '../inventory/audit-ledger.service';

export interface IRLedgerEntry {
  irNumber: string;
  itemId: string;
  itemCode: string;
  itemName: string;
  itemCategory: string;
  itemUnit: string;
  receivedQty: number;
  issuedQty: number;
  returnedQty: number;
  transferredOutQty: number;
  transferredInQty: number;
  wastedQty: number;
  sltReturnedQty: number;
  leftoverQty: number;
  projectId?: string;
  projectName?: string;
  wastageRate?: number;
  boqPlannedQty?: number;
  boqVarianceRate?: number;
}

export class ProjectIRLedgerService {
  static async getIRLedgerHistory(irNumber: string) {
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

  static async getIRLedgerMeta() {
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
  /**
   * Helper to verify project status inside a transaction context.
   */
  
  static async verifyProjectStatus(tx: any, projectId: string) {
    const proj = await tx.project.findUnique({
      where: { id: projectId },
      select: { name: true, status: true }
    });
    if (!proj) {
      throw AppError.badRequest('PROJECT_NOT_FOUND: The target project does not exist.');
    }
    if (proj.status === 'COMPLETED' || proj.status === 'CANCELLED') {
      throw AppError.badRequest(`INVALID_PROJECT_STATUS: Project "${proj.name}" is ${proj.status}. Material transactions are only allowed for active projects.`);
    }
  }

  /**
   * Helper to verify leftover quantity inside a Prisma transaction context.
   */
  static async verifyProjectLeftover(
    
    tx: any,
    projectId: string,
    itemId: string,
    batchId: string,
    requiredQty: number
  ): Promise<number> {
    const txItems = await tx.inventoryTransactionItem.findMany({
      where: {
        itemId,
        batchId,
        transaction: {
          referenceId: projectId,
          type: {
            in: [
              'PROJECT_ISSUE',
              'PROJECT_RETURN',
              'PROJECT_TRANSFER_OUT',
              'PROJECT_TRANSFER_IN',
              'WASTAGE',
              'SLT_RETURN'
            ]
          }
        }
      },
      include: { transaction: true }
    });

    let projectIssued = 0;
    let projectReturned = 0;
    let projectTransferredOut = 0;
    let projectTransferredIn = 0;
    let projectWasted = 0;
    let projectSLTReturned = 0;

    for (const txi of txItems) {
      const qty = Number(txi.quantity);
      switch (txi.transaction.type) {
        case 'PROJECT_ISSUE':
          projectIssued += qty;
          break;
        case 'PROJECT_RETURN':
          projectReturned += qty;
          break;
        case 'PROJECT_TRANSFER_OUT':
          projectTransferredOut += qty;
          break;
        case 'PROJECT_TRANSFER_IN':
          projectTransferredIn += qty;
          break;
        case 'WASTAGE':
          projectWasted += qty;
          break;
        case 'SLT_RETURN':
          projectSLTReturned += qty;
          break;
      }
    }
    const projectReceived = projectIssued + projectTransferredIn;
    const leftover = projectReceived - projectReturned - projectTransferredOut - projectWasted - projectSLTReturned;

    if (leftover < requiredQty) {
      throw AppError.badRequest(`INSUFFICIENT_PROJECT_STOCK: The source project has only ${leftover} units left of this batch, but ${requiredQty} was requested.`);
    }

    return leftover;
  }

  /**
   * Computes the IR Material Ledger balances grouped by IR Number and Item Code.
   * If a projectId is provided, returns the ledger specifically for that project.
   */
  static async getIRLedger(projectId?: string): Promise<IRLedgerEntry[]> {
    // 1. Fetch all inventory batches that have an associated GRN and IR reference number
    const batches = await prisma.inventoryBatch.findMany({
      include: {
        grn: true,
        item: true,
      },
      where: {
        grn: {
          reference: { not: null }
        }
      }
    });

    // 2. Fetch all project material transaction items
    const txItems = await prisma.inventoryTransactionItem.findMany({
      include: {
        transaction: true,
        batch: {
          include: { grn: true }
        }
      },
      where: {
        batchId: { not: null },
        transaction: {
          type: {
            in: [
              'PROJECT_ISSUE', 
              'PROJECT_RETURN', 
              'PROJECT_TRANSFER_OUT', 
              'PROJECT_TRANSFER_IN', 
              'WASTAGE', 
              'SLT_RETURN'
            ]
          },
          ...(projectId ? { referenceId: projectId } : {})
        }
      }
    });

    // Fetch projects to map names
    const projects = await prisma.project.findMany({
      select: { id: true, name: true }
    });
    const projectMap = new Map(projects.map(p => [p.id, p.name]));

    // Fetch BOQ planned quantities to compare budget vs actual
    const boqItems = projectId ? await prisma.projectBOQItem.findMany({
      where: { projectId }
    }) : [];
    const boqPlannedMap = new Map<string, number>();
    for (const item of boqItems) {
      if (item.materialId) {
        boqPlannedMap.set(item.materialId, item.quantity);
      }
      boqPlannedMap.set(item.itemCode, item.quantity);
    }

    const ledgerMap = new Map<string, IRLedgerEntry>();

    // Initialise ledger entries from batches (represents the original received quantities)
    for (const batch of batches) {
      const irNumber = batch.grn?.reference || 'UNKNOWN-IR';
      const key = `${irNumber}_${batch.itemId}_${projectId || 'GLOBAL'}`;

      if (!ledgerMap.has(key)) {
        ledgerMap.set(key, {
          irNumber,
          itemId: batch.itemId,
          itemCode: batch.item.code,
          itemName: batch.item.name,
          itemCategory: batch.item.category,
          itemUnit: batch.item.unit,
          receivedQty: 0,
          issuedQty: 0,
          returnedQty: 0,
          transferredOutQty: 0,
          transferredInQty: 0,
          wastedQty: 0,
          sltReturnedQty: 0,
          leftoverQty: 0,
          projectId: projectId || undefined,
          projectName: projectId ? (projectMap.get(projectId) || 'Unknown Project') : undefined
        });
      }

      const entry = ledgerMap.get(key)!;
      // If we are looking globally, receivedQty is the batch's initial received quantity
      if (!projectId) {
        entry.receivedQty += Number(batch.initialQty);
      }
    }

    // Populate transaction movements
    for (const txi of txItems) {
      const irNumber = txi.batch?.grn?.reference || 'UNKNOWN-IR';
      const txiProjectId = txi.transaction.referenceId || 'GLOBAL';
      const targetProjId = projectId || txiProjectId;
      const key = `${irNumber}_${txi.itemId}_${targetProjId}`;

      if (!ledgerMap.has(key)) {
        const item = await prisma.inventoryItem.findUnique({ where: { id: txi.itemId } });
        ledgerMap.set(key, {
          irNumber,
          itemId: txi.itemId,
          itemCode: item?.code || 'UNKNOWN',
          itemName: item?.name || 'Unknown Item',
          itemCategory: item?.category || 'OTHERS',
          itemUnit: item?.unit || 'Nos',
          receivedQty: 0,
          issuedQty: 0,
          returnedQty: 0,
          transferredOutQty: 0,
          transferredInQty: 0,
          wastedQty: 0,
          sltReturnedQty: 0,
          leftoverQty: 0,
          projectId: targetProjId !== 'GLOBAL' ? targetProjId : undefined,
          projectName: targetProjId !== 'GLOBAL' ? (projectMap.get(targetProjId) || 'Unknown Project') : undefined
        });
      }

      const entry = ledgerMap.get(key)!;
      const qty = Number(txi.quantity);

      switch (txi.transaction.type) {
        case 'PROJECT_ISSUE':
          entry.issuedQty += qty;
          break;
        case 'PROJECT_RETURN':
          entry.returnedQty += qty;
          break;
        case 'PROJECT_TRANSFER_OUT':
          entry.transferredOutQty += qty;
          break;
        case 'PROJECT_TRANSFER_IN':
          entry.transferredInQty += qty;
          break;
        case 'WASTAGE':
          entry.wastedQty += qty;
          break;
        case 'SLT_RETURN':
          entry.sltReturnedQty += qty;
          break;
      }
    }

    // Compute final leftover quantities and wastage rate for each entry
    const entries = Array.from(ledgerMap.values());
    for (const entry of entries) {
      if (projectId) {
        // For a single project context, Received is what was issued to it or transferred in
        entry.receivedQty = entry.issuedQty + entry.transferredInQty;
        entry.leftoverQty = entry.receivedQty - entry.returnedQty - entry.transferredOutQty - entry.wastedQty - entry.sltReturnedQty;
      } else {
        // For global context
        entry.leftoverQty = entry.receivedQty - entry.wastedQty - entry.sltReturnedQty;
      }

      // Round everything to prevent floats precision issues
      entry.receivedQty = StockService.round(entry.receivedQty);
      entry.issuedQty = StockService.round(entry.issuedQty);
      entry.returnedQty = StockService.round(entry.returnedQty);
      entry.transferredOutQty = StockService.round(entry.transferredOutQty);
      entry.transferredInQty = StockService.round(entry.transferredInQty);
      entry.wastedQty = StockService.round(entry.wastedQty);
      entry.sltReturnedQty = StockService.round(entry.sltReturnedQty);
      entry.leftoverQty = StockService.round(entry.leftoverQty);

      // Compute wastage rate
      entry.wastageRate = entry.receivedQty > 0
        ? StockService.round((entry.wastedQty / entry.receivedQty) * 100)
        : 0;

      // Compute BOQ variance (estimation vs actual consumption)
      entry.boqPlannedQty = boqPlannedMap.get(entry.itemId) || boqPlannedMap.get(entry.itemCode) || 0;
      entry.boqVarianceRate = entry.boqPlannedQty > 0
        ? StockService.round((entry.issuedQty / entry.boqPlannedQty) * 100)
        : 0;
    }

    return entries.filter(e => e.receivedQty > 0 || e.issuedQty > 0 || e.leftoverQty > 0);
  }

  /**
   * Records a Material Inspection Receipt (IR) from SLT.
   * This creates a Goods Receipt Note (GRN) and seeds new batches into store inventory.
   */
  static async recordIRReceipt(data: {
    irNumber: string;
    storeId: string;
    receivedById: string;
    items: { itemId: string; quantity: number }[];
  }) {
    const { irNumber, storeId, receivedById, items } = data;

    return await prisma.$transaction(async (tx) => {
      // Create the GRN with an atomic document number
      const grnNumber = await AuditLedgerService.getNextDocumentNumber('GRN-IR', tx);
      const grn = await tx.gRN.create({
        data: {
          grnNumber,
          storeId,
          sourceType: 'SLT',
          receivedById,
          reference: irNumber,
          items: {
            create: items.map(i => {
              if (i.quantity <= 0) {
                throw AppError.badRequest('INVALID_QUANTITY: Received quantity must be greater than zero.');
              }
              return {
                itemId: i.itemId,
                quantity: i.quantity
              };
            })
          }
        },
        include: { items: true }
      });

      // Fetch item costs
      const itemIds = items.map(i => i.itemId);
      const itemsMeta = await tx.inventoryItem.findMany({
        where: { id: { in: itemIds } }
      });

      // Create batch and transaction for each item
      const txItems = [];

      for (const item of items) {
        const meta = itemsMeta.find(m => m.id === item.itemId);
        const costPrice = meta?.costPrice || 0;
        const unitPrice = meta?.unitPrice || 0;

        // Create Batch
        const batch = await tx.inventoryBatch.create({
          data: {
            batchNumber: `BAT-IR-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            itemId: item.itemId,
            grnId: grn.id,
            initialQty: item.quantity,
            costPrice,
            unitPrice
          }
        });

        // Add to Store Batch Stock
        await tx.inventoryBatchStock.upsert({
          where: {
            storeId_batchId: {
              storeId,
              batchId: batch.id
            }
          },
          update: {
            quantity: { increment: item.quantity }
          },
          create: {
            storeId,
            itemId: item.itemId,
            batchId: batch.id,
            quantity: item.quantity
          }
        });

        // Add to Store Stock overall
        const existingStock = await tx.inventoryStock.findUnique({
          where: { storeId_itemId: { storeId, itemId: item.itemId } }
        });
        const quantityBefore = existingStock ? Number(existingStock.quantity) : 0;

        await tx.inventoryStock.upsert({
          where: {
            storeId_itemId: {
              storeId,
              itemId: item.itemId
            }
          },
          update: {
            quantity: { increment: item.quantity }
          },
          create: {
            storeId,
            itemId: item.itemId,
            quantity: item.quantity
          }
        });

        // Write Immutable Inventory Ledger Entry for the IR receipt
        await AuditLedgerService.recordEntry({
          storeId,
          itemId: item.itemId,
          batchId: batch.id,
          transactionType: 'GRN_RECEIPT',
          referenceType: 'GRN',
          referenceId: grn.id,
          quantityBefore,
          quantityChange: item.quantity,
          quantityAfter: quantityBefore + item.quantity,
          unitPrice: Number(costPrice),
          performedById: receivedById,
          idempotencyKey: `grn-ir-${grn.id}-${item.itemId}-${batch.id}`
        }, tx);

        txItems.push({
          itemId: item.itemId,
          quantity: item.quantity,
          batchId: batch.id
        });
      }

      // Log inventory transaction
      await tx.inventoryTransaction.create({
        data: {
          type: 'GRN_IR',
          storeId,
          referenceId: grn.id,
          notes: `IR Receipt: ${irNumber}`,
          userId: receivedById,
          items: {
            create: txItems
          }
        }
      });

      return grn;
    });
  }

  /**
   * Issues materials from an IR Batch to a Project.
   */
  static async recordProjectIssue(data: {
    projectId: string;
    storeId: string;
    batchId: string;
    itemId: string;
    quantity: number;
    userId: string;
    remarks?: string;
    contractorId?: string;
  }) {
    const { projectId, storeId, batchId, itemId, quantity, userId, remarks, contractorId } = data;

    if (quantity <= 0) {
      throw AppError.badRequest('INVALID_QUANTITY: Issue quantity must be greater than zero.');
    }

    return await prisma.$transaction(async (tx) => {
      // Validate Project Lifecycle Status
      await ProjectIRLedgerService.verifyProjectStatus(tx, projectId);

      // Verify BOQ Budget Limit Constraint (Enforce max 120% of planned BOQ)
      const boqItem = await tx.projectBOQItem.findFirst({
        where: { projectId, materialId: itemId }
      });
      if (boqItem) {
        const currentIssued = await tx.inventoryTransactionItem.aggregate({
          where: {
            itemId,
            transaction: {
              referenceId: projectId,
              type: 'PROJECT_ISSUE'
            }
          },
          _sum: { quantity: true }
        });
        const totalIssuedSoFar = Number(currentIssued._sum.quantity || 0) + quantity;
        const limit = Number(boqItem.quantity) * 1.20; // 120% budget ceiling
        if (totalIssuedSoFar > limit) {
          throw AppError.badRequest(`BOQ_LIMIT_EXCEEDED: Cumulative issued quantity (${totalIssuedSoFar}) exceeds the 120% BOQ budget ceiling (${limit}) for this item. Issue rejected.`);
        }
      }

      // Fetch project name for recipientName constraint
      const proj = await tx.project.findUnique({
        where: { id: projectId },
        select: { name: true, contractorId: true }
      });
      const recipientName = proj ? `Project: ${proj.name}` : 'Unknown Project';

      // Check & deduct store batch stock
      const bStock = await tx.inventoryBatchStock.findUnique({
        where: { storeId_batchId: { storeId, batchId } }
      });

      if (!bStock || Number(bStock.quantity) < quantity) {
        throw AppError.badRequest('INSUFFICIENT_STOCK: Store does not have enough quantity for this IR batch.');
      }

      await tx.inventoryBatchStock.update({
        where: { id: bStock.id },
        data: { quantity: { decrement: quantity } }
      });

      // Overall stock decrement
      const overallStock = await tx.inventoryStock.findUnique({
        where: { storeId_itemId: { storeId, itemId } }
      });
      const stockBefore = overallStock ? Number(overallStock.quantity) : 0;

      await tx.inventoryStock.update({
        where: { storeId_itemId: { storeId, itemId } },
        data: { quantity: { decrement: quantity } }
      });

      // Create Stock Issue record with an atomic document number
      const issueNumber = await AuditLedgerService.getNextDocumentNumber('ISS-IR', tx);
      const issue = await tx.stockIssue.create({
        data: {
          issueNumber,
          storeId,
          issuedById: userId,
          issueType: 'PROJECT',
          projectId,
          recipientName,
          status: 'APPROVED',
          remarks: remarks || `Issued to project for IR plan`,
          items: {
            create: [{
              itemId,
              quantity
            }]
          }
        }
      });

      // Log ledger transaction
      const finalContractorId = contractorId || proj?.contractorId || 'UNKNOWN';
      await tx.inventoryTransaction.create({
        data: {
          type: 'PROJECT_ISSUE',
          storeId,
          referenceId: projectId,
          notes: `Contractor: ${finalContractorId} | Remarks: ${remarks || ''}`,
          userId,
          items: {
            create: [{
              itemId,
              quantity,
              batchId
            }]
          }
        }
      });

      // Write Immutable Inventory Ledger Entry for the project issue
      await AuditLedgerService.recordEntry({
        storeId,
        itemId,
        batchId,
        transactionType: 'PROJECT_ISSUE',
        referenceType: 'ProjectIR',
        referenceId: issue.id,
        quantityBefore: stockBefore,
        quantityChange: -quantity,
        quantityAfter: stockBefore - quantity,
        performedById: userId,
        idempotencyKey: `project-issue-${issue.id}-${itemId}`
      }, tx);

      return issue;
    });
  }

  /**
   * Returns leftover materials from a Project to Store under the original IR batch.
   */
  static async recordProjectReturn(data: {
    projectId: string;
    storeId: string;
    batchId: string;
    itemId: string;
    quantity: number;
    userId: string;
    remarks?: string;
  }) {
    const { projectId, storeId, batchId, itemId, quantity, userId, remarks } = data;

    if (quantity <= 0) {
      throw AppError.badRequest('INVALID_QUANTITY: Return quantity must be greater than zero.');
    }

    return await prisma.$transaction(async (tx) => {
      // Validate Project Status and leftover stock inside transaction context
      await ProjectIRLedgerService.verifyProjectStatus(tx, projectId);
      await ProjectIRLedgerService.verifyProjectLeftover(tx, projectId, itemId, batchId, quantity);

      // 1. Increment store batch stock
      await tx.inventoryBatchStock.upsert({
        where: { storeId_batchId: { storeId, batchId } },
        update: { quantity: { increment: quantity } },
        create: { storeId, itemId, batchId, quantity }
      });

      // Overall stock increment
      const currentStock = await tx.inventoryStock.findUnique({
        where: { storeId_itemId: { storeId, itemId } }
      });
      const stockBefore = currentStock ? Number(currentStock.quantity) : 0;

      await tx.inventoryStock.upsert({
        where: { storeId_itemId: { storeId, itemId } },
        update: { quantity: { increment: quantity } },
        create: { storeId, itemId, quantity }
      });

      // 2. Create project return record with an atomic document number
      const returnNumber = await AuditLedgerService.getNextDocumentNumber('RET-IR', tx);
      const ret = await tx.projectMaterialReturn.create({
        data: {
          returnNumber,
          projectId,
          storeId,
          returnedById: userId,
          status: 'APPROVED',
          reason: remarks || `Leftover return`,
          items: {
            create: [{
              itemId,
              quantity,
              condition: 'GOOD',
              remarks
            }]
          }
        }
      });

      // 3. Log ledger transaction
      await tx.inventoryTransaction.create({
        data: {
          type: 'PROJECT_RETURN',
          storeId,
          referenceId: projectId,
          notes: remarks || `Leftover returned to store`,
          userId,
          items: {
            create: [{
              itemId,
              quantity,
              batchId
            }]
          }
        }
      });

      // Write Immutable Inventory Ledger Entry for the project return
      await AuditLedgerService.recordEntry({
        storeId,
        itemId,
        batchId,
        transactionType: 'PROJECT_RETURN',
        referenceType: 'ProjectIR',
        referenceId: ret.id,
        quantityBefore: stockBefore,
        quantityChange: quantity,
        quantityAfter: stockBefore + quantity,
        performedById: userId,
        idempotencyKey: `project-return-${ret.id}-${itemId}`
      }, tx);

      return ret;
    });
  }

  /**
   * Transfers leftover materials from a source Project to a target Project.
   */
  static async recordProjectTransfer(data: {
    sourceProjectId: string;
    destProjectId: string;
    storeId: string;
    batchId: string;
    itemId: string;
    quantity: number;
    userId: string;
    remarks?: string;
  }) {
    const { sourceProjectId, destProjectId, storeId, batchId, itemId, quantity, userId, remarks } = data;

    if (quantity <= 0) {
      throw AppError.badRequest('INVALID_QUANTITY: Transfer quantity must be greater than zero.');
    }

    return await prisma.$transaction(async (tx) => {
      // Validate project status for both projects and verify source project leftover
      await ProjectIRLedgerService.verifyProjectStatus(tx, sourceProjectId);
      await ProjectIRLedgerService.verifyProjectStatus(tx, destProjectId);
      await ProjectIRLedgerService.verifyProjectLeftover(tx, sourceProjectId, itemId, batchId, quantity);

      // 1. Create Transfer OUT transaction for source project
      await tx.inventoryTransaction.create({
        data: {
          type: 'PROJECT_TRANSFER_OUT',
          storeId,
          referenceId: sourceProjectId,
          notes: remarks || `Transferred to project ${destProjectId}`,
          userId,
          items: {
            create: [{
              itemId,
              quantity,
              batchId
            }]
          }
        }
      });

      // 2. Create Transfer IN transaction for target project
      await tx.inventoryTransaction.create({
        data: {
          type: 'PROJECT_TRANSFER_IN',
          storeId,
          referenceId: destProjectId,
          notes: remarks || `Transferred from project ${sourceProjectId}`,
          userId,
          items: {
            create: [{
              itemId,
              quantity,
              batchId
            }]
          }
        }
      });

      return { success: true };
    });
  }

  /**
   * Logs material wastage in a Project.
   */
  static async recordWastage(data: {
    projectId: string;
    storeId: string;
    batchId: string;
    itemId: string;
    quantity: number;
    userId: string;
    remarks?: string;
    contractorId?: string;
  }) {
    const { projectId, storeId, batchId, itemId, quantity, userId, remarks, contractorId } = data;

    if (quantity <= 0) {
      throw AppError.badRequest('INVALID_QUANTITY: Wastage quantity must be greater than zero.');
    }

    return await prisma.$transaction(async (tx) => {
      // Validate Project Status and leftover stock
      await ProjectIRLedgerService.verifyProjectStatus(tx, projectId);
      await ProjectIRLedgerService.verifyProjectLeftover(tx, projectId, itemId, batchId, quantity);

      // Resolve a valid contractorId
      const proj = await tx.project.findUnique({
        where: { id: projectId },
        select: { contractorId: true }
      });
      const firstContractor = await tx.contractor.findFirst({ select: { id: true } });
      const resolvedContractorId = contractorId || proj?.contractorId || firstContractor?.id || 'UNKNOWN';

      // 1. Create Wastage record (ContractorWastage)
      const waste = await tx.contractorWastage.create({
        data: {
          contractorId: resolvedContractorId,
          storeId,
          month: new Date().toLocaleString('default', { month: 'long' }),
          status: 'APPROVED',
          description: remarks || 'Wastage reported during construction',
          items: {
            create: [{
              itemId,
              quantity,
              unit: 'm'
            }]
          }
        }
      });

      // 2. Log ledger transaction
      await tx.inventoryTransaction.create({
        data: {
          type: 'WASTAGE',
          storeId,
          referenceId: projectId,
          notes: `Contractor: ${resolvedContractorId} | Remarks: ${remarks || ''}`,
          userId,
          items: {
            create: [{
              itemId,
              quantity,
              batchId
            }]
          }
        }
      });

      return waste;
    });
  }

  /**
   * Logs material return directly back to SLT from a Project.
   */
  static async recordSLTReturn(data: {
    projectId: string;
    storeId: string;
    batchId: string;
    itemId: string;
    quantity: number;
    userId: string;
    gatepassNumber: string;
    remarks?: string;
  }) {
    const { projectId, storeId, batchId, itemId, quantity, userId, gatepassNumber, remarks } = data;

    if (quantity <= 0) {
      throw AppError.badRequest('INVALID_QUANTITY: Return to SLT quantity must be greater than zero.');
    }

    if (!gatepassNumber || gatepassNumber.trim() === '') {
      throw AppError.badRequest('MISSING_GATEPASS: A valid SLT gatepass reference number is required to log a return back to SLT.');
    }

    return await prisma.$transaction(async (tx) => {
      // Validate Project Status and leftover stock
      await ProjectIRLedgerService.verifyProjectStatus(tx, projectId);
      await ProjectIRLedgerService.verifyProjectLeftover(tx, projectId, itemId, batchId, quantity);

      // 1. Create MRN with an atomic document number (gatepass kept in reason/notes)
      const mrnNumber = await AuditLedgerService.getNextDocumentNumber('MRN-IR', tx);
      const mrn = await tx.mRN.create({
        data: {
          mrnNumber,
          storeId,
          returnType: 'SLT',
          returnTo: 'SLT Warehouse',
          status: 'APPROVED',
          reason: remarks ? `Gatepass: ${gatepassNumber} | ${remarks}` : `Gatepass: ${gatepassNumber} | Leftover material returned to SLT`,
          returnedById: userId,
          items: {
            create: [{
              itemId,
              quantity,
              reason: remarks
            }]
          }
        }
      });

      // 2. Log ledger transaction
      await tx.inventoryTransaction.create({
        data: {
          type: 'SLT_RETURN',
          storeId,
          referenceId: projectId,
          notes: `Gatepass: ${gatepassNumber} | Remarks: ${remarks || ''}`,
          userId,
          items: {
            create: [{
              itemId,
              quantity,
              batchId
            }]
          }
        }
      });

      return mrn;
    });
  }
}
