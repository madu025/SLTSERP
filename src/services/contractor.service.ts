import { ContractorQueryService } from './contractor/contractor.query.service';
import { ContractorRegistrationService } from './contractor/contractor.registration.service';
import { ContractorLifecycleService } from './contractor/contractor.lifecycle.service';
import { 
    ContractorUpdateData, 
    ContractorQueryParams, 
    RegistrationLinkParams,
    TeamInput,
    TeamMemberInput
} from './contractor/contractor-types';

export type { 
    ContractorUpdateData, 
    ContractorQueryParams, 
    RegistrationLinkParams,
    TeamInput,
    TeamMemberInput
};

/**
 * ContractorService (Facade)
 * Acts as the main entry point for all contractor-related operations.
 * Delegates actual logic to specialized services.
 */
export class ContractorService {
    
    // --- QUERY OPERATIONS ---
    
    static async getAllContractors(opmcIds?: string[] | ContractorQueryParams, page?: number, limit?: number) {
        if (opmcIds && typeof opmcIds === 'object' && !Array.isArray(opmcIds)) {
            return ContractorQueryService.getAllContractors(opmcIds);
        }
        return ContractorQueryService.getAllContractors({ 
            opmcIds: opmcIds as string[] | undefined, 
            page, 
            limit 
        });
    }

    static async getContractorById(id: string) {
        return ContractorQueryService.getContractorById(id);
    }

    // --- REGISTRATION OPERATIONS ---

    static async generateRegistrationLink(data: RegistrationLinkParams) {
        return ContractorRegistrationService.generateRegistrationLink(data);
    }

    static async resendRegistrationLink(id: string, origin: string) {
        return ContractorRegistrationService.resendRegistrationLink(id, origin);
    }

    static async getContractorByToken(token: string) {
        return ContractorRegistrationService.getContractorByToken(token);
    }

    static async saveRegistrationDraft(token: string, draftData: ContractorUpdateData) {
        return ContractorRegistrationService.saveRegistrationDraft(token, draftData);
    }

    static async submitPublicRegistration(token: string, data: ContractorUpdateData) {
        return ContractorRegistrationService.submitPublicRegistration(token, data);
    }

    // --- LIFECYCLE OPERATIONS ---

    static async createContractor(data: ContractorUpdateData) {
        return ContractorLifecycleService.createContractor(data);
    }

    static async updateContractor(id: string, data: ContractorUpdateData) {
        return ContractorLifecycleService.updateContractor(id, data);
    }

    static async deleteContractor(id: string) {
        return ContractorLifecycleService.deleteContractor(id);
    }
}
