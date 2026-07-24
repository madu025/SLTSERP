import { prisma } from '@/lib/prisma';

export interface ConsumableLeakageSummary {
    contractorId: string;
    contractorName: string;
    completedFtthSodsCount: number;
    // Drop Wire
    dropWireIssuedMeters: number;
    dropWireFieldUsedMeters: number;
    dropWireReturnedMeters: number;
    dropWireApprovedWastageMeters: number;
    dropWireUnaccountedMeters: number;
    dropWireLeakageLkr: number;
    // Fast Connectors (FAC)
    facIssuedPcs: number;
    facExpectedPcs: number; // 2 per completed FTTH SOD
    facReturnedPcs: number;
    facApprovedWastagePcs: number;
    facUnaccountedPcs: number;
    facLeakageLkr: number;
    // Total Financial Impact
    totalLeakageLkr: number;
    riskStatus: 'NORMAL' | 'ELEVATED' | 'CRITICAL_LEAKAGE';
}

export class ConsumableAuditService {
    /**
     * Audit bulk consumable leakage (Drop Wire & FAC Connectors) for a specific contractor
     */
    static async auditContractorConsumableLeakage(contractorId: string): Promise<ConsumableLeakageSummary> {
        const contractor = await prisma.contractor.findUnique({
            where: { id: contractorId }
        });

        const contractorName = contractor?.name || 'Unknown Contractor';

        // 1. Completed FTTH SODs
        const completedSods = await prisma.serviceOrder.findMany({
            where: {
                contractorId,
                sltsStatus: 'COMPLETED'
            },
            select: {
                id: true,
                dropWireDistance: true
            }
        });

        const completedFtthSodsCount = completedSods.length;

        // Sum field Drop Wire distance in meters
        const dropWireFieldUsedMeters = completedSods.reduce((sum, s) => sum + (s.dropWireDistance || 0), 0);

        // 2. Query Contractor Stock & Issues
        const contractorIssues = await prisma.contractorMaterialIssue.findMany({
            where: {
                contractorId,
                status: 'ACCEPTED'
            },
            include: {
                items: {
                    include: { item: true }
                }
            }
        });

        let dropWireIssuedMeters = 0;
        let facIssuedPcs = 0;

        for (const issue of contractorIssues) {
            for (const item of issue.items) {
                const code = (item.item.code || '').toUpperCase();
                const name = (item.item.name || '').toUpperCase();

                if (code.includes('DW') || code.includes('OSPFTA003') || name.includes('DROP WIRE')) {
                    dropWireIssuedMeters += item.quantity;
                }
                if (code.includes('FAC') || name.includes('FAST CONNECTOR') || name.includes('FIELD CONNECTOR')) {
                    facIssuedPcs += item.quantity;
                }
            }
        }

        // 3. Formulaic Calculations
        // Expected FAC Connectors = 2 per completed FTTH SOD
        const facExpectedPcs = completedFtthSodsCount * 2;
        const dropWireApprovedWastageMeters = Math.round(dropWireFieldUsedMeters * 0.05); // 5% allowed wastage
        const facApprovedWastagePcs = Math.round(facExpectedPcs * 0.05); // 5% allowed wastage

        const dropWireReturnedMeters = 0;
        const facReturnedPcs = 0;

        // Unaccounted = Issued - (Used + Returned + Allowed Wastage)
        const dropWireUnaccountedMeters = Math.max(
            0,
            dropWireIssuedMeters - (dropWireFieldUsedMeters + dropWireReturnedMeters + dropWireApprovedWastageMeters)
        );

        const facUnaccountedPcs = Math.max(
            0,
            facIssuedPcs - (facExpectedPcs + facReturnedPcs + facApprovedWastagePcs)
        );

        // Financial Leakage Valuation (Estimated LKR Unit Prices)
        const DW_UNIT_PRICE_LKR = 65; // ~Rs. 65 per meter
        const FAC_UNIT_PRICE_LKR = 350; // ~Rs. 350 per connector

        const dropWireLeakageLkr = Math.round(dropWireUnaccountedMeters * DW_UNIT_PRICE_LKR);
        const facLeakageLkr = Math.round(facUnaccountedPcs * FAC_UNIT_PRICE_LKR);
        const totalLeakageLkr = dropWireLeakageLkr + facLeakageLkr;

        let riskStatus: 'NORMAL' | 'ELEVATED' | 'CRITICAL_LEAKAGE' = 'NORMAL';
        if (totalLeakageLkr > 250000) {
            riskStatus = 'CRITICAL_LEAKAGE';
        } else if (totalLeakageLkr > 50000) {
            riskStatus = 'ELEVATED';
        }

        return {
            contractorId,
            contractorName,
            completedFtthSodsCount,
            dropWireIssuedMeters,
            dropWireFieldUsedMeters,
            dropWireReturnedMeters,
            dropWireApprovedWastageMeters,
            dropWireUnaccountedMeters,
            dropWireLeakageLkr,
            facIssuedPcs,
            facExpectedPcs,
            facReturnedPcs,
            facApprovedWastagePcs,
            facUnaccountedPcs,
            facLeakageLkr,
            totalLeakageLkr,
            riskStatus,
        };
    }
}
