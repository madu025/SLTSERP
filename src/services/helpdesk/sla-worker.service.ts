import { Job } from 'bullmq';
import { prisma } from '@/lib/prisma';
import { NotificationService } from '@/services/notification.service';
import { TicketStatus } from '@prisma/client';

interface SLAJobData {
    ticketId: string;
    type: 'RESPONSE' | 'RESOLUTION';
}

export class SLABreachWorkerService {
    /**
     * Process SLA breach detection logic invoked by BullMQ Worker.
     */
    static async processSLA(job: Job<SLAJobData>) {
        const { ticketId, type } = job.data;
        
        const ticket = await prisma.ticket.findUnique({
            where: { id: ticketId },
            include: {
                assignedTo: true
            }
        });

        if (!ticket) {
            console.log(`[SLA Worker] Ticket ${ticketId} not found`);
            return;
        }

        // If ticket is already closed/resolved, no breach can occur
        if (ticket.status === TicketStatus.RESOLVED || ticket.status === TicketStatus.CLOSED) {
            return;
        }

        if (type === 'RESPONSE' && !ticket.slaResponseBreached) {
            if (ticket.slaResponseDeadline && new Date() > ticket.slaResponseDeadline) {
                // Mark as breached
                await prisma.ticket.update({
                    where: { id: ticketId },
                    data: { slaResponseBreached: true }
                });
                
                // Escalate / Notify
                if (ticket.assignedToId) {
                    await NotificationService.send({
                        userId: ticket.assignedToId,
                        title: 'SLA Response Breached',
                        message: `Ticket ${ticket.ticketNumber} SLA Response Deadline missed.`,
                        type: 'HELPDESK'
                    });
                }
            }
        }
        
        if (type === 'RESOLUTION' && !ticket.slaResolutionBreached) {
            if (ticket.slaResolutionDeadline && new Date() > ticket.slaResolutionDeadline) {
                // Mark as breached
                await prisma.ticket.update({
                    where: { id: ticketId },
                    data: { slaResolutionBreached: true }
                });
                
                // Notify L2/L3 Managers or Assignee
                if (ticket.assignedToId) {
                    await NotificationService.send({
                        userId: ticket.assignedToId,
                        title: 'SLA Resolution Breached',
                        message: `Ticket ${ticket.ticketNumber} SLA Resolution Deadline missed. Escalate immediately.`,
                        type: 'HELPDESK'
                    });
                }
            }
        }
    }
}
