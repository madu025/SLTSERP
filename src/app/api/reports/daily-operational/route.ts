import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSriLankaStartOfDay, getSriLankaEndOfDay } from '@/lib/timezone';

interface InHandMorningEntry {
    nc: number;
    rl: number;
    data: number;
    total: number;
}

interface ReceivedEntry {
    nc: number;
    rl: number;
    data: number;
    total: number;
}

interface CompletedEntry {
    create: number;
    recon: number;
    upgrade: number;
    fnc: number;
    or: number;
    ml: number;
    frl: number;
    data: number;
    total: number;
}

interface MaterialEntry {
    dwSlt: number;
    dwCompany: number;
    dw: number;
    pole56: number;
    pole67: number;
    pole80: number;
}

interface ReturnedEntry {
    nc: number;
    rl: number;
    data: number;
    total: number;
}

interface WiredOnlyEntry {
    nc: number;
    rl: number;
    data: number;
    total: number;
}

interface DelaysEntry {
    ontShortage: number;
    stbShortage: number;
    nokia: number;
    system: number;
    opmc: number;
    cxDelay: number;
    sameDay: number;
    polePending: number;
}

interface BalanceEntry {
    nc: number;
    rl: number;
    data: number;
    total: number;
}

interface ShortagesEntry {
    stb: number;
    ont: number;
}

interface ReportRow {
    region: string;
    province: string;
    rtom: string;
    regularTeams: number;
    teamsWorked: number;
    inHandMorning: InHandMorningEntry;
    received: ReceivedEntry;
    totalInHand: number;
    completed: CompletedEntry;
    material: MaterialEntry;
    returned: ReturnedEntry;
    wiredOnly: WiredOnlyEntry;
    delays: DelaysEntry;
    balance: BalanceEntry;
    shortages: ShortagesEntry;
}

interface StatusHistoryEntry {
    status: string;
    statusDate: Date | null | string;
}

interface MaterialUsageItem {
    category: string | null;
    name: string | null;
    code: string | null;
}

interface MaterialUsageEntry {
    item: MaterialUsageItem | null;
    quantity: number | string | { toNumber(): number }; // Handle Prisma Decimal
}

interface ServiceOrderWithRelations {
    id: string;
    orderType: string | null;
    package: string | null;
    status: string | null;
    statusDate: Date | null;
    receivedDate: Date | null;
    createdAt: Date;
    sltsStatus: string | null;
    completedDate: Date | null;
    wiredOnly: boolean | null;
    teamId: string | null;
    materialUsage: MaterialUsageEntry[];
    statusHistory: StatusHistoryEntry[];
    delayReasons?: Record<string, boolean> | null;
    stbShortage?: boolean;
    ontShortage?: boolean;
}

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const dateParam = searchParams.get('date');

        const selectedDate = dateParam ? new Date(dateParam) : new Date();
        const startDate = getSriLankaStartOfDay(selectedDate);
        const endDate = getSriLankaEndOfDay(selectedDate);

        // Get all OPMCs with their service orders for the day
        const opmcs = await prisma.oPMC.findMany({
            include: {
                serviceOrders: {
                    where: {
                        OR: [
                            { createdAt: { gte: startDate, lte: endDate } },
                            { completedDate: { gte: startDate, lte: endDate } },
                            { statusDate: { gte: startDate, lte: endDate } },
                            { receivedDate: { gte: startDate, lte: endDate } },
                            { updatedAt: { gte: startDate, lte: endDate } }
                        ]
                    },
                    include: {
                        materialUsage: {
                            include: {
                                item: true
                            }
                        },
                        statusHistory: true
                    }
                },
                contractorTeams: {
                    include: {
                        members: true
                    }
                }
            },
            orderBy: [
                { region: 'asc' },
                { province: 'asc' },
                { rtom: 'asc' }
            ]
        });

        // Workaround: Fetch materialSource via raw query since client validation might fail (stale client)
        const rawSources: { id: string; materialSource: string }[] = await prisma.$queryRaw`
            SELECT "id", "materialSource" FROM "ServiceOrder" 
            WHERE ("createdAt" >= ${startDate} AND "createdAt" <= ${endDate})
               OR ("completedDate" >= ${startDate} AND "completedDate" <= ${endDate})
               OR ("statusDate" >= ${startDate} AND "statusDate" <= ${endDate})
        `;

        const sourceMap = new Map<string, string>(rawSources.map(s => [s.id, s.materialSource]));

        // NEW: Fetch "In Hand Morning" - SODs that were pending at midnight (start of today)
        const inHandMorningOrders = await prisma.serviceOrder.groupBy({
            by: ['rtom', 'orderType'],
            where: {
                createdAt: { lt: startDate },
                AND: [
                    // Was NOT completed before today
                    {
                        OR: [
                            { sltsStatus: { not: 'COMPLETED' } },
                            { statusDate: { gte: startDate } }
                        ]
                    },
                    // Was NOT returned before today
                    {
                        OR: [
                            { sltsStatus: { not: 'RETURN' } },
                            { statusDate: { gte: startDate } }
                        ]
                    }
                ]
            },
            _count: { id: true }
        });

        // Build a map: rtom -> InHandMorningEntry
        const inHandMorningMap = new Map<string, InHandMorningEntry>();
        inHandMorningOrders.forEach(row => {
            const rtom = row.rtom;
            if (!inHandMorningMap.has(rtom)) {
                inHandMorningMap.set(rtom, { nc: 0, rl: 0, data: 0, total: 0 });
            }
            const entry = inHandMorningMap.get(rtom)!;
            const orderType = (row.orderType || '').toUpperCase();
            const count = row._count.id;

            if (orderType.includes('CREATE-OR') || orderType.includes('MODIFY-LOCATION') || orderType.includes('MODIFY LOCATION')) {
                entry.rl += count;
            } else if (orderType.includes('CREATE') || orderType.includes('F-NC')) {
                entry.nc += count;
            } else if (orderType.includes('F-RL')) {
                entry.rl += count;
            } else {
                entry.data += count;
            }
            entry.total += count;
        });

        const reportData: ReportRow[] = opmcs.map(opmc => {
            const orders = opmc.serviceOrders as unknown as ServiceOrderWithRelations[];

            // Calculate team metrics
            const regularTeams = opmc.contractorTeams.length;
            const teamsWorked = new Set(orders.map(o => o.teamId).filter(Boolean)).size;

            // Unified categorization function
            const categorizeOrder = (order: { orderType?: string | null; package?: string | null }) => {
                const orderType = order.orderType?.toUpperCase() || '';
                const packageInfo = (order.package || '').toUpperCase();

                if (orderType.includes('CREATE-OR') || orderType.includes('MODIFY-LOCATION') || orderType.includes('MODIFY LOCATION') || orderType.includes('F-RL') || packageInfo.includes('FRL')) {
                    return 'rl' as const;
                }

                if (
                    orderType.includes('CREATE') ||
                    orderType.includes('F-NC') ||
                    orderType.includes('RECON') ||
                    orderType.includes('UPGRADE') ||
                    orderType.includes('UPGRD') ||
                    packageInfo.includes('FNC') ||
                    packageInfo.includes('VOICE') ||
                    packageInfo.includes('INT') ||
                    packageInfo.includes('IPTV')
                ) {
                    return 'nc' as const;
                }

                return 'data' as const;
            };

            const inHandMorning = { nc: 0, rl: 0, data: 0, total: 0 };
            const opmcInHandMorning = inHandMorningOrders.filter(row => row.rtom === opmc.rtom);
            opmcInHandMorning.forEach(row => {
                const category = categorizeOrder({ orderType: row.orderType });
                const count = row._count.id;
                inHandMorning[category] += count;
                inHandMorning.total += count;
            });

            const received: ReceivedEntry = { nc: 0, rl: 0, data: 0, total: 0 };
            const completed: CompletedEntry = { create: 0, recon: 0, upgrade: 0, fnc: 0, or: 0, ml: 0, frl: 0, data: 0, total: 0 };
            const material: MaterialEntry = { dwSlt: 0, dwCompany: 0, dw: 0, pole56: 0, pole67: 0, pole80: 0 };
            const returned: ReturnedEntry = { nc: 0, rl: 0, data: 0, total: 0 };
            const wiredOnly: WiredOnlyEntry = { nc: 0, rl: 0, data: 0, total: 0 };
            const delays: DelaysEntry = { ontShortage: 0, stbShortage: 0, nokia: 0, system: 0, opmc: 0, cxDelay: 0, sameDay: 0, polePending: 0 };

            orders.forEach(order => {
                const category = categorizeOrder(order);
                const source = sourceMap.get(order.id) || 'SLT';

                const rDate = order.createdAt; // Use system arrival date for "Received Today"
                if (rDate >= startDate && rDate <= endDate) {
                    received[category]++;
                    received.total++;
                }

                const statusStr = order.status?.toUpperCase() || '';
                const isInstallClosedToday = (statusStr === 'INSTALL_CLOSED' || order.sltsStatus === 'COMPLETED') && (
                    (order.statusDate && order.statusDate >= startDate && order.statusDate <= endDate) ||
                    (order.completedDate && order.completedDate >= startDate && order.completedDate <= endDate)
                );

                const hadInstallClosedHistoryToday = order.statusHistory?.some((h) =>
                    h.status?.toUpperCase() === 'INSTALL_CLOSED' &&
                    h.statusDate && new Date(h.statusDate) >= startDate && new Date(h.statusDate) <= endDate
                );

                if (isInstallClosedToday || hadInstallClosedHistoryToday) {
                    const orderType = order.orderType?.toUpperCase() || '';
                    const packageInfo = (order.package || '').toUpperCase();

                    if (orderType.includes('RECON')) {
                        completed.recon++;
                    } else if (orderType.includes('UPGRADE') || orderType.includes('UPGRD')) {
                        completed.upgrade++;
                    } else if (orderType.includes('CREATE-OR')) {
                        completed.or++;
                    } else if (orderType.includes('MODIFY-LOCATION') || orderType.includes('MODIFY LOCATION')) {
                        completed.ml++;
                    } else if (orderType.includes('F-NC') || packageInfo.includes('FNC')) {
                        completed.fnc++;
                    } else if (orderType.includes('F-RL') || packageInfo.includes('FRL')) {
                        completed.frl++;
                    } else if (orderType.includes('CREATE')) {
                        completed.create++;
                    } else if (packageInfo.includes('VOICE') || packageInfo.includes('INT') || packageInfo.includes('IPTV')) {
                        completed.create++;
                    } else {
                        completed.data++;
                    }
                    completed.total++;
                }

                if (order.sltsStatus === 'RETURN' && order.statusDate &&
                    order.statusDate >= startDate && order.statusDate <= endDate) {
                    returned[category]++;
                    returned.total++;
                }

                const isProvClosedToday = order.status === 'PROV_CLOSED' && order.statusDate && order.statusDate >= startDate && order.statusDate <= endDate;
                const hadProvClosedHistoryToday = order.statusHistory?.some((h) =>
                    h.status === 'PROV_CLOSED' &&
                    h.statusDate && new Date(h.statusDate) >= startDate && new Date(h.statusDate) <= endDate
                );

                if (isProvClosedToday || hadProvClosedHistoryToday || order.wiredOnly === true) {
                    wiredOnly[category]++;
                    wiredOnly.total++;
                }

                if (order.delayReasons) {
                    const reasons = order.delayReasons as Record<string, boolean>;
                    if (reasons.ontShortage) delays.ontShortage++;
                    if (reasons.stbShortage) delays.stbShortage++;
                    if (reasons.nokia) delays.nokia++;
                    if (reasons.system) delays.system++;
                    if (reasons.opmc) delays.opmc++;
                    if (reasons.cxDelay) delays.cxDelay++;
                    if (reasons.sameDay) delays.sameDay++;
                    if (reasons.polePending) delays.polePending++;
                }

                if (order.materialUsage && order.materialUsage.length > 0) {
                    order.materialUsage.forEach((usage) => {
                        const itemCategory = usage.item?.category?.toLowerCase() || '';
                        const itemName = usage.item?.name?.toLowerCase() || '';
                        const itemCode = usage.item?.code?.toUpperCase() || '';

                        let quantity = 0;
                        if (typeof usage.quantity === 'number') {
                            quantity = usage.quantity;
                        } else if (usage.quantity && typeof usage.quantity === 'object' && 'toNumber' in usage.quantity) {
                            quantity = (usage.quantity as { toNumber(): number }).toNumber();
                        } else {
                            quantity = parseFloat(usage.quantity as string) || 0;
                        }

                        if (itemCode === 'OSPFTA003' || itemName.includes('drop wire')) {
                            if (source === 'COMPANY') {
                                material.dwCompany += quantity;
                            } else {
                                material.dwSlt += quantity;
                            }
                            material.dw += quantity;
                        } else if (itemCategory.includes('pole')) {
                            if (itemName.includes('5.6')) {
                                material.pole56 += quantity;
                            } else if (itemName.includes('6.7')) {
                                material.pole67 += quantity;
                            } else if (itemName.includes('8.0') || itemName.includes('8')) {
                                material.pole80 += quantity;
                            }
                        }
                    });
                }
            });

            const totalInHand = inHandMorning.total + received.total;

            const balance: BalanceEntry = {
                nc: inHandMorning.nc + received.nc - (completed.create + completed.fnc + completed.recon + completed.upgrade) - returned.nc,
                rl: inHandMorning.rl + received.rl - (completed.or + completed.ml + completed.frl) - returned.rl,
                data: inHandMorning.data + received.data - completed.data - returned.data,
                total: 0
            };
            balance.total = balance.nc + balance.rl + balance.data;

            const shortages: ShortagesEntry = {
                stb: orders.filter(o => o.stbShortage).length,
                ont: orders.filter(o => o.ontShortage).length
            };

            return {
                region: opmc.region,
                province: opmc.province,
                rtom: opmc.rtom,
                regularTeams,
                teamsWorked,
                inHandMorning,
                received,
                totalInHand,
                completed,
                material,
                returned,
                wiredOnly,
                delays,
                balance,
                shortages
            };
        });

        return NextResponse.json({
            reportData,
            date: selectedDate.toISOString().split('T')[0]
        });

    } catch (error) {
        console.error('Daily Operational Report Error:', error);
        return NextResponse.json({ error: 'Failed to generate report' }, { status: 500 });
    }
}

