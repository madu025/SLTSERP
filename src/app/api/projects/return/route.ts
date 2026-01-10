import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// POST: Create Return Request
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { projectId, storeId, items, reason } = body;

        // Mock User
        const user = await prisma.user.findFirst();
        const userId = user?.id;

        if (!projectId || !storeId || !items || !userId) {
            return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
        }

        const count = await prisma.projectMaterialReturn.count();
        const returnNumber = `PMRN-${new Date().getFullYear()}-${(count + 1).toString().padStart(4, '0')}`;

        const returnReq = await prisma.projectMaterialReturn.create({
            data: {
                returnNumber,
                projectId,
                storeId,
                returnedById: userId,
                reason,
                status: 'PENDING',
                items: {
                    create: items.map((item: any) => ({
                        itemId: item.itemId,
                        quantity: parseFloat(item.quantity),
                        condition: item.condition || 'GOOD',
                        remarks: item.remarks
                    }))
                }
            }
        });

        return NextResponse.json(returnReq);
    } catch (error) {
        console.error('Error creating return:', error);
        return NextResponse.json({ error: 'Failed' }, { status: 500 });
    }
}

// GET: List Returns
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const projectId = searchParams.get('projectId');

        if (!projectId) return NextResponse.json({ error: 'Project ID required' }, { status: 400 });

        const returns = await prisma.projectMaterialReturn.findMany({
            where: { projectId },
            include: {
                store: { select: { name: true } },
                items: { include: { item: { select: { code: true, name: true, unit: true } } } },
                returnedBy: { select: { name: true } },
                approvedBy: { select: { name: true } }
            },
            orderBy: { createdAt: 'desc' }
        });

        return NextResponse.json(returns);
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Failed' }, { status: 500 });
    }
}
