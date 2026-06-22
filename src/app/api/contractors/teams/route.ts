import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET: List all contractor teams with contractor name
 */
export async function GET() {
    try {
        const teams = await prisma.contractorTeam.findMany({
            select: {
                id: true,
                name: true,
                contractorId: true,
                contractor: {
                    select: { id: true, name: true }
                }
            },
            orderBy: { name: 'asc' }
        });

        return NextResponse.json(teams);
    } catch (error) {
        console.error('Error fetching contractor teams:', error);
        return NextResponse.json({ error: 'Failed to fetch teams' }, { status: 500 });
    }
}