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
                } else {
                    const sortedTiersAsc = [...payConfig.tiers].sort((a, b) => a.minDistance - b.minDistance);
                    if (distance < sortedTiersAsc[0].minDistance) {
                        contractorAmount = sortedTiersAsc[0].amount;
                    }
                }
            }
        }

        return { revenueAmount, contractorAmount };
    }

    /**
     * Determine if an SOD is eligible for invoicing
     */
    static determineInvoicableStatus(
        sltsPatStatus: string | null | undefined,
        opmcPatStatus: string | null | undefined,
        hoPatStatus: string | null | undefined
    ): boolean {
        // Business Rule: SOD is invoicable if OPMC, HO, and SLT HQ (slts) PAT are all PASSED
        return sltsPatStatus === 'PAT_PASSED' &&
               opmcPatStatus === 'PAT_PASSED' &&
               hoPatStatus === 'PAT_PASSED';
    }
}
