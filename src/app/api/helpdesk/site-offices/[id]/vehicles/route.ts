import { apiHandler } from "@/lib/api-handler";
import { HelpdeskService } from "@/services/helpdesk.service";
import { CreateOfficeVehicleSchema, UpdateOfficeVehicleSchema } from "@/lib/validations/siteoffice.schema";

export const POST = apiHandler(
  async (req, params, body) => {
    const { id: siteOfficeId } = await params;
    const userId = req.headers.get("x-user-id")!;
    const ipAddress = req.headers.get("x-real-ip") || undefined;
    const userAgent = req.headers.get("user-agent") || undefined;

    return await HelpdeskService.createOfficeVehicle(userId, siteOfficeId, body, ipAddress, userAgent);
  },
  {
    schema: CreateOfficeVehicleSchema,
    roles: ["SUPER_ADMIN", "ADMIN", "OFFICE_ADMIN"],
    audit: {
      action: "CREATE",
      entity: "SiteOfficeVehicle" as any
    }
  }
);

export const PUT = apiHandler(
  async (req, params, body) => {
    const userId = req.headers.get("x-user-id")!;
    const url = new URL(req.url);
    const vehicleId = url.searchParams.get("vehicleId");
    if (!vehicleId) throw new Error("Vehicle ID is required");

    const ipAddress = req.headers.get("x-real-ip") || undefined;
    const userAgent = req.headers.get("user-agent") || undefined;

    return await HelpdeskService.updateOfficeVehicle(userId, vehicleId, body, ipAddress, userAgent);
  },
  {
    schema: UpdateOfficeVehicleSchema,
    roles: ["SUPER_ADMIN", "ADMIN", "OFFICE_ADMIN"],
    audit: {
      action: "UPDATE",
      entity: "SiteOfficeVehicle" as any
    }
  }
);

export const DELETE = apiHandler(
  async (req) => {
    const userId = req.headers.get("x-user-id")!;
    const url = new URL(req.url);
    const vehicleId = url.searchParams.get("vehicleId");
    if (!vehicleId) throw new Error("Vehicle ID is required");

    const ipAddress = req.headers.get("x-real-ip") || undefined;
    const userAgent = req.headers.get("user-agent") || undefined;

    return await HelpdeskService.deleteOfficeVehicle(userId, vehicleId, ipAddress, userAgent);
  },
  {
    roles: ["SUPER_ADMIN", "ADMIN", "OFFICE_ADMIN"],
    audit: {
      action: "DELETE",
      entity: "SiteOfficeVehicle" as any
    }
  }
);
