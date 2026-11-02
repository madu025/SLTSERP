import { getAuthenticatedUserId } from '@/lib/request-context';
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

    const inspectedBy = getAuthenticatedUserId() || undefined;

    const result = await QCInspectionService.submitQCInspection({
        soNum,
        qcStatus,
        qcDefects,
        qcComment,
        inspectedBy
    });

    return result;
}, {
    audit: { action: 'INSPECT', entity: 'QC_INSPECTION' }
});
