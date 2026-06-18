import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id: projectId } = await params;
        const variations = await prisma.projectVariationOrder.findMany({
            where: { projectId },
            include: { items: true, approvals: true },
            orderBy: { createdAt: 'desc' }
        });
        return NextResponse.json(variations);
    } catch (error) {
        console.error('Error fetching variations:', error);
        return NextResponse.json({ error: 'Failed to fetch variations' }, { status: 500 });
    }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id: projectId } = await params;
        const body = await request.json();
        const { title, description, changeType, costImpact, timeImpact, reason, requestedById, items } = body;
        if (!title || !changeType || !requestedById) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }
        const variation = await prisma.projectVariationOrder.create({
            data: {
                projectId,
                title,
                description: description || null,
                changeType,
                costImpact: costImpact || 0,
                timeImpact: timeImpact || 0,
                reason: reason || null,
                requestedById,
                status: 'DRAFT',
                items: items?.length ? { create: items.map((i: { description: string; quantity?: number; unitRate?: number; amount?: number }) => ({ description: i.description, quantity: i.quantity || 1, unitRate: i.unitRate || 0, amount: i.amount || (i.quantity || 1) * (i.unitRate || 0) })) } : undefined
            },
            include: { items: true, approvals: true }
        });
        return NextResponse.json(variation, { status: 201 });
    } catch (error) {
        console.error('Error creating variation:', error);
        return NextResponse.json({ error: 'Failed to create variation' }, { status: 500 });
    }
}