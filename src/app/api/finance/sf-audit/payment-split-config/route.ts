import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { apiHandler } from '@/lib/api-handler';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

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

// GET: Fetch Active Payment Split Config
export const GET = apiHandler(async () => {
    const configRow = await prisma.systemConfig.findUnique({
        where: { key: CONFIG_KEY }
    });

    if (!configRow) {
        return { success: true, data: defaultConfig };
    }

    try {
        const parsed = JSON.parse(configRow.value) as PaymentSplitConfigData;
        return { success: true, data: parsed };
    } catch {
        return { success: true, data: defaultConfig };
    }
});

// POST Schema
const postSchema = z.object({
    splitMode: z.enum(['SINGLE_FULL', 'SPLIT_AB', 'SPLIT_ABC']),
    claimAPercent: z.number().min(0).max(100),
    claimBPercent: z.number().min(0).max(100),
    claimCPercent: z.number().min(0).max(100),
    description: z.string().optional()
}).refine((data) => {
    const sum = data.claimAPercent + data.claimBPercent + data.claimCPercent;
    return Math.abs(sum - 100) < 0.01;
}, {
    message: 'Total split percentages (Claim A + B + C) must equal exactly 100%'
});

// POST: Save SF Auditor Config Settings
export const POST = apiHandler(async (req) => {
    const body = await req.json();
    const validated = postSchema.parse(body);

    const payload: PaymentSplitConfigData = {
        ...validated,
        updatedAt: new Date().toISOString(),
        updatedBy: 'SF Auditor'
    };

    await prisma.systemConfig.upsert({
        where: { key: CONFIG_KEY },
        update: {
            value: JSON.stringify(payload),
            description: validated.description || 'Configured by SF Audit'
        },
        create: {
            key: CONFIG_KEY,
            value: JSON.stringify(payload),
            description: validated.description || 'Configured by SF Audit'
        }
    });

    return { success: true, message: 'Payment split configuration saved successfully', data: payload };
});
