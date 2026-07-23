import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { apiHandler } from '@/lib/api-handler';
import { z } from 'zod';
import { AppError } from '@/lib/error';

export const dynamic = 'force-dynamic';

const schema = z.object({
    sodIds: z.array(z.string()).min(1, 'At least one SOD ID is required'),
    notes: z.string().optional()
});

export const POST = apiHandler(async (req: Request) => {
    const json = await req.json();
    const { sodIds, notes } = schema.parse(json);
    const userId = req.headers.get('x-user-id') || 'system-engineer';

    // 1. Fetch target completed SODs
    const sods = await prisma.serviceOrder.findMany({
        where: {
            id: { in: sodIds },
            status: 'COMPLETED'
        }
    });

    if (sods.length === 0) {
        throw AppError.badRequest('No completed SODs found matching the provided IDs');
    }

    const verifiedIds: string[] = [];

    // 2. Perform verification and write audit logs in a transaction
    await prisma.$transaction(async (tx) => {
        for (const sod of sods) {
            await tx.serviceOrder.update({
                where: { id: sod.id },
                data: {
                    isInvoicable: true,
                    sltsPatStatus: 'PAT_PASSED',
                    opmcPatStatus: 'PAT_PASSED',
                    hoPatStatus: 'PAT_PASSED'
                }
            });

            // Record explicit Audit Log
            await tx.auditLog.create({
                data: {
                    action: 'SOD_INVOICABLE_VERIFIED',
                    entity: 'ServiceOrder',
                    entityId: sod.id,
                    userId: userId,
                    newValue: {
                        soNum: sod.soNum,
                        rtom: sod.rtom,
                        verifiedBy: userId,
                        notes: notes || 'Engineer verification passed'
                    }
                }
            });

            verifiedIds.push(sod.id);
        }
    });

    return {
        success: true,
        message: `Successfully verified and marked ${verifiedIds.length} SOD(s) as Invoicable by Engineer / SF Audit`,
        count: verifiedIds.length,
        verifiedIds
    };
}, {
    audit: { action: 'VERIFY_SOD_INVOICABLE', entity: 'ServiceOrder' }
});
