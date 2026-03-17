import { z } from 'zod';

export const contractorMemberSchema = z.object({
    name: z.string().min(1, "Member name is required"),
    designation: z.string().optional(),
    nic: z.string().optional(),
    contactNumber: z.string().optional(),
    address: z.string().optional(),
    photoUrl: z.string().optional(),
    nicUrl: z.string().optional(),
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
    registrationNumber: z.string().min(1, "Registration Number is required"),
    address: z.string().optional(),
    brNumber: z.string().optional().nullable(),
    status: z.string().optional(),
    type: z.string().optional(),
    contactNumber: z.string().optional().nullable(),
    nic: z.string().optional().nullable(),
    bankName: z.string().optional().nullable(),
    bankBranch: z.string().optional().nullable(),
    bankAccountNumber: z.string().optional().nullable(),
    opmcId: z.string().optional().nullable(),
    registrationFeePaid: z.boolean().optional(),
    agreementSigned: z.boolean().optional(),
    agreementDate: z.string().optional().nullable(),
    agreementDuration: z.union([z.number(), z.string()]).optional().nullable(),
    teams: z.array(contractorTeamSchema).optional(),
});
