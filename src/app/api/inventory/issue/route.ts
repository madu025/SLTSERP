import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth'; // Adjust path if needed

// POST: Issue materials to a contractor
export async function POST(request: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) {
            return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { contractorId, storeId, month, items } = body;

        // Validation
        if (!contractorId || !storeId || !month || !items || !Array.isArray(items) || items.length === 0) {
            return NextResponse.json({ message: 'Missing required fields' }, { status: 400 });
        }

        // Create Issue Record
        // We use a transaction to ensure header and items are created together
        const issue = await prisma.$transaction(async (tx) => {
            // 1. Create Header
            const newIssue = await tx.contractorMaterialIssue.create({
                data: {
                    contractorId,
                    storeId,
                    month, // Format: "YYYY-MM"
                    issuedBy: session.user?.email || 'System', // Or session.user.id if available
                    issueDate: new Date(),
                }
            });

            // 2. Create Items
            // We need to loop because `createMany` is not supported for nested create in all DBs or sometimes we want more control.
            // But Prisma `createMany` is efficient if supported. SQLite supports it recent versions, PostgreSQL does.
            // Let's use create with `items` relation if possible, or createMany separately.

            // safer approach: create many attached to the ID
            if (items.length > 0) {
                await tx.contractorMaterialIssueItem.createMany({
                    data: items.map((item: any) => ({
                        issueId: newIssue.id,
                        itemId: item.itemId,
                        quantity: parseFloat(item.quantity),
                        unit: item.unit
                    }))
                });
            }

            // OPTIONAL: Deduct from Main Store Inventory?
            // If you are tracking Main Store stock, you should deduct here. 
            // For now, we assume this is just tracking "Issues to Contractor".

            return newIssue;
        });

        return NextResponse.json({ message: 'Materials issued successfully', issueId: issue.id });

    } catch (error) {
        console.error('Material Issue Error:', error);
        return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
    }
}

// GET: Fetch Data (e.g., previous issues for a month/contractor)
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const contractorId = searchParams.get('contractorId');
        const month = searchParams.get('month');

        if (!contractorId) {
            return NextResponse.json({ message: 'Contractor ID required' }, { status: 400 });
        }

        const whereClause: any = { contractorId };
        if (month) whereClause.month = month;

        const issues = await prisma.contractorMaterialIssue.findMany({
            where: whereClause,
            include: {
                store: { select: { name: true } },
                items: {
                    include: {
                        item: { select: { name: true, code: true } }
                    }
                }
            },
            orderBy: { issueDate: 'desc' }
        });

        return NextResponse.json(issues);
    } catch (error) {
        console.error('Fetch Issue Error:', error);
        return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
    }
}
