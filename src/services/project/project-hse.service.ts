import { prisma } from '@/lib/prisma';
import { AppError } from '@/lib/error';

interface HSEAttendeeInput {
    name: string;
    designation?: string;
    signatureUrl?: string;
}

interface CreateHSELogInput {
    logType: string;
    title: string;
    description?: string;
    severity?: string;
    location?: string;
    recordedById: string;
    attendees?: HSEAttendeeInput[];
}

interface UpdateHSELogInput {
    status?: string;
    correctiveAction?: string;
    closedById?: string;
}

export class ProjectHSEService {
    static async getSafetyLogs(projectId: string) {
        return await prisma.hSESafetyLog.findMany({
            where: { projectId },
            include: { attendees: true },
            orderBy: { date: 'desc' }
        });
    }

    static async createSafetyLog(projectId: string, data: CreateHSELogInput) {
        const { logType, title, description, severity, location, recordedById, attendees } = data;

        return await prisma.hSESafetyLog.create({
            data: {
                projectId,
                logType,
                title,
                description: description || null,
                severity: severity || null,
                location: location || null,
                recordedById,
                attendees: attendees?.length ? {
                    create: attendees.map(a => ({
                        name: a.name,
                        designation: a.designation || null,
                        signatureUrl: a.signatureUrl || null,
                        attendedAt: new Date()
                    }))
                } : undefined
            },
            include: { attendees: true }
        });
    }

    static async updateSafetyLog(logId: string, data: UpdateHSELogInput) {
        const { status, correctiveAction, closedById } = data;

        return await prisma.hSESafetyLog.update({
            where: { id: logId },
            data: {
                status: status ?? undefined,
                correctiveAction: correctiveAction ?? undefined,
                closedById: closedById ?? undefined,
                closedAt: status === 'CLOSED' ? new Date() : undefined
            },
            include: { attendees: true }
        });
    }
}
