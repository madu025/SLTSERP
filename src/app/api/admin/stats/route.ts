import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { handleApiError } from '@/lib/api-utils';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        const role = request.headers.get('x-user-role');

        if (role !== 'ADMIN' && role !== 'SUPER_ADMIN') {
            return NextResponse.json(
                { message: 'Forbidden: Insufficient Permissions' },
                { status: 403 }
            );
        }

        const [users, staff, opmcs, contractors] = await Promise.all([
            prisma.user.count(),
            prisma.staff.count(),
            prisma.oPMC.count(),
            prisma.contractor.count()
        ]);

        return NextResponse.json({
            users,
            staff,
            opmcs,
            contractors
        });
    } catch (error) {
        return handleApiError(error);
    }
}
