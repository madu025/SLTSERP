import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET: Fetch all identified risks for a project
export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: projectId } = await params;

        const risks = await prisma.projectRisk.findMany({
            where: { projectId },
            orderBy: { score: 'desc' } // Prioritize high score risks
        });

        return NextResponse.json(risks);
    } catch (error) {
        console.error('Error fetching project risks:', error);
        return NextResponse.json({ error: 'Failed to fetch risks' }, { status: 500 });
    }
}

// POST: Add a new risk identifier
export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: projectId } = await params;
        const body = await request.json();
        const { title, description, probability, impact, mitigationPlan, identifiedById } = body;

        if (!title || !description || !probability || !impact || !identifiedById) {
            return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
        }

        const prob = Number(probability);
        const imp = Number(impact);

        const newRisk = await prisma.projectRisk.create({
            data: {
                projectId,
                title,
                description,
                probability: prob,
                impact: imp,
                score: prob * imp, // Auto score calculation
                mitigationPlan: mitigationPlan || null,
                identifiedById,
                status: 'OPEN'
            }
        });

        return NextResponse.json(newRisk);
    } catch (error) {
        console.error('Error identifying project risk:', error);
        return NextResponse.json({ error: 'Failed to log risk' }, { status: 500 });
    }
}

// PATCH: Update mitigation plan or close/mitigate a risk
export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const body = await request.json();
        const { riskId, mitigationPlan, status } = body;

        if (!riskId) {
            return NextResponse.json({ error: 'Risk ID is required' }, { status: 400 });
        }

        const updatedRisk = await prisma.projectRisk.update({
            where: { id: riskId },
            data: {
                mitigationPlan: mitigationPlan !== undefined ? mitigationPlan : undefined,
                status: status !== undefined ? status : undefined
            }
        });

        return NextResponse.json(updatedRisk);
    } catch (error) {
        console.error('Error updating project risk:', error);
        return NextResponse.json({ error: 'Failed to update risk' }, { status: 500 });
    }
}
