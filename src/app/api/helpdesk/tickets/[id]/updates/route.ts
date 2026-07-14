import { apiHandler } from "@/lib/api-handler";
import { HelpdeskService } from "@/services/helpdesk.service";
import { CreateTicketUpdateSchema } from "@/lib/validations/helpdesk.schema";

export const GET = apiHandler(async (req, params) => {
  const { id } = await params;
  const userId = req.headers.get("x-user-id")!;
  const userRole = req.headers.get("x-user-role") || "ENGINEER";

  const ticket = await HelpdeskService.getTicketById(id);
  if (!ticket) {
    throw new Error("Ticket not found");
  }

  // Security: Only IT Staff or the owner can view comments
  const isITStaff = ["SUPER_ADMIN", "ADMIN", "ENGINEER", "OFFICE_ADMIN", "OFFICE_ADMIN_ASSISTANT"].includes(userRole);
  if (!isITStaff && ticket.userId !== userId) {
    throw new Error("Forbidden");
  }

  return ticket.updates;
});

export const POST = apiHandler(
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

    // Security: Only IT Staff or the owner can add comments
    if (!isITStaff && ticket.userId !== userId) {
      throw new Error("Forbidden");
    }

    // Security: Standard employees can only transition ticket status to CLOSED or OPEN
    if (!isITStaff && body.statusTo && !["CLOSED", "OPEN"].includes(body.statusTo)) {
      throw new Error("Forbidden: Standard employees can only transition status to OPEN or CLOSED.");
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
