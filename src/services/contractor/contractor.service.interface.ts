import { Contractor } from '@prisma/client';
import { ContractorUpdateData, RegistrationLinkParams } from './contractor-types';

export interface IContractorService {
    createContractor(data: ContractorUpdateData): Promise<Contractor>;
    updateContractor(id: string, data: ContractorUpdateData): Promise<Contractor>;
    deleteContractor(id: string): Promise<any>;
    generateRegistrationLink(data: RegistrationLinkParams): Promise<any>;
    resendRegistrationLink(id: string, origin: string): Promise<any>;
    generateRenewalLink(id: string, origin: string): Promise<any>;
    getContractorByToken(token: string): Promise<Contractor>;
    saveRegistrationDraft(token: string, draftData: ContractorUpdateData): Promise<Contractor>;
    submitPublicRegistration(token: string, data: ContractorUpdateData): Promise<Contractor>;
}
