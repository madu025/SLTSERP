import { AppError } from '@/lib/error';
import { prisma } from '@/lib/prisma';
import { safe } from '@/utils/safe-await.util';
import { GRN, Prisma } from '@prisma/client';
import { NotificationService } from '@/services/notification/notification.service';
import { emitSystemEvent } from '@/lib/events';
import { CreateGRNData, TransactionClient } from '@/types/inventory/inventory-service.types';
import { StockService } from './stock.service';
import { AuditLedgerService } from './audit-ledger.service';
import { StoreService } from './store.service';
import { LedgerService } from '../finance/ledger.service';
import { grnSchema } from '@/lib/validations/inventory.schema';
import { AuditService } from '@/services/audit/audit.service';
import { getProcurementConfig } from '@/services/procurement/procurement-config';
import { overReceiptCheck, poStatusFromReceipts, weightedAverageCost, normalizePoStatus } from '@/lib/procurement-rules';
import { ACCOUNTS } from '@/services/finance/account-codes';

export class GRNService {
    static async getGRNs(storeId?: string, allowedStoreIds?: string[]) {
        const where: Prisma.GRNWhereInput = storeId
            ? { storeId }
            : allowedStoreIds
                ? { storeId: { in: allowedStoreIds } }
                : {};
        return await prisma.gRN.findMany({
            where,
            include: {
                store: true,
                receivedBy: true,
                request: {
                    include: {
                        items: { include: { item: true } },
                        requestedBy: true,
                        approvedBy: true,
                        purchaseOrders: true
                    }
                },
                items: {
                    include: {
                        item: true,
                        batch: true
                    }
                }
            },
            orderBy: { createdAt: 'desc' }
        });
    }

    static async createGRN(data: CreateGRNData): Promise<GRN> {
        const { receivedById } = data;
        const parsed = grnSchema.safeParse(data);
        if (!parsed.success) {
            throw AppError.badRequest('INVALID_GRN_PAYLOAD');
        }

        const { storeId, sourceType, supplier, items, requestId: requestIdInput, purchaseOrderId, sltReferenceId, reference, documentUrl, oracleGrnNumber, vendorInvoiceNumber, vendorInvoiceDate, vendorInvoiceGoods, vendorInvoiceTax, vendorInvoiceUrl } = parsed.data;
        // a rejected quantity needs its reason (the goods go back to the vendor and are not paid)
        for (const i of items) if (Number(i.rejectedQty ?? 0) > 0 && (i.rejectReason ?? '').trim().length < 3) throw AppError.badRequest('GRN_REJECT_REASON_REQUIRED: give the reason for the rejected quantity');
        // A receipt against a PO is a receipt against that PO's stock request, even if the caller did not say so
        let requestId: string | null | undefined = requestIdInput;

        if (!receivedById?.trim()) {
            throw AppError.badRequest('RECEIVER_REQUIRED');
        }

        // Store-Scope Enforcement: caller must be authorized for the receiving store
        await StoreService.assertStoreWriteAccess(receivedById, storeId);

        return await prisma.$transaction(async (tx: TransactionClient) => {
            // Promote CUSTOM/Unregistered items to standard SLTS type
            const rawItemIds = items.map((i) => i.itemId);
            const dbItems = await tx.inventoryItem.findMany({
                where: { id: { in: rawItemIds } }
            });
            for (const dbItem of dbItems) {
                if (dbItem.type === 'CUSTOM' || dbItem.code.startsWith('UNREG-')) {
                    const newCode = `MAT-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;
                    await tx.inventoryItem.update({
                        where: { id: dbItem.id },
                        data: {
                            type: 'SLTS',
                            code: newCode,
                            description: dbItem.description
                                ? `${dbItem.description} (Registered via GRN)`
                                : `Registered via GRN`
                        }
                    });
                }
            }

            // 0. Purchase order checks: the PO must be open, belong to the request, and each line may only be received up to its balance
            const cfg = await getProcurementConfig(tx as unknown as typeof prisma);
            const poLineByItem = new Map<string, { id: string; quantity: number; receivedQty: number; unitPrice: number }>();
            let poId: string | null = null;
            let hoInvoiceFor: { poId: string; creditDays: number | null; paymentDueDate: Date | null } | null = null;
            if (purchaseOrderId) {
                const po = await tx.purchaseOrder.findUnique({
                    where: { id: purchaseOrderId },
                    include: { items: { include: { stockRequestItem: { select: { itemId: true } } } } },
                });
                if (!po) throw AppError.badRequest('PURCHASE_ORDER_NOT_FOUND');
                const poStatus = normalizePoStatus(po.status);
                if (poStatus === 'PENDING_APPROVAL') {
                    throw AppError.badRequest(`PURCHASE_ORDER_NOT_APPROVED: ${po.poNumber} is waiting for approval and cannot receive goods`);
                }
                if (poStatus === 'CANCELLED' || poStatus === 'CLOSED') {
                    throw AppError.badRequest(`PURCHASE_ORDER_NOT_OPEN: ${po.poNumber} is ${poStatus}`);
                }
                if (requestIdInput && requestIdInput !== po.stockRequestId) {
                    throw AppError.badRequest(`PURCHASE_ORDER_REQUEST_MISMATCH: ${po.poNumber} belongs to a different stock request`);
                }
                requestId = po.stockRequestId;
                poId = po.id;
                // an order approved in the HO system is received with its Oracle GRN number and the vendor's invoice for this delivery
                if (po.hoApprovalRef) {
                    if ((oracleGrnNumber ?? '').trim().length < 3) throw AppError.badRequest('ORACLE_GRN_NUMBER_REQUIRED: enter the GRN number from the Oracle system');
                    if ((vendorInvoiceNumber ?? '').trim().length < 1 || !vendorInvoiceDate || Number.isNaN(new Date(vendorInvoiceDate).getTime())) throw AppError.badRequest('VENDOR_INVOICE_REQUIRED: enter the vendor invoice number and date for this delivery');
                    if (!(Number(vendorInvoiceGoods) >= 0) || !(Number(vendorInvoiceTax ?? 0) >= 0)) throw AppError.badRequest('VENDOR_INVOICE_REQUIRED: enter the invoice goods value and tax');
                    if (!(vendorInvoiceUrl ?? '').trim()) throw AppError.badRequest('VENDOR_INVOICE_REQUIRED: attach the scanned vendor invoice');
                    hoInvoiceFor = { poId: po.id, creditDays: po.creditDays, paymentDueDate: po.paymentDueDate };
                }
                for (const l of po.items) {
                    poLineByItem.set(l.stockRequestItem.itemId, { id: l.id, quantity: Number(l.quantity), receivedQty: Number(l.receivedQty), unitPrice: Number(l.unitPrice) });
                }
                const receivingByItem = new Map<string, number>();
                for (const i of items) receivingByItem.set(i.itemId, (receivingByItem.get(i.itemId) ?? 0) + Number(i.quantity));
                for (const [itemId, qty] of receivingByItem) {
                    const line = poLineByItem.get(itemId);
                    if (!line) throw AppError.badRequest(`ITEM_NOT_ON_PURCHASE_ORDER: an item you are receiving is not on ${po.poNumber}`);
                    const check = overReceiptCheck(line.quantity, line.receivedQty, qty, cfg.overReceiptTolerancePct);
                    if (!check.ok) {
                        throw AppError.badRequest(`GRN_QUANTITY_EXCEEDS_PO: receiving ${qty} but only ${Number(check.remaining.toFixed(4))} remain on ${po.poNumber} for this item`);
                    }
                }
            }

            // 0b. One GRN for several purchase orders: every line names its PO line. Each PO must be approved and open, all from one vendor,
            //     the item must be the PO line's item, and each PO line may only be received up to its balance.
            const lineMode = items.some((i) => i.poItemId);
            const lineAlloc = new Map<number, { poItemId: string; poId: string; requestId: string; unitPrice: number }>();
            let vendorLabel: string | null = null;
            if (lineMode) {
                if (purchaseOrderId) throw AppError.badRequest('GRN_PO_MODE_CONFLICT: give either one purchase order for the whole GRN or a PO line on every line, not both');
                if (items.some((i) => !i.poItemId)) throw AppError.badRequest('GRN_PO_LINE_REQUIRED: when receiving against several purchase orders, every line must name its PO line');
                const ids = [...new Set(items.map((i) => i.poItemId as string))];
                const poLines = await tx.purchaseOrderItem.findMany({
                    where: { id: { in: ids } },
                    include: { purchaseOrder: { select: { id: true, poNumber: true, status: true, vendor: true, vendorId: true, stockRequestId: true, hoApprovalRef: true, stockRequest: { select: { fromStoreId: true } } } }, stockRequestItem: { select: { itemId: true } } },
                });
                const byId = new Map(poLines.map((l) => [l.id, l]));
                const vendors = new Set<string>();
                const receiving = new Map<string, number>();
                items.forEach((i, idx) => {
                    const l = byId.get(i.poItemId as string);
                    if (!l) throw AppError.badRequest('PURCHASE_ORDER_LINE_NOT_FOUND');
                    // an order approved in the HO system is received one PO per GRN, with the vendor's invoice for that delivery
                    if (l.purchaseOrder.hoApprovalRef) throw AppError.badRequest(`HO_ORDER_ONE_PO_PER_GRN: receive ${l.purchaseOrder.poNumber} on its own GRN with its vendor invoice`);
                    // the goods of an order are received into the store that raised it (the caller's access to that store was checked above)
                    if (l.purchaseOrder.stockRequest.fromStoreId !== storeId) throw AppError.forbidden(`PURCHASE_ORDER_LINE_NOT_IN_STORE: ${l.purchaseOrder.poNumber} belongs to another store`);
                    const st = normalizePoStatus(l.purchaseOrder.status);
                    if (st === 'PENDING_APPROVAL' || st === 'RETURNED') throw AppError.badRequest(`PURCHASE_ORDER_NOT_APPROVED: ${l.purchaseOrder.poNumber} is not approved and cannot receive goods`);
                    if (st === 'CANCELLED' || st === 'CLOSED') throw AppError.badRequest(`PURCHASE_ORDER_NOT_OPEN: ${l.purchaseOrder.poNumber} is ${st}`);
                    if (l.stockRequestItem.itemId !== i.itemId) throw AppError.badRequest(`ITEM_NOT_ON_PURCHASE_ORDER_LINE: the item does not match the line of ${l.purchaseOrder.poNumber}`);
                    vendors.add(l.purchaseOrder.vendorId ?? l.purchaseOrder.vendor);
                    vendorLabel = l.purchaseOrder.vendor;
                    receiving.set(l.id, (receiving.get(l.id) ?? 0) + Number(i.quantity));
                    lineAlloc.set(idx, { poItemId: l.id, poId: l.purchaseOrder.id, requestId: l.purchaseOrder.stockRequestId, unitPrice: Number(l.unitPrice) });
                });
                if (vendors.size > 1) throw AppError.badRequest('GRN_MIXED_VENDORS: one GRN receives the goods of one vendor; the purchase orders chosen are from different vendors');
                for (const [lineId, qty] of receiving) {
                    const l = byId.get(lineId)!;
                    const check = overReceiptCheck(Number(l.quantity), Number(l.receivedQty), qty, cfg.overReceiptTolerancePct);
                    if (!check.ok) throw AppError.badRequest(`GRN_QUANTITY_EXCEEDS_PO: receiving ${qty} but only ${Number(check.remaining.toFixed(4))} remain on ${l.purchaseOrder.poNumber} for this item`);
                }
            }
            const lineOf = (itemId: string, idx: number): { id: string; unitPrice: number } | undefined => {
                if (lineMode) { const a = lineAlloc.get(idx); return a ? { id: a.poItemId, unitPrice: a.unitPrice } : undefined; }
                return poLineByItem.get(itemId);
            };
            // a request with an order approved in the HO system is received per PO (with that PO's vendor invoice), never as a combined intake
            if (!poId && !lineMode && requestIdInput) {
                const hoOrders = await tx.purchaseOrder.count({ where: { stockRequestId: requestIdInput, hoApprovalRef: { not: null }, status: { not: 'CANCELLED' } } });
                if (hoOrders > 0) throw AppError.badRequest('HO_ORDER_PO_REQUIRED: choose the purchase order this delivery is for; each delivery is received against its own PO with its vendor invoice');
            }
            const poIdsTouched = lineMode ? [...new Set([...lineAlloc.values()].map((a) => a.poId))] : (poId ? [poId] : []);
            const requestIdsTouched = lineMode ? [...new Set([...lineAlloc.values()].map((a) => a.requestId))] : (requestId ? [requestId] : []);

            // 1. Create GRN with an atomic document number (its lines are written with their batch below, so the same item on two POs stays two lines)
            const grnNumber = await AuditLedgerService.getNextDocumentNumber('GRN', tx);
            const grn = await tx.gRN.create({
                data: {
                    grnNumber,
                    storeId,
                    sourceType,
                    supplier: supplier || vendorLabel,
                    receivedById,
                    requestId: lineMode ? (requestIdsTouched.length === 1 ? requestIdsTouched[0] : null) : (requestId || null),
                    purchaseOrderId: lineMode ? (poIdsTouched.length === 1 ? poIdsTouched[0] : null) : (purchaseOrderId || null),
                    reference: reference || sltReferenceId || null,
                    documentUrl: documentUrl || null,
                    oracleGrnNumber: oracleGrnNumber?.trim() || null,
                    vendorInvoiceNumber: vendorInvoiceNumber?.trim() || null,
                    vendorInvoiceDate: vendorInvoiceDate ? new Date(vendorInvoiceDate) : null,
                    vendorInvoiceGoods: vendorInvoiceGoods ?? null,
                    vendorInvoiceTax: vendorInvoiceTax ?? null,
                    vendorInvoiceUrl: vendorInvoiceUrl?.trim() || null,
                },
            });

            // 2. Fetch Item Metadata for Pricing
            const itemIds = items.map((i) => i.itemId);

            const itemMetadata = await tx.inventoryItem.findMany({
                where: { id: { in: itemIds } },
                select: { id: true, costPrice: true, unitPrice: true }
            });

            // 3. Update Stock & Create Batches
            const transactionItems: { itemId: string; quantity: number; batchId?: string }[] = [];
            let totalGrnCost = 0;

            for (const [idx, item] of items.entries()) {
                const qty = StockService.round(item.quantity);
                const poLine = lineOf(item.itemId, idx);

                const meta = itemMetadata.find((m) => m.id === item.itemId);
                const masterCost = Number(meta?.costPrice ?? 0);
                // The price actually paid: the PO line price when the receipt is against a PO, otherwise the item master cost
                const poPrice = poLine?.unitPrice ?? 0;
                const costPrice = poPrice > 0 ? poPrice : masterCost;
                totalGrnCost += costPrice * qty;
                const unitPrice = meta?.unitPrice || 0;

                // Weighted-average costing: the item cost follows what was paid, weighted by what is already on hand
                if (cfg.costingMethod === 'WEIGHTED_AVERAGE' && poPrice > 0) {
                    const onHand = await tx.inventoryStock.aggregate({ where: { itemId: item.itemId }, _sum: { quantity: true } });
                    const newCost = weightedAverageCost(Number(onHand._sum.quantity ?? 0), masterCost, qty, poPrice);
                    if (Math.abs(newCost - masterCost) >= 0.005) {
                        await tx.inventoryItem.update({ where: { id: item.itemId }, data: { costPrice: newCost } });
                        AuditService.log({
                            userId: receivedById, action: 'UPDATE_ITEM_COST', entity: 'InventoryItem', entityId: item.itemId,
                            oldValue: { costPrice: masterCost }, newValue: { costPrice: newCost, method: 'WEIGHTED_AVERAGE', grnNumber, receiptUnitCost: poPrice, receiptQty: qty },
                        }).catch(() => undefined);
                        if (meta) meta.costPrice = new Prisma.Decimal(newCost);
                    }
                }

                // A. Create Batch
                const lotNumber = await AuditLedgerService.getNextDocumentNumber('LOT', tx);
                const batch = await tx.inventoryBatch.create({
                    data: {
                        batchNumber: lotNumber, // Auto-incrementing Lot Number
                        itemId: item.itemId,
                        grnId: grn.id,
                        initialQty: qty,
                        costPrice: costPrice,
                        unitPrice: unitPrice,
                        expiryDate: item.expiryDate ? new Date(item.expiryDate) : null
                    }
                });

                // B. The GRN line, with its PO line, the price it was received at and its batch
                await tx.gRNItem.create({
                    data: { grnId: grn.id, itemId: item.itemId, quantity: qty, poItemId: poLine?.id ?? null, unitPrice: costPrice, batchId: batch.id, rejectedQty: Number(item.rejectedQty ?? 0), rejectReason: item.rejectReason?.trim() || null },
                });

                // C. Initialize Batch Stock in Store
                await tx.inventoryBatchStock.create({
                    data: {
                        storeId,
                        batchId: batch.id,
                        itemId: item.itemId,
                        quantity: qty,
                        ...(item.locator ? { locatorId: item.locator } : {})
                    }
                });

                // D. Update Store Stock Total
                const updatedStoreStock = await tx.inventoryStock.upsert({
                    where: {
                        storeId_itemId: {
                            storeId,
                            itemId: item.itemId
                        }
                    },
                    update: {
                        quantity: { increment: qty }
                    },
                    create: {
                        storeId,
                        itemId: item.itemId,
                        quantity: qty
                    }
                });

                // Write Immutable Inventory Ledger Entry
                const currentQtyAfter = updatedStoreStock?.quantity ? Number(updatedStoreStock.quantity) : 0;
                await AuditLedgerService.recordEntry({
                    storeId,
                    itemId: item.itemId,
                    batchId: batch.id,
                    transactionType: 'GRN_RECEIPT',
                    referenceType: 'GRN',
                    referenceId: grn.id,
                    quantityBefore: currentQtyAfter - qty,
                    quantityChange: qty,
                    quantityAfter: currentQtyAfter,
                    // The ledger carries cost (what the stock is worth), not the selling price
                    unitPrice: costPrice,
                    performedById: receivedById
                }, tx);

                transactionItems.push({
                    itemId: item.itemId,
                    quantity: qty,
                    batchId: batch.id
                });

                // D2. Serial-tracked items must arrive with exactly one distinct serial per unit
                const itemMeta = dbItems.find((d) => d.id === item.itemId);
                const snAll: string[] = (item.serials ?? []).map((s: string) => s.trim()).filter(Boolean);
                if (itemMeta?.hasSerial) {
                    if (snAll.length !== Number(qty)) {
                        throw AppError.badRequest(`SERIAL_COUNT_MISMATCH: ${itemMeta.name} needs ${qty} serial number(s), received ${snAll.length}`);
                    }
                    if (new Set(snAll).size !== snAll.length) {
                        throw AppError.badRequest(`DUPLICATE_SERIAL_IN_REQUEST: ${itemMeta.name} has repeated serial numbers`);
                    }
                }

                // E. If the item is serialized, upsert serial records in bulk
                if (item.serials && Array.isArray(item.serials) && item.serials.length > 0) {
                    const snList = item.serials.map((s: string) => s.trim()).filter(Boolean);
                    if (snList.length > 0) {
                        const existingSerials = await tx.inventoryItemSerial.findMany({
                            where: { serialNumber: { in: snList } }
                        });
                        const existingMap = new Map(existingSerials.map((s) => [s.serialNumber, s]));

                        const toUpdateIds: string[] = [];
                        const toCreateData: Prisma.InventoryItemSerialUncheckedCreateInput[] = [];

                        for (const sn of snList) {
                            const existing = existingMap.get(sn);
                            if (existing) {
                                // A serial that is in the store, issued or installed must not be received again
                                if (['IN_STORE', 'ISSUED', 'INSTALLED'].includes(existing.status)) {
                                    throw AppError.badRequest(`SERIAL_ALREADY_IN_USE: ${sn} is ${existing.status}`);
                                }
                                toUpdateIds.push(existing.id);
                            } else {
                                toCreateData.push({
                                    itemId: item.itemId,
                                    serialNumber: sn,
                                    status: 'IN_STORE',
                                    storeId,
                                    locator: item.locator || undefined
                                } as Prisma.InventoryItemSerialUncheckedCreateInput);
                            }
                        }

                        if (toCreateData.length > 0) {
                            await tx.inventoryItemSerial.createMany({
                                data: toCreateData
                            });
                        }

                        if (toUpdateIds.length > 0) {
                            await tx.inventoryItemSerial.updateMany({
                                where: { id: { in: toUpdateIds } },
                                data: {
                                    status: 'IN_STORE',
                                    storeId,
                                    contractorId: null,
                                    sodId: null,
                                    locator: item.locator || null
                                } as Prisma.InventoryItemSerialUncheckedUpdateInput
                            });
                        }
                    }
                }
            }

            // 3.1 Record what was received against each PO line and move the PO status with it (same transaction)
            if (lineMode) {
                const byLine = new Map<string, number>();
                items.forEach((i, idx) => { const a = lineAlloc.get(idx)!; byLine.set(a.poItemId, (byLine.get(a.poItemId) ?? 0) + Number(i.quantity)); });
                for (const [lineId, qty] of byLine) await tx.purchaseOrderItem.update({ where: { id: lineId }, data: { receivedQty: { increment: qty } } });
            } else if (poId) {
                for (const [itemId, line] of poLineByItem) {
                    const qty = items.filter((i) => i.itemId === itemId).reduce((a, i) => a + Number(i.quantity), 0);
                    if (qty > 0) await tx.purchaseOrderItem.update({ where: { id: line.id }, data: { receivedQty: { increment: qty } } });
                }
            }
            for (const id of poIdsTouched) {
                const p = await tx.purchaseOrder.findUnique({ where: { id }, select: { status: true, poNumber: true, vendor: true, hoAdvanceAmount: true, items: { select: { quantity: true, receivedQty: true } } } });
                const nextStatus = poStatusFromReceipts(p?.status, (p?.items ?? []).map((l) => ({ quantity: Number(l.quantity), receivedQty: Number(l.receivedQty) })));
                await tx.purchaseOrder.update({ where: { id }, data: { status: nextStatus } });
            }

            // 4. Create Transaction Log
            await tx.inventoryTransaction.create({
                data: {
                    type: 'GRN_IN',
                    storeId,
                    referenceId: grn.id,
                    userId: receivedById,
                    notes: `GRN from ${sourceType} ${supplier ? '- ' + supplier : ''}`,
                    items: {
                        create: transactionItems
                    }
                }
            });

            // 3.5 Log receipt in General Ledger (real-time double-entry)
            await LedgerService.logGrnReceipt(tx, grn.id, totalGrnCost, `GRN ${grnNumber}: goods received in store${supplier || vendorLabel ? " from " + (supplier || vendorLabel) : ""}`);

            // 4. Update the status of every stock request this GRN receives against (one, or one per purchase order)
            for (const requestId of requestIdsTouched) {
                // the quantities of this GRN that belong to this request, per item
                const qtyForRequest = new Map<string, number>();
                items.forEach((i, idx) => {
                    if (lineMode && lineAlloc.get(idx)?.requestId !== requestId) return;
                    qtyForRequest.set(i.itemId, (qtyForRequest.get(i.itemId) ?? 0) + Number(i.quantity));
                });
                // Lock the StockRequest row to prevent concurrent race conditions
                // Explicit ::uuid cast — Prisma binds the parameter as text and Postgres
                // has no implicit text->uuid operator, which would fail the whole transaction
                await tx.$executeRaw`SELECT id FROM "StockRequest" WHERE id = ${requestId}::uuid FOR UPDATE`;

                const request = await tx.stockRequest.findUnique({
                    where: { id: requestId },
                    include: { items: true }
                });

                if (request) {
                    if (request.status !== 'APPROVED' && request.status !== 'PARTIALLY_COMPLETED') {
                        throw AppError.badRequest(`CANNOT_RECEIVE_GRN_FOR_UNAPPROVED_REQUEST: Stock Request ${request.requestNr} has status ${request.status} and must be APPROVED first.`);
                    }

                    // Update received quantities for each item
                    for (const reqItem of request.items) {
                        const receivedNow = qtyForRequest.get(reqItem.itemId) ?? 0;
                        const limitQty = Number(reqItem.approvedQty) > 0 ? Number(reqItem.approvedQty) : Number(reqItem.requestedQty);

                        if (receivedNow > 0) {
                            const newReceivedQty = reqItem.receivedQty.toNumber() + receivedNow;
                            if (newReceivedQty > limitQty) {
                                throw AppError.badRequest(`GRN_QUANTITY_EXCEEDS_APPROVED_LIMIT: Received quantity of ${newReceivedQty} exceeds approved limit of ${limitQty} for item ${reqItem.itemId}`);
                            }

                            await tx.stockRequestItem.update({
                                where: { id: reqItem.id },
                                data: { receivedQty: newReceivedQty }
                            });
                        }
                    }

                    // Use DB function to determine and update request status atomically
                    const statusResult = await tx.$queryRaw<[{ new_status: string }]>`
                        SELECT fn_update_stock_request_status(${requestId}::uuid) as new_status
                    `;
                    const newStatus = statusResult[0].new_status;

                    // Fetch updated request for notification
                    const updatedReq = await tx.stockRequest.findUnique({
                        where: { id: requestId }
                    });

                    if (updatedReq) {
                        // Update SLT reference if provided
                        if (sltReferenceId) {
                            await tx.stockRequest.update({
                                where: { id: requestId },
                                data: { sltReferenceId }
                            });
                        }

                        // Notify Requester that stock has arrived
                        const [nErr] = await safe(NotificationService.send({
                            userId: updatedReq.requestedById,
                            title: newStatus === 'COMPLETED' ? 'Stock Fully Received' : 'Stock Partially Received',
                            message: `Materials for request ${updatedReq.requestNr} have arrived at the store via GRN ${grn.grnNumber}.`,
                            type: 'INVENTORY',
                            priority: 'HIGH',
                            link: '/inventory/requests',
                            metadata: { requestId: updatedReq.id, grnNumber: grn.grnNumber, status: newStatus }
                        }));
                        if (nErr) {
                            console.error("Failed to notify stock arrival:", nErr);
                        }
                    }
                }
            }

            // the vendor's invoice for this delivery, saved with the GRN (due: the PO's due date, else this GRN's date + the PO's credit days)
            if (hoInvoiceFor) {
                const { SupplierInvoiceService } = await import('@/services/procurement/supplier-invoice.service');
                const due = hoInvoiceFor.paymentDueDate ?? (hoInvoiceFor.creditDays ? new Date(grn.createdAt.getTime() + hoInvoiceFor.creditDays * 86_400_000) : null);
                await SupplierInvoiceService.createFromGrnTx(tx as unknown as Prisma.TransactionClient, {
                    grnId: grn.id, grnNumber, poId: hoInvoiceFor.poId, userId: receivedById, invoiceNumber: vendorInvoiceNumber!, invoiceDate: new Date(vendorInvoiceDate!),
                    goods: Number(vendorInvoiceGoods), tax: Number(vendorInvoiceTax ?? 0), dueDate: due,
                    lines: items.map((i) => ({ poItemId: poLineByItem.get(i.itemId)!.id, quantity: Number(i.quantity) })),
                });
            }

            emitSystemEvent('INVENTORY_UPDATE');
            return tx.gRN.findUniqueOrThrow({ where: { id: grn.id }, include: { items: true } });
        }, { timeout: 30000 });
    }
}
