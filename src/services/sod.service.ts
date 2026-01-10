import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { sltApiService } from './slt-api.service';

export class ServiceOrderService {

    /**
     * Get all service orders with filtering and sorting
     */
    static async getServiceOrders(params: {
        opmcId: string;
        filter?: string;
        page?: number;
        limit?: number;
        month?: number;
        year?: number;
    }) {
        const { opmcId, filter, page = 1, limit = 50, month, year } = params;
        const skip = (page - 1) * limit;

        if (!opmcId) {
            throw new Error('OPMC_ID_REQUIRED');
        }

        // Build where clause
        let whereClause: any = { opmcId };

        // Date Filtering
        if (month && year) {
            const startDate = new Date(year, month - 1, 1);
            const nextMonth = new Date(year, month, 1);

            if (filter === 'completed') {
                whereClause.completedDate = { gte: startDate, lt: nextMonth };
            } else if (filter === 'return') {
                whereClause.updatedAt = { gte: startDate, lt: nextMonth };
            } else {
                // Pending - filter by creation date
                whereClause.createdAt = { gte: startDate, lt: nextMonth };
            }
        }

        // Status Filtering
        if (filter === 'pending') {
            whereClause.sltsStatus = { notIn: ['COMPLETED', 'RETURN'] };
        } else if (filter === 'completed') {
            whereClause.sltsStatus = 'COMPLETED';
        } else if (filter === 'return') {
            whereClause.sltsStatus = 'RETURN';
        }

        // Determine sort order
        let orderBy: any = { createdAt: 'desc' };
        if (filter === 'completed') {
            orderBy = { completedDate: 'desc' };
        } else if (filter === 'return') {
            orderBy = { updatedAt: 'desc' };
        }

        // Run queries in parallel
        const [total, items, statusGroups, contractorCount, appointmentCount] = await Promise.all([
            prisma.serviceOrder.count({ where: whereClause }),
            prisma.serviceOrder.findMany({
                where: whereClause,
                include: {
                    materialUsage: true,
                    contractor: true,
                    team: true
                },
                orderBy,
                skip,
                take: limit
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
            })
        ]);

        const totalPages = Math.ceil(total / limit);

        const statusBreakdown = statusGroups.reduce((acc, curr) => {
            acc[curr.status] = curr._count;
            return acc;
        }, {} as Record<string, number>);

        return {
            items,
            meta: { total, page, limit, totalPages },
            summary: {
                totalSod: total,
                contractorAssigned: contractorCount,
                appointments: appointmentCount,
                statusBreakdown
            }
        };
    }

    /**
     * Update Service Order (General Update)
     */
    static async updateServiceOrder(id: string, data: any) {
        if (!id) throw new Error('ID_REQUIRED');

        return await prisma.serviceOrder.update({
            where: { id },
            data: {
                ...data,
                statusDate: data.statusDate ? new Date(data.statusDate) : undefined
            }
        });
    }

    /**
     * Patch Update (Status Change, Completion, etc.)
     * Handles complex logic like material deduction, snapshots, etc.
     */
    static async patchServiceOrder(id: string, data: any) {
        if (!id) throw new Error('ID_REQUIRED');

        const { sltsStatus, completedDate, contractorId, comments, ...otherData } = data;
        const updateData: any = {};

        // Status Logic
        if (sltsStatus) {
            if (!['INPROGRESS', 'COMPLETED', 'RETURN'].includes(sltsStatus)) {
                throw new Error('INVALID_STATUS');
            }
            updateData.sltsStatus = sltsStatus;

            if ((sltsStatus === 'COMPLETED' || sltsStatus === 'RETURN') && !completedDate) {
                throw new Error('COMPLETED_DATE_REQUIRED');
            }
        }

        if (completedDate) {
            updateData.completedDate = new Date(completedDate);
        }

        if (contractorId !== undefined) {
            updateData.contractorId = contractorId;
        }

        if (comments) {
            updateData.comments = comments;
        }

        // Add other completion fields
        if (otherData.ontSerialNumber) updateData.ontSerialNumber = otherData.ontSerialNumber;
        if (otherData.iptvSerialNumbers) updateData.iptvSerialNumbers = otherData.iptvSerialNumbers;
        if (otherData.dpDetails) updateData.dpDetails = otherData.dpDetails;
        if (otherData.teamId) updateData.teamId = otherData.teamId;
        if (otherData.directTeamName) updateData.directTeam = otherData.directTeamName;

        if (otherData.patStatus) {
            updateData.patStatus = otherData.patStatus;
            updateData.patDate = new Date();
        }

        if (otherData.completionMode) {
            updateData.completionMode = otherData.completionMode;
        }

        // Material Source Snapshot
        const configs: any[] = await prisma.$queryRaw`SELECT value FROM "SystemConfig" WHERE key = 'OSP_MATERIAL_SOURCE' LIMIT 1`;
        const currentSource = configs[0]?.value || 'SLT';

        // Material Usage Handling
        if (otherData.materialUsage && Array.isArray(otherData.materialUsage)) {
            // Transactional update for usage to ensure consistency
            await prisma.$transaction(async (tx) => {
                // 1. Clear existing
                await tx.sODMaterialUsage.deleteMany({
                    where: { serviceOrderId: id }
                });

                // 2. Create new
                updateData.materialUsage = {
                    create: otherData.materialUsage.map((m: any) => ({
                        itemId: m.itemId,
                        quantity: parseFloat(m.quantity),
                        unit: m.unit || 'Nos',
                        usageType: m.usageType || 'USED',
                        wastagePercent: m.wastagePercent ? parseFloat(m.wastagePercent) : null,
                        exceedsLimit: m.exceedsLimit || false,
                        comment: m.comment
                    }))
                };

                // 3. Stock Deduction (Contractor Stock)
                const targetContractorId = contractorId || updateData.contractorId;
                if (targetContractorId) {
                    for (const m of otherData.materialUsage) {
                        if (['USED', 'WASTAGE', 'USED_F1', 'USED_G1'].includes(m.usageType) && m.itemId && m.quantity) {
                            await tx.contractorStock.upsert({
                                where: {
                                    contractorId_itemId: {
                                        contractorId: targetContractorId,
                                        itemId: m.itemId
                                    }
                                },
                                create: {
                                    contractorId: targetContractorId,
                                    itemId: m.itemId,
                                    quantity: -parseFloat(m.quantity)
                                },
                                update: {
                                    quantity: { decrement: parseFloat(m.quantity) }
                                }
                            });
                        }
                    }
                }
            });
        }

        if (Object.keys(updateData).length === 0) {
            throw new Error('NO_FIELDS_TO_UPDATE');
        }

        const serviceOrder = await prisma.serviceOrder.update({
            where: { id },
            data: updateData
        });

        // Manual Raw update for materialSource
        await prisma.$executeRaw`UPDATE "ServiceOrder" SET "materialSource" = ${currentSource} WHERE "id" = ${id}`;

        return serviceOrder;
    }

    /**
     * Create Service Order (Manual Entry)
     */
    static async createServiceOrder(data: any) {
        const { opmcId, ...orderData } = data;

        if (!opmcId || !orderData.soNum || !orderData.status) {
            throw new Error('REQUIRED_FIELDS_MISSING');
        }

        const existing = await prisma.serviceOrder.findUnique({
            where: {
                soNum_status: {
                    soNum: orderData.soNum,
                    status: orderData.status
                }
            }
        });

        if (existing) {
            throw new Error('ORDER_EXISTS');
        }

        return await prisma.serviceOrder.create({
            data: {
                ...orderData,
                opmcId,
                statusDate: orderData.statusDate ? new Date(orderData.statusDate) : null
            }
        });
    }

    /**
     * Sync Service Orders from SLT API
     */
    static async syncServiceOrders(opmcId: string, rtom: string) {
        if (!opmcId || !rtom) {
            throw new Error('OPMC_ID_AND_RTOM_REQUIRED');
        }

        // Fetch data from SLT API
        const sltData = await sltApiService.fetchServiceOrders(rtom);

        if (!sltData || sltData.length === 0) {
            return {
                message: 'No data received from SLT API',
                synced: 0,
                updated: 0,
                created: 0,
                skipped: 0,
                markedAsMissing: 0
            };
        }

        // Optimization 1: Identify SO numbers that already have user actions (COMPLETED/RETURN)
        // This avoids querying the DB inside the loop
        const sltSoNums = sltData.map(item => item.SO_NUM);

        // Find existing records that should NOT be touched
        const lockedSods = await prisma.serviceOrder.findMany({
            where: {
                soNum: { in: sltSoNums },
                sltsStatus: { in: ['COMPLETED', 'RETURN'] }
            },
            select: { soNum: true }
        });

        const lockedSoNums = new Set(lockedSods.map(s => s.soNum));

        // Filter sltData to only process syncable items
        const syncableData = sltData.filter(item => !lockedSoNums.has(item.SO_NUM));
        const skippedCount = sltData.length - syncableData.length;

        let created = 0;
        let updated = 0;

        // Optimization 2: Process in parallel batches (No explicit transaction to avoid session timeouts)
        const batchSize = 25; // Smaller chunks for parallel execution
        for (let i = 0; i < syncableData.length; i += batchSize) {
            const batch = syncableData.slice(i, i + batchSize);

            // Execute batch in parallel
            const results = await Promise.all(
                batch.map(async (item) => {
                    try {
                        const statusDate = sltApiService.parseStatusDate(item.CON_STATUS_DATE);

                        // Upsert: create if not exists, update if status changed
                        return await prisma.serviceOrder.upsert({
                            where: {
                                soNum_status: {
                                    soNum: item.SO_NUM,
                                    status: item.CON_STATUS
                                }
                            },
                            update: {
                                lea: item.LEA,
                                voiceNumber: item.VOICENUMBER,
                                orderType: item.ORDER_TYPE,
                                serviceType: item.S_TYPE,
                                customerName: item.CON_CUS_NAME,
                                techContact: item.CON_TEC_CONTACT,
                                statusDate,
                                address: item.ADDRE,
                                dp: item.DP,
                                package: item.PKG,
                                ospPhoneClass: item.CON_OSP_PHONE_CLASS,
                                phonePurchase: item.CON_PHN_PURCH,
                                sales: item.CON_SALES,
                                woroTaskName: item.CON_WORO_TASK_NAME,
                                iptv: item.IPTV,
                                woroSeit: item.CON_WORO_SEIT,
                                ftthInstSeit: item.FTTH_INST_SIET,
                                ftthWifi: item.FTTH_WIFI,
                            },
                            create: {
                                opmcId,
                                rtom: item.RTOM,
                                lea: item.LEA,
                                soNum: item.SO_NUM,
                                voiceNumber: item.VOICENUMBER,
                                orderType: item.ORDER_TYPE,
                                serviceType: item.S_TYPE,
                                customerName: item.CON_CUS_NAME,
                                techContact: item.CON_TEC_CONTACT,
                                status: item.CON_STATUS,
                                statusDate,
                                address: item.ADDRE,
                                dp: item.DP,
                                package: item.PKG,
                                ospPhoneClass: item.CON_OSP_PHONE_CLASS,
                                phonePurchase: item.CON_PHN_PURCH,
                                sales: item.CON_SALES,
                                woroTaskName: item.CON_WORO_TASK_NAME,
                                iptv: item.IPTV,
                                woroSeit: item.CON_WORO_SEIT,
                                ftthInstSeit: item.FTTH_INST_SIET,
                                ftthWifi: item.FTTH_WIFI,
                                sltsStatus: 'INPROGRESS',
                            }
                        });
                    } catch (err) {
                        console.error(`Error syncing SO ${item.SO_NUM}:`, err);
                        return null;
                    }
                })
            );

            // Calculate stats
            results.forEach(result => {
                if (result) {
                    if (result.createdAt.getTime() === result.updatedAt.getTime()) {
                        created++;
                    } else {
                        updated++;
                    }
                }
            });
        }

        // Optimization 3: Efficiently mark missing SODs
        const missingSods = await prisma.serviceOrder.findMany({
            where: {
                opmcId,
                sltsStatus: 'INPROGRESS',
                soNum: { notIn: sltSoNums }
            },
            select: { id: true, soNum: true, comments: true }
        });

        if (missingSods.length > 0) {
            // Update in 50-item chunks for missing check
            const missingChunkSize = 50;
            for (let i = 0; i < missingSods.length; i += missingChunkSize) {
                const chunk = missingSods.slice(i, i + missingChunkSize);
                await Promise.all(chunk.map(sod =>
                    prisma.serviceOrder.update({
                        where: { id: sod.id },
                        data: {
                            comments: sod.comments?.includes('MISSING FROM SYNC')
                                ? sod.comments
                                : `[MISSING FROM SYNC - Possibly completed in SLT system]\n${sod.comments || ''}`
                        }
                    })
                ));
            }
        }

        return {
            message: 'Sync completed',
            total: sltData.length,
            created,
            updated,
            skipped: skippedCount,
            markedAsMissing: missingSods.length
        };
    }

}
