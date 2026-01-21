import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { startOfDay, endOfDay } from 'date-fns';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const dateParam = searchParams.get('date');

        const selectedDate = dateParam ? new Date(dateParam) : new Date();
        const startDate = startOfDay(selectedDate);
        const endDate = endOfDay(selectedDate);

        // Get all OPMCs with their service orders for the day
        const opmcs = await prisma.oPMC.findMany({
            include: {
                serviceOrders: {
                    where: {
                        OR: [
                            { createdAt: { gte: startDate, lte: endDate } },
                            { completedDate: { gte: startDate, lte: endDate } },
                            { statusDate: { gte: startDate, lte: endDate } }
                        ]
                    },
                    include: {
                        materialUsage: {
                            include: {
                                item: true
                            }
                        }
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
        // We replicate the date filters to fetch relevant IDs
        const rawSources: any[] = await prisma.$queryRaw`
            SELECT "id", "materialSource" FROM "ServiceOrder" 
            WHERE ("createdAt" >= ${startDate} AND "createdAt" <= ${endDate})
               OR ("completedDate" >= ${startDate} AND "completedDate" <= ${endDate})
               OR ("statusDate" >= ${startDate} AND "statusDate" <= ${endDate})
        `;

        const sourceMap = new Map(rawSources.map(s => [s.id, s.materialSource]));

        // NEW: Fetch "In Hand Morning" - SODs that were pending at midnight (start of today)
        // These are SODs that existed before today AND were not completed/returned before today
        const inHandMorningOrders = await prisma.serviceOrder.groupBy({
            by: ['rtom', 'orderType'],
            where: {
                createdAt: { lt: startDate }, // Created before today
                OR: [
                    { completedDate: null }, // Never completed
                    { completedDate: { gte: startDate } }, // Completed today or later
                ],
                AND: [
                    {
                        OR: [
                            { sltsStatus: { not: 'RETURN' } }, // Not returned
                            { statusDate: { gte: startDate } }, // Or returned today or later
                        ]
                    }
                ]
            },
            _count: { id: true }
        });

        // Build a map: rtom -> { nc, rl, data, total }
        const inHandMorningMap = new Map<string, { nc: number; rl: number; data: number; total: number }>();
        inHandMorningOrders.forEach(row => {
            const rtom = row.rtom;
            if (!inHandMorningMap.has(rtom)) {
                inHandMorningMap.set(rtom, { nc: 0, rl: 0, data: 0, total: 0 });
            }
            const entry = inHandMorningMap.get(rtom)!;
            const orderType = (row.orderType || '').toUpperCase();
            const count = row._count.id;

            if (orderType.includes('CREATE') && !orderType.includes('CREATE-OR')) {
                entry.nc += count;
            } else if (orderType.includes('CREATE-OR') || orderType.includes('MODIFY-LOCATION') || orderType.includes('MODIFY LOCATION')) {
                entry.rl += count;
            } else {
                entry.data += count;
            }
            entry.total += count;
        });

        // Attach materialSource to orders in memory
        opmcs.forEach(opmc => {
            opmc.serviceOrders.forEach(order => {
                const source = sourceMap.get(order.id);
                if (source) {
                    (order as any).materialSource = source;
                }
            });
        });

        const reportData = opmcs.map(opmc => {
            const orders = opmc.serviceOrders;

            // Calculate team metrics
            const regularTeams = opmc.contractorTeams.length;
            const teamsWorked = new Set(orders.map(o => o.teamId).filter(Boolean)).size;

            // Helper function to categorize orders based on Order Type
            const categorizeOrder = (order: any) => {
                const orderType = order.orderType?.toUpperCase() || '';

                // NC (New Connection): CREATE, CREATE-UPGRD SAME NO, CREATE-RECON
                if (orderType.includes('CREATE') && !orderType.includes('CREATE-OR')) {
                    return 'nc';
                }

                // RL (Relocation): CREATE-OR, MODIFY-LOCATION
                if (orderType.includes('CREATE-OR') || orderType.includes('MODIFY-LOCATION') || orderType.includes('MODIFY LOCATION')) {
                    return 'rl';
                }

                // DATA: Orders without proper Order Type or manual entries
                // This ensures all orders are counted
                return 'data';
            };

            // In Hand Morning (from precomputed map - SODs pending at midnight)
            const inHandMorning = inHandMorningMap.get(opmc.rtom) || {
                nc: 0,
                rl: 0,
                data: 0,
                total: 0
            };

            // Received Today
            const received = {
                nc: 0,
                rl: 0,
                data: 0,
                total: 0
            };

            // Completed Today
            const completed = {
                create: 0,
                recon: 0,
                upgrade: 0,
                fnc: 0,
                or: 0,
                ml: 0,
                frl: 0,
                data: 0,
                total: 0
            };

            // Material Usage - Calculated from SODMaterialUsage relation
            const material = {
                dwSlt: 0,      // Drop Wire (SLT Source)
                dwCompany: 0,  // Drop Wire (Company Source)
                pole56: 0,  // 5.6m poles
                pole67: 0,  // 6.7m poles
                pole80: 0   // 8.0m poles
            };

            // Returned Today
            const returned = {
                nc: 0,
                rl: 0,
                data: 0,
                total: 0
            };

            // Wired Only - From database field
            const wiredOnly = {
                nc: 0,
                rl: 0,
                data: 0,
                total: 0
            };

            // Delay Reasons - From database JSON field
            const delays = {
                ontShortage: 0,
                stbShortage: 0,
                nokia: 0,
                system: 0,
                opmc: 0,
                cxDelay: 0,
                sameDay: 0,
                polePending: 0
            };

            // Process orders
            orders.forEach(order => {
                const category = categorizeOrder(order);

                // Check if received today (created today)
                if (order.createdAt >= startDate && order.createdAt <= endDate) {
                    received[category]++;
                    received.total++;
                }

                // Check if completed today
                // Use completedDate if available, otherwise fall back to statusDate for legacy records
                const completionDate = order.completedDate || order.statusDate;
                const isCompletedToday = order.sltsStatus === 'COMPLETED' &&
                    completionDate &&
                    completionDate >= startDate &&
                    completionDate <= endDate;

                if (isCompletedToday) {
                    const orderType = order.orderType?.toUpperCase() || '';
                    if (orderType.includes('CREATE') && !orderType.includes('CREATE-OR') && !orderType.includes('RECON') && !orderType.includes('UPGRD')) {
                        completed.create++;
                    } else if (orderType.includes('RECON')) {
                        completed.recon++;
                    } else if (orderType.includes('UPGRD') || orderType.includes('UPGRADE')) {
                        completed.upgrade++;
                    } else if (orderType.includes('CREATE-OR')) {
                        completed.or++;
                    } else if (orderType.includes('MODIFY-LOCATION') || orderType.includes('MODIFY LOCATION')) {
                        completed.ml++;
                    }

                    completed.total++;
                }

                // Check if returned today
                if (order.sltsStatus === 'RETURN' && order.statusDate &&
                    order.statusDate >= startDate && order.statusDate <= endDate) {
                    returned[category]++;
                    returned.total++;
                }

                // Track wired-only orders
                if ((order as any).wiredOnly) {
                    wiredOnly[category]++;
                    wiredOnly.total++;
                }

                // Track delay reasons from JSON field
                if ((order as any).delayReasons) {
                    const reasons = (order as any).delayReasons as any;
                    if (reasons.ontShortage) delays.ontShortage++;
                    if (reasons.stbShortage) delays.stbShortage++;
                    if (reasons.nokia) delays.nokia++;
                    if (reasons.system) delays.system++;
                    if (reasons.opmc) delays.opmc++;
                    if (reasons.cxDelay) delays.cxDelay++;
                    if (reasons.sameDay) delays.sameDay++;
                    if (reasons.polePending) delays.polePending++;
                }

                // Track material usage from SODMaterialUsage relation
                if (order.materialUsage && order.materialUsage.length > 0) {
                    order.materialUsage.forEach((usage: any) => {
                        const itemCategory = usage.item?.category?.toLowerCase() || '';
                        const itemName = usage.item?.name?.toLowerCase() || '';
                        const itemCode = usage.item?.code?.toUpperCase() || '';
                        const quantity = parseFloat(usage.quantity) || 0; // Use parseFloat for decimal qty like km

                        // Drop Wire - Check by Code or Name
                        // Code: OSPFTA003 is Fiber Drop Wire
                        if (itemCode === 'OSPFTA003' || itemName.includes('drop wire')) {
                            const source = (order as any).materialSource || 'SLT';
                            if (source === 'COMPANY') {
                                material.dwCompany += quantity;
                            } else {
                                material.dwSlt += quantity;
                            }
                        }
                        // Poles - categorized by size
                        // Poles - categorized by size
                        else if (itemCategory.includes('pole')) {
                            if (itemName.includes('5.6')) {
                                material.pole56 += quantity; // 5.6m poles
                            } else if (itemName.includes('6.7')) {
                                material.pole67 += quantity; // 6.7m poles
                            } else if (itemName.includes('8.0') || itemName.includes('8')) {
                                material.pole80 += quantity; // 8.0m poles
                            }
                        }
                    });
                }
            });

            const totalInHand = inHandMorning.total + received.total;

            // Balance calculation
            const balance = {
                nc: inHandMorning.nc + received.nc - completed.create - completed.fnc - returned.nc,
                rl: inHandMorning.rl + received.rl - completed.or - completed.ml - completed.frl - returned.rl,
                data: inHandMorning.data + received.data - completed.data - returned.data,
                total: 0
            };
            balance.total = balance.nc + balance.rl + balance.data;

            // Shortages - Count from database fields
            const shortages = {
                stb: orders.filter(o => (o as any).stbShortage).length,
                ont: orders.filter(o => (o as any).ontShortage).length
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
