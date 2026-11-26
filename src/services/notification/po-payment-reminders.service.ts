import { HoPayablesService } from '@/services/procurement/ho-payables.service';
import { NotificationService } from './index';

const fmt = (n: number) => Math.round(n).toLocaleString('en-US');

/**
 * Daily reminder for credit purchases approved in the HO system: goods received but not yet paid by HO that fall due within 7 days, and those already
 * overdue. One in-app notice a day to the finance team (audience FINANCE_ALL), so OSP Finance can chase HO before the supplier does. Notification only.
 */
export class PoPaymentReminderService {
    static async run(now: Date = new Date()): Promise<{ dueSoon: number; overdue: number; notified: boolean }> {
        const orders = (await HoPayablesService.orders({}, now)).filter((o) => o.owedForReceived > 0 && o.daysOverdue !== null);
        const overdue = orders.filter((o) => (o.daysOverdue as number) > 0);
        const dueSoon = orders.filter((o) => (o.daysOverdue as number) <= 0 && (o.daysOverdue as number) >= -7);
        if (!overdue.length && !dueSoon.length) return { dueSoon: 0, overdue: 0, notified: false };

        const sum = (list: typeof orders) => list.reduce((a, o) => a + o.owedForReceived, 0);
        const worst = [...overdue].sort((a, b) => (b.daysOverdue as number) - (a.daysOverdue as number))[0];
        const parts = [
            overdue.length ? `${overdue.length} order(s) overdue, ${fmt(sum(overdue))} owed${worst ? ` (oldest ${worst.poNumber}, ${worst.vendor}, ${worst.daysOverdue} days)` : ''}` : '',
            dueSoon.length ? `${dueSoon.length} due within 7 days, ${fmt(sum(dueSoon))}` : '',
        ].filter(Boolean);
        await NotificationService.notifyByAudience({
            audience: 'FINANCE_ALL',
            title: overdue.length ? 'Supplier payments overdue (HO credit purchases)' : 'Supplier payments due this week (HO credit purchases)',
            message: `${parts.join('; ')}. Open the vendor statement or AP aging for the list.`,
            type: 'FINANCE',
            priority: overdue.length ? 'HIGH' : 'MEDIUM',
            link: '/finance/ap/aging',
            metadata: { source: 'po-payment-reminders', overdue: overdue.map((o) => o.poNumber), dueSoon: dueSoon.map((o) => o.poNumber) },
            dedupKey: `po-payment-reminders:${now.toISOString().slice(0, 10)}`,
        });
        return { dueSoon: dueSoon.length, overdue: overdue.length, notified: true };
    }
}
