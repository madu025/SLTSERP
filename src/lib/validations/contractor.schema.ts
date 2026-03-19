import { z } from 'zod';

export const contractorMemberSchema = z.object({
    name: z.string().min(1, "Member name is required"),
    designation: z.string().optional(),
    nic: z.string().optional(),
    contactNumber: z.string().optional(),
    address: z.string().optional(),
    photoUrl: z.string().optional(),
    nicUrl: z.string().optional(),
    passportPhotoUrl: z.string().optional(),
    policeReportUrl: z.string().optional(),
    gramaCertUrl: z.string().optional(),
    shoeSize: z.string().optional(),
    tshirtSize: z.string().optional(),
});

export const contractorTeamSchema = z.object({
    id: z.string().optional(),
    name: z.string().min(1, "Team name is required"),
    opmcId: z.string().optional().nullable(),
    sltCode: z.string().optional().nullable(),
    storeIds: z.array(z.string()).optional(),
    primaryStoreId: z.string().optional().nullable(),
    members: z.array(contractorMemberSchema).optional().default([]),
});

export const contractorSchema = z.object({
    id: z.string().optional(),
    name: z.string().min(1, "Name is required"),
    registrationNumber: z.string().optional().nullable(),
    address: z.string().optional().nullable(),
    brNumber: z.string().optional().nullable(),
    status: z.string().optional(),
    type: z.string().optional(),
    contactNumber: z.string().min(10, "Valid contact number is required"),
    nic: z.string().min(10, "Valid NIC is required"),
    email: z.string().email("Invalid email").optional().nullable(),
    
    // Bank Details
    bankName: z.string().optional().nullable(),
    bankBranch: z.string().optional().nullable(),
    bankAccountNumber: z.string().optional().nullable(),
    bankPassbookUrl: z.string().optional().nullable(),
    
    // Internal assignment
    opmcId: z.string().optional().nullable(),
    
    // Status/Agreements
    registrationFeePaid: z.boolean().optional(),
    agreementSigned: z.boolean().optional(),
    agreementDate: z.string().optional().nullable(),
    agreementDuration: z.union([z.number(), z.string()]).optional().nullable(),
    
    // Document URLs
    photoUrl: z.string().optional().nullable(),
    nicFrontUrl: z.string().optional().nullable(),
    nicBackUrl: z.string().optional().nullable(),
    policeReportUrl: z.string().optional().nullable(),
    gramaCertUrl: z.string().optional().nullable(),
    brCertUrl: z.string().optional().nullable(),
    registrationFeeSlipUrl: z.string().optional().nullable(),
    
    // Teams
    teams: z.array(contractorTeamSchema).optional().default([]),
});

// For public registration specifically
export const publicRegistrationSchema = contractorSchema.extend({
    nic: z.string().min(10, "NIC is strictly required for registration"),
    address: z.string().min(5, "Full address is required"),
    contactNumber: z.string().min(10, "Contact number is required"),
    bankName: z.string().min(2, "Bank name is required"),
    bankAccountNumber: z.string().min(5, "Account number is required"),
    // URLs are required on final submission
    nicFrontUrl: z.string().min(5, "NIC Front is required"),
    nicBackUrl: z.string().min(5, "NIC Back is required"),
    registrationFeeSlipUrl: z.string().min(5, "Registration Fee Slip is required"),
});

export const registrationInviteSchema = z.object({
    name: z.string().min(1, "Name is required"),
    contactNumber: z.string().min(10, "Valid contact number is required"),
    type: z.enum(['SOD', 'OSP']).default('SOD'),
    opmcId: z.string().min(1, "Regional Office is required"),
    siteOfficeStaffId: z.string().optional(),
    email: z.string().email().optional().nullable(),
});

export type ContractorSchema = z.infer<typeof contractorSchema>;
export type PublicRegistrationSchema = z.infer<typeof publicRegistrationSchema>;
export type ContractorTeamSchema = z.infer<typeof contractorTeamSchema>;
export type ContractorMemberSchema = z.infer<typeof contractorMemberSchema>;
export type RegistrationInviteSchema = z.infer<typeof registrationInviteSchema>;
