import { getAuthenticatedUserId } from '@/lib/request-context';
export const dynamic = 'force-dynamic';

import { apiHandler } from "@/lib/api-handler";
import { AppError } from "@/lib/error";
import { HelpdeskService } from "@/services/helpdesk/helpdesk.service";
import { UpdateTicketSchema } from "@/lib/validations/helpdesk.schema";

import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';

export const GET = apiHandler(async (req, params) => {
  const { id } = await params;
  const userId = getAuthenticatedUserId()!;

  const ticket = await HelpdeskService.getTicketById(id);
  if (!ticket) {
    throw AppError.notFound("Ticket not found");
  }

  // Security: Only IT Staff or the owner can view ticket details
  const isITStaff = params._permissions.includes(RBAC_PERMISSIONS.HELPDESK_WRITE);
  if (!isITStaff && ticket.userId !== userId) {
    throw AppError.forbidden("Forbidden");
  }

  return ticket;
});

export const PUT = apiHandler(
  async (req, params, body) => {
    const { id } = await params;
    const userId = getAuthenticatedUserId()!;
    const ipAddress = req.headers.get("x-real-ip") || undefined;
    const userAgent = req.headers.get("user-agent") || undefined;

    const ticket = await HelpdeskService.getTicketById(id);
    if (!ticket) {
      throw AppError.notFound("Ticket not found");
    }

    const isITStaff = params._permissions.includes(RBAC_PERMISSIONS.HELPDESK_WRITE);
    
    // Security: Check authorization to update ticket
    if (!isITStaff) {
      // Standard employee can only update their own ticket
      if (ticket.userId !== userId) {
        throw AppError.forbidden("Forbidden");
      }

      // Standard employee can ONLY change:
      // 1. anydeskId
      // 2. status to CLOSED or OPEN (reopen)
      // 3. satisfactionRating & satisfactionNote
      const allowedKeys = ["anydeskId", "status", "satisfactionRating", "satisfactionNote"];
      const requestedKeys = Object.keys(body).filter(k => body[k as keyof typeof body] !== undefined);
      const isAllowed = requestedKeys.every(k => allowedKeys.includes(k));

      if (!isAllowed) {
        throw AppError.forbidden("Forbidden: Standard employees can only update AnyDesk ID, rating, or close/reopen their ticket.");
      }

      if (body.status && !["CLOSED", "OPEN"].includes(body.status)) {
        throw AppError.forbidden("Forbidden: Standard employees can only transition tickets to OPEN or CLOSED.");
      }
    }

    return await HelpdeskService.updateTicket(userId, id, body, ipAddress, userAgent);
  },
  {
    schema: UpdateTicketSchema,
    audit: {
      action: "UPDATE",
      entity: "Ticket"
    }
  }
);
