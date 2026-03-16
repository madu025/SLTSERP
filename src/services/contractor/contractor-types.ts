import { ContractorStatus } from '@prisma/client';

export interface TeamMemberInput {
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
    members: TeamMemberInput[];
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
    registrationFeePaid?: boolean;
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
    armApprovedAt?: Date | string | null;
    armApprovedById?: string | null;
    ospApprovedAt?: Date | string | null;
    ospApprovedById?: string | null;
    rejectionReason?: string | null;
    rejectionById?: string | null;
    rejectedAt?: Date | string | null;
}

export interface RegistrationLinkParams {
    name: string;
    contactNumber: string;
    email?: string;
    type?: string;
    siteOfficeStaffId: string;
    origin: string;
}

export interface ContractorQueryParams {
    opmcIds?: string[];
    page?: number;
    limit?: number;
}
