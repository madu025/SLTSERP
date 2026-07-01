import { NextResponse } from 'next/server';
import { ContractorService } from '@/services/contractor.service';

// GET - Get team's assigned stores
export async function GET(
    request: Request,
    context: { params: Promise<{ teamId: string }> }
) {
    const params = await context.params;
    try {
        const team = await ContractorService.getTeamStores(params.teamId);

        if (!team) {
            return NextResponse.json({ error: 'Team not found' }, { status: 404 });
        }

        return NextResponse.json(team);
    } catch (error) {
        console.error('Error fetching team stores:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// POST - Add store to team or update primary
export async function POST(
    request: Request,
    context: { params: Promise<{ teamId: string }> }
) {
    const params = await context.params;
    try {
        const role = request.headers.get('x-user-role');

        // Check user role
        if (!role || !['STORES_MANAGER', 'STORES_ASSISTANT', 'SUPER_ADMIN', 'ADMIN'].includes(role)) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
        }

        const { storeId, isPrimary } = await request.json();

        if (!storeId) {
            return NextResponse.json({ error: 'Store ID is required' }, { status: 400 });
        }

        const assignment = await ContractorService.assignTeamStore(params.teamId, storeId, isPrimary);

        return NextResponse.json(assignment);
    } catch (error) {
        console.error('Error adding store to team:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// DELETE - Remove store from team
export async function DELETE(
    request: Request,
    context: { params: Promise<{ teamId: string }> }
) {
    const params = await context.params;
    try {
        const role = request.headers.get('x-user-role');

        // Check user role
        if (!role || !['STORES_MANAGER', 'STORES_ASSISTANT', 'SUPER_ADMIN', 'ADMIN'].includes(role)) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
        }

        const { storeId } = await request.json();

        if (!storeId) {
            return NextResponse.json({ error: 'Store ID is required' }, { status: 400 });
        }

        await ContractorService.removeTeamStore(params.teamId, storeId);

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error removing store from team:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
