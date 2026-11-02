import { getAuthenticatedUserId } from '@/lib/request-context';
export const dynamic = 'force-dynamic';

import { apiHandler } from "@/lib/api-handler";
import { AppError } from "@/lib/error";
import { HelpdeskService } from "@/services/helpdesk/helpdesk.service";
import { CreateTicketUpdateSchema } from "@/lib/validations/helpdesk.schema";

import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';

export const GET = apiHandler(async (req, params) => {
  const { id } = await params;
  const userId = getAuthenticatedUserId()!;

  const ticket = await HelpdeskService.getTicketById(id);
  if (!ticket) {
    throw AppError.notFound("Ticket not found");
  }

  // Security: Only IT Staff or the owner can view comments
  const isITStaff = params._permissions.includes(RBAC_PERMISSIONS.HELPDESK_WRITE);
  if (!isITStaff && ticket.userId !== userId) {
    throw AppError.forbidden("Forbidden");
  }

  return ticket.updates;
});

export const POST = apiHandler(
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

    // Security: Only IT Staff or the owner can add comments
    if (!isITStaff && ticket.userId !== userId) {
      throw AppError.forbidden("Forbidden");
    }

    // Security: Standard employees can only transition ticket status to CLOSED or OPEN
    if (!isITStaff && body.statusTo && !["CLOSED", "OPEN"].includes(body.statusTo)) {
      throw AppError.forbidden("Forbidden: Standard employees can only transition status to OPEN or CLOSED.");
    }

    return await HelpdeskService.addTicketComment(userId, id, body, ipAddress, userAgent);
  },
  {
    schema: CreateTicketUpdateSchema,
    audit: {
      action: "UPDATE",
      entity: "Ticket"
    }
  }
);
