import { ContractorStatus } from '@prisma/client';

export interface TeamMemberInput {
    id?: string;
    name: string;
    nic?: string;
    idCopyNumber?: string;
    contractorIdCopyNumber?: string;
    designation?: string;
    contactNumber?: string;
    address?: string;
    photoUrl?: string;
    passportPhotoUrl?: string;
    nicUrl?: string;
    policeReportUrl?: string;
    gramaCertUrl?: string;
    shoeSize?: string;
    tshirtSize?: string;
}

export interface TeamInput {
    id?: string;
    name: string;
    opmcId?: string | null;
    storeIds?: string[];
    primaryStoreId?: string;
    sltCode?: string;
    status?: string;
    storeAssignments?: { storeId: string; isPrimary?: boolean }[];
    members?: TeamMemberInput[];
}

export interface ContractorUpdateData {
    id?: string;
    name?: string;
    address?: string;
    email?: string;
    registrationNumber?: string;
    brNumber?: string;
    status?: ContractorStatus;
    documentStatus?: string;
    kycVerified?: boolean;
    whtHoldStatus?: boolean;
    registrationFeePaid?: boolean;
    registrationFeeSlipUrl?: string;
    agreementSigned?: boolean;
    agreementDate?: string | Date | null;
    agreementDuration?: string | number;
    contactNumber?: string;
    nic?: string;
    brCertUrl?: string;
    bankAccountNumber?: string;
    bankBranch?: string;
    bankName?: string;
    bankPassbookUrl?: string;
    photoUrl?: string;
    nicFrontUrl?: string;
    nicBackUrl?: string;
    policeReportUrl?: string;
    gramaCertUrl?: string;
    opmcId?: string;
    siteOfficeStaffId?: string;
    registrationToken?: string;
    registrationTokenExpiry?: string | Date;
    type?: string;
    teams?: TeamInput[];
    createdAt?: Date | string;
    updatedAt?: Date | string;
}

/** Client input for the approval flow; actor, status, and audit fields are server-derived. */
export interface ContractorApprovalInput {
    teamCodes?: Record<string, string>;
}

/** Client input for a rejection; the rejecting actor and timestamp are server-derived. */
export interface ContractorRejectionInput {
    reason: string;
}

export interface RegistrationLinkParams {
    name: string;
    contactNumber: string;
    email?: string | null;
    type?: string;
    siteOfficeStaffId?: string;
    origin: string;
    opmcId?: string;
}

export interface ContractorQueryParams {
    opmcIds?: string[];
    page?: number;
    limit?: number;
    userId?: string;
    userRole?: string;
    /** SOD = service-order contractors, OSP = project / fibre-construction contractors. */
    type?: 'SOD' | 'OSP';
    status?: string;
}
