import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { InvoiceQueryService } from './invoice/invoice.query.service';
import { InvoiceGeneratorService } from './invoice/invoice.generator.service';
import { InvoiceCalculatorService } from './invoice/invoice.calculator.service';
import { InvoiceRetentionService } from './invoice/invoice.retention.service';
import { CreateInvoiceDTO, UpdateInvoiceDTO } from '@/lib/validations/invoice.schema';
import { AppError, ErrorCode } from '@/lib/error';

export class InvoiceService {

    static async proposePenalty(invoiceId: string, amount: number, reason: string, description: string | undefined, serviceOrderId: string | undefined, userId: string, userRole: string) {
        const { primaryClient } = await import('@/lib/prisma');
        const { NotificationService } = await import('@/services/notification');

        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { name: true, role: true }
        });
        const proposerName = user ? `${user.name || 'User'} (${user.role})` : 'System User';

        const isApproverRole = userRole === 'AREA_MANAGER' || userRole === 'SUPER_ADMIN' || userRole === 'ADMIN';
        const status = isApproverRole ? 'APPROVED' : 'PENDING';

        const penalty = await primaryClient.$transaction(async (tx: any) => {
            const record = await tx.penalty.create({
                data: {
                    invoiceId,
                    amount,
                    reason: reason || 'MANUAL',
                    description: description || null,
                    serviceOrderId: serviceOrderId || null,
                    status,
                    proposedBy: proposerName
                }
            });

            if (status === 'APPROVED') {
                await InvoiceGeneratorService.recalculateInvoiceSplits(invoiceId, tx);
            }

            return record;
        });

        const invoice = await prisma.invoice.findUnique({
            where: { id: invoiceId },
            select: { invoiceNumber: true, contractorId: true }
        });
        const invNum = invoice?.invoiceNumber || invoiceId;

        if (status === 'PENDING') {
            await NotificationService.notifyByRole({
                roles: ['AREA_MANAGER', 'SUPER_ADMIN', 'ADMIN'],
                title: 'New Penalty Proposed',
                message: `A penalty of LKR ${amount.toFixed(2)} has been proposed for Invoice ${invNum} by ${proposerName}. Reason: ${reason || 'MANUAL'}.`,
                type: 'FINANCE',
                priority: 'HIGH',
                link: '/invoices'
            });
        } else if (status === 'APPROVED' && invoice?.contractorId) {
            await NotificationService.send({
                userId: invoice.contractorId,
                title: 'Penalty Applied',
                message: `A penalty of LKR ${amount.toFixed(2)} has been applied to Invoice ${invNum}. Reason: ${reason || 'MANUAL'}.`,
                type: 'FINANCE',
                priority: 'HIGH',
                link: '/invoices'
            });
        }

        return penalty;
    }

    static async updatePenaltyStatus(invoiceId: string, penaltyId: string, status: 'APPROVED' | 'REJECTED') {
        const { primaryClient } = await import('@/lib/prisma');
        const { NotificationService } = await import('@/services/notification');

        const updatedPenalty = await primaryClient.$transaction(async (tx: any) => {
            const record = await tx.penalty.update({
                where: { id: penaltyId },
                data: { status }
            });

            await InvoiceGeneratorService.recalculateInvoiceSplits(invoiceId, tx);
            return record;
        });

        const invoice = await prisma.invoice.findUnique({
            where: { id: invoiceId },
            select: { invoiceNumber: true, contractorId: true }
        });
        const invNum = invoice?.invoiceNumber || invoiceId;

        await NotificationService.notifyByRole({
            roles: ['AREA_COORDINATOR', 'QC_OFFICER', 'MANAGER', 'OSP_MANAGER', 'SUPER_ADMIN', 'ADMIN'],
            title: `Penalty ${status.toLowerCase()}`,
            message: `A proposed penalty of LKR ${updatedPenalty.amount.toFixed(2)} for Invoice ${invNum} has been ${status.toLowerCase()} by an Area Manager.`,
            type: 'FINANCE',
            priority: 'MEDIUM',
            link: '/invoices'
        });

        if (status === 'APPROVED' && invoice?.contractorId) {
            await NotificationService.send({
                userId: invoice.contractorId,
                title: 'Penalty Applied',
                message: `A proposed penalty of LKR ${updatedPenalty.amount.toFixed(2)} has been approved and applied to your Invoice ${invNum}.`,
                type: 'FINANCE',
                priority: 'HIGH',
                link: '/invoices'
            });
        }

        return updatedPenalty;
    }

    static async deletePenalty(invoiceId: string, penaltyId: string, userRole: string | null) {
        const { primaryClient } = await import('@/lib/prisma');
        
        const isApproverRole = userRole === 'AREA_MANAGER' || userRole === 'SUPER_ADMIN' || userRole === 'ADMIN';

        const penalty = await primaryClient.penalty.findUnique({
            where: { id: penaltyId }
        });

        if (!penalty) {
            throw AppError.notFound('Penalty not found');
        }

        if (!isApproverRole && penalty.status !== 'PENDING') {
            throw AppError.forbidden('Permission Denied. Only Area Managers can delete approved/rejected penalties.');
        }

        await primaryClient.$transaction(async (tx: any) => {
            await tx.penalty.delete({
                where: { id: penaltyId }
            });

            await InvoiceGeneratorService.recalculateInvoiceSplits(invoiceId, tx);
        });
    }

    /**
     * Get details of a single invoice including reconciliation
     */
    static async getInvoiceDetails(id: string) {
        const invoice = await prisma.invoice.findUnique({
            where: { id },
            include: {
                contractor: {
                    select: {
                        id: true,
                        name: true,
                        address: true,
                        contactNumber: true,
                        registrationNumber: true,
                        bankName: true,
                        bankBranch: true,
                        bankAccountNumber: true,
                    }
                },
                sods: {
                    include: {
                        materialUsage: {
                            include: {
                                item: true
                            }
                        },
                        erectedPoles: true,
                        iptvSerials: true
                    },
                    orderBy: { completedDate: 'asc' }
                },
                penalties: true,
            }
        });

        if (!invoice) {
            throw AppError.notFound('Invoice not found');
        }

        const sodsWithReconciliation = invoice.sods.map(sod => {
            const usages = sod.materialUsage;
            
            const itemMap: Record<string, {
                itemCode: string;
                itemName: string;
                localQty: number;
                bomQty: number;
                unit: string;
            }> = {};

            usages.forEach(u => {
                const itemCode = u.item.code;
                if (!itemMap[itemCode]) {
                    itemMap[itemCode] = {
                        itemCode,
                        itemName: u.item.name,
                        localQty: 0,
                        bomQty: 0,
                        unit: u.unit || 'Nos'
                    };
                }

                if (u.usageType === 'BOM_CLAIM') {
                    itemMap[itemCode].bomQty += u.quantity;
                } else {
                    itemMap[itemCode].localQty += u.quantity;
                }
            });

            const discrepancies = Object.values(itemMap).filter(item => 
                Math.abs(item.localQty - item.bomQty) > 0.001
            );

            const isMismatched = discrepancies.length > 0;

            return {
                ...sod,
                isMismatched,
                reconciliation: Object.values(itemMap),
                discrepancies
            };
        });

        const totalSodsCount = invoice.sods.length;
        const mismatchedSodsCount = sodsWithReconciliation.filter(s => s.isMismatched).length;

        return {
            id: invoice.id,
            invoiceNumber: invoice.invoiceNumber,
            title: invoice.description || `Invoice ${invoice.invoiceNumber}`,
            description: invoice.description,
            status: invoice.status,
            totalAmount: invoice.totalAmount,
            paidAmount: invoice.amountA,
            balanceAmount: invoice.amountB,
            invoiceDate: invoice.date,
            createdAt: invoice.createdAt,
            referenceNumber: invoice.agreementNumber,
            year: invoice.year,
            month: invoice.month,
            items: [],
            contractor: invoice.contractor,
            sods: sodsWithReconciliation,
            penalties: invoice.penalties,
            connectionTitle: invoice.connectionTitle,
            agreementNumber: invoice.agreementNumber,
            projectNumber: invoice.projectNumber,
            bomNumber: invoice.bomNumber,
            rtomArea: invoice.rtomArea,
            totalSodsCount,
            mismatchedSodsCount,
        };
    }

    /**
     * Get delay sheets for a specific month and RTOM
     */
    static async getDelaySheets(monthParam?: string | null, rtomParam?: string | null) {
        const targetMonth = monthParam || new Date().toISOString().substring(0, 7);
        const startOfMonth = new Date(`${targetMonth}-01T00:00:00.000Z`);
        const endOfMonth = new Date(startOfMonth.getFullYear(), startOfMonth.getMonth() + 1, 0, 23, 59, 59, 999);

        const whereClause: Prisma.ServiceOrderWhereInput = {
            receivedDate: { lte: endOfMonth }
        };

        if (rtomParam && rtomParam !== 'ALL') {
            whereClause.rtom = rtomParam;
        }

        const serviceOrders = await prisma.serviceOrder.findMany({
            where: whereClause,
            include: {
                opmc: true,
                contractor: true
            },
            orderBy: {
                receivedDate: 'asc'
            }
        });

        const delayedOrders = serviceOrders.filter(order => {
            const isCompleted = order.status === 'INSTALL_CLOSED' || order.sltsStatus === 'COMPLETED';
            
            if (isCompleted && order.completedDate) {
                const completionDate = new Date(order.completedDate);
                if (completionDate > endOfMonth) return true;
            }

            const hasShortage = order.stbShortage || order.ontShortage;
            const hasDelayReasons = order.delayReasons && typeof order.delayReasons === 'object' &&
                Object.values(order.delayReasons as Record<string, boolean>).some(Boolean);

            if (isCompleted) {
                return hasShortage || hasDelayReasons;
            }

            return true;
        });

        const formattedOrders = delayedOrders.map(o => {
            const reasonsObj = (o.delayReasons as Record<string, boolean>) || {};
            const activeReasons: string[] = [];
            
            if (reasonsObj.cxDelay) activeReasons.push('Customer Delay');
            if (reasonsObj.ontShortage || o.ontShortage) activeReasons.push('ONT Shortage');
            if (reasonsObj.stbShortage || o.stbShortage) activeReasons.push('STB Shortage');
            if (reasonsObj.nokia) activeReasons.push('Nokia/Port Issue');
            if (reasonsObj.system) activeReasons.push('SLT System Issue');
            if (reasonsObj.opmc) activeReasons.push('OPMC Pending');
            if (reasonsObj.polePending) activeReasons.push('Pole Placement Pending');
            if (reasonsObj.sameDay) activeReasons.push('Same Day Delay');

            if (activeReasons.length === 0 && o.status !== 'INSTALL_CLOSED') {
                activeReasons.push('Pending Execution');
            }

            return {
                id: o.id,
                soNum: o.soNum,
                voiceNumber: o.voiceNumber || 'N/A',
                rtom: o.rtom,
                opmcName: o.opmc?.name || o.rtom,
                customerName: o.customerName || 'N/A',
                address: o.address || 'N/A',
                status: o.status,
                sltsStatus: o.sltsStatus,
                receivedDate: o.receivedDate ? o.receivedDate.toISOString().split('T')[0] : 'N/A',
                statusDate: o.statusDate ? o.statusDate.toISOString().split('T')[0] : 'N/A',
                stbShortage: o.stbShortage,
                ontShortage: o.ontShortage,
                ontType: o.ontType || null,
                reasons: activeReasons,
                comments: o.comments || 'N/A',
                contractorName: o.contractor?.name || 'N/A'
            };
        });

        const stats = {
            total: formattedOrders.length,
            ontShortage: formattedOrders.filter(o => o.ontShortage || o.reasons.includes('ONT Shortage')).length,
            stbShortage: formattedOrders.filter(o => o.stbShortage || o.reasons.includes('STB Shortage')).length,
            cxDelay: formattedOrders.filter(o => o.reasons.includes('Customer Delay')).length,
            other: formattedOrders.filter(o => 
                !o.ontShortage && !o.stbShortage && !o.reasons.includes('Customer Delay')
            ).length
        };

        const rtoms = Array.from(new Set(serviceOrders.map(o => o.rtom).filter(Boolean)));

        return {
            month: targetMonth,
            stats,
            rtoms,
            orders: formattedOrders
        };
    }

    /**
     * Generate Monthly Invoice for a Contractor
     */
    static async generateMonthlyInvoice(contractorId: string, month: number, year: number) {
        // 1. Fetch eligible SODs
        const eligibleSods = await InvoiceQueryService.getEligibleSods(contractorId, month, year);
        if (eligibleSods.length === 0) {
            return { success: false, message: 'No eligible service orders found for this period.' };
        }

        // 2. Fetch Contractor Info
        const contractor = await prisma.contractor.findUnique({
            where: { id: contractorId }
        });
        if (!contractor) throw AppError.badRequest('CONTRACTOR_NOT_FOUND');

        // 3. Prepare common variables
        const prefix = InvoiceCalculatorService.getContractorPrefix(contractor.name);

        // 4. Group by Region and Generate
        const regions = InvoiceQueryService.groupByRegion(eligibleSods);
        const createdInvoices = [];

        for (const opmcId in regions) {
            const groupSods = regions[opmcId];
            const regionName = (groupSods[0].opmc.name.replace(/OPMC/i, '').trim() || 'REGION').toUpperCase();

            try {
                // Generate unique number: INV/[PREFIX]/[REG]/[YY]/[MM]-[SEQ]
                const invoiceNumber = await InvoiceGeneratorService.generateUniqueNumber(
                    prefix, regionName, year, month
                );

                // Calculate and Create
                const totalAmount = groupSods.reduce((sum, sod) => sum + (sod.contractorAmount || 0), 0);
                if (totalAmount === 0) continue;

                // Audit each SOD for penalties
                const penaltiesList: { amount: number; reason: string; description?: string; serviceOrderId?: string }[] = [];
                let penaltyTotal = 0;

                for (const sod of groupSods) {
                    // 1. QC Officer Quality Check Failure (opmcPatStatus === 'REJECTED')
                    if (sod.opmcPatStatus === 'REJECTED') {
                        const amt = 1500;
                        penaltiesList.push({
                            amount: amt,
                            reason: 'QC_FAILURE',
                            description: 'QC Quality Check Failure (OPMC PAT Rejected)',
                            serviceOrderId: sod.id
                        });
                        penaltyTotal += amt;
                    }

                    // 2. SLT PAT Reject (sltsPatStatus === 'REJECTED')
                    if (sod.sltsPatStatus === 'REJECTED') {
                        const amt = 2500;
                        penaltiesList.push({
                            amount: amt,
                            reason: 'PAT_REJECT',
                            description: 'SLT PAT Rejected',
                            serviceOrderId: sod.id
                        });
                        penaltyTotal += amt;
                    }

                    // 3. Material Mismatch
                    let materialMismatch = false;
                    let mismatchReason = '';

                    const dropWireDistance = sod.dropWireDistance || 0;
                    if (dropWireDistance > 0) {
                        
                        const hasDropwireMaterial = (sod as any).materialUsage?.some((mu: any) => {
                            const code = (mu.item?.code || '').toUpperCase();
                            const name = (mu.item?.name || '').toUpperCase();
                            return code.includes('F-1') || 
                                   code.includes('G-1') || 
                                   code.includes('F1') || 
                                   code.includes('G1') || 
                                   code.includes('DW') || 
                                   name.includes('F-1') || 
                                   name.includes('G-1') || 
                                   name.includes('F1') || 
                                   name.includes('G1') || 
                                   name.includes('DROP WIRE') || 
                                   name.includes('DROPWIRE') || 
                                   name.includes('DW');
                        });
                        if (!hasDropwireMaterial) {
                            materialMismatch = true;
                            mismatchReason = `Recorded drop-wire distance of ${dropWireDistance}m but no drop-wire material logged.`;
                        }
                    }

                    const isNewConnection = sod.orderType?.toUpperCase().includes('NEW') || 
                                            sod.serviceType?.toUpperCase().includes('NEW');
                    if (isNewConnection && sod.ontType === 'NEW') {
                        if (!sod.ontSerialNumber || sod.ontSerialNumber.trim() === '') {
                            materialMismatch = true;
                            mismatchReason = mismatchReason 
                                ? `${mismatchReason} Also, missing ONT Router Serial Number for a new connection.`
                                : 'Missing ONT Router Serial Number for a new connection.';
                        }
                    }

                    if (materialMismatch) {
                        const amt = 1000;
                        penaltiesList.push({
                            amount: amt,
                            reason: 'MATERIAL_MISMATCH',
                            description: mismatchReason,
                            serviceOrderId: sod.id
                        });
                        penaltyTotal += amt;
                    }
                }

                const invoice = await InvoiceGeneratorService.createRegionalInvoice({
                    invoiceNumber,
                    contractorId,
                    year,
                    month,
                    totalAmount,
                    regionName,
                    sodIds: groupSods.map(s => s.id),
                    penaltyTotal,
                    penaltiesList
                });

                createdInvoices.push(invoice);
            } catch (error) {
                console.error(`[INV-SERVICE] Failed for region ${regionName}:`, error);
            }
        }

        return {
            success: createdInvoices.length > 0,
            message: `Generated ${createdInvoices.length} invoices.`,
            invoices: createdInvoices
        };
    }

    /**
     * Check Logic for Part B (Retention) Release
     */
    static async checkRetentionEligibility() {
        return await InvoiceRetentionService.processAutoReleases();
    }

    /**
     * Get list of contractor invoices with filters
     */
    static async getInvoices(filters: { status?: string; contractorId?: string; projectId?: string }) {
        const where: Prisma.InvoiceWhereInput = {};
        if (filters.status) where.status = filters.status;
        if (filters.contractorId) where.contractorId = filters.contractorId;
        if (filters.projectId) where.projectId = filters.projectId;

        return await prisma.invoice.findMany({
            where,
            include: {
                contractor: {
                    select: {
                        id: true,
                        name: true,
                        contactNumber: true,
                        address: true,
                        registrationNumber: true,
                        bankName: true,
                        bankBranch: true,
                        bankAccountNumber: true
                    }
                },
                project: {
                    select: {
                        id: true,
                        name: true
                    }
                },
                _count: {
                    select: {
                        sods: true
                    }
                }
            },
            orderBy: {
                createdAt: 'desc'
            }
        });
    }

    /**
     * Create a manual invoice
     */
    static async createInvoice(data: CreateInvoiceDTO) {
        // Check if invoice number already exists
        const existing = await prisma.invoice.findUnique({
            where: { invoiceNumber: data.invoiceNumber }
        });

        if (existing) {
            throw new AppError('Invoice number already exists', ErrorCode.CONFLICT, 400);
        }

        return await prisma.invoice.create({
            data: {
                invoiceNumber: data.invoiceNumber,
                contractorId: data.contractorId,
                projectId: data.projectId || null,
                amount: typeof data.amount === 'string' ? parseFloat(data.amount) : data.amount,
                status: 'PENDING',
                date: new Date(),
                description: data.description || null,
                dueDate: data.dueDate ? new Date(data.dueDate) : null
            },
            include: {
                contractor: {
                    select: {
                        id: true,
                        name: true,
                        contactNumber: true
                    }
                },
                project: {
                    select: {
                        id: true,
                        name: true
                    }
                }
            }
        });
    }

    /**
     * Update an invoice
     */
    static async updateInvoice(data: UpdateInvoiceDTO) {
        const invoice = await prisma.invoice.findUnique({
            where: { id: data.id }
        });

        if (!invoice) {
            throw new AppError('Invoice not found', ErrorCode.NOT_FOUND, 404);
        }

        const updateData: Prisma.InvoiceUpdateInput & Record<string, unknown> = {};
        if (data.status !== undefined) updateData.status = data.status;
        if (data.amount !== undefined) updateData.amount = data.amount;
        if (data.description !== undefined) updateData.description = data.description;
        if (data.connectionTitle !== undefined) updateData.connectionTitle = data.connectionTitle;
        if (data.agreementNumber !== undefined) updateData.agreementNumber = data.agreementNumber;
        if (data.projectNumber !== undefined) updateData.projectNumber = data.projectNumber;
        if (data.bomNumber !== undefined) updateData.bomNumber = data.bomNumber;
        if (data.rtomArea !== undefined) updateData.rtomArea = data.rtomArea;
        if (data.projectId !== undefined) updateData.projectId = data.projectId;

        return await prisma.invoice.update({
            where: { id: data.id },
            data: updateData,
            include: {
                contractor: {
                    select: {
                        id: true,
                        name: true,
                        contactNumber: true
                    }
                },
                project: {
                    select: {
                        id: true,
                        name: true
                    }
                }
            }
        });
    }

    /**
     * Delete an invoice (only PENDING status allowed)
     */
    static async deleteInvoice(id: string) {
        const invoice = await prisma.invoice.findUnique({
            where: { id }
        });

        if (!invoice) {
            throw new AppError('Invoice not found', ErrorCode.NOT_FOUND, 404);
        }

        if (invoice.status === 'PAID') {
            throw new AppError('Cannot delete paid invoices', ErrorCode.BAD_REQUEST, 400);
        }

        await prisma.invoice.delete({
            where: { id }
        });

        return { success: true };
    }
}
