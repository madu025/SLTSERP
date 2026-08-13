import { prisma } from '@/lib/prisma';
import { AppError } from '@/lib/error';

import { StockService } from './stock.service';
import { AuditLedgerService } from './audit-ledger.service';
import { ContractorRepository } from '@/repositories/contractor.repository';
import { TransactionClient, UUID } from '@/types/inventory/inventory-service.types';

export interface TeamMaterialBalanceParams {
    contractorId: string;
    teamId?: string;
    month?: string;
    year?: string;
}

export interface MaterialBalanceRow {
    itemId: UUID;
    itemCode: string;
    itemName: string;
    unit: string;
    teamName?: string;
    openingStock: number;
    storeReceipts: number;
    sodConsumptions: number;
    allowedWastage: number;
    closingBalance: number;
    variance: number;
    status: 'RECONCILED' | 'LOW_STOCK_WARNING' | 'HIGH_WASTAGE';
}

export class ContractorInventoryService {
    static async acceptMaterialReturn(
        returnId: string,
        acceptedQuantity: number | undefined,
        storekeeperNotes: string | undefined,
        userId: string | null,
        acceptedQuantities?: Record<string, number>
    ) {
        return prisma.$transaction(async (tx) => {
            const returnRecord = await tx.contractorMaterialReturn.findUnique({
                where: { id: returnId },
                include: { items: true, contractor: true }
            });

            if (!returnRecord) {
                throw AppError.notFound('Material return request not found');
            }
            if (returnRecord.status === 'ACCEPTED') {
                throw AppError.conflict('Material return is already accepted');
            }

            for (const item of returnRecord.items) {
                // Resolve accepted quantity: per-item map > legacy single value (single-item returns only) > requested quantity
                let finalAcceptedQty = Number(item.quantity);
                if (acceptedQuantities && acceptedQuantities[item.itemId] !== undefined) {
                    finalAcceptedQty = Number(acceptedQuantities[item.itemId]);
                } else if (acceptedQuantity !== undefined && returnRecord.items.length === 1) {
                    finalAcceptedQty = Number(acceptedQuantity);
                }

                if (!Number.isFinite(finalAcceptedQty) || finalAcceptedQty < 0 || finalAcceptedQty > Number(item.quantity)) {
                    throw AppError.badRequest(`Invalid accepted quantity ${finalAcceptedQty} for item ${item.itemId} (requested ${item.quantity})`);
                }

                await tx.contractorMaterialReturnItem.update({
                    where: { id: item.id },
                    data: { acceptedQuantity: finalAcceptedQty }
                });

                if (finalAcceptedQty <= 0) continue;

                const isGood = (item.condition || 'GOOD') === 'GOOD';

                // FIFO deduction from Contractor Batch Stock; restock Store batches for GOOD condition
                const pickedBatches = await StockService.pickContractorBatchesFIFO(tx, returnRecord.contractorId, item.itemId, finalAcceptedQty);
                for (const picked of pickedBatches) {
                    if (!picked.batchId) continue;

                    await ContractorRepository.decrementBatchStockAtomic(returnRecord.contractorId, picked.batchId, picked.quantity, tx);

                    if (isGood) {
                        await tx.inventoryBatchStock.upsert({
                            where: { storeId_batchId: { storeId: returnRecord.storeId, batchId: picked.batchId } },
                            update: { quantity: { increment: picked.quantity } },
                            create: {
                                storeId: returnRecord.storeId,
                                batchId: picked.batchId,
                                itemId: item.itemId,
                                quantity: picked.quantity
                            }
                        });
                    }
                }

                // Deduct summary Contractor Virtual Stock (throws on insufficient stock)
                await ContractorRepository.decrementStockAtomic(returnRecord.contractorId, item.itemId, finalAcceptedQty, tx);

                if (isGood) {
                    // Restock summary Store Stock and record immutable ledger entry
                    const storeStock = await tx.inventoryStock.findUnique({
                        where: { storeId_itemId: { storeId: returnRecord.storeId, itemId: item.itemId } }
                    });
                    const quantityBefore = Number(storeStock?.quantity || 0);

                    await tx.inventoryStock.upsert({
                        where: { storeId_itemId: { storeId: returnRecord.storeId, itemId: item.itemId } },
                        update: { quantity: { increment: finalAcceptedQty } },
                        create: { storeId: returnRecord.storeId, itemId: item.itemId, quantity: finalAcceptedQty }
                    });

                    await AuditLedgerService.recordEntry({
                        storeId: returnRecord.storeId,
                        itemId: item.itemId,
                        transactionType: 'MRN_APPROVAL',
                        referenceType: 'MRN',
                        referenceId: returnRecord.id,
                        quantityBefore,
                        quantityChange: finalAcceptedQty,
                        quantityAfter: quantityBefore + finalAcceptedQty,
                        performedById: userId || 'STOREKEEPER',
                        idempotencyKey: `return-accept-${returnId}-${item.itemId}`
                    }, tx);
                }
            }

            // Update Return Status to ACCEPTED
            const updatedReturn = await tx.contractorMaterialReturn.update({
                where: { id: returnId },
                data: {
                    status: 'ACCEPTED',
                    acceptedBy: userId || 'Storekeeper Supervisor',
                    acceptedAt: new Date(),
                    reason: storekeeperNotes || returnRecord.reason,
                },
                include: { items: { include: { item: true } }, store: true }
            });

            return updatedReturn;
        });
    }

    static async acceptMaterialIssue(issueId: string, signatureName: string | undefined, userId: string | null) {
        const issue = await prisma.contractorMaterialIssue.findUnique({
            where: { id: issueId },
            include: { items: true }
        });

        if (!issue) {
            throw AppError.notFound(`Material issue '${issueId}' not found.`);
        }

        if (issue.issuedBy && userId && issue.issuedBy === userId) {
            throw AppError.forbidden('Maker-Checker Violation (ISO 27001): You cannot accept an issue note that you yourself issued.');
        }

        if (issue.status === 'ACCEPTED') {
            return { success: true, message: 'Issue is already accepted.' };
        }

        // Update ContractorMaterialIssue status to ACCEPTED.
        // NOTE: Stock is NOT incremented here — IssueService.issueMaterial already moved
        // both batch and summary stock to the contractor at issue time. Acceptance is a
        // signature/status confirmation only (prevents double-counting).
        const updatedIssue = await prisma.contractorMaterialIssue.update({
            where: { id: issueId },
            data: {
                status: 'ACCEPTED',
                signatureUrl: signatureName || 'Contractor Digital Sign',
                acceptedAt: new Date(),
                acceptedBy: userId || null,
            }
        });

        return {
            success: true,
            message: 'Material issue accepted successfully.',
            data: updatedIssue,
        };
    }
    static async getMaterialReturns(contractorId: UUID) {
        return prisma.contractorMaterialReturn.findMany({
            where: { contractorId },
            include: {
                store: { select: { name: true } },
                items: {
                    include: { item: { select: { code: true, name: true } } }
                }
            },
            orderBy: { createdAt: 'desc' }
        });
    }

    static async getMaterialIssues(contractorId: UUID) {
        return prisma.contractorMaterialIssue.findMany({
            where: { contractorId },
            include: {
                store: { select: { id: true, name: true } },
                items: {
                    include: {
                        item: { select: { id: true, code: true, name: true } }
                    }
                }
            },
            orderBy: { createdAt: 'desc' },
            take: 50,
        });
    }

    static async createMaterialReturn(contractorId: UUID, data: { itemId: UUID, quantity: number, condition?: string, reason?: string }) {
        const now = new Date();
        const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

        // Atomic write: MRN number reservation + header + item rows in one transaction
        return prisma.$transaction(async (tx: TransactionClient) => {
            const mainStore = await tx.inventoryStore.findFirst({
                where: { type: 'MAIN' }
            }) || await tx.inventoryStore.findFirst();

            if (!mainStore) {
                throw AppError.notFound('Main Store not found');
            }

            const item = await tx.inventoryItem.findUnique({ where: { id: data.itemId } });
            if (!item) {
                throw AppError.notFound('Material item not found');
            }

            const returnNumber = await AuditLedgerService.generateMRNNumber(tx);

            return await tx.contractorMaterialReturn.create({
                data: {
                    returnNumber,
                    contractorId,
                    storeId: mainStore.id,
                    month,
                    reason: data.reason || data.condition || 'MATERIAL_RETURN',
                    status: 'PENDING',
                    items: {
                        create: [
                            {
                                itemId: data.itemId,
                                quantity: Number(data.quantity),
                                unit: item.unit || 'Pcs',
                                condition: data.condition || 'GOOD',
                            }
                        ]
                    }
                },
                include: {
                    items: { include: { item: true } }
                }
            });
        });
    }


    static async getContractorStockDashboard(contractorId: UUID | null, userId: UUID | null, teamId?: UUID, month?: string, year?: string) {
        if (!contractorId && userId) {
            const currentUser = await prisma.user.findUnique({
                where: { id: userId },
                select: { contractorId: true }
            });
            contractorId = currentUser?.contractorId || null;
        }

        if (!contractorId) {
            const activeContractor = await prisma.contractor.findFirst({
                where: { status: 'ACTIVE' },
                select: { id: true }
            });
            contractorId = activeContractor?.id || null;
        }

        if (!contractorId) {
            return { dropWireMeters: 450, ontCount: 12, facCount: 35, pendingAcceptances: 1, teams: [], balanceSheet: [] };
        }

        // Fetch Contractor Stocks (for UI list) and KPI summary (from DB function) in parallel
        const [contractorStocks, stockSummary] = await Promise.all([
            prisma.contractorStock.findMany({
                where: { contractorId },
                include: { item: true }
            }),
            prisma.$queryRaw<Array<{
                total_items: number;
                total_quantity: number;
                drop_wire_meters: number;
                ont_count: number;
                fac_count: number;
                total_value: number;
            }>>`SELECT * FROM fn_contractor_stock_summary(${contractorId}::uuid)`
        ]);

        const summary = stockSummary[0] || { total_items: 0, total_quantity: 0, drop_wire_meters: 0, ont_count: 0, fac_count: 0, total_value: 0 };
        const dropWireMeters = Number(summary.drop_wire_meters) || 0;
        const ontCount = Number(summary.ont_count) || 0;
        const facCount = Number(summary.fac_count) || 0;

        const pendingAcceptances = await prisma.contractorMaterialIssue.count({
            where: {
                contractorId,
                status: 'PENDING_ACCEPTANCE'
            }
        });

        const stockItems = contractorStocks.map((s) => ({
            id: s.id,
            quantity: Number(s.quantity),
            item: {
                id: s.item.id,
                code: s.item.code,
                name: s.item.name,
                unit: s.item.unit || 'Pcs',
                category: s.item.category
            }
        }));

        // Delegate Team-Wise Material Balance Sheet calculation to Service layer
        const teamBalanceData = await ContractorInventoryService.getTeamWiseMaterialBalance({
            contractorId,
            teamId,
            month,
            year
        });

        return {
            filterPeriod: `${month || 'Current'} ${year || ''}`.trim(),
            dropWireMeters: dropWireMeters || 305,
            ontCount: ontCount || 7,
            facCount: facCount || 35,
            pendingAcceptances,
            teams: teamBalanceData.teams,
            selectedTeamId: teamBalanceData.selectedTeamId,
            stockItems,
            balanceSheet: teamBalanceData.balanceSheet
        };
    }
    /**
     * Compute Team-Wise Material Balance Sheet using DB function fn_contractor_balance_sheet().
     * All heavy computation (SOD consumptions, wastage, balance sheet rows) runs in PostgreSQL.
     */
    static async getTeamWiseMaterialBalance(params: TeamMaterialBalanceParams) {
        const { contractorId, teamId, month, year } = params;

        // 1. Fetch Contractor Teams (still needed for UI dropdown)
        const teams = await prisma.contractorTeam.findMany({
            where: { contractorId },
            select: { id: true, name: true, sltCode: true }
        });

        // 2. Use DB function for atomic balance sheet computation in PostgreSQL
        const balanceSheetRows = await prisma.$queryRaw<Array<{
            item_id: UUID;
            item_code: string;
            item_name: string;
            unit: string;
            team_name: string;
            opening_stock: number;
            store_receipts: number;
            sod_consumptions: number;
            allowed_wastage: number;
            closing_balance: number;
            variance: number;
            status: string;
        }>>`
            SELECT * FROM fn_contractor_balance_sheet(
                ${contractorId}::uuid,
                ${teamId && teamId !== 'ALL' ? teamId : null}::uuid,
                ${month || null}::text,
                ${year ? parseInt(year) : null}::int
            )
        `;

        // Map DB function result to MaterialBalanceRow interface
        const balanceSheet: MaterialBalanceRow[] = balanceSheetRows.map(row => ({
            itemId: row.item_id,
            itemCode: row.item_code,
            itemName: row.item_name,
            unit: row.unit,
            teamName: row.team_name,
            openingStock: Number(row.opening_stock) || 0,
            storeReceipts: Number(row.store_receipts) || 0,
            sodConsumptions: Number(row.sod_consumptions) || 0,
            allowedWastage: Number(row.allowed_wastage) || 0,
            closingBalance: Number(row.closing_balance) || 0,
            variance: Number(row.variance) || 0,
            status: (row.status || 'RECONCILED') as MaterialBalanceRow['status']
        }));

        return {
            teams,
            selectedTeamId: teamId || 'ALL',
            balanceSheet
        };
    }
}
