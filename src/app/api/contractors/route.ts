import { NextResponse } from 'next/server';
import { ContractorService } from '@/services/contractor.service';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// GET
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '50');

        const userId = request.headers.get('x-user-id');
        const role = request.headers.get('x-user-role');

        let opmcIds: string[] | undefined = undefined;

        // Filter by accessible OPMCs for relevant roles
        if (['AREA_MANAGER', 'SITE_OFFICE_STAFF', 'OFFICE_ADMIN'].includes(role || '') && userId) {
            const user = await prisma.user.findUnique({
                where: { id: userId },
                include: { accessibleOpmcs: { select: { id: true } } }
            });
            if (user) {
                opmcIds = user.accessibleOpmcs.map((o: any) => o.id);
            }
        }

        const result = await ContractorService.getAllContractors(opmcIds, page, limit);
        return NextResponse.json(result, {
            headers: {
                'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0',
            }
        });
    } catch (error: any) {
        console.error('CRITICAL: Error fetching contractors:', error);
        return NextResponse.json({
            message: 'Error fetching contractors',
            debug: error.message,
            stack: error.stack
        }, { status: 500 });
    }
}

// POST
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const contractor = await ContractorService.createContractor(body);
        return NextResponse.json(contractor);
    } catch (error: any) {
        if (error.message === 'NAME_AND_REGISTRATION_REQUIRED') {
            return NextResponse.json({ message: 'Name and Registration Number required' }, { status: 400 });
        }
        console.error('Error creating contractor:', error);
        return NextResponse.json({ message: 'Error creating contractor', debug: error.message }, { status: 500 });
    }
}

// PUT
export async function PUT(request: Request) {
    try {
        const body = await request.json();
        const { id, ...data } = body;

        // Ensure ID is separated logic if needed, but Service expects id as first arg
        // Our service signature: updateContractor(id, data)
        // Data object still contains id but we ignore it inside service logic or handle it.

        const updated = await ContractorService.updateContractor(id, data);
        return NextResponse.json(updated);
    } catch (error: any) {
        if (error.message === 'ID_REQUIRED') {
            return NextResponse.json({ message: 'ID required' }, { status: 400 });
        }
        console.error('Error updating contractor:', error);
        return NextResponse.json({ message: 'Error updating contractor', debug: error.message }, { status: 500 });
    }
}

// DELETE
export async function DELETE(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        // Service handles validation, but we need to extract ID from URL here
        if (!id) return NextResponse.json({ message: 'ID required' }, { status: 400 });

        await ContractorService.deleteContractor(id);
        return NextResponse.json({ message: 'Deleted successfully' });
    } catch (error: any) {
        if (error.message === 'HAS_RELATED_DATA') {
            return NextResponse.json({
                message: 'Cannot delete contractor because they have assigned Service Orders, Projects, or Stock items.'
            }, { status: 400 });
        }
        if (error.message.startsWith('NOT_FOUND_FOR_DELETE')) {
            const missingId = error.message.split(':')[1] || 'Unknown';
            return NextResponse.json({
                message: `The contractor record with ID ${missingId} could not be found. It may have already been deleted.`
            }, { status: 404 });
        }
        console.error('Error deleting contractor:', error);
        return NextResponse.json({ message: 'Error deleting contractor', debug: error.message }, { status: 500 });
    }
}
