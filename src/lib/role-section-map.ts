// Role to Section Mapping
export const ROLE_SECTION_MAP: Record<string, { sectionCode: string; requiresOPMC: boolean }> = {
    // Projects Section
    'OSP_MANAGER': { sectionCode: 'PROJECTS', requiresOPMC: false },
    'AREA_MANAGER': { sectionCode: 'PROJECTS', requiresOPMC: false },
    'ENGINEER': { sectionCode: 'PROJECTS', requiresOPMC: false },
    'ASSISTANT_ENGINEER': { sectionCode: 'PROJECTS', requiresOPMC: false },
    'AREA_COORDINATOR': { sectionCode: 'PROJECTS', requiresOPMC: false },
    'QC_OFFICER': { sectionCode: 'PROJECTS', requiresOPMC: false },

    // New Connection Section
    'MANAGER': { sectionCode: 'NEW_CONNECTION', requiresOPMC: true },

    // Service Assurance Section
    'SA_MANAGER': { sectionCode: 'SERVICE_ASSURANCE', requiresOPMC: true },
    'SA_ASSISTANT': { sectionCode: 'SERVICE_ASSURANCE', requiresOPMC: true },

    // Stores Section
    'STORES_MANAGER': { sectionCode: 'STORES', requiresOPMC: false },
    'STORES_ASSISTANT': { sectionCode: 'STORES', requiresOPMC: false },

    // Procurement Section
    'PROCUREMENT_OFFICER': { sectionCode: 'PROCUREMENT', requiresOPMC: false },

    // Finance Section
    'FINANCE_MANAGER': { sectionCode: 'FINANCE', requiresOPMC: false },
    'FINANCE_ASSISTANT': { sectionCode: 'FINANCE', requiresOPMC: false },

    // Invoice Section
    'INVOICE_MANAGER': { sectionCode: 'INVOICE', requiresOPMC: false },
    'INVOICE_ASSISTANT': { sectionCode: 'INVOICE', requiresOPMC: false },

    // Office Admin Section
    'OFFICE_ADMIN': { sectionCode: 'OFFICE_ADMIN', requiresOPMC: false },
    'OFFICE_ADMIN_ASSISTANT': { sectionCode: 'OFFICE_ADMIN', requiresOPMC: false },

    // Admin (no section needed)
    'SUPER_ADMIN': { sectionCode: 'ADMIN', requiresOPMC: false },
    'ADMIN': { sectionCode: 'ADMIN', requiresOPMC: false }
};

// Helper to get section code from role
export function getSectionCodeForRole(role: string): string | null {
    return ROLE_SECTION_MAP[role]?.sectionCode || null;
}

// Helper to check if role requires OPMC
export function roleRequiresOPMC(role: string): boolean {
    return ROLE_SECTION_MAP[role]?.requiresOPMC || false;
}
