import { apiHandler } from '@/lib/api-handler';
import { prisma } from '@/lib/prisma';
import { AppError } from '@/lib/error';

export const dynamic = 'force-dynamic';

export const POST = apiHandler(async (req: Request, params: any, body: any) => {
    const issueId = params?.id as string;
    const { signatureName } = body || {};
    const userId = req.headers.get('x-user-id');

    if (!issueId) {
        throw AppError.badRequest('Issue ID is required.');
    }

    const issue = await prisma.contractorMaterialIssue.findUnique({
        where: { id: issueId },
        include: { items: true }
    });

    if (!issue) {
        throw AppError.notFound(`Material issue '${issueId}' not found.`);
    }

    if (issue.status === 'ACCEPTED') {
        return { success: true, message: 'Issue is already accepted.' };
    }

    // Update ContractorMaterialIssue status to ACCEPTED
    const updatedIssue = await prisma.contractorMaterialIssue.update({
        where: { id: issueId },
        data: {
            status: 'ACCEPTED',
            signatureUrl: signatureName || 'Contractor Digital Sign',
            acceptedAt: new Date(),
            acceptedBy: userId || null,
        }
    });

    // Update ContractorStock virtual balance
    for (const item of issue.items) {
        await prisma.contractorStock.upsert({
            where: {
                contractorId_itemId: {
                    contractorId: issue.contractorId,
                    itemId: item.itemId,
                }
            },
            update: {
                quantity: { increment: item.quantity }
            },
            create: {
                contractorId: issue.contractorId,
                itemId: item.itemId,
                quantity: item.quantity,
            }
        });
    }

    return {
        success: true,
        message: 'Material issue accepted successfully. Virtual stock updated.',
        data: updatedIssue,
    };
}, {
    roles: ['SUPER_ADMIN', 'ADMIN', 'CONTRACTOR_SUPERVISOR', 'CONTRACTOR_TECHNICIAN', 'STORES_MANAGER'],
    audit: { action: 'ACCEPT_CONTRACTOR_MATERIAL_ISSUE', entity: 'ContractorMaterialIssue' }
});
