import { NextRequest, NextResponse } from 'next/server';
import { ProjectPermitService } from '@/services/project-permit.service';

// GET all permit types with their authority
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const isActive = searchParams.get('isActive');
        const authorityId = searchParams.get('authorityId');

        const isActiveVal = isActive !== null ? isActive === 'true' : undefined;

        const permitTypes = await ProjectPermitService.getPermitTypes(isActiveVal, authorityId);
        return NextResponse.json(permitTypes);
    } catch (error: unknown) {
        console.error('Error fetching permit types:', error);
        return NextResponse.json(
            { error: 'Failed to fetch permit types' },
            { status: 500 }
        );
    }
}
