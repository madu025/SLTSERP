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

const emptyToNullCuid = z
  .string()
  .cuid()
  .optional()
  .nullable()
  .transform((val) => (val === "" ? null : val));

const emptyToNullNumber = z
  .union([z.number(), z.string()])
  .optional()
  .nullable()
  .transform((val) => {
    if (val === "" || val === null || val === undefined) return null;
    const num = Number(val);
    return isNaN(num) ? undefined : num;
  });

// IT Asset Schemas
export const CreateAssetSchema = z.object({
  assetNumber: z.string().min(1, "Asset number is required"),
  serialNumber: z.string().min(1, "Serial number is required"),
  deviceType: ITDeviceTypeSchema,
  brand: z.string().min(1, "Brand is required"),
  model: z.string().min(1, "Model identifier is required"),
  assignedStaffId: emptyToNullCuid,
  department: z.string().optional().nullable(),
  siteOfficeId: emptyToNullCuid,
  location: z.string().optional().nullable(),
  status: ITAssetStatusSchema.default("ACTIVE"),
  purchaseDate: z.string().or(z.date()).optional().nullable(),
  warrantyExpiry: z.string().or(z.date()).optional().nullable(),
  purchaseCost: emptyToNullNumber
});

export const UpdateAssetSchema = z.object({
  assetNumber: z.string().min(1).optional(),
  serialNumber: z.string().min(1).optional(),
  deviceType: ITDeviceTypeSchema.optional(),
  brand: z.string().min(1).optional(),
  model: z.string().min(1).optional(),
  assignedStaffId: emptyToNullCuid,
  department: z.string().optional().nullable(),
  siteOfficeId: emptyToNullCuid,
  location: z.string().optional().nullable(),
  status: ITAssetStatusSchema.optional(),
  purchaseDate: z.string().or(z.date()).optional().nullable(),
  warrantyExpiry: z.string().or(z.date()).optional().nullable(),
  purchaseCost: emptyToNullNumber,
  agreementReceived: z.boolean().optional().nullable(),
  newCustodianName: z.string().optional().nullable(),
  newCustodianEmpNo: z.string().optional().nullable(),
  isExchange: z.boolean().optional().nullable(),
  oldLaptopSerial: z.string().optional().nullable(),
  oldLaptopStatus: z.enum(["DECOMMISSIONED", "FAULTY", "SPARE", "ACTIVE"]).optional().nullable()
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

// Software License Schemas
export const SoftwareLicenseStatusSchema = z.enum(["ACTIVE", "EXPIRED", "DECOMMISSIONED"]);

export const CreateSoftwareLicenseSchema = z.object({
  name: z.string().min(1, "Software name is required"),
  key: z.string().optional().nullable(),
  vendor: z.string().optional().nullable(),
  purchaseDate: z.string().or(z.date()).optional().nullable(),
  expiryDate: z.string().or(z.date()).optional().nullable(),
  purchaseCost: z.number().optional().nullable(),
  totalLicenses: z.number().int().positive().default(1),
  status: SoftwareLicenseStatusSchema.default("ACTIVE"),
  remarks: z.string().optional().nullable()
});

export const UpdateSoftwareLicenseSchema = z.object({
  name: z.string().min(1).optional(),
  key: z.string().optional().nullable(),
  vendor: z.string().optional().nullable(),
  purchaseDate: z.string().or(z.date()).optional().nullable(),
  expiryDate: z.string().or(z.date()).optional().nullable(),
  purchaseCost: z.number().optional().nullable(),
  totalLicenses: z.number().int().positive().optional(),
  status: SoftwareLicenseStatusSchema.optional(),
  remarks: z.string().optional().nullable()
});

export const CreateSoftwareLicenseAssignmentSchema = z.object({
  assignedStaffId: z.string().cuid().optional().nullable(),
  assignedAssetId: z.string().cuid().optional().nullable(),
  assignedEmail: z.string().email().or(z.string().length(0)).optional().nullable(),
  remarks: z.string().optional().nullable()
});

export const CreateITAssetUnitSchema = z.object({
  serialNumber: z.string().min(1, "Serial number is required"),
  unitNumber: z.string().optional().nullable(),
  status: z.string().default("IN_HAND_STORES"),
  assignedStaffId: z.string().optional().nullable(),
  remarks: z.string().optional().nullable()
});

export const UpdateITAssetUnitSchema = z.object({
  unitId: z.string(),
  serialNumber: z.string().optional(),
  unitNumber: z.string().optional().nullable(),
  status: z.string().optional(),
  assignedStaffId: z.string().optional().nullable(),
  remarks: z.string().optional().nullable()
});
