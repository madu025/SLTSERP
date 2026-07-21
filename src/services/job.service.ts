import { prisma } from '@/lib/prisma';
import { WorkflowEngine } from '@/services/WorkflowEngine';
import { AppError } from '@/lib/error';

export class JobService {
    static async getJobs(params: { status?: string; region?: string; assigneeId?: string }) {
        const where: any = {};
        if (params.status) where.status = params.status;
        if (params.region) where.region = params.region;
        if (params.assigneeId) where.assignedToId = params.assigneeId;

        return await prisma.job.findMany({
            where,
            include: {
                project: {
                    select: {
                        id: true,
                        projectCode: true,
                        name: true,
                        status: true,
                        progress: true
                    }
                },
                assignedTo: {
                    select: {
                        id: true,
                        name: true,
                        designation: true
                    }
                }
            },
            orderBy: { createdAt: 'desc' }
        });
    }

    static async createJob(data: {
        jobCode: string;
        name: string;
        description?: string;
        customerName?: string;
        customerContact?: string;
        location?: string;
        region?: string;
        district?: string;
        priority?: string;
        assignedToId?: string;
    }) {
        if (!data.jobCode || !data.name) {
            throw AppError.badRequest('Job code and name are required');
        }

        const existing = await prisma.job.findUnique({
            where: { jobCode: data.jobCode }
        });

        if (existing) {
            throw AppError.conflict('Job code already exists');
        }

        try {
            return await prisma.job.create({
                data: {
                    jobCode: data.jobCode,
                    name: data.name,
                    description: data.description || null,
                    customerName: data.customerName || null,
                    customerContact: data.customerContact || null,
                    location: data.location || null,
                    region: data.region || null,
                    district: data.district || null,
                    priority: data.priority || 'MEDIUM',
                    assignedToId: data.assignedToId || null,
                    status: 'PENDING_SURVEY'
                },
                include: {
                    assignedTo: {
                        select: {
                            id: true,
                            name: true,
                            designation: true
                        }
                    }
                }
            });
        } catch (error: any) {
            if (error?.code === 'P2002') {
                throw AppError.conflict('Job code already exists');
            }
            throw error;
        }
    }

    static async getJobById(id: string) {
        const job = await prisma.job.findUnique({
            where: { id },
            include: {
                project: { select: { id: true, projectCode: true, name: true, status: true, progress: true } },
                assignedTo: { select: { id: true, name: true, designation: true } }
            }
        });

        if (!job) {
            throw AppError.notFound('Job not found');
        }

        return job;
    }

    static async updateJob(id: string, data: any) {
        try {
            return await prisma.job.update({ where: { id }, data });
        } catch (error: any) {
            if (error?.code === 'P2025') {
                throw AppError.notFound('Job not found');
            }
            throw error;
        }
    }

    static async deleteJob(id: string) {
        try {
            await prisma.job.delete({ where: { id } });
            return true;
        } catch (error: any) {
            if (error?.code === 'P2025') {
                throw AppError.notFound('Job not found');
            }
            throw error;
        }
    }

    static async assignJobToSurvey(jobId: string, data: {
        areaManagerId?: string;
        contractorId?: string;
        opmcId?: string;
        projectTypeId?: string;
    }) {
        const job = await prisma.job.findUnique({ where: { id: jobId } });
        if (!job) {
            throw AppError.notFound('Job not found');
        }

        if (job.projectId) {
            const existingProject = await prisma.project.findUnique({ where: { id: job.projectId } });
            return { message: 'Already assigned to project', job, project: existingProject };
        }

        const year = new Date().getFullYear();
        const count = await prisma.project.count({ where: { projectCode: { startsWith: `FOSP_SLTS_${year}` } } });
        const sequence = String(count + 1).padStart(3, '0');
        const projectCode = `FOSP_SLTS_${year}_${sequence}`;

        const typeMap: Record<string, string> = {
            'Cluster Development': 'CLUSTER_DEVELOPMENT',
            'SSD': 'SSD',
            'Building Fiber': 'BUILDING_FIBER',
            'OSP FTTH': 'OSP_FTTH'
        };

        let projectType = null;
        if (data.projectTypeId) {
            projectType = await prisma.projectType.findUnique({ where: { id: data.projectTypeId } });
        }
        const type = projectType ? (typeMap[projectType.name] || 'OSP_FTTH') : 'OSP_FTTH';

        const project = await prisma.project.create({
            data: {
                projectCode,
                name: job.name,
                description: job.description || `Created from Job ${job.jobCode}`,
                type,
                location: job.location || job.region || null,
                status: 'PLANNING',
                areaManagerId: data.areaManagerId || null,
                contractorId: data.contractorId || null,
                opmcId: data.opmcId || null,
                projectTypeId: data.projectTypeId || null,
                jobId: jobId
            }
        });

        await prisma.job.update({
            where: { id: jobId },
            data: { projectId: project.id, status: 'SURVEY_IN_PROGRESS' }
        });

        if (data.projectTypeId) {
            try {
                await WorkflowEngine.initializeProjectWorkflow(project.id, data.projectTypeId);
            } catch (e) {
                console.error('[JOB-SURVEY-WORKFLOW-ERR]', e);
            }
        }

        const updatedJob = await prisma.job.findUnique({
            where: { id: jobId },
            include: { project: true, assignedTo: { select: { id: true, name: true, designation: true } } }
        });

        return {
            message: 'Job assigned to survey project. Ready for QGIS upload.',
            job: updatedJob,
            project
        };
    }
}
