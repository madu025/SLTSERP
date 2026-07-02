import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

type Params = Promise<{ id: string }>;

// GET /api/projects/[id]/expenses
export async function GET(request: NextRequest, { params }: { params: Params }) {
  try {
    const { id: projectId } = await params;
    
    if (!projectId) {
      return NextResponse.json({ error: 'Project ID is required' }, { status: 400 });
    }

    const expenses = await prisma.projectExpense.findMany({
      where: { projectId },
      orderBy: { date: 'desc' },
    });

    return NextResponse.json(expenses);
  } catch (error: any) {
    console.error('Error fetching project expenses:', error);
    return NextResponse.json(
      { error: 'Failed to fetch project expenses' },
      { status: 500 }
    );
  }
}
