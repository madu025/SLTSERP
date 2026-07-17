import { apiHandler } from "@/lib/api-handler";
import { HelpdeskAuditService } from "@/services/helpdesk-audit.service";
import { z } from "zod";
import { ITDeviceTypeSchema, ITAssetStatusSchema } from "@/lib/validations/helpdesk.schema";

export const dynamic = 'force-dynamic';

const CreateAuditSchema = z.object({
  serialNumber: z.string().min(1, "Serial number is required"),
  assetNumber: z.string().optional().nullable(),
  deviceType: ITDeviceTypeSchema,
  brand: z.string().min(1, "Brand is required"),
  model: z.string().min(1, "Model is required"),
  employeeNo: z.string().min(1, "Employee Number is required"),
  custodianName: z.string().min(1, "Custodian Name is required"),
  status: ITAssetStatusSchema.default("ACTIVE"),
  remarks: z.string().optional().nullable(),
  isConfirmed: z.boolean().default(false),
  department: z.string().optional().nullable(),
  siteOfficeId: z.string().optional().nullable(),
  location: z.string().optional().nullable()
});

// GET: List all audits (Admin only)
export const GET = apiHandler(
  async () => {
    return await HelpdeskAuditService.getAudits();
  },
  {
    roles: ["SUPER_ADMIN", "ADMIN", "ENGINEER", "OFFICE_ADMIN", "OFFICE_ADMIN_ASSISTANT"]
  }
);

// POST: Submit a public audit response (No auth checks so anyone can access it)
export const POST = apiHandler(
  async (req, _params, body) => {
    return await HelpdeskAuditService.submitAudit(body);
  },
  {
    schema: CreateAuditSchema
  }
);

// PUT: Approve & Sync an audit response with optional modifications (Admin only)
export const PUT = apiHandler(
  async (req, _params, body) => {
    const url = new URL(req.url);
    const auditId = url.searchParams.get("auditId");

    if (!auditId) {
      throw new Error("Audit ID is required");
    }

    return await HelpdeskAuditService.syncAuditToInventory(auditId, body || undefined);
  },
  {
    roles: ["SUPER_ADMIN", "ADMIN", "ENGINEER", "OFFICE_ADMIN", "OFFICE_ADMIN_ASSISTANT"],
    audit: {
      action: "UPDATE",
      entity: "ITAssetAudit"
    }
  }
);

// PATCH: Ignore / Reject an audit response (Admin only)
export const PATCH = apiHandler(
  async (req) => {
    const url = new URL(req.url);
    const auditId = url.searchParams.get("auditId");

    if (!auditId) {
      throw new Error("Audit ID is required");
    }

    return await HelpdeskAuditService.rejectAudit(auditId);
  },
  {
    roles: ["SUPER_ADMIN", "ADMIN", "ENGINEER", "OFFICE_ADMIN", "OFFICE_ADMIN_ASSISTANT"],
    audit: {
      action: "UPDATE",
      entity: "ITAssetAudit"
    }
  }
);
