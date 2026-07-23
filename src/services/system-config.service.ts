import { prisma } from '@/lib/prisma';
import { SystemService } from '@/services/system.service';

export interface FinanceSystemConfig {
    vatPercent: number;
    ssclPercent: number;
    whtPercent: number;
    retentionPercent: number;
    lateInvoicePenaltyPercent: number;
    qcRejectionPenaltyAmount: number;
    approvalLimitManager: number;
    approvalLimitGM: number;
    approvalLimitDirector: number;
    minInvoiceBatchAmount: number;
}

export interface SODSystemConfig {
    slaFtthHours: number;
    slaCopperHours: number;
    slaLteHours: number;
    slaFaultHours: number;
    contractorMaxActiveSod: number;
    qcPassScorePercent: number;
    freeCableDistanceMeters: number;
    consumptionVarianceTolerancePercent: number;
    dispatchEscalationHours: number;
}

export interface InventorySystemConfig {
    dropWireRatePerMeter: number;
    ontUnitRate: number;
    rosetteUnitRate: number;
    fastConnectorRate: number;
    splicingSleeveRate: number;
    safetyStockCableMeters: number;
    safetyStockOntUnits: number;
    scrapTolerancePercent: number;
    materialReturnGraceDays: number;
    storeTransferAutoApproveLimit: number;
    stockDiscrepancyTolerancePercent: number;
}

export class SystemConfigService {
    /**
     * Fetch all system configs as a key-value map with defaults fallback.
     */
    static async getConfigs(): Promise<Record<string, string>> {
        try {
            const configs: { key: string, value: string }[] = await prisma.$queryRaw`SELECT * FROM "SystemConfig"`;
            const map = configs.reduce((acc: Record<string, string>, curr) => {
                acc[curr.key] = curr.value;
                return acc;
            }, {} as Record<string, string>);

            return {
                // Finance Defaults
                FINANCE_VAT_PERCENT: map.FINANCE_VAT_PERCENT || '18.0',
                FINANCE_SSCL_PERCENT: map.FINANCE_SSCL_PERCENT || '2.5',
                FINANCE_WHT_PERCENT: map.FINANCE_WHT_PERCENT || '5.0',
                FINANCE_RETENTION_PERCENT: map.FINANCE_RETENTION_PERCENT || '5.0',
                FINANCE_LATE_INVOICE_PENALTY_PERCENT: map.FINANCE_LATE_INVOICE_PENALTY_PERCENT || '2.0',
                FINANCE_QC_REJECTION_PENALTY_AMOUNT: map.FINANCE_QC_REJECTION_PENALTY_AMOUNT || '1500',
                FINANCE_APPROVAL_LIMIT_MANAGER: map.FINANCE_APPROVAL_LIMIT_MANAGER || '100000',
                FINANCE_APPROVAL_LIMIT_GM: map.FINANCE_APPROVAL_LIMIT_GM || '1000000',
                FINANCE_APPROVAL_LIMIT_DIRECTOR: map.FINANCE_APPROVAL_LIMIT_DIRECTOR || '5000000',
                FINANCE_MIN_INVOICE_BATCH_AMOUNT: map.FINANCE_MIN_INVOICE_BATCH_AMOUNT || '25000',

                // SOD Operational Defaults
                SOD_SLA_FTTH_HOURS: map.SOD_SLA_FTTH_HOURS || '48',
                SOD_SLA_COPPER_HOURS: map.SOD_SLA_COPPER_HOURS || '72',
                SOD_SLA_LTE_HOURS: map.SOD_SLA_LTE_HOURS || '24',
                SOD_SLA_FAULT_HOURS: map.SOD_SLA_FAULT_HOURS || '24',
                SOD_SLA_TIER1_DAYS: map.SOD_SLA_TIER1_DAYS || '2',
                SOD_SLA_TIER2_DAYS: map.SOD_SLA_TIER2_DAYS || '5',
                SOD_SLA_TIER3_DAYS: map.SOD_SLA_TIER3_DAYS || '7',
                SOD_SLA_TIER4_DAYS: map.SOD_SLA_TIER4_DAYS || '10',
                SOD_CONTRACTOR_MAX_ACTIVE_SOD: map.SOD_CONTRACTOR_MAX_ACTIVE_SOD || '50',
                SOD_QC_PASS_SCORE_PERCENT: map.SOD_QC_PASS_SCORE_PERCENT || '80',
                SOD_FREE_CABLE_DISTANCE_METERS: map.SOD_FREE_CABLE_DISTANCE_METERS || '50',
                SOD_CONSUMPTION_VARIANCE_TOLERANCE_PERCENT: map.SOD_CONSUMPTION_VARIANCE_TOLERANCE_PERCENT || '10',
                SOD_DISPATCH_ESCALATION_HOURS: map.SOD_DISPATCH_ESCALATION_HOURS || '24',

                // Inventory Defaults
                INVENTORY_DROP_WIRE_RATE_PER_METER: map.INVENTORY_DROP_WIRE_RATE_PER_METER || '45',
                INVENTORY_ONT_UNIT_RATE: map.INVENTORY_ONT_UNIT_RATE || '12000',
                INVENTORY_ROSETTE_UNIT_RATE: map.INVENTORY_ROSETTE_UNIT_RATE || '450',
                INVENTORY_FAST_CONNECTOR_RATE: map.INVENTORY_FAST_CONNECTOR_RATE || '150',
                INVENTORY_SPLICING_SLEEVE_RATE: map.INVENTORY_SPLICING_SLEEVE_RATE || '15',
                INVENTORY_SAFETY_STOCK_CABLE_METERS: map.INVENTORY_SAFETY_STOCK_CABLE_METERS || '5000',
                INVENTORY_SAFETY_STOCK_ONT_UNITS: map.INVENTORY_SAFETY_STOCK_ONT_UNITS || '50',
                INVENTORY_SCRAP_TOLERANCE_PERCENT: map.INVENTORY_SCRAP_TOLERANCE_PERCENT || '2',
                INVENTORY_MATERIAL_RETURN_GRACE_DAYS: map.INVENTORY_MATERIAL_RETURN_GRACE_DAYS || '7',
                INVENTORY_STORE_TRANSFER_AUTO_APPROVE_LIMIT: map.INVENTORY_STORE_TRANSFER_AUTO_APPROVE_LIMIT || '50000',
                INVENTORY_STOCK_AUDIT_DISCREPANCY_TOLERANCE_PERCENT: map.INVENTORY_STOCK_AUDIT_DISCREPANCY_TOLERANCE_PERCENT || '1',
                OSP_MATERIAL_SOURCE: map.OSP_MATERIAL_SOURCE || 'SLT',
                ...map
            };
        } catch (e) {
            console.error('[SYSTEM-CONFIG-FETCH-FAIL]', e);
            return {};
        }
    }

    /**
     * Get OSP Material Source as of a target date or order completion date
     */
    static async getOspMaterialSourceAsOfDate(targetDate: Date = new Date()): Promise<'SLT' | 'COMPANY'> {
        try {
            const versions: Array<{ key: string; value: string }> = await prisma.$queryRaw`
                SELECT DISTINCT ON ("key") "key", "value"
                FROM "SystemConfigVersion"
                WHERE "key" = 'OSP_MATERIAL_SOURCE'
                  AND "effectiveFrom" <= ${targetDate}
                  AND ("effectiveTo" IS NULL OR "effectiveTo" >= ${targetDate})
                ORDER BY "key", "effectiveFrom" DESC
            `;

            if (versions.length > 0 && (versions[0].value === 'COMPANY' || versions[0].value === 'SLT')) {
                return versions[0].value as 'SLT' | 'COMPANY';
            }

            const liveConfigs = await this.getConfigs();
            const liveSource = liveConfigs.OSP_MATERIAL_SOURCE;
            return (liveSource === 'COMPANY' ? 'COMPANY' : 'SLT');
        } catch (e) {
            console.error('[TIME-SERIES-OSP-SOURCE-FAIL]', e);
            return 'SLT';
        }
    }

    /**
     * Get Finance Configuration as of a specific historical date
     */
    static async getFinanceConfigAsOfDate(targetDate: Date = new Date()): Promise<FinanceSystemConfig> {
        try {
            const versions: Array<{ key: string; value: string }> = await prisma.$queryRaw`
                SELECT DISTINCT ON ("key") "key", "value"
                FROM "SystemConfigVersion"
                WHERE "effectiveFrom" <= ${targetDate}
                  AND ("effectiveTo" IS NULL OR "effectiveTo" >= ${targetDate})
                ORDER BY "key", "effectiveFrom" DESC
            `;

            const map = versions.reduce((acc, curr) => {
                acc[curr.key] = curr.value;
                return acc;
            }, {} as Record<string, string>);

            const liveConfigs = await this.getConfigs();

            return {
                vatPercent: Number(map.FINANCE_VAT_PERCENT || liveConfigs.FINANCE_VAT_PERCENT || 18.0),
                ssclPercent: Number(map.FINANCE_SSCL_PERCENT || liveConfigs.FINANCE_SSCL_PERCENT || 2.5),
                whtPercent: Number(map.FINANCE_WHT_PERCENT || liveConfigs.FINANCE_WHT_PERCENT || 5.0),
                retentionPercent: Number(map.FINANCE_RETENTION_PERCENT || liveConfigs.FINANCE_RETENTION_PERCENT || 5.0),
                lateInvoicePenaltyPercent: Number(map.FINANCE_LATE_INVOICE_PENALTY_PERCENT || liveConfigs.FINANCE_LATE_INVOICE_PENALTY_PERCENT || 2.0),
                qcRejectionPenaltyAmount: Number(map.FINANCE_QC_REJECTION_PENALTY_AMOUNT || liveConfigs.FINANCE_QC_REJECTION_PENALTY_AMOUNT || 1500),
                approvalLimitManager: Number(map.FINANCE_APPROVAL_LIMIT_MANAGER || liveConfigs.FINANCE_APPROVAL_LIMIT_MANAGER || 100000),
                approvalLimitGM: Number(map.FINANCE_APPROVAL_LIMIT_GM || liveConfigs.FINANCE_APPROVAL_LIMIT_GM || 1000000),
                approvalLimitDirector: Number(map.FINANCE_APPROVAL_LIMIT_DIRECTOR || liveConfigs.FINANCE_APPROVAL_LIMIT_DIRECTOR || 5000000),
                minInvoiceBatchAmount: Number(map.FINANCE_MIN_INVOICE_BATCH_AMOUNT || liveConfigs.FINANCE_MIN_INVOICE_BATCH_AMOUNT || 25000)
            };
        } catch (e) {
            console.error('[TIME-SERIES-CONFIG-FETCH-FAIL]', e);
            return this.getFinanceConfig();
        }
    }

    /**
     * Get typed Finance System Configuration
     */
    static async getFinanceConfig(): Promise<FinanceSystemConfig> {
        const c = await this.getConfigs();
        return {
            vatPercent: Number(c.FINANCE_VAT_PERCENT || 18.0),
            ssclPercent: Number(c.FINANCE_SSCL_PERCENT || 2.5),
            whtPercent: Number(c.FINANCE_WHT_PERCENT || 5.0),
            retentionPercent: Number(c.FINANCE_RETENTION_PERCENT || 5.0),
            lateInvoicePenaltyPercent: Number(c.FINANCE_LATE_INVOICE_PENALTY_PERCENT || 2.0),
            qcRejectionPenaltyAmount: Number(c.FINANCE_QC_REJECTION_PENALTY_AMOUNT || 1500),
            approvalLimitManager: Number(c.FINANCE_APPROVAL_LIMIT_MANAGER || 100000),
            approvalLimitGM: Number(c.FINANCE_APPROVAL_LIMIT_GM || 1000000),
            approvalLimitDirector: Number(c.FINANCE_APPROVAL_LIMIT_DIRECTOR || 5000000),
            minInvoiceBatchAmount: Number(c.FINANCE_MIN_INVOICE_BATCH_AMOUNT || 25000)
        };
    }

    /**
     * Get typed SOD Operational Configuration
     */
    static async getSODConfig(): Promise<SODSystemConfig> {
        const c = await this.getConfigs();
        return {
            slaFtthHours: Number(c.SOD_SLA_FTTH_HOURS || 48),
            slaCopperHours: Number(c.SOD_SLA_COPPER_HOURS || 72),
            slaLteHours: Number(c.SOD_SLA_LTE_HOURS || 24),
            slaFaultHours: Number(c.SOD_SLA_FAULT_HOURS || 24),
            contractorMaxActiveSod: Number(c.SOD_CONTRACTOR_MAX_ACTIVE_SOD || 50),
            qcPassScorePercent: Number(c.SOD_QC_PASS_SCORE_PERCENT || 80),
            freeCableDistanceMeters: Number(c.SOD_FREE_CABLE_DISTANCE_METERS || 50),
            consumptionVarianceTolerancePercent: Number(c.SOD_CONSUMPTION_VARIANCE_TOLERANCE_PERCENT || 10),
            dispatchEscalationHours: Number(c.SOD_DISPATCH_ESCALATION_HOURS || 24)
        };
    }

    /**
     * Get typed Inventory & Material Configuration
     */
    static async getInventoryConfig(): Promise<InventorySystemConfig> {
        const c = await this.getConfigs();
        return {
            dropWireRatePerMeter: Number(c.INVENTORY_DROP_WIRE_RATE_PER_METER || 45),
            ontUnitRate: Number(c.INVENTORY_ONT_UNIT_RATE || 12000),
            rosetteUnitRate: Number(c.INVENTORY_ROSETTE_UNIT_RATE || 450),
            fastConnectorRate: Number(c.INVENTORY_FAST_CONNECTOR_RATE || 150),
            splicingSleeveRate: Number(c.INVENTORY_SPLICING_SLEEVE_RATE || 15),
            safetyStockCableMeters: Number(c.INVENTORY_SAFETY_STOCK_CABLE_METERS || 5000),
            safetyStockOntUnits: Number(c.INVENTORY_SAFETY_STOCK_ONT_UNITS || 50),
            scrapTolerancePercent: Number(c.INVENTORY_SCRAP_TOLERANCE_PERCENT || 2),
            materialReturnGraceDays: Number(c.INVENTORY_MATERIAL_RETURN_GRACE_DAYS || 7),
            storeTransferAutoApproveLimit: Number(c.INVENTORY_STORE_TRANSFER_AUTO_APPROVE_LIMIT || 50000),
            stockDiscrepancyTolerancePercent: Number(c.INVENTORY_STOCK_AUDIT_DISCREPANCY_TOLERANCE_PERCENT || 1)
        };
    }

    /**
     * Create an effective date range versioned configuration
     */
    static async createConfigVersion(input: {
        category: string;
        key: string;
        value: string;
        effectiveFrom: Date;
        effectiveTo?: Date;
        description?: string;
        createdBy?: string;
    }) {
        const p = prisma as unknown as Record<string, { create: (args: unknown) => Promise<unknown> }>;
        if (p.systemConfigVersion) {
            const created = await p.systemConfigVersion.create({
                data: {
                    category: input.category,
                    key: input.key,
                    value: String(input.value),
                    effectiveFrom: input.effectiveFrom,
                    effectiveTo: input.effectiveTo || null,
                    description: input.description || null,
                    createdBy: input.createdBy || 'System Admin'
                }
            });
            await this.updateConfig(input.key, String(input.value), input.description, input.createdBy || 'System Admin');
            return created;
        }

        await prisma.$executeRaw`
            INSERT INTO "SystemConfigVersion" ("id", "category", "key", "value", "effectiveFrom", "effectiveTo", "description", "createdBy", "createdAt")
            VALUES (gen_random_uuid(), ${input.category}, ${input.key}, ${String(input.value)}, ${input.effectiveFrom}, ${input.effectiveTo || null}, ${input.description || null}, ${input.createdBy || 'System Admin'}, NOW())
        `;
        await this.updateConfig(input.key, String(input.value), input.description, input.createdBy || 'System Admin');
        return { success: true };
    }

    /**
     * Upsert a system config.
     */
    static async updateConfig(key: string, value: string, description: string | undefined, userId: string) {
        const result: { key: string, value: string, description: string | null }[] = await prisma.$queryRaw`
            INSERT INTO "SystemConfig" ("key", "value", "description", "updatedAt")
            VALUES (${key}, ${String(value)}, ${description || null}, NOW())
            ON CONFLICT ("key") 
            DO UPDATE SET "value" = ${String(value)}, "description" = COALESCE(${description || null}, "SystemConfig"."description"), "updatedAt" = NOW()
            RETURNING *
        `;

        await SystemService.logEvent({
            userId,
            action: 'SYSTEM_CONFIG_UPDATE',
            entity: 'SystemConfig',
            entityId: key,
            newValue: { key, value: String(value), description }
        });

        return result[0];
    }
}
