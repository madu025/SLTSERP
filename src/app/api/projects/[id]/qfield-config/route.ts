import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

type Params = Promise<{ id: string }>;

// GET /api/projects/[id]/qfield-config - Get project QField field configurator options
export async function GET(_request: Request, { params }: { params: Params }) {
  try {
    const { id: projectId } = await params;
    const userId = _request.headers.get('x-user-id');
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const configs = await prisma.qFieldFieldConfig.findMany({
      where: { projectId },
      orderBy: [
        { layerId: 'asc' },
        { fieldName: 'asc' }
      ]
    });

    return NextResponse.json({ projectId, configs });
  } catch (error) {
    console.error('Error fetching QField configs:', error);
    return NextResponse.json({ error: 'Failed to fetch field configurations' }, { status: 500 });
  }
}

// POST /api/projects/[id]/qfield-config - Update/Save QField field configurator options
export async function POST(request: Request, { params }: { params: Params }) {
  try {
    const { id: projectId } = await params;
    const userId = request.headers.get('x-user-id');
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { configs } = body; // Array of { layerId, fieldName, options }

    if (!Array.isArray(configs)) {
      return NextResponse.json({ error: 'configs must be an array' }, { status: 400 });
    }

    // Clean up empty options and fields with no options
    const filteredConfigs = configs
      .map((c: any) => ({
        layerId: c.layerId?.trim(),
        fieldName: c.fieldName?.trim(),
        options: Array.isArray(c.options)
          ? c.options.map((opt: string) => opt.trim()).filter((opt: string) => opt.length > 0)
          : []
      }))
      .filter((c: any) => c.layerId && c.fieldName && c.options.length > 0);

    // Save in transaction: delete existing and create new
    const result = await prisma.$transaction(async (tx) => {
      await tx.qFieldFieldConfig.deleteMany({
        where: { projectId }
      });

      if (filteredConfigs.length > 0) {
        return tx.qFieldFieldConfig.createMany({
          data: filteredConfigs.map((c: any) => ({
            projectId,
            layerId: c.layerId,
            fieldName: c.fieldName,
            options: c.options
          }))
        });
      }
      return { count: 0 };
    });

    const updatedConfigs = await prisma.qFieldFieldConfig.findMany({
      where: { projectId },
      orderBy: [
        { layerId: 'asc' },
        { fieldName: 'asc' }
      ]
    });

    return NextResponse.json({
      message: 'Field configurations updated successfully',
      count: result.count,
      configs: updatedConfigs
    });
  } catch (error) {
    console.error('Error saving QField configs:', error);
    const message = error instanceof Error ? error.message : 'Failed to save field configurations';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
