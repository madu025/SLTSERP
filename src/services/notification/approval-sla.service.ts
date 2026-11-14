import { prisma } from '@/lib/prisma';
import { slaState } from '@/lib/procurement-rules';
import { NotificationService } from './index';

const day = (d: Date) => d.toISOString().slice(0, 10);

export interface SlaBreach { instanceId: string; entityType: string; entityId: string; waitedHours: number; slaHours: number; state: 'BREACHED' | 'ESCALATE'; assignedUserId: string | null }

/**
 * Approval SLA: an approval waiting longer than its level's SLA hours is breached; twice the SLA is escalated.
 * The gate levels have always stored `slaHours`; nothing used it. This finds the breaches (also used by the Control monitor)
 * and, once a day, tells the assigned approver, and tells administrators about the escalated ones.
 * Notification only: it never approves, rejects or reassigns anything.
 */
export class ApprovalSlaService {
    static async findBreaches(now = new Date()): Promise<SlaBreach[]> {
        const pending = await prisma.universalApprovalInstance.findMany({
            where: { status: 'PENDING' },
            select: { id: true, entityType: true, entityId: true, policyId: true, policyVariant: true, level: true, assignedUserId: true, createdAt: true },
            take: 2000,
        });
        const policyIds = [...new Set(pending.map((p) => p.policyId).filter((x): x is string => !!x))];
        const levels = policyIds.length
            ? await prisma.processApprovalLevel.findMany({ where: { gatePolicyId: { in: policyIds } }, select: { gatePolicyId: true, policyVariant: true, level: true, slaHours: true } })
            : [];
        const slaOf = new Map(levels.map((l) => [`${l.gatePolicyId}|${l.policyVariant}|${l.level}`, l.slaHours]));

        const out: SlaBreach[] = [];
        for (const p of pending) {
            const slaHours = (p.policyId ? slaOf.get(`${p.policyId}|${p.policyVariant}|${p.level}`) : null) ?? 24;
            const state = slaState(p.createdAt, slaHours, now);
            if (state === 'OK') continue;
            out.push({ instanceId: p.id, entityType: p.entityType, entityId: p.entityId, waitedHours: Math.round((now.getTime() - p.createdAt.getTime()) / 3_600_000), slaHours, state, assignedUserId: p.assignedUserId });
        }
        return out;
    }

    static async run(now = new Date()): Promise<{ breached: number; escalated: number; notified: number }> {
        const breaches = await this.findBreaches(now);
        let notified = 0;
        for (const b of breaches) {
            if (!b.assignedUserId) continue;
            const r = await NotificationService.send({
                userId: b.assignedUserId,
                title: `Approval overdue: ${b.entityType.replace(/_/g, ' ').toLowerCase()}`,
                message: `This approval has been waiting ${b.waitedHours} hours (target ${b.slaHours} hours).`,
                type: 'SYSTEM', priority: b.state === 'ESCALATE' ? 'HIGH' : 'MEDIUM', link: '/approvals',
                metadata: { source: 'approval-sla', instanceId: b.instanceId },
                dedupKey: `approval-sla:${b.instanceId}:${day(now)}`,
            });
            if (r) notified++;
        }
        const escalated = breaches.filter((b) => b.state === 'ESCALATE');
        if (escalated.length > 0) {
            await NotificationService.notifyByAudience({
                audience: 'ADMINISTRATORS',
                title: `${escalated.length} approval(s) waiting more than twice their target time`,
                message: `The longest has waited ${Math.max(...escalated.map((e) => e.waitedHours))} hours. Open the Control monitor to see them.`,
                type: 'SYSTEM', priority: 'HIGH', link: '/admin/control',
                metadata: { source: 'approval-sla' }, dedupKey: `approval-sla-escalation:${day(now)}`,
            });
        }
        return { breached: breaches.length, escalated: escalated.length, notified };
    }
}
