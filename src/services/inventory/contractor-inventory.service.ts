import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';

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
