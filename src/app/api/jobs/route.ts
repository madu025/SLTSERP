import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET all jobs
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const status = searchParams.get('status');
        const region = searchParams.get('region');
        const assigneeId = searchParams.get('assigneeId');

        const where: any = {};
        if (status) where.status = status;
        if (region) where.region = region;
        if (assigneeId) where.assignedToId = assigneeId;

        const jobs = await prisma.job.findMany({
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

        return NextResponse.json(jobs);
    } catch (error) {
        console.error('Error fetching jobs:', error);
        return NextResponse.json(
            { error: 'Failed to fetch jobs' },
            { status: 500 }
        );
    }
}

// POST create new job
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const {
            jobCode,
            name,
            description,
            customerName,
            customerContact,
            location,
            region,
            district,
            priority,
            assignedToId
        } = body;

        if (!jobCode || !name) {
            return NextResponse.json(
                { error: 'Job code and name are required' },
                { status: 400 }
            );
        }

        const existing = await prisma.job.findUnique({
            where: { jobCode }
        });

        if (existing) {
            return NextResponse.json(
                { error: 'Job code already exists' },
                { status: 409 }
            );
        }

        const job = await prisma.job.create({
            data: {
                jobCode,
                name,
                description: description || null,
                customerName: customerName || null,
                customerContact: customerContact || null,
                location: location || null,
                region: region || null,
                district: district || null,
                priority: priority || 'MEDIUM',
                assignedToId: assignedToId || null,
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

        return NextResponse.json(job, { status: 201 });
    } catch (error: any) {
        console.error('Error creating job:', error);
        if (error.code === 'P2002') {
            return NextResponse.json(
                { error: 'Job code already exists' },
                { status: 409 }
            );
        }
        return NextResponse.json(
            { error: 'Failed to create job' },
            { status: 500 }
        );
    }
}