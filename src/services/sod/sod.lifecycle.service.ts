import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { ServiceOrderUpdateData } from './sod-types';
import { SODInvoicingService } from './sod.invoicing.service';
import { ServiceOrderRepository } from '@/repositories/service-order.repository';
import { eventBus } from '@/lib/events/event-bus';

export class SODLifecycleService {
    /**
     * Validate status transitions and prevent duplicate SO numbers for the same status
     */
    static async validateStatusTransition(id: string, soNum: string, newStatus?: string, oldStatus?: string) {
        if (newStatus && newStatus !== oldStatus) {
            const collision = await ServiceOrderRepository.findFirst({
                where: { soNum, status: newStatus },
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
            if (!['INPROGRESS', 'COMPLETED', 'RETURN', 'PROV_CLOSED'].includes(sltsStatus)) {
                throw new Error('INVALID_STATUS');
            }
            updateData.sltsStatus = sltsStatus;
            if ((sltsStatus === 'COMPLETED' || sltsStatus === 'RETURN') && !completedDate) {
                throw new Error('COMPLETED_DATE_REQUIRED');
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
        if (contractorId !== undefined) updateData.contractorId = contractorId;
        if (comments !== undefined) updateData.comments = comments;
        if (otherData.wiredOnly !== undefined) updateData.wiredOnly = otherData.wiredOnly;

        // SLT Status fields mapping
        if (status) updateData.status = status;
        if (statusDate) updateData.statusDate = new Date(statusDate);
        if (receivedDate) updateData.receivedDate = new Date(receivedDate);

        // Completion fields mapping
        if (otherData.ontSerialNumber) updateData.ontSerialNumber = otherData.ontSerialNumber;
        if (otherData.iptvSerialNumbers) {
            updateData.iptvSerialNumbers = Array.isArray(otherData.iptvSerialNumbers) 
                ? JSON.stringify(otherData.iptvSerialNumbers) 
                : otherData.iptvSerialNumbers;
        }
        if (otherData.dpDetails !== undefined) updateData.dpDetails = otherData.dpDetails;
        if (otherData.dp !== undefined) updateData.dp = otherData.dp;
        if (otherData.voiceNumber !== undefined) updateData.voiceNumber = otherData.voiceNumber;
        if (otherData.scheduledDate !== undefined) {
            updateData.scheduledDate = otherData.scheduledDate ? new Date(otherData.scheduledDate as string) : null;
        }
        if (otherData.scheduledTime !== undefined) updateData.scheduledTime = otherData.scheduledTime;
        if (otherData.techContact !== undefined) updateData.techContact = otherData.techContact;
        if (otherData.teamId) updateData.teamId = otherData.teamId || null;
        if (otherData.directTeamName) updateData.directTeam = otherData.directTeamName;

        if (otherData.dropWireDistance !== undefined) {
            updateData.dropWireDistance = parseFloat(String(otherData.dropWireDistance || '0'));
        }

        // PAT Updates from UI
        if (otherData.sltsPatStatus) {
            updateData.sltsPatStatus = otherData.sltsPatStatus;
            if (otherData.sltsPatStatus === 'PAT_PASSED' && oldOrder.sltsPatStatus !== 'PAT_PASSED') {
                updateData.sltsPatDate = new Date();
            }
        }
        if (otherData.opmcPatStatus) {
            updateData.opmcPatStatus = otherData.opmcPatStatus;
            if (otherData.opmcPatStatus === 'PAT_PASSED' && oldOrder.opmcPatStatus !== 'PAT_PASSED') {
                updateData.opmcPatDate = new Date();
            }
        }
        if (otherData.hoPatStatus) {
            updateData.hoPatStatus = otherData.hoPatStatus;
            if (otherData.hoPatStatus === 'PAT_PASSED' && oldOrder.hoPatStatus !== 'PAT_PASSED') {
                updateData.hoPatDate = new Date();
            }
        }

        // Invoicable logic delegated to SODInvoicingService
        updateData.isInvoicable = SODInvoicingService.determineInvoicableStatus(
            otherData.sltsPatStatus as string | undefined,
            oldOrder.isInvoicable || false
        );

        return updateData;
    }

    /**
     * Post-update actions (History, Notifications, Stats)
     */
    static async handlePostUpdate(
        oldOrder: { status: string | null; sltsStatus: string | null; statusDate: Date | null },
        serviceOrder: { id: string; status: string; sltsStatus: string; opmcId: string; soNum: string; returnReason: string | null },
        updateData: Prisma.ServiceOrderUncheckedUpdateInput,
        userId: string = 'SYSTEM',
        tx?: any
    ) {
        // Track status history if status changed
        if (serviceOrder.status && serviceOrder.status !== oldOrder.status) {
            await ServiceOrderRepository.createStatusHistory({
                serviceOrderId: serviceOrder.id,
                status: serviceOrder.status,
                statusDate: updateData.statusDate 
                    ? new Date(updateData.statusDate as string | Date) 
                    : (oldOrder.statusDate || new Date())
            }, tx || prisma);
        }

        // Emit domain event for status changes
        if (serviceOrder.sltsStatus !== oldOrder.sltsStatus) {
            eventBus.publish('sod.status_changed', {
                serviceOrderId: serviceOrder.id,
                soNum: serviceOrder.soNum,
                opmcId: serviceOrder.opmcId,
                oldStatus: oldOrder.sltsStatus || 'PENDING',
                newStatus: serviceOrder.sltsStatus,
                returnReason: serviceOrder.returnReason,
                userId
            }).catch(e => {
                console.error('[LIFECYCLE-EVENT] Failed to publish status change event:', e);
            });
        }
    }
}
