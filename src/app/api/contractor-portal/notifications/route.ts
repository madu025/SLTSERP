import { NextResponse } from 'next/server';
import { apiHandler } from '@/lib/api-handler';
import { QCInspectionService } from '@/services/qc/qc-inspection.service';

export const dynamic = 'force-dynamic';

export const GET = apiHandler(async (req) => {
    const contractorId = req.headers.get('x-contractor-id') || undefined;
    const { searchParams } = new URL(req.url);
    const teamId = searchParams.get('teamId') || undefined;
    const unreadOnly = searchParams.get('unreadOnly') === 'true';

    const result = await QCInspectionService.getQCNotifications({
        contractorId,
        teamId,
        unreadOnly
    });

    return result;
}, {
    roles: ['SUPER_ADMIN', 'ADMIN', 'CONTRACTOR_SUPERVISOR', 'CONTRACTOR_TECHNICIAN'],
});

export const PATCH = apiHandler(async (req) => {
    const body = await req.json();
    const { id } = body;

    if (!id) {
        return NextResponse.json({ error: 'Notification ID is required' }, { status: 400 });
    }

    const updated = await QCInspectionService.markNotificationAsRead(id);
    return updated;
}, {
    roles: ['SUPER_ADMIN', 'ADMIN', 'CONTRACTOR_SUPERVISOR', 'CONTRACTOR_TECHNICIAN'],
});
