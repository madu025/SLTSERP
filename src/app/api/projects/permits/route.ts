import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET: Fetch all permits across projects
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const projectId = searchParams.get('projectId');

        const where: Record<string, unknown> = {};
        if (projectId) where.projectId = projectId;

        const permits = await prisma.projectPermit.findMany({
            where,
            include: {
                _count: { select: { permitDocuments: true } }
            },
            orderBy: { createdAt: 'desc' }
        });

        return NextResponse.json(permits);
    } catch (error) {
        console.error('Error fetching permits:', error);
        return NextResponse.json({ error: 'Failed to fetch permits' }, { status: 500 });
    }
}

// POST: Create a new permit record
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { projectId, permitTypeId, authorityId, referenceNumber, issuedDate, expiryDate, status } = body;

        if (!projectId || !permitTypeId || !authorityId) {
            return NextResponse.json({ error: 'Missing required fields: projectId, permitTypeId, authorityId' }, { status: 400 });
        }

        const permit = await prisma.projectPermit.create({
            data: {
                projectId,
                permitTypeId,
                authorityId,
                referenceNumber: referenceNumber || null,
                issuedDate: issuedDate ? new Date(issuedDate) : null,
                expiryDate: expiryDate ? new Date(expiryDate) : null,
                status: status || 'PENDING'
            },
            include: {
                _count: { select: { permitDocuments: true } }
            }
        });

        return NextResponse.json(permit, { status: 201 });
    } catch (error) {
        console.error('Error creating permit:', error);
        return NextResponse.json({ error: 'Failed to create permit' }, { status: 500 });
    }
}