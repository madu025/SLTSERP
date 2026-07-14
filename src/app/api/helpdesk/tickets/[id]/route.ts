import { apiHandler } from "@/lib/api-handler";
import { HelpdeskService } from "@/services/helpdesk.service";
import { UpdateTicketSchema } from "@/lib/validations/helpdesk.schema";

export const GET = apiHandler(async (req, params) => {
  const { id } = await params;
  const userId = req.headers.get("x-user-id")!;
  const userRole = req.headers.get("x-user-role") || "ENGINEER";

  const ticket = await HelpdeskService.getTicketById(id);
  if (!ticket) {
    throw new Error("Ticket not found");
  }

  // Security: Only IT Staff or the owner can view ticket details
  const isITStaff = ["SUPER_ADMIN", "ADMIN", "ENGINEER", "OFFICE_ADMIN", "OFFICE_ADMIN_ASSISTANT"].includes(userRole);
  if (!isITStaff && ticket.userId !== userId) {
    throw new Error("Forbidden");
  }

  return ticket;
});

export const PUT = apiHandler(
  async (req, params, body) => {
    const { id } = await params;
    const userId = req.headers.get("x-user-id")!;
    const userRole = req.headers.get("x-user-role") || "ENGINEER";
    const ipAddress = req.headers.get("x-real-ip") || undefined;
    const userAgent = req.headers.get("user-agent") || undefined;

    const ticket = await HelpdeskService.getTicketById(id);
    if (!ticket) {
      throw new Error("Ticket not found");
    }

    const isITStaff = ["SUPER_ADMIN", "ADMIN", "ENGINEER", "OFFICE_ADMIN", "OFFICE_ADMIN_ASSISTANT"].includes(userRole);
    
    // Security: Check authorization to update ticket
    if (!isITStaff) {
      // Standard employee can only update their own ticket
      if (ticket.userId !== userId) {
        throw new Error("Forbidden");
      }

      // Standard employee can ONLY change:
      // 1. anydeskId
      // 2. status to CLOSED or OPEN (reopen)
      // 3. satisfactionRating & satisfactionNote
      const allowedKeys = ["anydeskId", "status", "satisfactionRating", "satisfactionNote"];
      const requestedKeys = Object.keys(body).filter(k => body[k as keyof typeof body] !== undefined);
      const isAllowed = requestedKeys.every(k => allowedKeys.includes(k));

      if (!isAllowed) {
        throw new Error("Forbidden: Standard employees can only update AnyDesk ID, rating, or close/reopen their ticket.");
      }

      if (body.status && !["CLOSED", "OPEN"].includes(body.status)) {
        throw new Error("Forbidden: Standard employees can only transition tickets to OPEN or CLOSED.");
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
