import { AppError } from '@/lib/error';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { GetServiceOrdersParams } from './sod-types';

interface ServiceOrderItemWithIptv {
    id: string;
    soNum: string;
    voiceNumber: string | null;
    orderType: string;
    serviceType: string;
    customerName: string;
    lea: string | null;
    status: string;
    statusDate: Date | null;
    sltsStatus: string;
    completedDate: Date | null;
    contractorId: string | null;
    contractor: { name: string } | null;
    opmcPatStatus: string | null;
    opmcPatDate: Date | null;
    sltsPatStatus: string | null;
    sltsPatDate: Date | null;
    hoPatStatus: string | null;
    hoPatDate: Date | null;
    isInvoicable: boolean;
    invoiced: boolean;
    package: string | null;
    address: string | null;
    dp: string | null;
    iptv: string | null;
    ontSerialNumber: string | null;
    iptvSerials: { serialNumber: string }[];
    dpDetails: string | null;
    revenueAmount: Prisma.Decimal | null;
    contractorAmount: Prisma.Decimal | null;
    dropWireDistance: Prisma.Decimal | null;
    receivedDate: Date | null;
    woroTaskName: string | null;
    scheduledDate: Date | null;
    techContact: string | null;
    sales: string | null;
    comments: string | null;
    returnReason: string | null;
    createdAt: Date;
    _count: { commentsHistory: number };
    materialUsage: { quantity: number; unitPrice: Prisma.Decimal; usageType: string; serialNumber: string | null; comment: string | null; item: { name: string; code: string; unit: string } }[];
    forensicAudit: { auditData: string | null; voiceTestStatus: string | null } | null;
}

export class SODQueryService {
    /**
     * Get all service orders with filtering and sorting
     */
    static async getServiceOrders(params: GetServiceOrdersParams) {
        const { rtomId: opmcId, filter, search, statusFilter, patFilter, matFilter, page = 1, limit = 50, cursor, month, year } = params;

        // Offset-based fallback for backward compatibility
        const skip = cursor ? 1 : (page - 1) * limit;

        // Build where clause using an array of AND filters to avoid OR collisions
        const andFilters: Prisma.ServiceOrderWhereInput[] = [];
        if (opmcId && opmcId !== 'ALL') {
            // Resolve whether opmcId is a CUID or RTOM code string (e.g. 'R-KX' / 'r-kx')
            const matchedOpmc = await prisma.oPMC.findFirst({
                where: {
                    OR: [
                        { id: opmcId },
                        { rtom: { equals: opmcId, mode: 'insensitive' } },
                        { name: { contains: opmcId, mode: 'insensitive' } }
                    ]
                },
                select: { id: true }
            });
            const targetOpmcId = matchedOpmc ? matchedOpmc.id : opmcId;
            andFilters.push({ opmcId: targetOpmcId });
        }

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
                    sltsStatus: { notIn: ['COMPLETED', 'INSTALL_CLOSED', 'RETURN'] },
                    status: { notIn: completionStatuses }
                });
            }
        } else if (filter === 'install_closed') {
            andFilters.push({
                OR: [
                    { sltsStatus: 'INSTALL_CLOSED' },
                    { status: 'INSTALL_CLOSED' }
                ]
            });
        } else if (filter === 'completed') {
            andFilters.push({
                OR: [
                    { sltsStatus: 'COMPLETED' },
                    { status: 'COMPLETED' }
                ]
            });
        } else if (filter === 'return') {
            andFilters.push({ sltsStatus: 'RETURN' });
        }

        if (statusFilter && statusFilter !== 'ALL' && statusFilter !== 'DEFAULT') {
            if (statusFilter === 'ASSIGNED') {
                andFilters.push({ status: { in: ['ASSIGNED', 'ASSIGN'] } });
            } else {
                andFilters.push({ status: statusFilter });
            }
        } else if (statusFilter === 'DEFAULT' && filter === 'pending') {
            andFilters.push({ status: { in: ["ASSIGNED", "ASSIGN", "INPROGRESS", "PROV_CLOSED", "OFFLINE"] } });
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
            (prisma.serviceOrder as unknown as { findMany: (args: unknown) => Promise<ServiceOrderItemWithIptv[]> }).findMany({
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
                    iptvSerials: { select: { serialNumber: true } },
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
                    completionMode: true,
                    directTeam: true,
                    returnReason: true,
                    createdAt: true,
                    _count: {
                        select: { commentsHistory: true }
                    },
                    materialUsage: {
                        select: {
                            id: true,
                            itemId: true,
                            quantity: true,
                            unitPrice: true,
                            usageType: true,
                            serialNumber: true,
                            comment: true,
                            item: { select: { id: true, name: true, code: true, unit: true } }
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

    /**
     * Get unique service order by soNum with full details
     */
    static async getServiceOrderBySoNum(soNum: string) {
        const order = await prisma.serviceOrder.findUnique({
            where: { soNum },
            include: {
                contractor: { select: { name: true } },
                team: { select: { name: true, sltCode: true } },
                materialUsage: {
                    select: {
                        id: true,
                        itemId: true,
                        quantity: true,
                        unitPrice: true,
                        usageType: true,
                        serialNumber: true,
                        item: { select: { id: true, name: true, code: true, unit: true } }
                    }
                },
                forensicAudit: {
                    select: {
                        auditData: true,
                        voiceTestStatus: true
                    }
                },
                statusHistory: {
                    orderBy: { statusDate: 'desc' },
                    select: {
                        id: true,
                        status: true,
                        statusDate: true,
                        createdAt: true
                    }
                },
                restoreRequests: {
                    orderBy: { createdAt: 'desc' },
                    select: {
                        id: true,
                        reason: true,
                        status: true,
                        createdAt: true
                    }
                },
                commentsHistory: {
                    orderBy: { createdAt: 'desc' },
                    select: {
                        id: true,
                        comment: true,
                        createdAt: true,
                        author: { select: { name: true } }
                    }
                }
            }
        });

        if (order) return order;

        // Fallback: Check if it exists in PAT Statuses
        const patStatus = await prisma.sLTPATStatus.findUnique({
            where: { soNum }
        });

        if (patStatus) {
            // Retrieve comments from raw scraper payload if present
            const rawExt = await prisma.extensionRawData.findFirst({
                where: { soNum },
                orderBy: { createdAt: 'desc' }
            });
            const scraped = rawExt?.scrapedData as Record<string, unknown> | null;
            const commentsList = ((scraped?.commentsList || []) as unknown) as { date?: string; user?: string; comment?: string }[];

            return {
                id: patStatus.id,
                soNum: patStatus.soNum,
                rtom: patStatus.rtom,
                lea: patStatus.lea,
                voiceNumber: patStatus.voiceNumber,
                serviceType: patStatus.sType,
                orderType: patStatus.orderType,
                status: patStatus.status,
                statusDate: patStatus.statusDate,
                sltsStatus: 'NOT_IN_SYSTEM',
                package: patStatus.package,
                contractorId: null,
                contractor: null,
                team: null,
                materialUsage: [],
                forensicAudit: null,
                statusHistory: [],
                restoreRequests: [],
                commentsHistory: commentsList.map((c, idx) => ({
                    id: `scraped-${idx}`,
                    comment: c.comment || '',
                    createdAt: c.date ? new Date(c.date) : new Date(),
                    author: { name: c.user || 'Portal User' }
                })),
                createdAt: patStatus.updatedAt,
                updatedAt: patStatus.updatedAt
            } as unknown as import('@prisma/client').ServiceOrder;
        }

        return null;
    }

    /**
     * Get first extension raw data record by soNum
     */
    static async getExtensionRawData(soNum: string) {
        return await prisma.extensionRawData.findFirst({
            where: { soNum: soNum.trim().toUpperCase() },
            orderBy: { createdAt: 'desc' }
        });
    }

    /**
     * Get PAT results with filtering and pagination, enriched with internal service order info
     */
    static async getPatResults(params: {
        page?: number;
        limit?: number;
        search?: string;
        status?: string;
        rtom?: string;
        region?: string;
        startDate?: string;
        endDate?: string;
    }) {
        const { page = 1, limit = 20, search = '', status = 'ALL', rtom = 'ALL', region = 'ALL', startDate, endDate } = params;
        const skip = (page - 1) * limit;

        const where: Prisma.SLTPATStatusWhereInput = {};

        if (search) {
            where.soNum = { contains: search, mode: 'insensitive' };
        }

        if (rtom !== 'ALL') {
            where.rtom = rtom;
        } else if (region !== 'ALL') {
            const regionOpmcs = await prisma.oPMC.findMany({
                where: { region },
                select: { rtom: true }
            });
            where.rtom = { in: regionOpmcs.map(o => o.rtom) };
        }

        if (startDate && endDate) {
            where.statusDate = {
                gte: new Date(startDate),
                lte: new Date(endDate)
            };
        }

        if (status === 'ACCEPTED') {
            where.status = 'PAT_PASSED';
            where.source = 'HO_APPROVED';
        } else if (status === 'REJECTED') {
            where.status = { in: ['PAT_REJECTED', 'REJECTED'] };
            where.source = 'HO_REJECTED';
        } else if (status === 'OPMC_REJECTED') {
            where.status = { in: ['OPMC_REJECTED', 'REJECTED', 'PAT_OPMC_REJECTED'] };
            where.source = { in: ['SYNC', 'OPMC_REJECTED'] };
        } else if (status !== 'ALL') {
            where.source = status;
        }

        const [results, total, rtoms] = await Promise.all([
            prisma.sLTPATStatus.findMany({
                where,
                skip,
                take: limit,
                orderBy: { statusDate: 'desc' },
            }),
            prisma.sLTPATStatus.count({
                where
            }),
            prisma.oPMC.findMany({ select: { rtom: true }, orderBy: { rtom: 'asc' } })
        ]);

        // Enrich results with ServiceOrder internal info
        const soNums = results.map(r => r.soNum);
        const internalOrders = await prisma.serviceOrder.findMany({
            where: { soNum: { in: soNums } },
            select: {
                soNum: true,
                sltsStatus: true,
                sltsPatStatus: true,
                isInvoicable: true
            }
        });

        const internalOrderMap = new Map(internalOrders.map(io => [io.soNum, io]));

        const orders = results.map(r => {
            const internal = internalOrderMap.get(r.soNum);

            return {
                id: r.id,
                soNum: r.soNum,
                rtom: r.rtom,
                lea: r.lea,
                voiceNumber: r.voiceNumber,
                sType: r.sType,
                orderType: r.orderType,
                task: r.task,
                package: r.package,
                conName: r.conName,
                patUser: r.patUser,
                status: r.status,
                statusDate: r.statusDate,
                source: r.source,
                hasDuplicate: (r as unknown as { hasDuplicate: boolean }).hasDuplicate,
                // Internal metadata
                sltsStatus: internal?.sltsStatus || 'NOT_IN_SYSTEM',
                sltsPatStatus: internal?.sltsPatStatus || 'PENDING',
                isInvoicable: internal?.isInvoicable || false
            };
        });

        // Fetch all OPMCs for region mapping
        const allOpmcs = await prisma.oPMC.findMany({
            select: { rtom: true, region: true },
            orderBy: { rtom: 'asc' }
        });
        const rtomRegionMap: Record<string, string> = {};
        const availableRegionsSet = new Set<string>();
        allOpmcs.forEach(o => {
            rtomRegionMap[o.rtom] = o.region;
            availableRegionsSet.add(o.region);
        });
        const availableRegions = Array.from(availableRegionsSet).sort();

        return {
            orders,
            total,
            totalPages: Math.ceil(total / limit),
            rtoms: rtoms.map(r => r.rtom),
            availableRegions,
            rtomRegionMap
        };
    }

    /**
     * Get OSP FTTH items for manual mapping
     */
    static async getOspFtthItems() {
        return await prisma.inventoryItem.findMany({
            where: {
                isOspFtth: true
            },
            select: {
                id: true,
                code: true,
                name: true,
                source: true,
                commonName: true,
                importAliases: true
            },
            orderBy: {
                name: 'asc'
            }
        });
    }
}
