import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';

interface CreateTimesheetInput {
    projectId: string;
    taskId: string;
    staffId?: string | null;
    contractorId?: string | null;
    date?: string | Date | null;
    hours: number;
    description?: string | null;
}

export class ProjectTimesheetService {
    static async getTimesheets(projectId?: string | null, taskId?: string | null, dateStr?: string | null) {
        const where: Prisma.TimesheetWhereInput = {};
        
        if (projectId) where.projectId = projectId;
        if (taskId) where.taskId = taskId;
        
        if (dateStr) {
            const d = new Date(dateStr);
            if (!isNaN(d.getTime())) {
                where.date = {
                    gte: new Date(d.setHours(0, 0, 0, 0)),
                    lte: new Date(d.setHours(23, 59, 59, 999))
                };
            }
        }

        return await prisma.timesheet.findMany({
            where,
            include: {
                task: { select: { id: true, name: true, wbsCode: true } }
            },
            orderBy: { date: 'desc' }
        });
    }

    static async createTimesheet(data: CreateTimesheetInput) {
        return await prisma.timesheet.create({
            data: {
                projectId: data.projectId,
                taskId: data.taskId,
                staffId: data.staffId || null,
                contractorId: data.contractorId || null,
                date: data.date ? new Date(data.date) : new Date(),
                hours: Number(data.hours),
                description: data.description || null,
                status: 'PENDING'
            },
            include: {
                task: { select: { id: true, name: true, wbsCode: true } }
            }
        });
    }

    static async updateTimesheetStatus(id: string, status: string, verifiedById?: string | null) {
        return await prisma.timesheet.update({
            where: { id },
            data: {
                status,
                verifiedById: verifiedById || null,
                verifiedAt: status === 'APPROVED' || status === 'REJECTED' ? new Date() : null
            }
        });
    }
}