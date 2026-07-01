import { NextResponse } from 'next/server';
import { ContractorService } from '@/services/contractor.service';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET: List all contractor teams with contractor name
 */
export async function GET() {
    try {
        const teams = await ContractorService.getAllTeams();
        return NextResponse.json(teams);
    } catch (error) {
        console.error('Error fetching contractor teams:', error);
        return NextResponse.json({ error: 'Failed to fetch teams' }, { status: 500 });
    }
}