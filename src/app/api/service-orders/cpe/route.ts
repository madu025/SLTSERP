import { prisma } from '@/lib/prisma';
import { apiHandler } from '@/lib/api-handler';
import { Prisma } from '@prisma/client';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

// GET: List collected CPEs with filter options
export const GET = apiHandler(async (request) => {
    const { searchParams } = new URL(request.url);
    const contractorId = searchParams.get('contractorId') || undefined;
    const status = searchParams.get('status') || undefined;
    const deviceType = searchParams.get('deviceType') || undefined;

    const whereClause: Prisma.CollectedCPEWhereInput = {};
    if (contractorId) whereClause.contractorId = contractorId;
    if (status) whereClause.status = status;
    if (deviceType) whereClause.deviceType = deviceType;

    const cpes = await prisma.collectedCPE.findMany({
        where: whereClause,
        include: {
            serviceOrder: {
                select: {
                    soNum: true,
                    voiceNumber: true,
                    completedDate: true
                }
            },
            contractor: {
                select: {
                    name: true
                }
            }
        },
        orderBy: {
            collectedDate: 'desc'
        }
    });

    return { success: true, data: cpes };
}, { rawResponse: true });

const cpeHandbackSchema = z.object({
    ids: z.array(z.string()).min(1, 'IDs array is required'),
    handbackReference: z.string().min(1, 'Handback reference is required')
});

// POST: Submit a handback receipt to SLT (Bulk mark as HANDED_BACK)
export const POST = apiHandler(
    async (request, params, body) => {
        const { ids, handbackReference } = body;

        const result = await prisma.$transaction(async (tx) => {
            return await tx.collectedCPE.updateMany({
                where: {
                    id: { in: ids },
                    status: 'PENDING_HANDBACK'
                },
                data: {
                    status: 'HANDED_BACK',
                    handbackDate: new Date(),
                    handbackReference
                }
            });
        });

        return { 
            success: true,
            message: `Successfully handed back ${result.count} CPEs to SLT.`,
            count: result.count 
        };
    },
    { schema: cpeHandbackSchema, rawResponse: true }
);
