import { prisma } from '@/lib/prisma';
import { NotificationService } from '@/services/notification';

/**
 * In-app notices to the people of a contractor about its invoice (a contractor has its own users; a notification needs a user id, not
 * the contractor id). Best effort: a failure here never stops an invoice step. No e-mail is sent.
 */
export async function notifyContractorUsers(contractorId: string | null | undefined, input: { title: string; message: string; invoiceId: string; step: string; priority?: 'LOW' | 'MEDIUM' | 'HIGH' }) {
    if (!contractorId) return;
    try {
        const users = await prisma.user.findMany({ where: { contractorId, status: 'active' }, select: { id: true }, take: 20 });
        await Promise.all(users.map((u) => NotificationService.send({
            userId: u.id, title: input.title, message: input.message, type: 'FINANCE', priority: input.priority ?? 'MEDIUM', link: '/contractor/finance',
            // one notice per invoice step, so a repeated press does not repeat it
            dedupKey: `invoice-step:${input.invoiceId}:${input.step}:${u.id}`, replaceByCategory: false,
        })));
    } catch (e) {
        console.error('[invoice-contractor-notify] failed:', (e as Error).message);
    }
}
