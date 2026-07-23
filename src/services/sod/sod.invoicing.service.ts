import { prisma } from '@/lib/prisma';

export class SODInvoicingService {
    /**
     * Max billable Drop Wire distance per connection (Clause 17.7: >180M delivered FOC)
     */
    static capDropWireDistance(distance: number): number {
        if (!distance || distance <= 0) return 0;
        return Math.min(distance, 180);
    }

    /**
     * Calculate Model 1B Concrete Pole Administrative Fee (LKR 500 per pole)
     */
    static calculatePoleAdminFee(poleCount: number, materialSource?: string | null): number {
        if (!poleCount || poleCount <= 0) return 0;
        // Model 1B applies LKR 500 admin fee when materials/poles are supplied by SLTS
        const isModel1B = materialSource === 'SLTS' || !materialSource;
        return isModel1B ? poleCount * 500 : 0;
    }

    /**
     * Calculate SLA Delay Penalty (Clause 11.2 & Clause 16.2: LKR 500/day penalty)
     * Target: 5 working days (without poles) / 7 working days (with poles)
     */
    static calculateSlaDelayPenalty(
        receivedDate: Date | null | undefined,
        completedDate: Date | null | undefined,
        hasPoles: boolean
    ): number {
        if (!receivedDate || !completedDate) return 0;
        const targetDays = hasPoles ? 7 : 5;
        const diffTime = Math.max(0, completedDate.getTime() - receivedDate.getTime());
        const elapsedDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        const delayDays = Math.max(0, elapsedDays - targetDays);
        return delayDays * 500;
    }

    /**
     * Resolve RTOM / OPMC Region Code to Rate Matrix Area Group (CEN, HK, OTHER)
     * Rule:
     * - CEN   : RTOM 'R-MD', 'R-CEN', 'MD', 'CEN'
     * - HK    : RTOM 'R-HK', 'HK'
     * - OTHER : All other remaining RTOMs
     */
    static resolveAreaGroup(rtomOrName?: string | null): 'CEN' | 'HK' | 'OTHER' {
        if (!rtomOrName) return 'OTHER';
        const u = rtomOrName.trim().toUpperCase();
        if (u === 'R-MD' || u === 'R-CEN' || u === 'MD' || u === 'CEN' || u.endsWith('-MD') || u.endsWith('-CEN')) {
            return 'CEN';
        }
        if (u === 'R-HK' || u === 'HK' || u.endsWith('-HK')) {
            return 'HK';
        }
        return 'OTHER';
    }

    /**
     * Calculate Revenue and Contractor Payment dynamically for a completed SOD based on Rate Matrix
     */
    static async calculateAmounts(
        opmcIdOrRtom: string,
        rawDistance: number,
        options?: {
            materialSource?: string | null;
            poleCount?: number;
            serviceType?: string | null;
            poleType?: string | null;
            poleMethod?: string | null;
        }
    ) {
        let revenueAmount = 11000;
        let contractorAmount = 0;

        // Use actual drop wire distance for rate matrix bracket matching
        const distance = rawDistance && rawDistance > 0 ? rawDistance : 0;

        // 1. Resolve OPMC / RTOM region
        let rtomCode = opmcIdOrRtom;
        const opmcModel = (prisma as any).oPMC || (prisma as any).OPMC;
        if (opmcModel) {
            const opmc = await opmcModel.findFirst({
                where: { OR: [{ id: opmcIdOrRtom }, { rtom: opmcIdOrRtom }] }
            });
            if (opmc) rtomCode = opmc.rtom;
        }

        const areaGroup = SODInvoicingService.resolveAreaGroup(rtomCode);
        const serviceTypeStr = (options?.serviceType || 'FTTH').toUpperCase();
        const workType = serviceTypeStr.includes('DATA') ? 'DATA' : serviceTypeStr.includes('PSTN') ? 'PSTN' : serviceTypeStr.includes('IPTV') ? 'IPTV' : 'FTTH';

        // 2. Query Dynamic ContractorRateRule table from PostgreSQL
        const ruleModel = (prisma as any).contractorRateRule || (prisma as any).ContractorRateRule;
        let matchingRule: any = null;
        if (ruleModel) {
            matchingRule = await ruleModel.findFirst({
                where: {
                    workType,
                    areaGroup,
                    minDistance: { lte: distance },
                    maxDistance: { gte: distance },
                    isActive: true
                },
                orderBy: { minDistance: 'desc' }
            });

            if (matchingRule) {
                contractorAmount = matchingRule.rateAmount;
            } else {
                const fallbackRule = await ruleModel.findFirst({
                    where: {
                        workType,
                        minDistance: { lte: distance },
                        maxDistance: { gte: distance },
                        isActive: true
                    }
                });
                contractorAmount = fallbackRule ? fallbackRule.rateAmount : (areaGroup === 'OTHER' ? 6650 : 6750);
            }
        } else {
            contractorAmount = areaGroup === 'OTHER' ? 6650 : 6750;
        }

        // 3. Add Dynamic Pole Installation Rates if poles exist
        if (options?.poleCount && options.poleCount > 0) {
            const poleType = options.poleType || '5.6m';
            const poleMethod = options.poleMethod || 'STANDARD';
            const poleRule = await prisma.contractorRateRule.findFirst({
                where: {
                    workType: 'POLE',
                    poleType,
                    poleMethod,
                    areaGroup,
                    isActive: true
                }
            });
            if (poleRule) {
                contractorAmount += options.poleCount * poleRule.rateAmount;
            } else {
                contractorAmount += options.poleCount * 700;
            }
        }

        return {
            revenueAmount,
            contractorAmount,
            areaGroup,
            workDescription: matchingRule?.workDescription || `${workType} - DW length- (${distance}m)`
        };
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
