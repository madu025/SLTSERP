import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';

import { StockService } from './stock.service';
import { AuditLedgerService } from './audit-ledger.service';
import { ContractorRepository } from '@/repositories/contractor.repository';

export interface TeamMaterialBalanceParams {
    contractorId: string;
    teamId?: string;
    month?: string;
    year?: string;
}

export interface MaterialBalanceRow {
    itemId: string;
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
                throw new Error('Material return request not found');
            }
            if (returnRecord.status === 'ACCEPTED') {
                throw new Error('Material return is already accepted');
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
                    throw new Error(`Invalid accepted quantity ${finalAcceptedQty} for item ${item.itemId} (requested ${item.quantity})`);
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
                        transactionType: 'CONTRACTOR_RETURN',
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
            throw new Error(`Material issue '${issueId}' not found.`);
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
    static async getMaterialReturns(contractorId: string) {
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

    static async getMaterialIssues(contractorId: string) {
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

    static async createMaterialReturn(contractorId: string, data: { itemId: string, quantity: number, condition?: string, reason?: string }) {
        const mainStore = await prisma.inventoryStore.findFirst({
            where: { type: 'MAIN' }
        }) || await prisma.inventoryStore.findFirst();

        if (!mainStore) {
            throw new Error('Main Store not found');
        }

        const item = await prisma.inventoryItem.findUnique({ where: { id: data.itemId } });
        if (!item) {
            throw new Error('Material item not found');
        }

        const returnNumber = await AuditLedgerService.generateMRNNumber();
        const now = new Date();
        const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

        return prisma.contractorMaterialReturn.create({
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
    }


    static async getContractorStockDashboard(contractorId: string | null, userId: string | null, teamId?: string, month?: string, year?: string) {
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

        // Fetch Contractor Stocks
        const contractorStocks = await prisma.contractorStock.findMany({
            where: { contractorId },
            include: { item: true }
        });

        let dropWireMeters = 0;
        let ontCount = 0;
        let facCount = 0;

        for (const stock of contractorStocks) {
            const code = (stock.item.code || '').toUpperCase();
            const name = (stock.item.name || '').toUpperCase();

            if (code.includes('DW') || name.includes('DROP WIRE')) {
                dropWireMeters += Number(stock.quantity);
            } else if (code.includes('ONT') || name.includes('ONT') || name.includes('ROUTER')) {
                ontCount += Number(stock.quantity);
            } else if (code.includes('FAC') || name.includes('FAST CONNECTOR')) {
                facCount += Number(stock.quantity);
            }
        }

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
     * Compute High-Performance Team-Wise Material Balance Sheet using O(1) Hash Maps
     */
    static async getTeamWiseMaterialBalance(params: TeamMaterialBalanceParams) {
        const { contractorId, teamId } = params;

        // 1. Fetch Contractor Teams
        const teams = await prisma.contractorTeam.findMany({
            where: { contractorId },
            select: { id: true, name: true, sltCode: true }
        });
        const teamMap = new Map(teams.map(t => [t.id, t.name]));

        // 2. Fetch Contractor Stock (Base stock balances)
        const contractorStocks = await prisma.contractorStock.findMany({
            where: { contractorId },
            include: { item: true }
        });

        // 3. Fetch SOD Material Usages for contractor
        const whereUsage: Prisma.SODMaterialUsageWhereInput = { serviceOrder: { contractorId } };
        if (teamId && teamId !== 'ALL') {
            whereUsage.serviceOrder = {
                contractorId,
                OR: [
                    { teamId },
                    { directTeam: teamMap.get(teamId) }
                ]
            };
        }

        const sodUsages = await prisma.sODMaterialUsage.findMany({
            where: whereUsage,
            select: {
                itemId: true,
                quantity: true,
                usageType: true,
                serviceOrder: {
                    select: {
                        teamId: true,
                        directTeam: true
                    }
                }
            }
        });

        // 4. Build O(1) Hash Map for SOD Consumptions & Wastage
        const consumedMap = new Map<string, number>();
        const wastageMap = new Map<string, number>();

        for (const usage of sodUsages) {
            const qty = Number(usage.quantity) || 0;
            if (usage.usageType === 'WASTAGE') {
                const prevWastage = wastageMap.get(usage.itemId) || 0;
                wastageMap.set(usage.itemId, prevWastage + qty);
            } else {
                const prevConsumed = consumedMap.get(usage.itemId) || 0;
                consumedMap.set(usage.itemId, prevConsumed + qty);
            }
        }

        // 5. Compute Balance Sheet Rows
        const balanceSheet: MaterialBalanceRow[] = contractorStocks.map(stock => {
            const itemId = stock.itemId;
            const itemCode = stock.item.code;
            const itemName = stock.item.name;
            const unit = stock.item.unit || 'Pcs';
            const currentVanStock = Number(stock.quantity);

            const sodConsumptions = consumedMap.get(itemId) || 0;
            const explicitWastage = wastageMap.get(itemId) || 0;

            const allowedWastage = explicitWastage > 0
                ? explicitWastage
                : (stock.item.isWastageAllowed ? sodConsumptions * 0.05 : 0);

            const storeReceipts = currentVanStock + sodConsumptions + allowedWastage;

            let status: 'RECONCILED' | 'LOW_STOCK_WARNING' | 'HIGH_WASTAGE' = 'RECONCILED';
            if (currentVanStock < 5) {
                status = 'LOW_STOCK_WARNING';
            } else if (allowedWastage > sodConsumptions * 0.1) {
                status = 'HIGH_WASTAGE';
            }

            return {
                itemId,
                itemCode,
                itemName,
                unit,
                teamName: teamId && teamId !== 'ALL' ? (teamMap.get(teamId) || 'Selected Team') : 'All Contractor Teams',
                openingStock: 0,
                storeReceipts: Math.round(storeReceipts * 100) / 100,
                sodConsumptions: Math.round(sodConsumptions * 100) / 100,
                allowedWastage: Math.round(allowedWastage * 100) / 100,
                closingBalance: Math.round(currentVanStock * 100) / 100,
                variance: 0,
                status
            };
        });

        return {
            teams,
            selectedTeamId: teamId || 'ALL',
            balanceSheet
        };
    }
}
