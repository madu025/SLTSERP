import { prisma } from '@/lib/prisma';

export interface PaymentSplitConfigData {
    splitMode: 'SINGLE_FULL' | 'SPLIT_AB' | 'SPLIT_ABC';
    claimAPercent: number;
    claimBPercent: number;
    claimCPercent: number;
    description?: string;
    updatedAt?: string;
    updatedBy?: string;
}

const CONFIG_KEY = 'SF_AUDIT_PAYMENT_SPLIT_CONFIG';

const defaultConfig: PaymentSplitConfigData = {
    splitMode: 'SPLIT_AB',
    claimAPercent: 90,
    claimBPercent: 10,
    claimCPercent: 0,
    description: 'SF Audit Default Config: 90% Direct Labor Claim A & 10% Material Supply Claim B'
};

export class SfAuditService {
    static async getPaymentSplitConfig(): Promise<PaymentSplitConfigData> {
        const configRow = await prisma.systemConfig.findUnique({
            where: { key: CONFIG_KEY }
        });

        if (!configRow) {
            return defaultConfig;
        }

        try {
            return JSON.parse(configRow.value) as PaymentSplitConfigData;
        } catch {
            return defaultConfig;
        }
    }

    static async savePaymentSplitConfig(data: PaymentSplitConfigData): Promise<PaymentSplitConfigData> {
        const payload: PaymentSplitConfigData = {
            ...data,
            updatedAt: new Date().toISOString(),
            updatedBy: 'SF Auditor'
        };

        await prisma.systemConfig.upsert({
            where: { key: CONFIG_KEY },
            update: {
                value: JSON.stringify(payload),
                description: payload.description || 'Configured by SF Audit'
            },
            create: {
                key: CONFIG_KEY,
                value: JSON.stringify(payload),
                description: payload.description || 'Configured by SF Audit'
            }
        });

        return payload;
    }
}
