import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET: Calculate and fetch KPI analytics / EVM metrics
export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: projectId } = await params;

        const project = await prisma.project.findUnique({
            where: { id: projectId }
        });

        if (!project) {
            return NextResponse.json({ error: 'Project not found' }, { status: 404 });
        }

        const budget = project.budget || 1000000; // default/fallback
        const actualCost = project.actualCost || 450000; // default/fallback
        const progress = (project.progress || 0) / 100;

        // EVM Calculations
        const EV = budget * progress; // Earned Value
        const PV = budget * Math.min(progress + 0.1, 1); // Planned Value (Simulated baseline)
        const AC = actualCost; // Actual Cost

        const SPI = PV > 0 ? EV / PV : 1; // Schedule Performance Index
        const CPI = AC > 0 ? EV / AC : 1; // Cost Performance Index

        return NextResponse.json({
            metrics: {
                budget,
                actualCost: AC,
                earnedValue: EV,
                plannedValue: PV,
                spi: Number(SPI.toFixed(2)),
                cpi: Number(CPI.toFixed(2)),
                variance: EV - AC,
                progressPercent: project.progress
            },
            status: {
                costStatus: CPI >= 1.0 ? 'UNDER_BUDGET' : 'OVER_BUDGET',
                scheduleStatus: SPI >= 1.0 ? 'AHEAD_OF_SCHEDULE' : 'BEHIND_SCHEDULE'
            }
        });
    } catch (error) {
        console.error('Error fetching KPI analytics:', error);
        return NextResponse.json({ error: 'Failed to calculate KPI metrics' }, { status: 500 });
    }
}
