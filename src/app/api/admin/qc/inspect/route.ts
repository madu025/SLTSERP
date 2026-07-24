import { NextResponse } from 'next/server';
import { apiHandler } from '@/lib/api-handler';
import { QCInspectionService } from '@/services/qc/qc-inspection.service';

export const dynamic = 'force-dynamic';

export const POST = apiHandler(async (req) => {
    const body = await req.json();
    const { soNum, qcStatus, qcDefects, qcComment } = body;

    if (!soNum || !qcStatus) {
        return NextResponse.json({ error: 'soNum and qcStatus are required' }, { status: 400 });
    }

    const inspectedBy = req.headers.get('x-user-id') || undefined;

    const result = await QCInspectionService.submitQCInspection({
        soNum,
        qcStatus,
        qcDefects,
        qcComment,
        inspectedBy
    });

    return result;
}, {
    roles: ['SUPER_ADMIN', 'ADMIN', 'QUALITY_CONTROL', 'OSP_MANAGER'],
});
