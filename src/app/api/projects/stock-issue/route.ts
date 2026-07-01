import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { projectId, storeId, items, remarks, issueDate } = body;

        // Extract authenticated User ID (Issuer) from middleware headers
        const userId = request.headers.get('x-user-id');

        if (!projectId || !storeId || !items || !items.length || !userId) {
            return NextResponse.json(
                { error: 'Missing required fields' },
                { status: 400 }
            );
        }

        // Generate Issue Number
        const count = await prisma.stockIssue.count();
        const issueNumber = `ISS-${new Date().getFullYear()}-${(count + 1).toString().padStart(4, '0')}`;

        // Verify stock availability (Preliminary check)
        for (const item of items) {
            const stock = await prisma.inventoryStock.findUnique({
                where: {
                    storeId_itemId: {
                        storeId: storeId,
                        itemId: item.itemId
                    }
                },
                include: { item: true }
            });

            if (!stock || Number(stock.quantity) < parseFloat(item.quantity)) {
                return NextResponse.json(
                    { error: `Insufficient stock for item: ${stock?.item.name || item.itemId}` },
                    { status: 400 }
                );
            }
        }

        // Fetch Project Name
        const project = await prisma.project.findUnique({
            where: { id: projectId },
            select: { name: true }
        });
        const recipientName = project ? `Project: ${project.name}` : 'Unknown Project';

        // Create PENDING Issue
        const stockIssue = await prisma.stockIssue.create({
            data: {
                issueNumber,
                storeId,
                projectId,
                issuedById: userId,
                issueType: 'PROJECT',
                recipientName,
                remarks,
                status: 'PENDING', // Wait for Approval
                createdAt: issueDate ? new Date(issueDate) : new Date(),
                items: {
                    create: items.map((item: any) => ({
                        itemId: item.itemId,
                        quantity: parseFloat(item.quantity),
                        remarks: item.remarks
                    }))
                }
            }
        });

        return NextResponse.json(stockIssue);

    } catch (error) {
        console.error('Error creating issue request:', error);
        return NextResponse.json(
            { error: 'Failed to create request' },
            { status: 500 }
        );
    }
}

// GET Issues for a project
export async function GET(request: Request) {
    try {
        // Extract authenticated User ID from middleware headers
        const userId = request.headers.get('x-user-id');
        if (!userId) {
            return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const projectId = searchParams.get('projectId');

        if (!projectId) {
            return NextResponse.json({ error: 'Project ID required' }, { status: 400 });
        }

        const issues = await prisma.stockIssue.findMany({
            where: { projectId },
            include: {
                store: { select: { name: true } },
                issuedBy: { select: { name: true } },
                items: {
                    include: {
                        item: { select: { code: true, name: true, unit: true } }
                    }
                }
            },
            orderBy: { createdAt: 'desc' }
        });

        return NextResponse.json(issues);
    } catch (error) {
        console.error('Error fetching issues:', error);
        return NextResponse.json({ error: 'Failed' }, { status: 500 });
    }
}
