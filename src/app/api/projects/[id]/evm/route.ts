import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: projectId } = await params;

        const evm = await prisma.projectEVM.findUnique({
            where: { projectId },
            include: {
                snapshots: {
                    orderBy: { snapshotDate: 'desc' },
                    take: 30
                }
            }
        });

        if (!evm) {
            return NextResponse.json({
                projectId,
                pvTotal: 0,
                evTotal: 0,
                acTotal: 0,
                scheduleVariance: 0,
                costVariance: 0,
                spi: 1,
                cpi: 1,
                snapshots: []
            });
        }

        return NextResponse.json(evm);
    } catch (error) {
        console.error('Error fetching EVM data:', error);
        return NextResponse.json({ error: 'Failed to fetch EVM data' }, { status: 500 });
    }
}

export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: projectId } = await params;
        const body = await request.json();
        const { pvTotal, evTotal, acTotal } = body;

        const scheduleVariance = (evTotal ?? 0) - (pvTotal ?? 0);
        const costVariance = (evTotal ?? 0) - (acTotal ?? 0);
        const spi = (pvTotal ?? 0) > 0 ? (evTotal ?? 0) / (pvTotal ?? 0) : 1;
        const cpi = (acTotal ?? 0) > 0 ? (evTotal ?? 0) / (acTotal ?? 0) : 1;

        const evm = await prisma.projectEVM.upsert({
            where: { projectId },
            update: {
                pvTotal: pvTotal ?? 0,
                evTotal: evTotal ?? 0,
                acTotal: acTotal ?? 0,
                scheduleVariance,
                costVariance,
                spi,
                cpi
            },
            create: {
                projectId,
                pvTotal: pvTotal ?? 0,
                evTotal: evTotal ?? 0,
                acTotal: acTotal ?? 0,
                scheduleVariance,
                costVariance,
                spi,
                cpi
            }
        });

        return NextResponse.json(evm, { status: 201 });
    } catch (error) {
        console.error('Error updating EVM data:', error);
        return NextResponse.json({ error: 'Failed to update EVM data' }, { status: 500 });
    }
}