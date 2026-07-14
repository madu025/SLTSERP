import { z } from "zod";

export const CreateSiteOfficeSchema = z.object({
  name: z.string().min(1, "Site office name is required"),
  address: z.string().min(1, "Site office address is required"),
  officeAdminId: z.string().cuid().optional().nullable(),
  contactNo: z.string().optional().nullable(),
  rentalCost: z.number().nonnegative().default(0),
  landlordName: z.string().optional().nullable(),
  landlordPhone: z.string().optional().nullable()
});

export const UpdateSiteOfficeSchema = CreateSiteOfficeSchema.partial();

// Agreement Validation
export const CreateAgreementSchema = z.object({
  agreementType: z.enum(["RENTAL", "LEASE", "PURCHASE"]),
  contractNumber: z.string().min(1, "Contract number is required"),
  startDate: z.string().or(z.date()),
  endDate: z.string().or(z.date()).optional().nullable(),
  terms: z.string().min(1, "Terms conditions are required"),
  monthlyRent: z.number().nonnegative().default(0),
  landlordName: z.string().optional().nullable(),
  landlordPhone: z.string().optional().nullable(),
  documentUrl: z.string().url("Must be a valid document attachment link").optional().nullable().or(z.literal(""))
});
export const UpdateAgreementSchema = CreateAgreementSchema.partial();

// Physical Goods Request Validation
export const CreateOfficeRequestSchema = z.object({
  itemType: z.enum(["FURNITURE", "STATIONERY", "EQUIPMENT", "MAINTENANCE", "OTHER"]),
  description: z.string().min(1, "Description of required items is required"),
  estimatedCost: z.number().nonnegative().default(0),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).default("MEDIUM"),
  status: z.enum(["PENDING", "APPROVED", "DELIVERED", "REJECTED"]).default("PENDING"),
  notes: z.string().optional().nullable()
});
export const UpdateOfficeRequestSchema = CreateOfficeRequestSchema.partial();

// Vehicle Allocation Validation
export const CreateOfficeVehicleSchema = z.object({
  vehicleRegNo: z.string().min(1, "Vehicle Registration Number is required"),
  makeModel: z.string().min(1, "Vehicle Make & Model is required"),
  assignedDriver: z.string().optional().nullable(),
  driverPhone: z.string().optional().nullable(),
  status: z.enum(["ACTIVE", "MAINTENANCE", "RETURNED"]).default("ACTIVE"),
  notes: z.string().optional().nullable()
});
export const UpdateOfficeVehicleSchema = CreateOfficeVehicleSchema.partial();

// Purchasing Tender Validation
export const CreateOfficeTenderSchema = z.object({
  tenderNo: z.string().min(1, "Tender publication number is required"),
  title: z.string().min(1, "Tender title is required"),
  description: z.string().min(1, "Tender description is required"),
  budget: z.number().nonnegative().default(0),
  publishDate: z.string().or(z.date()),
  closingDate: z.string().or(z.date()),
  status: z.enum(["DRAFT", "OPEN", "UNDER_EVALUATION", "AWARDED"]).default("DRAFT"),
  winnerVendor: z.string().optional().nullable(),
  winnerBidAmount: z.number().nonnegative().optional().nullable()
});
export const UpdateOfficeTenderSchema = CreateOfficeTenderSchema.partial();
