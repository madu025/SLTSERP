import { Contractor } from '@prisma/client';
import { ContractorUpdateData, RegistrationLinkParams } from './contractor-types';

export interface IContractorService {
    createContractor(data: ContractorUpdateData): Promise<Contractor>;
    updateContractor(id: string, data: ContractorUpdateData): Promise<Contractor>;
    deleteContractor(id: string): Promise<Record<string, unknown>>;
    generateRegistrationLink(data: RegistrationLinkParams): Promise<Record<string, unknown>>;
    resendRegistrationLink(id: string, origin: string): Promise<Record<string, unknown>>;
    generateRenewalLink(id: string, origin: string): Promise<Record<string, unknown>>;
    getContractorByToken(token: string): Promise<Contractor>;
    saveRegistrationDraft(token: string, draftData: ContractorUpdateData): Promise<Contractor>;
    submitPublicRegistration(token: string, data: ContractorUpdateData): Promise<Contractor>;
}
