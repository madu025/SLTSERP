import { prisma } from '@/lib/prisma';
import { TicketStatus } from '@prisma/client';

export class SLABreachWorkerService {
    /**
     * Fetch active SLA tickets and calculate compliance metrics
     */
    static async getSLAStats() {
        const activeTickets = await prisma.ticket.findMany({
            where: {
                status: {
                    in: [TicketStatus.OPEN, TicketStatus.IN_PROGRESS, TicketStatus.WAITING_FOR_USER]
                }
            },
            include: {
                assignedTo: {
                    select: { id: true, name: true, email: true }
                },
                user: {
                    select: { id: true, name: true, email: true }
                }
            },
            orderBy: { createdAt: 'desc' }
        });

        const now = new Date();

        const responseBreached = activeTickets.filter(
            t => t.slaResponseBreached || (t.slaResponseDeadline && now > new Date(t.slaResponseDeadline) && !t.firstResponseAt)
        );

        const resolutionBreached = activeTickets.filter(
            t => t.slaResolutionBreached || (t.slaResolutionDeadline && now > new Date(t.slaResolutionDeadline))
        );

        const complianceRate = activeTickets.length > 0
            ? Math.round(((activeTickets.length - (responseBreached.length + resolutionBreached.length)) / activeTickets.length) * 100)
            : 100;

        return {
            tickets: activeTickets,
            stats: {
                totalActive: activeTickets.length,
                responseBreaches: responseBreached.length,
                resolutionBreaches: resolutionBreached.length,
                complianceRate: Math.max(0, complianceRate)
            }
        };
    }
}
