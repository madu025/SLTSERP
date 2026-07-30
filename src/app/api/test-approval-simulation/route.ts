import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { DynamicApprovalService } from '@/services/approval/dynamic-approval.service';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        // 1. Check if SMTP is configured
        const smtpConfig = await prisma.systemSetting.findUnique({
            where: { key: 'SMTP_CONFIG' }
        });

        if (!smtpConfig || !smtpConfig.value || !(smtpConfig.value as any).host) {
            return NextResponse.json({
                success: false,
                message: "SMTP_CONFIG not found in database.",
                instruction: "Please go to http://localhost:3000/admin/settings/smtp and configure sltsqms@gmail.com with your Google App Password first."
            }, { status: 400 });
        }

        // 2. Create a dummy UniversalApprovalInstance to simulate the Stores Manager's material request
        const instance = await prisma.universalApprovalInstance.create({
            data: {
                entityId: `MRN-SIM-${Date.now()}`,
                entityType: 'MATERIAL_REQUEST',
                status: 'PENDING',
                level: 1,
                requiredRole: 'MANAGER',
                assignedUserId: null // We just test the email sending part
            }
        });

        // 3. Dispatch the Actionable Email to the first approver (Prasad)
        await DynamicApprovalService.sendActionableEmail(
            instance.id,
            'MATERIAL_REQUEST',
            instance.entityId,
            'prasad@slts.lk',
            'user-prasad-id',
            125000 // Dummy value
        );

        return NextResponse.json({
            success: true,
            message: "Simulation Step 1 Complete! Email dispatched successfully.",
            details: {
                targetEmail: 'prasad@slts.lk',
                instanceId: instance.id,
                entityId: instance.entityId
            },
            instruction: "Check the inbox for prasad@slts.lk and click the 'Approve' button. The webhook will securely process it, and from there you can trigger the next level to hirunisha@slts.lk"
        });

    } catch (error: any) {
        return NextResponse.json({
            success: false,
            message: "Simulation failed.",
            error: error.message
        }, { status: 500 });
    }
}
