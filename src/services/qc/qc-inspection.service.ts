import { prisma } from '@/lib/prisma';
import { AppError } from '@/lib/error';
import { Prisma } from '@prisma/client';

export interface QCInspectionInput {
    soNum: string;
    qcStatus: 'QC_PASSED' | 'QC_DEFECT_FLAGGED' | 'QC_REJECTED';
    qcDefects?: string[]; // e.g. ["MISSING_DROPWIRE_PHOTO", "INVALID_ONT_BARCODE"]
    qcComment?: string;
    inspectedBy?: string;
}

export class QCInspectionService {
    /**
     * Submit QC Inspection result and send automated notifications to Contractor & Team
     */
    static async submitQCInspection(data: QCInspectionInput) {
        const { soNum, qcStatus, qcDefects = [], qcComment = '' } = data;

        const sod = await prisma.serviceOrder.findUnique({
            where: { soNum },
            select: {
                id: true,
                soNum: true,
                contractorId: true,
                teamId: true,
                directTeam: true
            }
        });

        if (!sod) {
            throw AppError.notFound(`Service Order ${soNum} not found.`);
        }

        // Update Service Order QC fields
        const updatedSod = await prisma.serviceOrder.update({
            where: { soNum },
            data: {
                qcStatus,
                qcDefects: qcDefects.length > 0 ? qcDefects : undefined,
                qcComment: qcComment || undefined,
                qcInspectedAt: new Date()
            }
        });

        // Trigger Automated Notifications if Defect Flagged or Rejected
        if (qcStatus === 'QC_DEFECT_FLAGGED' || qcStatus === 'QC_REJECTED') {
            const title = `⚠️ QC Defect Flagged on SO ${soNum}`;
            const message = qcComment || `QC Officer flagged defect(s): ${qcDefects.join(', ')}. Please review and upload required photo proof.`;

            await prisma.qCNotification.create({
                data: {
                    soNum,
                    contractorId: sod.contractorId,
                    teamId: sod.teamId,
                    title,
                    message,
                    severity: qcStatus === 'QC_REJECTED' ? 'CRITICAL' : 'WARNING'
                }
            });
        }

        return updatedSod;
    }

    /**
     * Get QC Notifications for Contractor / Team
     */
    static async getQCNotifications(params: {
        contractorId?: string;
        teamId?: string;
        unreadOnly?: boolean;
        page?: number;
        limit?: number;
    }) {
        const { contractorId, teamId, unreadOnly = false, page = 1, limit = 20 } = params;
        const skip = (page - 1) * limit;

        const orConditions: Prisma.QCNotificationWhereInput[] = [];
        if (contractorId) orConditions.push({ contractorId });
        if (teamId) orConditions.push({ teamId });

        const where: Prisma.QCNotificationWhereInput = {};
        if (orConditions.length > 0) {
            where.OR = orConditions;
        }
        if (unreadOnly) {
            where.isRead = false;
        }

        const [notifications, unreadCount, total] = await Promise.all([
            prisma.qCNotification.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                skip,
                take: limit
            }),
            prisma.qCNotification.count({
                where: { ...where, isRead: false }
            }),
            prisma.qCNotification.count({ where })
        ]);

        return {
            notifications,
            unreadCount,
            total,
            page,
            limit
        };
    }

    /**
     * Mark notification as read
     */
    static async markNotificationAsRead(id: string) {
        return await prisma.qCNotification.update({
            where: { id },
            data: { isRead: true }
        });
    }

    /**
     * Mark all unread notifications as read for contractor / team
     */
    static async markAllNotificationsAsRead(params: { contractorId?: string; teamId?: string }) {
        const { contractorId, teamId } = params;
        const orConditions: Prisma.QCNotificationWhereInput[] = [];
        if (contractorId) orConditions.push({ contractorId });
        if (teamId) orConditions.push({ teamId });

        const where: Prisma.QCNotificationWhereInput = { isRead: false };
        if (orConditions.length > 0) {
            where.OR = orConditions;
        }

        return await prisma.qCNotification.updateMany({
            where,
            data: { isRead: true }
        });
    }
}
