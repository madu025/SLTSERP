import { prisma } from '@/lib/prisma';

export class SODInvoicingService {
    /**
     * Calculate Revenue and Contractor Payment for a completed SOD
     */
    static async calculateAmounts(opmcId: string, distance: number) {
        let revenueAmount = 0;
        let contractorAmount = 0;

        // 1. Calculate Revenue (Flat Rate per OPMC/RTOM)
        const revConfig = await prisma.sODRevenueConfig.findFirst({
            where: { OR: [{ rtomId: opmcId }, { rtomId: null }], isActive: true },
            orderBy: { rtomId: { sort: 'asc', nulls: 'last' } }
        });
        if (revConfig) revenueAmount = revConfig.revenuePerSOD;

        // 2. Calculate Contractor Payment (Tiered Distance)
        const payConfig = await prisma.contractorPaymentConfig.findFirst({
            where: { OR: [{ rtomId: opmcId }, { rtomId: null }], isActive: true },
            include: { tiers: true },
            orderBy: { rtomId: { sort: 'asc', nulls: 'last' } }
        });

        if (payConfig && payConfig.tiers && payConfig.tiers.length > 0) {
            const matchingTier = payConfig.tiers.find((t) =>
                distance >= t.minDistance && distance <= t.maxDistance
            );
            if (matchingTier) {
                contractorAmount = matchingTier.amount;
            } else {
                const sortedTiers = [...payConfig.tiers].sort((a, b) => b.maxDistance - a.maxDistance);
                if (distance > sortedTiers[0].maxDistance) {
                    contractorAmount = sortedTiers[0].amount;
                }
            }
        }

        return { revenueAmount, contractorAmount };
    }

    /**
     * Determine if an SOD is eligible for invoicing
     */
    static determineInvoicableStatus(
        sltsPatStatus: string | undefined, 
        currentInvoicable: boolean
    ): boolean {
        // Business Rule: SOD is invoicable if SLTS PAT is PASSED
        if (sltsPatStatus === 'PAT_PASSED') return true;
        return currentInvoicable;
    }
}
