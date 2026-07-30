import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';

export class CpeService {
    static async getCollectedCPEs(params: { contractorId?: string; status?: string; deviceType?: string }) {
        const whereClause: Prisma.CollectedCPEWhereInput = {};
        if (params.contractorId) whereClause.contractorId = params.contractorId;
        if (params.status) whereClause.status = params.status;
        if (params.deviceType) whereClause.deviceType = params.deviceType;

        return await prisma.collectedCPE.findMany({
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
    }

    static async submitHandback(ids: string[], handbackReference: string) {
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
    }
}
