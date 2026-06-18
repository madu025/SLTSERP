import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET: Fetch EVM snapshots for a project (historical trend)
export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: projectId } = await params;
        const { searchParams } = new URL(request.url);
        const limit = parseInt(searchParams.get('limit') || '90', 10);

        const snapshots = await prisma.eVMSnapshot.findMany({
            where: { evm: { projectId } },
            orderBy: { snapshotDate: 'desc' },
            take: Math.min(limit, 365)
        });

        return NextResponse.json(snapshots);
    } catch (error) {
        console.error('Error fetching EVM snapshots:', error);
        return NextResponse.json({ error: 'Failed to fetch EVM snapshots' }, { status: 500 });
    }
}

// POST: Record a new EVM snapshot (daily tracking point)
export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: projectId } = await params;
        const body = await request.json();
        const { plannedValue, earnedValue, actualCost, snapshotDate } = body;

        // Find the project's EVM record
        let evm = await prisma.projectEVM.findUnique({
            where: { projectId }
        });

        if (!evm) {
            evm = await prisma.projectEVM.create({
                data: {
                    projectId,
                    plannedValue: plannedValue ?? 0,
                    earnedValue: earnedValue ?? 0,
                    actualCost: actualCost ?? 0,
                    scheduleVariance: (earnedValue ?? 0) - (plannedValue ?? 0),
                    costVariance: (earnedValue ?? 0) - (actualCost ?? 0),
                    spi: (plannedValue ?? 0) > 0 ? (earnedValue ?? 0) / (plannedValue ?? 0) : 1,
                    cpi: (actualCost ?? 0) > 0 ? (earnedValue ?? 0) / (actualCost ?? 0) : 1
                }
            });
        }

        const snapshot = await prisma.eVMSnapshot.create({
            data: {
                evmId: evm.id,
                plannedValue: plannedValue ?? 0,
                earnedValue: earnedValue ?? 0,
                actualCost: actualCost ?? 0,
                scheduleVariance: (earnedValue ?? 0) - (plannedValue ?? 0),
                costVariance: (earnedValue ?? 0) - (actualCost ?? 0),
                snapshotDate: snapshotDate ? new Date(snapshotDate) : new Date()
            }
        });

        // Update live EVM with latest values
        await prisma.projectEVM.update({
            where: { id: evm.id },
            data: {
                plannedValue: plannedValue ?? 0,
                earnedValue: earnedValue ?? 0,
                actualCost: actualCost ?? 0,
                scheduleVariance: (earnedValue ?? 0) - (plannedValue ?? 0),
                costVariance: (earnedValue ?? 0) - (actualCost ?? 0),
                spi: (plannedValue ?? 0) > 0 ? (earnedValue ?? 0) / (plannedValue ?? 0) : 1,
                cpi: (actualCost ?? 0) > 0 ? (earnedValue ?? 0) / (actualCost ?? 0) : 1
            }
        });

        return NextResponse.json(snapshot, { status: 201 });
    } catch (error) {
        console.error('Error recording EVM snapshot:', error);
        return NextResponse.json({ error: 'Failed to record EVM snapshot' }, { status: 500 });
    }
}