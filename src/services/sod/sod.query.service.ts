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

        // Build where clause using an array of AND filters to avoid OR collisions
        const andFilters: Prisma.ServiceOrderWhereInput[] = [{ opmcId }];

        // Date Filtering
        if (month && year) {
            const startDate = new Date(year, month - 1, 1);
            const nextMonth = new Date(year, month, 1);

            if (patFilter === 'READY') {
                andFilters.push({
                    hoPatDate: { gte: startDate, lt: nextMonth },
                    isInvoicable: true
                });
            } else if (filter === 'completed') {
                andFilters.push({ completedDate: { gte: startDate, lt: nextMonth } });
            } else if (filter === 'return') {
                andFilters.push({
                    OR: [
                        { completedDate: { gte: startDate, lt: nextMonth } },
                        {
                            AND: [
                                { completedDate: null },
                                { statusDate: { gte: startDate, lt: nextMonth } }
                            ]
                        }
                    ]
                });
            } else {
                andFilters.push({ createdAt: { gte: startDate, lt: nextMonth } });
            }
        }

        // Status Filtering
        const completionStatuses = ["COMPLETED", "INSTALL_CLOSED", "PAT_OPMC_PASSED", "PAT_CORRECTED"];

        if (filter === 'pending') {
            if (statusFilter === 'RETURN') {
                andFilters.push({ sltsStatus: 'RETURN' });
            } else {
                andFilters.push({
                    sltsStatus: { notIn: ['COMPLETED', 'RETURN'] },
                    status: { notIn: completionStatuses }
                });
            }
        } else if (filter === 'completed') {
            andFilters.push({
                OR: [
                    { sltsStatus: 'COMPLETED' },
                    { status: { in: completionStatuses } }
                ]
            });
        } else if (filter === 'return') {
            andFilters.push({ sltsStatus: 'RETURN' });
        }

        if (statusFilter && statusFilter !== 'ALL' && statusFilter !== 'DEFAULT') {
            andFilters.push({ status: statusFilter });
        } else if (statusFilter === 'DEFAULT' && filter === 'pending') {
            andFilters.push({ status: { in: ["ASSIGNED", "INPROGRESS", "PROV_CLOSED"] } });
        }

        if (patFilter && patFilter !== 'ALL') {
            if (patFilter === 'READY') {
                andFilters.push({ isInvoicable: true });
            } else if (patFilter === 'OPMC_REJECTED') {
                andFilters.push({ opmcPatStatus: 'REJECTED' });
            } else if (patFilter === 'HO_REJECTED') {
                andFilters.push({ hoPatStatus: 'REJECTED' });
            } else if (patFilter === 'HO_PASS' || patFilter === 'PAT_PASSED') {
                andFilters.push({ hoPatStatus: 'PAT_PASSED' });
            } else if (patFilter === 'SLTS_PASS') {
                andFilters.push({ sltsPatStatus: 'PAT_PASSED' });
            } else if (patFilter === 'PENDING') {
                andFilters.push({ isInvoicable: false, hoPatStatus: 'PENDING' });
            }
        }

        if (matFilter && matFilter !== 'ALL') {
            const isMatPending = matFilter === 'PENDING';
            if (isMatPending) {
                andFilters.push({ comments: { not: { contains: '[MATERIAL_COMPLETED]' } } });
            } else {
                andFilters.push({ comments: { contains: '[MATERIAL_COMPLETED]' } });
            }
        }

        // Clone the current andFilters for summary metrics (excludes search term table scans)
        const summaryWhereClause: Prisma.ServiceOrderWhereInput = {
            AND: [...andFilters]
        };

        // Add the search term filter ONLY to the main list items and total count query
        if (search) {
            andFilters.push({
                OR: [
                    { soNum: { contains: search, mode: 'insensitive' } },
                    { customerName: { contains: search, mode: 'insensitive' } },
                    { voiceNumber: { contains: search, mode: 'insensitive' } }
                ]
            });
        }

        const whereClause: Prisma.ServiceOrderWhereInput = {
            AND: andFilters
        };

        // Sort order
        let primaryOrderBy: Prisma.ServiceOrderOrderByWithRelationInput = { createdAt: 'desc' };
        if (filter === 'completed') {
            primaryOrderBy = { completedDate: 'desc' };
        } else if (filter === 'return') {
            primaryOrderBy = { completedDate: 'desc' };
        }

        const orderBy: Prisma.ServiceOrderOrderByWithRelationInput[] = [primaryOrderBy, { id: 'desc' }];

        // Run queries (using optimized summaryWhereClause for metrics queries)
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
                    lea: true,
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
                    woroTaskName: true,
                    scheduledDate: true,
                    techContact: true,
                    sales: true,
                    comments: true,
                    returnReason: true,
                    createdAt: true,
                    _count: {
                        select: { commentsHistory: true }
                    },
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
                where: summaryWhereClause,
                _count: true
            }),
            prisma.serviceOrder.count({
                where: {
                    ...summaryWhereClause,
                    contractorId: { not: null }
                }
            }),
            prisma.serviceOrder.count({
                where: {
                    ...summaryWhereClause,
                    scheduledDate: { not: null }
                }
            }),
            prisma.serviceOrder.groupBy({ by: ['opmcPatStatus'], where: summaryWhereClause, _count: true }),
            prisma.serviceOrder.groupBy({ by: ['hoPatStatus'], where: summaryWhereClause, _count: true }),
            prisma.serviceOrder.groupBy({ by: ['sltsPatStatus'], where: summaryWhereClause, _count: true }),
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
