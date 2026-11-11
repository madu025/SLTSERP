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

        // No contractor means no notifications (an empty filter used to return every contractor's notifications),
        // and a team filter only counts when the team belongs to the caller's contractor.
        if (!contractorId) return { notifications: [], unreadCount: 0, total: 0, page, limit };
        const ownTeams = await QCInspectionService.teamIdsOf(contractorId);
        const orConditions: Prisma.QCNotificationWhereInput[] = [{ contractorId }];
        if (teamId && ownTeams.includes(teamId)) orConditions.push({ teamId });

        const where: Prisma.QCNotificationWhereInput = { OR: orConditions };
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
    static async markNotificationAsRead(id: string, contractorId?: string) {
        if (!contractorId) throw AppError.forbidden('CONTRACTOR_CONTEXT_REQUIRED');
        // Only a notification addressed to this contractor (directly or through one of its teams) can be touched
        const claimed = await prisma.qCNotification.updateMany({
            where: { id, OR: [{ contractorId }, { teamId: { in: await QCInspectionService.teamIdsOf(contractorId) } }] },
            data: { isRead: true }
        });
        if (claimed.count !== 1) throw AppError.notFound('NOTIFICATION_NOT_FOUND');
        return prisma.qCNotification.findUniqueOrThrow({ where: { id } });
    }

    /** Team ids that belong to a contractor (a caller may only filter notifications by its own teams). */
    static async teamIdsOf(contractorId: string): Promise<string[]> {
        const teams = await prisma.contractorTeam.findMany({ where: { contractorId }, select: { id: true } });
        return teams.map((t) => t.id);
    }

    /**
     * Mark all unread notifications as read for contractor / team
     */
    static async markAllNotificationsAsRead(params: { contractorId?: string; teamId?: string }) {
        const { contractorId, teamId } = params;
        // Without a contractor there is nothing to scope the update to: never mark everybody's notifications
        if (!contractorId) throw AppError.forbidden('CONTRACTOR_CONTEXT_REQUIRED');
        const ownTeams = await QCInspectionService.teamIdsOf(contractorId);
        const orConditions: Prisma.QCNotificationWhereInput[] = [{ contractorId }];
        if (teamId && ownTeams.includes(teamId)) orConditions.push({ teamId });

        const where: Prisma.QCNotificationWhereInput = { isRead: false, OR: orConditions };

        return await prisma.qCNotification.updateMany({
            where,
            data: { isRead: true }
        });
    }
}
