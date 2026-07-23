import { prisma } from '@/lib/prisma';
import { AppError } from '@/lib/error';

export interface CreateContractInput {
    contractNumber: string;
    title: string;
    startDate: string;
    endDate: string;
    notes?: string;
    documentUrl?: string;
    // Commercial / financial governance
    tenderNo?: string;
    ceilingValue?: number;
    model1AQty?: number;
    model1BQty?: number;
    // Dedicated master rate structure
    poleRate56?: number;
    poleRate67?: number;
    poleRate80?: number;
    poleErectRate?: number;
    poleAdminFee?: number;
    peoTvRate?: number;
    targets: Array<{
        year: number;
        month: number;
        targetVolume: number;
        baseUnitRate: number;
        poleRate?: number;
        perMeterRate?: number;
        distanceThresholdMeters?: number;
        customSurcharges?: Record<string, number>;
        penaltyPerShortfall?: number;
        bonusPerOverachieve?: number;
    }>;
}

export interface CreateAmendmentInput {
    contractId: string;
    amendmentNumber: string;
    effectiveDate: string;
    reason: string;
    revisedUnitRate?: number;
    revisedTargetVolume?: number;
    revisedPoleRate?: number;
    revisedPerMeterRate?: number;
    revisedDistanceThreshold?: number;
    revisedEndDate?: string;
    ceilingValue?: number;
    ceilingIncrease?: number;
    parentAmendmentId?: string;
    customSurcharges?: Record<string, number>;
    targetMonths?: number[];
    documentUrl?: string;
    approvedBy?: string;
}

export interface MonthPerformanceSummary {
    month: number;
    monthName: string;
    targetVolume: number;
    actualCompleted: number;
    targetAchievementPercent: number;
    baseUnitRate: number;
    effectiveUnitRate: number;
    effectivePoleRate: number;
    effectivePerMeterRate: number;
    effectiveDistanceThreshold: number;
    customSurcharges?: Record<string, number>;
    activeAmendment: {
        amendmentNumber: string;
        reason: string;
        revisedUnitRate?: number;
        revisedTargetVolume?: number;
        revisedPoleRate?: number;
        revisedPerMeterRate?: number;
        effectiveDate: string;
        documentUrl?: string;
    } | null;
    contractedRevenue: number;
    actualRevenue: number;
    revenueVariance: number;
    status: 'EXCEEDED' | 'ON_TRACK' | 'AT_RISK' | 'CRISIS_SHORTFALL';
}

export interface Annual12MonthPerformanceSummary {
    contractId: string;
    contractNumber: string;
    title: string;
    year: number;
    startDate?: string;
    endDate?: string;
    documentUrl?: string;
    quotaStatus?: 'WITHIN_QUOTA' | 'NEARING_CAP' | 'QUOTA_EXCEEDED';
    monthlyBreakdown: MonthPerformanceSummary[];
    annualTotals: {
        totalTargetVolume: number;
        totalActualCompleted: number;
        overallAchievementPercent: number;
        totalContractedRevenue: number;
        totalActualRevenue: number;
        totalRevenueVariance: number;
    };
}

const MONTH_NAMES = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
];

function getPrismaInstance(): any {
    const p = prisma as any;
    if (!p.sLTContract && !p.SLTContract) {
        try {
            const { PrismaClient } = require('@prisma/client');
            const freshPrisma = new PrismaClient();
            (globalThis as any).prisma = freshPrisma;
            return freshPrisma;
        } catch (e) {
            console.error('[PRISMA-REFRESH-FAIL]', e);
        }
    }
    return p;
}

function getSLTContractModel() {
    const p = getPrismaInstance();
    const model = p.sLTContract || p.SLTContract || p.sltContract;
    if (!model) {
        throw AppError.internal('SLTContract Prisma model not initialized.');
    }
    return model;
}

function getSLTContractTargetModel() {
    const p = getPrismaInstance();
    return p.sLTContractTarget || p.SLTContractTarget || p.sltContractTarget;
}

function getSLTContractAmendmentModel() {
    const p = getPrismaInstance();
    return p.sLTContractAmendment || p.SLTContractAmendment || p.sltContractAmendment;
}

function getSLTContractAuditModel() {
    const p = getPrismaInstance();
    return p.sLTContractAudit || p.SLTContractAudit || p.sltContractAudit;
}

export class SLTContractService {
    /**
     * Universal Dynamic SOD Revenue Calculator for Multi-Tier Rates
     */
    static calculateSODRevenue(order: {
        baseRate: number;
        polesPlanted?: number;
        poleRate?: number;
        distanceMeters?: number;
        distanceThresholdMeters?: number;
        perMeterRate?: number;
        customSurcharges?: Record<string, number>;
    }): number {
        let total = Number(order.baseRate || 0);

        // 1. Pole Surcharge
        if (order.polesPlanted && order.poleRate) {
            total += Number(order.polesPlanted) * Number(order.poleRate);
        }

        // 2. Distance Span Surcharge
        if (order.distanceMeters && order.perMeterRate) {
            const threshold = Number(order.distanceThresholdMeters || 50);
            const extraMeters = Math.max(0, Number(order.distanceMeters) - threshold);
            total += extraMeters * Number(order.perMeterRate);
        }

        // 3. Custom Surcharges
        if (order.customSurcharges) {
            for (const value of Object.values(order.customSurcharges)) {
                total += Number(value || 0);
            }
        }

        return total;
    }

    /**
     * Get all master contracts with their targets and amendments
     */
    static async getContracts() {
        const ContractModel = getSLTContractModel();
        const contracts = await ContractModel.findMany({
            include: {
                targets: {
                    orderBy: [{ year: 'desc' }, { month: 'asc' }]
                },
                amendments: {
                    orderBy: { effectiveDate: 'desc' }
                },
                audits: {
                    take: 15,
                    orderBy: { createdAt: 'desc' }
                }
            },
            orderBy: { createdAt: 'desc' }
        });

        return contracts;
    }

    /**
     * Create a new SLT Master Commercial Agreement with full 12-month targets
     */
    static async createContract(input: CreateContractInput, performedBy: string = 'System Admin') {
        const ContractModel = getSLTContractModel();
        const existing = await ContractModel.findUnique({
            where: { contractNumber: input.contractNumber }
        });

        if (existing) {
            throw AppError.badRequest(`Contract number ${input.contractNumber} already exists`);
        }

        const contract = await ContractModel.create({
            data: {
                contractNumber: input.contractNumber,
                title: input.title,
                startDate: new Date(input.startDate),
                endDate: new Date(input.endDate),
                notes: input.notes || null,
                documentUrl: input.documentUrl || null,
                status: 'ACTIVE',
                tenderNo: input.tenderNo || null,
                ceilingValue: input.ceilingValue !== undefined ? Number(input.ceilingValue) : null,
                model1AQty: input.model1AQty !== undefined ? Number(input.model1AQty) : null,
                model1BQty: input.model1BQty !== undefined ? Number(input.model1BQty) : null,
                poleRate56: input.poleRate56 !== undefined ? Number(input.poleRate56) : null,
                poleRate67: input.poleRate67 !== undefined ? Number(input.poleRate67) : null,
                poleRate80: input.poleRate80 !== undefined ? Number(input.poleRate80) : null,
                poleErectRate: input.poleErectRate !== undefined ? Number(input.poleErectRate) : null,
                poleAdminFee: input.poleAdminFee !== undefined ? Number(input.poleAdminFee) : null,
                peoTvRate: input.peoTvRate !== undefined ? Number(input.peoTvRate) : null,
                targets: {
                    create: input.targets.map(t => ({
                        year: Number(t.year),
                        month: Number(t.month),
                        targetVolume: Number(t.targetVolume),
                        baseUnitRate: Number(t.baseUnitRate),
                        poleRate: t.poleRate !== undefined ? Number(t.poleRate) : 4500,
                        perMeterRate: t.perMeterRate !== undefined ? Number(t.perMeterRate) : 250,
                        distanceThresholdMeters: t.distanceThresholdMeters !== undefined ? Number(t.distanceThresholdMeters) : 50,
                        customSurcharges: t.customSurcharges || null,
                        penaltyPerShortfall: Number(t.penaltyPerShortfall || 0),
                        bonusPerOverachieve: Number(t.bonusPerOverachieve || 0)
                    }))
                },
                audits: {
                    create: {
                        action: 'CONTRACT_CREATED',
                        details: `Created master agreement ${input.contractNumber} (${input.title}) with ${input.targets.length} monthly targets`,
                        performedBy
                    }
                }
            },
            include: {
                targets: true,
                amendments: true
            }
        });

        return contract;
    }

    /**
     * Delete an SLT Master Commercial Agreement and its targets, amendments, and audits
     */
    static async deleteContract(id: string) {
        const ContractModel = getSLTContractModel();
        const TargetModel = getSLTContractTargetModel();
        const AmendmentModel = getSLTContractAmendmentModel();
        const AuditModel = getSLTContractAuditModel();

        const existing = await ContractModel.findUnique({
            where: { id }
        });

        if (!existing) {
            throw AppError.notFound('Contract not found');
        }

        // Delete child relations first
        if (TargetModel) await TargetModel.deleteMany({ where: { contractId: id } });
        if (AmendmentModel) await AmendmentModel.deleteMany({ where: { contractId: id } });
        if (AuditModel) await AuditModel.deleteMany({ where: { contractId: id } });

        const deleted = await ContractModel.delete({
            where: { id }
        });

        return deleted;
    }

    /**
     * File a dynamic crisis/period amendment modifying unit rates or target volumes for specific months
     */
    static async createAmendment(input: CreateAmendmentInput, performedBy: string = 'Commercial Manager') {
        const ContractModel = getSLTContractModel();
        const AmendmentModel = getSLTContractAmendmentModel();
        const AuditModel = getSLTContractAuditModel();

        const contract = await ContractModel.findUnique({
            where: { id: input.contractId }
        });

        if (!contract) {
            throw AppError.notFound('Master contract not found');
        }

        const monthsStr = input.targetMonths && input.targetMonths.length > 0
            ? ` Target Months: [${input.targetMonths.join(', ')}]`
            : '';

        const amendment = await AmendmentModel.create({
            data: {
                contractId: input.contractId,
                amendmentNumber: input.amendmentNumber,
                effectiveDate: new Date(input.effectiveDate),
                reason: `${input.reason}${monthsStr}`,
                revisedUnitRate: input.revisedUnitRate !== undefined ? Number(input.revisedUnitRate) : null,
                revisedTargetVolume: input.revisedTargetVolume !== undefined ? Number(input.revisedTargetVolume) : null,
                revisedPoleRate: input.revisedPoleRate !== undefined ? Number(input.revisedPoleRate) : null,
                revisedPerMeterRate: input.revisedPerMeterRate !== undefined ? Number(input.revisedPerMeterRate) : null,
                revisedDistanceThreshold: input.revisedDistanceThreshold !== undefined ? Number(input.revisedDistanceThreshold) : null,
                revisedEndDate: input.revisedEndDate ? new Date(input.revisedEndDate) : null,
                ceilingValue: input.ceilingValue !== undefined ? Number(input.ceilingValue) : null,
                ceilingIncrease: input.ceilingIncrease !== undefined ? Number(input.ceilingIncrease) : null,
                parentAmendmentId: input.parentAmendmentId || null,
                customSurcharges: input.customSurcharges || null,
                documentUrl: input.documentUrl || null,
                approvedBy: input.approvedBy || performedBy,
                status: 'ACTIVE'
            }
        });

        // Log audit
        if (AuditModel) {
            await AuditModel.create({
                data: {
                    contractId: input.contractId,
                    action: 'AMENDMENT_FILED',
                    details: `Filed Amendment ${input.amendmentNumber}: ${input.reason}. Rate: ${input.revisedUnitRate ? `LKR ${input.revisedUnitRate}` : 'Unchanged'}${monthsStr}`,
                    performedBy
                }
            });
        }

        return amendment;
    }

    /**
     * Get 100% Dynamic 12-Month Annual Performance Matrix (Jan - Dec)
     * High performance optimization: Batch fetches annual completed orders in 1 DB query instead of N*12 queries
     */
    static async getAnnual12MonthPerformance(year: number): Promise<Annual12MonthPerformanceSummary[]> {
        const ContractModel = getSLTContractModel();
        const contracts = await ContractModel.findMany({
            where: { status: 'ACTIVE' },
            include: {
                targets: {
                    where: { year }
                },
                amendments: {
                    where: { status: 'ACTIVE' },
                    orderBy: { effectiveDate: 'desc' }
                }
            }
        });

        // OPTIMIZATION: Single batch query for the entire year
        const yearStart = new Date(year, 0, 1);
        const yearEnd = new Date(year, 11, 31, 23, 59, 59);

        const completedOrders = await prisma.serviceOrder.findMany({
            where: {
                sltsStatus: 'COMPLETED',
                OR: [
                    { completedDate: { gte: yearStart, lte: yearEnd } },
                    { statusDate: { gte: yearStart, lte: yearEnd } }
                ]
            },
            select: {
                completedDate: true,
                statusDate: true
            }
        });

        // Pre-aggregate monthly completed counts in O(N) memory
        const monthlyActualCounts = new Array<number>(13).fill(0);
        for (const order of completedOrders) {
            const date = order.completedDate || order.statusDate;
            if (date) {
                const m = new Date(date).getMonth() + 1;
                if (m >= 1 && m <= 12) {
                    monthlyActualCounts[m]++;
                }
            }
        }

        const summaries: Annual12MonthPerformanceSummary[] = [];

        for (const c of contracts) {
            const monthlyBreakdown: MonthPerformanceSummary[] = [];

            let totalTargetVolume = 0;
            let totalActualCompleted = 0;
            let totalContractedRevenue = 0;
            let totalActualRevenue = 0;

            for (let m = 1; m <= 12; m++) {
                const monthName = MONTH_NAMES[m - 1];
                const target = c.targets.find((t: any) => t.month === m);
                const baseTargetVolume = target?.targetVolume || 0;
                const baseUnitRate = target?.baseUnitRate || 10000;
                const basePoleRate = target?.poleRate || 4500;
                const basePerMeterRate = target?.perMeterRate || 250;
                const baseDistanceThreshold = target?.distanceThresholdMeters || 50;
                const baseCustomSurcharges = (target?.customSurcharges as Record<string, number>) || {};

                const actualCompletedCount = monthlyActualCounts[m];

                // Find active amendment for this specific month
                let effectiveUnitRate = baseUnitRate;
                let effectiveTargetVolume = baseTargetVolume;
                let effectivePoleRate = basePoleRate;
                let effectivePerMeterRate = basePerMeterRate;
                let effectiveDistanceThreshold = baseDistanceThreshold;
                let effectiveCustomSurcharges = { ...baseCustomSurcharges };

                let activeAmendmentObj: MonthPerformanceSummary['activeAmendment'] = null;

                for (const amd of c.amendments) {
                    const amdDate = new Date(amd.effectiveDate);
                    const amdMonth = amdDate.getMonth() + 1;
                    const amdYear = amdDate.getFullYear();

                    let appliesToThisMonth = false;
                    if (amd.reason.includes('Target Months: [')) {
                        const match = amd.reason.match(/Target Months: \[([0-9, ]+)\]/);
                        if (match && match[1]) {
                            const months = match[1].split(',').map((s: string) => Number(s.trim()));
                            if (months.includes(m)) appliesToThisMonth = true;
                        }
                    } else if (amdYear === year && amdMonth <= m) {
                        appliesToThisMonth = true;
                    }

                    if (appliesToThisMonth) {
                        if (amd.revisedUnitRate) effectiveUnitRate = amd.revisedUnitRate;
                        if (amd.revisedTargetVolume) effectiveTargetVolume = amd.revisedTargetVolume;
                        if (amd.revisedPoleRate) effectivePoleRate = amd.revisedPoleRate;
                        if (amd.revisedPerMeterRate) effectivePerMeterRate = amd.revisedPerMeterRate;
                        if (amd.revisedDistanceThreshold) effectiveDistanceThreshold = amd.revisedDistanceThreshold;
                        if (amd.customSurcharges) {
                            effectiveCustomSurcharges = { ...effectiveCustomSurcharges, ...(amd.customSurcharges as Record<string, number>) };
                        }

                        activeAmendmentObj = {
                            amendmentNumber: amd.amendmentNumber,
                            reason: amd.reason,
                            revisedUnitRate: amd.revisedUnitRate || undefined,
                            revisedTargetVolume: amd.revisedTargetVolume || undefined,
                            revisedPoleRate: amd.revisedPoleRate || undefined,
                            revisedPerMeterRate: amd.revisedPerMeterRate || undefined,
                            effectiveDate: amd.effectiveDate.toISOString().split('T')[0],
                            documentUrl: amd.documentUrl || undefined
                        };
                        break;
                    }
                }

                const targetAchievementPercent = effectiveTargetVolume > 0
                    ? Math.round((actualCompletedCount / effectiveTargetVolume) * 100)
                    : 0;

                const contractedRevenue = effectiveTargetVolume * effectiveUnitRate;
                const actualRevenue = actualCompletedCount * effectiveUnitRate;
                const revenueVariance = actualRevenue - contractedRevenue;

                let status: MonthPerformanceSummary['status'] = 'ON_TRACK';
                if (targetAchievementPercent >= 100) status = 'EXCEEDED';
                else if (targetAchievementPercent >= 85) status = 'ON_TRACK';
                else if (targetAchievementPercent >= 60) status = 'AT_RISK';
                else status = 'CRISIS_SHORTFALL';

                monthlyBreakdown.push({
                    month: m,
                    monthName,
                    targetVolume: effectiveTargetVolume,
                    actualCompleted: actualCompletedCount,
                    targetAchievementPercent,
                    baseUnitRate,
                    effectiveUnitRate,
                    effectivePoleRate,
                    effectivePerMeterRate,
                    effectiveDistanceThreshold,
                    customSurcharges: effectiveCustomSurcharges,
                    activeAmendment: activeAmendmentObj,
                    contractedRevenue,
                    actualRevenue,
                    revenueVariance,
                    status
                });

                totalTargetVolume += effectiveTargetVolume;
                totalActualCompleted += actualCompletedCount;
                totalContractedRevenue += contractedRevenue;
                totalActualRevenue += actualRevenue;
            }

            const overallAchievementPercent = totalTargetVolume > 0
                ? Math.round((totalActualCompleted / totalTargetVolume) * 100)
                : 0;

            const totalRevenueVariance = totalActualRevenue - totalContractedRevenue;

            let quotaStatus: Annual12MonthPerformanceSummary['quotaStatus'] = 'WITHIN_QUOTA';
            if (totalActualCompleted >= totalTargetVolume && totalTargetVolume > 0) {
                quotaStatus = 'QUOTA_EXCEEDED';
            } else if (totalActualCompleted >= totalTargetVolume * 0.9 && totalTargetVolume > 0) {
                quotaStatus = 'NEARING_CAP';
            }

            summaries.push({
                contractId: c.id,
                contractNumber: c.contractNumber,
                title: c.title,
                year,
                startDate: c.startDate ? c.startDate.toISOString().split('T')[0] : undefined,
                endDate: c.endDate ? c.endDate.toISOString().split('T')[0] : undefined,
                documentUrl: c.documentUrl || undefined,
                quotaStatus,
                monthlyBreakdown,
                annualTotals: {
                    totalTargetVolume,
                    totalActualCompleted,
                    overallAchievementPercent,
                    totalContractedRevenue,
                    totalActualRevenue,
                    totalRevenueVariance
                }
            });
        }

        return summaries;
    }
}
