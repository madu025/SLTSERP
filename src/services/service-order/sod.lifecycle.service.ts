import { AppError } from '@/lib/error';
import { prisma } from '@/lib/prisma';
import { Prisma, ServiceOrderStatus } from '@prisma/client';
import { ServiceOrderUpdateData } from '@/types/service-order/sod-sync.types';
import { TransactionClient } from '@/types/inventory/inventory-service.types';
import { UUID } from '@/types/common';
import { SODInvoicingService } from './sod.invoicing.service';
import { ServiceOrderRepository } from '@/repositories/service-order.repository';
import { eventBus } from '@/lib/events/event-bus';
import { safe } from '@/utils/safe-await.util';
import { SOD_EXTERNAL_COMPLETION_STATUSES, SOD_RETURN_STATUSES } from '@/lib/constants/sod-constants';

/** Valid ServiceOrderStatus enum members — guards raw portal/UI strings before Prisma writes */
export const SERVICE_ORDER_STATUS_VALUES = new Set<string>(Object.keys(ServiceOrderStatus));

export class SODLifecycleService {
    /**
     * Validate status transitions and prevent duplicate SO numbers for the same status
     */
    static async validateStatusTransition(id: string, soNum: string, newStatus?: string, oldStatus?: string) {
        if (newStatus && newStatus !== oldStatus) {
            const collision = await ServiceOrderRepository.findFirst({
                where: { soNum, status: newStatus as ServiceOrderStatus },
                select: { id: true }
            });
            if (collision && collision.id !== id) {
                return collision.id;
            }
        }
        return null;
    }

    /**
     * Prepare update data for status transitions
     */
    static async prepareStatusTransition(
        oldOrder: { sltsStatus: string; status: string | null; statusDate: Date | null; comments: string | null; returnReason: string | null; sltsPatStatus?: string | null; opmcPatStatus?: string | null; hoPatStatus?: string | null; isInvoicable?: boolean },
        data: ServiceOrderUpdateData
    ): Promise<Prisma.ServiceOrderUncheckedUpdateInput> {
        const { sltsStatus, status, statusDate, receivedDate, completedDate, contractorId, comments, ...otherData } = data;
        const updateData: Prisma.ServiceOrderUncheckedUpdateInput = {};

        if (sltsStatus) {
            if (!['INPROGRESS', 'COMPLETED', 'RETURN', 'PROV_CLOSED', 'OFFLINE', 'INSTALL_CLOSED'].includes(sltsStatus)) {
                throw AppError.badRequest('INVALID_STATUS');
            }
            updateData.sltsStatus = sltsStatus as ServiceOrderStatus;
            if (sltsStatus === 'COMPLETED' && !completedDate) {
                updateData.completedDate = new Date();
            }

            // Logic for Restoring a RETURNED SOD
            if (sltsStatus === 'INPROGRESS' && oldOrder.sltsStatus === 'RETURN') {
                updateData.receivedDate = new Date();
                const prevReason = oldOrder.returnReason || oldOrder.status || "Previous Return";
                const restoreComment = `[RESTORED] Prev Return: ${prevReason} (Status Date: ${oldOrder.statusDate?.toLocaleDateString() || 'N/A'})`;
                updateData.comments = oldOrder.comments ? `${oldOrder.comments}\n${restoreComment}` : restoreComment;
                updateData.returnReason = null;
            }
        }

        if (completedDate) updateData.completedDate = new Date(completedDate);
        if (contractorId !== undefined) updateData.contractorId = contractorId || null;
        if (comments !== undefined) updateData.comments = comments;
        if (otherData.wiredOnly !== undefined) updateData.wiredOnly = otherData.wiredOnly;

        // SLT Status fields mapping (enum-guarded — raw portal strings must not hit Prisma unvalidated)
        if (status) {
            const statusUpper = String(status).toUpperCase().trim();
            if (!SERVICE_ORDER_STATUS_VALUES.has(statusUpper)) {
                throw AppError.badRequest(`INVALID_STATUS: ${statusUpper}`);
            }
            updateData.status = statusUpper as ServiceOrderStatus;
        }
        if (statusDate) updateData.statusDate = new Date(statusDate);
        if (receivedDate) updateData.receivedDate = new Date(receivedDate);

        // Completion fields mapping
        if (otherData.ontSerialNumber) updateData.ontSerialNumber = otherData.ontSerialNumber;
        if (otherData.dpDetails !== undefined) updateData.dpDetails = otherData.dpDetails;
        if (otherData.dp !== undefined) updateData.dp = otherData.dp;
        if (otherData.voiceNumber !== undefined) updateData.voiceNumber = otherData.voiceNumber;
        if (otherData.scheduledDate !== undefined) {
            updateData.scheduledDate = otherData.scheduledDate ? new Date(otherData.scheduledDate as string) : null;
        }
        if (otherData.scheduledTime !== undefined) updateData.scheduledTime = otherData.scheduledTime;
        if (otherData.techContact !== undefined) updateData.techContact = otherData.techContact;
        if (otherData.teamId !== undefined) updateData.teamId = otherData.teamId || null;
        if (otherData.directTeamName !== undefined) updateData.directTeam = otherData.directTeamName || null;
        if ((otherData as Record<string, unknown>).directTeam !== undefined) updateData.directTeam = (otherData as Record<string, unknown>).directTeam || null;

        // Auto-resolve teamId if contractorId is assigned without teamId
        const cIdStr = typeof updateData.contractorId === 'string' ? updateData.contractorId : null;
        if (cIdStr && !updateData.teamId) {
            const firstTeam = await prisma.contractorTeam.findFirst({
                where: { contractorId: cIdStr },
                select: { id: true, name: true }
            });
            if (firstTeam) {
                updateData.teamId = firstTeam.id;
                if (!updateData.directTeam) {
                    updateData.directTeam = firstTeam.name;
                }
            }
        }

        if (otherData.dropWireDistance !== undefined) {
            updateData.dropWireDistance = parseFloat(String(otherData.dropWireDistance || '0'));
        }

        // PAT Updates from UI
        if (otherData.sltsPatStatus) {
            updateData.sltsPatStatus = otherData.sltsPatStatus as import('@prisma/client').PatStatusEnum;
            if (otherData.sltsPatStatus === 'PAT_PASSED' && oldOrder.sltsPatStatus !== 'PAT_PASSED') {
                updateData.sltsPatDate = new Date();
            }
        }
        if (otherData.opmcPatStatus) {
            updateData.opmcPatStatus = otherData.opmcPatStatus as import('@prisma/client').PatStatusEnum;
            if (otherData.opmcPatStatus === 'PAT_PASSED' && oldOrder.opmcPatStatus !== 'PAT_PASSED') {
                updateData.opmcPatDate = new Date();
            }
        }
        if (otherData.hoPatStatus) {
            updateData.hoPatStatus = otherData.hoPatStatus as import('@prisma/client').PatStatusEnum;
            if (otherData.hoPatStatus === 'PAT_PASSED' && oldOrder.hoPatStatus !== 'PAT_PASSED') {
                updateData.hoPatDate = new Date();
            }
        }


        // Invoicable logic delegated to SODInvoicingService
        const finalSltsPat = otherData.sltsPatStatus !== undefined ? otherData.sltsPatStatus : oldOrder.sltsPatStatus;
        const finalOpmcPat = otherData.opmcPatStatus !== undefined ? otherData.opmcPatStatus : oldOrder.opmcPatStatus;
        const finalHoPat = otherData.hoPatStatus !== undefined ? otherData.hoPatStatus : oldOrder.hoPatStatus;

        updateData.isInvoicable = SODInvoicingService.determineInvoicableStatus(
            finalSltsPat as string | null | undefined,
            finalOpmcPat as string | null | undefined,
            finalHoPat as string | null | undefined
        );

        return updateData;
    }

    /**
     * Post-update actions (History, Notifications, Stats)
     */
    static async handlePostUpdate(
        oldOrder: { status: string | null; sltsStatus: string | null; statusDate: Date | null },
        serviceOrder: { id: UUID; status: string; sltsStatus: string; opmcId: UUID; soNum: string; returnReason: string | null },
        updateData: Prisma.ServiceOrderUncheckedUpdateInput,
        userId: string = 'SYSTEM',
        tx?: TransactionClient
    ) {
        // Track status history if legacy status changed
        const legacyStatusChanged = !!serviceOrder.status && serviceOrder.status !== oldOrder.status;
        if (legacyStatusChanged) {
            await ServiceOrderRepository.createStatusHistory({
                serviceOrderId: serviceOrder.id,
                status: serviceOrder.status as ServiceOrderStatus,
                statusDate: updateData.statusDate 
                    ? new Date(updateData.statusDate as string | Date) 
                    : (oldOrder.statusDate || new Date())
            }, tx || prisma);
        }

        // Track sltsStatus transitions (effective routing field) — skip exact duplicate of legacy row
        const sltsStatusChanged = serviceOrder.sltsStatus !== oldOrder.sltsStatus;
        if (sltsStatusChanged && (!legacyStatusChanged || serviceOrder.sltsStatus !== serviceOrder.status)) {
            await ServiceOrderRepository.createStatusHistory({
                serviceOrderId: serviceOrder.id,
                status: serviceOrder.sltsStatus as ServiceOrderStatus,
                statusDate: updateData.statusDate
                    ? new Date(updateData.statusDate as string | Date)
                    : (updateData.completedDate ? new Date(updateData.completedDate as string | Date) : new Date())
            }, tx || prisma);
        }

        if (serviceOrder.sltsStatus !== oldOrder.sltsStatus) {
            void (async () => {
                const [e] = await safe(eventBus.publish('sod.status_changed', {
                    serviceOrderId: serviceOrder.id,
                    soNum: serviceOrder.soNum,
                    opmcId: serviceOrder.opmcId,
                    oldStatus: oldOrder.sltsStatus || 'PENDING',
                    newStatus: serviceOrder.sltsStatus,
                    returnReason: serviceOrder.returnReason,
                    userId
                }));
                if (e) {
                    console.error('[LIFECYCLE-EVENT] Failed to publish status change event:', e);
                }
            })();
        }
    }

    /**
     * Toggle / Mark an existing Work Order (CREATE, CREATE-UPGRD, SAME_NO, etc.) as Offline.
     * IMPORTANT: Never changes serviceType (FTTH, LTE, PSTN) or orderType.
     */
    static async toggleOfflineWorkOrder(id: string, isOffline: boolean, offlineReference?: string, reason?: string) {
        const existing = await ServiceOrderRepository.findById(id);
        if (!existing) throw AppError.notFound('Service order not found');

        const updated = await ServiceOrderRepository.update(id, {
            isOfflineWorkOrder: isOffline,
            offlineReference: offlineReference || (isOffline ? `OFFLINE-WO-${Date.now()}` : null),
            comments: reason ? `${existing.comments || ''}\n[OFFLINE FLAG]: ${reason}` : existing.comments
        });

        return updated;
    }

    /**
     * Get paginated offline work orders
     */
    static async getOfflineOrders(page: number = 1, limit: number = 50, opmcId?: string | null, status?: string | null, accessibleOpmcs?: string[]) {
        const whereClause: Record<string, unknown> = {
            isOfflineWorkOrder: true
        };

        // Tri-state OPMC isolation: undefined = admin/global; [] = deny all;
        // client opmcId is intersected with the resolved scope.
        if (accessibleOpmcs !== undefined) {
            if (opmcId && opmcId !== 'ALL') {
                whereClause.opmcId = accessibleOpmcs.includes(opmcId)
                    ? opmcId
                    : '00000000-0000-0000-0000-000000000000';
            } else {
                whereClause.opmcId = accessibleOpmcs.length > 0
                    ? { in: accessibleOpmcs }
                    : '00000000-0000-0000-0000-000000000000';
            }
        } else if (opmcId && opmcId !== 'ALL') {
            whereClause.opmcId = opmcId;
        }

        if (status && status !== 'ALL') {
            whereClause.sltsStatus = status;
        }

        const [total, orders] = await prisma.$transaction([
            prisma.serviceOrder.count({ where: whereClause }),
            prisma.serviceOrder.findMany({
                where: whereClause,
                include: {
                    opmc: { select: { id: true, rtom: true, name: true } },
                    contractor: { select: { id: true, name: true } },
                    team: { select: { id: true, name: true } },
                    materialUsage: {
                        select: {
                            id: true,
                            itemId: true,
                            quantity: true,
                            unitPrice: true
                        }
                    }
                },
                orderBy: { createdAt: 'desc' },
                skip: (page - 1) * limit,
                take: limit
            })
        ]);

        return { total, orders, page, limit, totalPages: Math.ceil(total / limit) };
    }

    /**
     * Register a new manual offline order
     */
    static async registerOfflineOrder(data: {
        soNum: string;
        rtom: string;
        opmcId: UUID;
        customerName?: string;
        voiceNumber?: string;
        serviceType: string;
        orderType: string;
        sltsStatus: ServiceOrderStatus;
        dropWireDistance: number;
        contractorId?: string;
        teamId?: string;
        offlineReference?: string;
        comments?: string;
        completedDate?: Date;
    }) {
        const compDate = data.completedDate || new Date();

        // Compute Rates using Rate Matrix & SODRevenueConfig
        const rates = await SODInvoicingService.calculateAmounts(data.rtom, data.dropWireDistance, {
            serviceType: data.serviceType,
            completedDate: compDate
        });

        const order = await prisma.serviceOrder.create({
            data: {
                soNum: data.soNum,
                rtom: data.rtom,
                opmcId: data.opmcId,
                customerName: data.customerName || 'Offline Contractor Entry',
                voiceNumber: data.voiceNumber,
                serviceType: data.serviceType,
                orderType: data.orderType,
                status: data.sltsStatus,
                sltsStatus: data.sltsStatus,
                completedDate: compDate,
                dropWireDistance: data.dropWireDistance,
                revenueAmount: rates.revenueAmount,
                contractorAmount: rates.contractorAmount,
                contractorId: data.contractorId || null,
                teamId: data.teamId || null,
                comments: data.comments || 'Registered via Offline Work Order Entry Portal',
                isOfflineWorkOrder: true,
                isManualEntry: true,
                offlineReference: data.offlineReference || `OFFLINE-WO-${Date.now()}`
            }
        });

        return order;
    }

    /**
     * Centralized mapper for External Status (ISHAMP/Excel) to Internal SLTS Status
     */
    static mapExternalStatusToSltsStatus(externalStatus: string): 'INPROGRESS' | 'COMPLETED' | 'PROV_CLOSED' | 'RETURN' {
        const conStatusUpper = (externalStatus || '').toUpperCase();
        
        const isPatRejection = conStatusUpper.includes('PAT') || conStatusUpper.includes('OPMC_REJECT') || conStatusUpper.includes('HO_REJECT');
        
        if ((SOD_EXTERNAL_COMPLETION_STATUSES as readonly string[]).includes(conStatusUpper)) {
            return 'COMPLETED';
        } else if (conStatusUpper === 'PROV_CLOSED') {
            return 'PROV_CLOSED';
        } else if (!isPatRejection && ((SOD_RETURN_STATUSES as readonly string[]).includes(conStatusUpper) || conStatusUpper.includes('RETURN') || conStatusUpper.includes('CANCEL'))) {
            return 'RETURN';
        }
        return 'INPROGRESS';
    }
}
