import { prisma } from '@/lib/prisma';
import { daysOverdue } from '@/lib/po-payables';
import { NotificationService } from './index';

const fmt = (n: number) => Math.round(n).toLocaleString('en-US');

/**
 * Daily reminder of vendor invoices (one per GRN in the company flow) that are not fully paid by HO: those overdue and those due within 7 days.
 * Due date = the order's due date, else the GRN date + the order's credit days. One in-app notice a day to the finance team (audience FINANCE_ALL),
 * so OSP Finance can follow up with HO before the supplier does. Notification only.
 */
export class PoPaymentReminderService {
    static async run(now: Date = new Date()): Promise<{ dueSoon: number; overdue: number; notified: boolean }> {
        const invoices = await prisma.supplierInvoice.findMany({
            where: { dueDate: { not: null }, status: { in: ['MATCHED', 'VARIANCE', 'AWAITING_EXECUTIVE', 'APPROVED', 'PARTIALLY_PAID'] } },
            select: { invoiceNumber: true, dueDate: true, totalAmount: true, paidAmount: true, vendor: { select: { name: true } } },
            take: 5000,
        });
        const open = invoices
            .map((i) => ({ ...i, owed: Number(i.totalAmount) - Number(i.paidAmount), days: daysOverdue(i.dueDate, now) as number }))
            .filter((i) => i.owed > 0.005);
        const overdue = open.filter((i) => i.days > 0);
        const dueSoon = open.filter((i) => i.days <= 0 && i.days >= -7);
        if (!overdue.length && !dueSoon.length) return { dueSoon: 0, overdue: 0, notified: false };

        const sum = (list: typeof open) => list.reduce((a, i) => a + i.owed, 0);
        const worst = [...overdue].sort((a, b) => b.days - a.days)[0];
        const parts = [
            overdue.length ? `${overdue.length} invoice(s) overdue, ${fmt(sum(overdue))} owed${worst ? ` (oldest ${worst.invoiceNumber}, ${worst.vendor.name}, ${worst.days} days)` : ''}` : '',
            dueSoon.length ? `${dueSoon.length} due within 7 days, ${fmt(sum(dueSoon))}` : '',
        ].filter(Boolean);
        await NotificationService.notifyByAudience({
            audience: 'FINANCE_ALL',
            title: overdue.length ? 'Vendor payments overdue' : 'Vendor payments due this week',
            message: `${parts.join('; ')}. Open AP aging or the vendor statement for the list.`,
            type: 'FINANCE',
            priority: overdue.length ? 'HIGH' : 'MEDIUM',
            link: '/finance/ap/aging',
            metadata: { source: 'po-payment-reminders', overdue: overdue.map((i) => i.invoiceNumber), dueSoon: dueSoon.map((i) => i.invoiceNumber) },
            dedupKey: `po-payment-reminders:${now.toISOString().slice(0, 10)}`,
        });
        return { dueSoon: dueSoon.length, overdue: overdue.length, notified: true };
    }
}
