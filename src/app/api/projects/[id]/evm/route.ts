import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET: Fetch Earned Value Management metrics for a project
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
                plannedValue: 0,
                earnedValue: 0,
                actualCost: 0,
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

// POST: Initialize or update EVM baseline for a project
export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: projectId } = await params;
        const body = await request.json();
        const { plannedValue, earnedValue, actualCost } = body;

        const scheduleVariance = (earnedValue ?? 0) - (plannedValue ?? 0);
        const costVariance = (earnedValue ?? 0) - (actualCost ?? 0);
        const spi = (plannedValue ?? 0) > 0 ? (earnedValue ?? 0) / (plannedValue ?? 0) : 1;
        const cpi = (actualCost ?? 0) > 0 ? (earnedValue ?? 0) / (actualCost ?? 0) : 1;

        const evm = await prisma.projectEVM.upsert({
            where: { projectId },
            update: {
                plannedValue: plannedValue ?? 0,
                earnedValue: earnedValue ?? 0,
                actualCost: actualCost ?? 0,
                scheduleVariance,
                costVariance,
                spi,
                cpi
            },
            create: {
                projectId,
                plannedValue: plannedValue ?? 0,
                earnedValue: earnedValue ?? 0,
                actualCost: actualCost ?? 0,
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