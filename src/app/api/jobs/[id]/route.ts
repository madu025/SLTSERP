import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { WorkflowEngine } from '@/services/WorkflowEngine';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const job = await prisma.job.findUnique({
            where: { id },
            include: {
                project: { select: { id: true, projectCode: true, name: true, status: true, progress: true } },
                assignedTo: { select: { id: true, name: true, designation: true } }
            }
        });
        if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 });
        return NextResponse.json(job);
    } catch (error) {
        return NextResponse.json({ error: 'Failed to fetch job' }, { status: 500 });
    }
}

export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const body = await request.json();
        const job = await prisma.job.update({ where: { id }, data: body });
        return NextResponse.json(job);
    } catch (error: any) {
        if (error.code === 'P2025') return NextResponse.json({ error: 'Job not found' }, { status: 404 });
        return NextResponse.json({ error: 'Failed to update job' }, { status: 500 });
    }
}

export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        await prisma.job.delete({ where: { id } });
        return NextResponse.json({ success: true });
    } catch (error: any) {
        if (error.code === 'P2025') return NextResponse.json({ error: 'Job not found' }, { status: 404 });
        return NextResponse.json({ error: 'Failed to delete job' }, { status: 500 });
    }
}

export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: jobId } = await params;
        const body = await request.json();
        const { areaManagerId, contractorId, opmcId, projectTypeId } = body;
        const job = await prisma.job.findUnique({ where: { id: jobId } });
        if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 });
        if (job.projectId) {
            const existingProject = await prisma.project.findUnique({ where: { id: job.projectId } });
            return NextResponse.json({ message: 'Already assigned to project', job, project: existingProject });
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
        if (projectTypeId) projectType = await prisma.projectType.findUnique({ where: { id: projectTypeId } });
        const type = projectType ? (typeMap[projectType.name] || 'OSP_FTTH') : 'OSP_FTTH';
        const project = await prisma.project.create({
            data: {
                projectCode,
                name: job.name,
                description: job.description || `Created from Job ${job.jobCode}`,
                type,
                location: job.location || job.region || null,
                status: 'PLANNING',
                areaManagerId: areaManagerId || null,
                contractorId: contractorId || null,
                opmcId: opmcId || null,
                projectTypeId: projectTypeId || null,
                jobId: jobId
            }
        });
        await prisma.job.update({
            where: { id: jobId },
            data: { projectId: project.id, status: 'SURVEY_IN_PROGRESS' }
        });
        if (projectTypeId) {
            try { await WorkflowEngine.initializeProjectWorkflow(project.id, projectTypeId); } catch (e) {}
        }
        const updatedJob = await prisma.job.findUnique({
            where: { id: jobId },
            include: { project: true, assignedTo: { select: { id: true, name: true, designation: true } } }
        });
        return NextResponse.json({
            message: 'Job assigned to survey project. Ready for QGIS upload.',
            job: updatedJob,
            project
        }, { status: 201 });
    } catch (error: any) {
        console.error('Error assigning job to survey:', error);
        return NextResponse.json({ error: 'Failed to assign job to survey' }, { status: 500 });
    }
}
