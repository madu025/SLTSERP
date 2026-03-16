import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { GetServiceOrdersParams } from './sod-types';

export class SODQueryService {
    /**
     * Get all service orders with filtering and sorting
     */
    static async getServiceOrders(params: GetServiceOrdersParams) {
        const { rtomId: opmcId, filter, search, statusFilter, patFilter, matFilter, page = 1, limit = 50, cursor, month, year } = params;

        // Offset-based fallback for backward compatibility
        const skip = cursor ? 1 : (page - 1) * limit;

        if (!opmcId) {
            throw new Error('RTOM_ID_REQUIRED');
        }

        // Build where clause
        const whereClause: Prisma.ServiceOrderWhereInput = { opmcId };

        // Date Filtering
        if (month && year) {
            const startDate = new Date(year, month - 1, 1);
            const nextMonth = new Date(year, month, 1);

            if (patFilter === 'READY') {
                whereClause.hoPatDate = { gte: startDate, lt: nextMonth };
                whereClause.isInvoicable = true;
            } else if (filter === 'completed') {
                whereClause.completedDate = { gte: startDate, lt: nextMonth };
            } else if (filter === 'return') {
                whereClause.OR = [
                    { completedDate: { gte: startDate, lt: nextMonth } },
                    {
                        AND: [
                            { completedDate: null },
                            { statusDate: { gte: startDate, lt: nextMonth } }
                        ]
                    }
                ];
            } else {
                whereClause.createdAt = { gte: startDate, lt: nextMonth };
            }
        }

        // Status Filtering
        const completionStatuses = ["COMPLETED", "INSTALL_CLOSED", "PAT_OPMC_PASSED", "PAT_CORRECTED"];

        if (filter === 'pending') {
            if (statusFilter === 'RETURN') {
                whereClause.sltsStatus = 'RETURN';
            } else {
                whereClause.sltsStatus = { notIn: ['COMPLETED', 'RETURN'] };
                whereClause.status = { notIn: completionStatuses };
            }
        } else if (filter === 'completed') {
            whereClause.OR = [
                { sltsStatus: 'COMPLETED' },
                { status: { in: completionStatuses } }
            ];
        } else if (filter === 'return') {
            whereClause.sltsStatus = 'RETURN';
        }

        // Sub-Filtering
        if (search) {
            whereClause.OR = [
                { soNum: { contains: search, mode: 'insensitive' } },
                { customerName: { contains: search, mode: 'insensitive' } },
                { voiceNumber: { contains: search, mode: 'insensitive' } }
            ];
        }

        if (statusFilter && statusFilter !== 'ALL' && statusFilter !== 'DEFAULT') {
            whereClause.status = statusFilter;
        } else if (statusFilter === 'DEFAULT' && filter === 'pending') {
            whereClause.status = { in: ["ASSIGNED", "INPROGRESS", "PROV_CLOSED"] };
        }

        if (patFilter && patFilter !== 'ALL') {
            if (patFilter === 'READY') {
                whereClause.isInvoicable = true;
            } else if (patFilter === 'OPMC_REJECTED') {
                whereClause.opmcPatStatus = 'REJECTED';
            } else if (patFilter === 'HO_REJECTED') {
                whereClause.hoPatStatus = 'REJECTED';
            } else if (patFilter === 'HO_PASS' || patFilter === 'PAT_PASSED') {
                whereClause.hoPatStatus = 'PAT_PASSED';
            } else if (patFilter === 'SLTS_PASS') {
                whereClause.sltsPatStatus = 'PAT_PASSED';
            } else if (patFilter === 'PENDING') {
                whereClause.isInvoicable = false;
                whereClause.hoPatStatus = 'PENDING';
            }
        }

        if (matFilter && matFilter !== 'ALL') {
            const isMatPending = matFilter === 'PENDING';
            if (isMatPending) {
                whereClause.comments = { not: { contains: '[MATERIAL_COMPLETED]' } };
            } else {
                whereClause.comments = { contains: '[MATERIAL_COMPLETED]' };
            }
        }

        // Sort order
        let primaryOrderBy: Prisma.ServiceOrderOrderByWithRelationInput = { createdAt: 'desc' };
        if (filter === 'completed') {
            primaryOrderBy = { completedDate: 'desc' };
        } else if (filter === 'return') {
            primaryOrderBy = { completedDate: 'desc' };
        }

        const orderBy: Prisma.ServiceOrderOrderByWithRelationInput[] = [primaryOrderBy, { id: 'desc' }];

        // Run queries
        const [total, items, statusGroups, contractorCount, appointmentCount, opmcGroups, hoGroups, sltGroups, returnCount] = await Promise.all([
            prisma.serviceOrder.count({ where: whereClause }),
            prisma.serviceOrder.findMany({
                where: whereClause,
                select: {
                    id: true,
                    soNum: true,
                    voiceNumber: true,
                    orderType: true,
                    serviceType: true,
                    customerName: true,
                    status: true,
                    statusDate: true,
                    sltsStatus: true,
                    completedDate: true,
                    contractorId: true,
                    contractor: { select: { name: true } },
                    opmcPatStatus: true,
                    opmcPatDate: true,
                    sltsPatStatus: true,
                    sltsPatDate: true,
                    hoPatStatus: true,
                    hoPatDate: true,
                    isInvoicable: true,
                    invoiced: true,
                    package: true,
                    address: true,
                    dp: true,
                    iptv: true,
                    ontSerialNumber: true,
                    iptvSerialNumbers: true,
                    dpDetails: true,
                    revenueAmount: true,
                    contractorAmount: true,
                    dropWireDistance: true,
                    receivedDate: true,
                    createdAt: true,
                    materialUsage: {
                        select: {
                            quantity: true,
                            unitPrice: true,
                            usageType: true,
                            serialNumber: true,
                            comment: true,
                            item: { select: { name: true, code: true, unit: true } }
                        }
                    },
                    forensicAudit: {
                        select: {
                            auditData: true,
                            voiceTestStatus: true
                        }
                    }
                },
                orderBy,
                skip,
                take: limit,
                cursor: cursor ? { id: cursor } : undefined,
            }),
            prisma.serviceOrder.groupBy({
                by: ['status'],
                where: whereClause,
                _count: true
            }),
            prisma.serviceOrder.count({
                where: {
                    ...whereClause,
                    contractorId: { not: null }
                }
            }),
            prisma.serviceOrder.count({
                where: {
                    ...whereClause,
                    scheduledDate: { not: null }
                }
            }),
            prisma.serviceOrder.groupBy({ by: ['opmcPatStatus'], where: whereClause, _count: true }),
            prisma.serviceOrder.groupBy({ by: ['hoPatStatus'], where: whereClause, _count: true }),
            prisma.serviceOrder.groupBy({ by: ['sltsPatStatus'], where: whereClause, _count: true }),
            prisma.serviceOrder.count({
                where: { opmcId, sltsStatus: 'RETURN' }
            })
        ]);

        const bridgeLogs = await prisma.extensionRawData.findMany({
            where: { soNum: { in: items.map(i => i.soNum).filter(Boolean) as string[] } },
            select: { soNum: true }
        });
        const bridgeLogSet = new Set(bridgeLogs.map(l => l.soNum));

        const itemsWithLogs = items.map(item => ({
            ...item,
            hasBridgeLog: item.soNum ? bridgeLogSet.has(item.soNum) : false
        }));

        return {
            items: itemsWithLogs,
            meta: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
                nextCursor: items.length === limit ? items[items.length - 1].id : undefined
            },
            summary: {
                totalSod: total,
                contractorAssigned: contractorCount,
                appointments: appointmentCount,
                statusBreakdown: statusGroups.reduce((acc, curr) => {
                    acc[curr.status] = curr._count;
                    return acc;
                }, {} as Record<string, number>),
                totalReturns: returnCount as number,
                patBreakdown: {
                    opmc: (opmcGroups || []).reduce((acc: Record<string, number>, curr: { opmcPatStatus: string | null; _count: number }) => { 
                        acc[curr.opmcPatStatus || 'PENDING'] = curr._count; 
                        return acc; 
                    }, {} as Record<string, number>),
                    ho: (hoGroups || []).reduce((acc: Record<string, number>, curr: { hoPatStatus: string | null; _count: number }) => { 
                        acc[curr.hoPatStatus || 'PENDING'] = curr._count; 
                        return acc; 
                    }, {} as Record<string, number>),
                    slt: (sltGroups || []).reduce((acc: Record<string, number>, curr: { sltsPatStatus: string | null; _count: number }) => { 
                        acc[curr.sltsPatStatus || 'PENDING'] = curr._count; 
                        return acc; 
                    }, {} as Record<string, number>),
                }
            }
        };
    }
}
