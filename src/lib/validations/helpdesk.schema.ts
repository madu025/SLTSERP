import { z } from "zod";

// Enum schemas matching the Prisma models
export const ITDeviceTypeSchema = z.enum(["LAPTOP", "DESKTOP", "MOBILE", "PRINTER", "NETWORK", "OTHER"]);
export const ITAssetStatusSchema = z.enum(["ACTIVE", "UNDER_REPAIR", "DECOMMISSIONED", "SPARE", "FAULTY", "DISPOSED"]);
export const TicketPrioritySchema = z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]);
export const TicketStatusSchema = z.enum([
  "OPEN",
  "ASSIGNED",
  "IN_PROGRESS",
  "WAITING_FOR_USER",
  "WAITING_FOR_PARTS",
  "RESOLVED",
  "CLOSED"
]);
export const IssueCategorySchema = z.enum([
  "PHYSICAL_DAMAGE",
  "BROKEN_DISPLAY",
  "PRINTER_ISSUE",
  "NETWORK_ISSUE",
  "SOFTWARE_ISSUE",
  "EMAIL_ISSUE",
  "EQUIPMENT_REQUEST",
  "HARDWARE_REPLACEMENT",
  "AUDIO_SPEAKER_ISSUE",
  "HOUSING_BODY_DAMAGE",
  "OTHER"
]);

// Ticket Schemas
export const CreateTicketSchema = z.object({
  assetId: z.string().cuid().optional().nullable(),
  category: IssueCategorySchema.default("OTHER"),
  description: z.string().optional().nullable(),
  priority: TicketPrioritySchema.default("MEDIUM"),
  anydeskId: z.string().optional().nullable(),
  photoUrls: z.array(z.string()).default([])
});

export const UpdateTicketSchema = z.object({
  status: TicketStatusSchema.optional(),
  priority: TicketPrioritySchema.optional(),
  assignedToId: z.string().cuid().optional().nullable(),
  anydeskId: z.string().optional().nullable(),
  anydeskSession: z.string().optional().nullable(),
  satisfactionRating: z.number().min(1).max(5).optional().nullable(),
  satisfactionNote: z.string().optional().nullable()
});

export const CreateTicketUpdateSchema = z.object({
  message: z.string().min(1, "Message content is required"),
  statusTo: TicketStatusSchema.optional(),
  photoUrls: z.array(z.string()).default([])
});

// IT Asset Schemas
export const CreateAssetSchema = z.object({
  assetNumber: z.string().min(1, "Asset number is required"),
  serialNumber: z.string().min(1, "Serial number is required"),
  deviceType: ITDeviceTypeSchema,
  brand: z.string().min(1, "Brand is required"),
  model: z.string().min(1, "Model identifier is required"),
  assignedStaffId: z.string().cuid().optional().nullable(),
  department: z.string().optional().nullable(),
  siteOfficeId: z.string().cuid().optional().nullable(),
  location: z.string().optional().nullable(),
  status: ITAssetStatusSchema.default("ACTIVE"),
  purchaseDate: z.string().or(z.date()).optional().nullable(),
  warrantyExpiry: z.string().or(z.date()).optional().nullable(),
  purchaseCost: z.number().optional().nullable()
});

export const UpdateAssetSchema = z.object({
  assetNumber: z.string().min(1).optional(),
  serialNumber: z.string().min(1).optional(),
  deviceType: ITDeviceTypeSchema.optional(),
  brand: z.string().min(1).optional(),
  model: z.string().min(1).optional(),
  assignedStaffId: z.string().cuid().optional().nullable(),
  department: z.string().optional().nullable(),
  siteOfficeId: z.string().cuid().optional().nullable(),
  location: z.string().optional().nullable(),
  status: ITAssetStatusSchema.optional(),
  purchaseDate: z.string().or(z.date()).optional().nullable(),
  warrantyExpiry: z.string().or(z.date()).optional().nullable(),
  purchaseCost: z.number().optional().nullable()
});

// KB Article Schemas
export const CreateKBArticleSchema = z.object({
  title: z.string().min(1, "Title is required"),
  content: z.string().min(1, "Content body is required"),
  category: z.string().min(1, "Category is required")
});

// Handover Log Schemas
export const AssetTransactionTypeSchema = z.enum(["ISSUED_TO_USER", "RETURNED_TO_STORE", "EXCHANGED"]);

export const CreateAssetHandoverSchema = z.object({
  transactionType: AssetTransactionTypeSchema,
  targetStaffId: z.string().cuid().optional().nullable(),
  condition: z.string().optional().nullable(),
  remarks: z.string().optional().nullable()
});
