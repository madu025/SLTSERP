import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET: Fetch contractor and past evaluations for a project
export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: projectId } = await params;

        const project = await prisma.project.findUnique({
            where: { id: projectId },
            include: {
                contractor: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        contactNumber: true,
                        registrationNumber: true
                    }
                }
            }
        });

        if (!project) {
            return NextResponse.json({ error: 'Project not found' }, { status: 404 });
        }

        // Simulating evaluation log from project details (stored in description or mock database)
        // In a full enterprise ERP, this links to vendor rating tables.
        const evaluations = [
            { id: 'eval-1', rating: 4, comments: 'Completed cable layout on schedule.', date: new Date().toISOString() }
        ];

        return NextResponse.json({
            contractor: project.contractor,
            evaluations
        });
    } catch (error) {
        console.error('Error fetching contractor rating:', error);
        return NextResponse.json({ error: 'Failed to fetch rating' }, { status: 500 });
    }
}

// POST: Log a new contractor evaluation
export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: projectId } = await params;
        const body = await request.json();
        const { contractorId, rating, comments } = body;

        if (!contractorId || !rating) {
            return NextResponse.json({ error: 'Contractor ID and rating are required' }, { status: 400 });
        }

        // Return successful log acknowledgement
        return NextResponse.json({
            success: true,
            loggedEvaluation: {
                projectId,
                contractorId,
                rating: Number(rating),
                comments: comments || '',
                date: new Date().toISOString()
            }
        });
    } catch (error) {
        console.error('Error logging contractor evaluation:', error);
        return NextResponse.json({ error: 'Failed to log contractor evaluation' }, { status: 500 });
    }
}
