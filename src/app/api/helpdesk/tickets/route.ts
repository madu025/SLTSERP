import { apiHandler } from "@/lib/api-handler";
import { HelpdeskService } from "@/services/helpdesk.service";
import { CreateTicketSchema } from "@/lib/validations/helpdesk.schema";
import { TicketStatus, TicketPriority, IssueCategory } from "@prisma/client";

export const dynamic = 'force-dynamic';

export const GET = apiHandler(async (req) => {
  const url = new URL(req.url);
  const page = parseInt(url.searchParams.get("page") || "1");
  const limit = parseInt(url.searchParams.get("limit") || "20");
  const search = url.searchParams.get("search") || "";
  const status = url.searchParams.get("status") as TicketStatus || undefined;
  const priority = url.searchParams.get("priority") as TicketPriority || undefined;
  const category = url.searchParams.get("category") as IssueCategory || undefined;
  const assignedToId = url.searchParams.get("assignedToId") || undefined;
  
  const userIdHeader = req.headers.get("x-user-id")!;
  const userRole = req.headers.get("x-user-role") || "ENGINEER";

  // Security: Check if standard employee. If so, restrict results to their own tickets.
  const isITStaff = ["SUPER_ADMIN", "ADMIN", "ENGINEER", "OFFICE_ADMIN", "OFFICE_ADMIN_ASSISTANT"].includes(userRole);
  const userId = isITStaff ? (url.searchParams.get("userId") || undefined) : userIdHeader;

  return await HelpdeskService.getTickets({
    page,
    limit,
    status,
    priority,
    category,
    userId,
    assignedToId,
    search
  });
});

export const POST = apiHandler(
  async (req, _params, body) => {
    const userId = req.headers.get("x-user-id")!;
    const ipAddress = req.headers.get("x-real-ip") || undefined;
    const userAgent = req.headers.get("user-agent") || undefined;

    return await HelpdeskService.createTicket(userId, body, ipAddress, userAgent);
  },
  {
    schema: CreateTicketSchema,
    audit: {
      action: "CREATE",
      entity: "Ticket"
    }
  }
);
