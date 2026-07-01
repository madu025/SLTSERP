import { NextResponse } from 'next/server';
import { NotificationPolicyService } from '@/services/notification/notification-policy.service';
import { handleApiError } from '@/lib/api-utils';

export async function GET() {
    try {
        const warnings = await NotificationPolicyService.checkBatchExpirations();
        return NextResponse.json({ success: true, warnings });
    } catch (error) {
        return handleApiError(error);
    }
}
