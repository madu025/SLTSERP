import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

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

export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: projectId } = await params;
        const body = await request.json();
        const { pvCumulative, evCumulative, acCumulative, snapshotDate, periodLabel } = body;

        let evm = await prisma.projectEVM.findUnique({ where: { projectId } });

        if (!evm) {
            const pv = pvCumulative ?? 0;
            const ev = evCumulative ?? 0;
            const ac = acCumulative ?? 0;
            evm = await prisma.projectEVM.create({
                data: {
                    projectId,
                    pvTotal: pv,
                    evTotal: ev,
                    acTotal: ac,
                    scheduleVariance: ev - pv,
                    costVariance: ev - ac,
                    spi: pv > 0 ? ev / pv : 1,
                    cpi: ac > 0 ? ev / ac : 1
                }
            });
        }

        const snapshot = await prisma.eVMSnapshot.create({
            data: {
                evmId: evm.id,
                pvCumulative: pvCumulative ?? 0,
                evCumulative: evCumulative ?? 0,
                acCumulative: acCumulative ?? 0,
                spi: (pvCumulative ?? 0) > 0 ? (evCumulative ?? 0) / (pvCumulative ?? 0) : 1,
                cpi: (acCumulative ?? 0) > 0 ? (evCumulative ?? 0) / (acCumulative ?? 0) : 1,
                scheduleVariance: (evCumulative ?? 0) - (pvCumulative ?? 0),
                costVariance: (evCumulative ?? 0) - (acCumulative ?? 0),
                snapshotDate: snapshotDate ? new Date(snapshotDate) : new Date(),
                periodLabel: periodLabel || new Date().toISOString().slice(0, 10)
            }
        });

        await prisma.projectEVM.update({
            where: { id: evm.id },
            data: {
                pvTotal: pvCumulative ?? 0,
                evTotal: evCumulative ?? 0,
                acTotal: acCumulative ?? 0,
                scheduleVariance: (evCumulative ?? 0) - (pvCumulative ?? 0),
                costVariance: (evCumulative ?? 0) - (acCumulative ?? 0),
                spi: (pvCumulative ?? 0) > 0 ? (evCumulative ?? 0) / (pvCumulative ?? 0) : 1,
                cpi: (acCumulative ?? 0) > 0 ? (evCumulative ?? 0) / (acCumulative ?? 0) : 1
            }
        });

        return NextResponse.json(snapshot, { status: 201 });
    } catch (error) {
        console.error('Error recording EVM snapshot:', error);
        return NextResponse.json({ error: 'Failed to record EVM snapshot' }, { status: 500 });
    }
}