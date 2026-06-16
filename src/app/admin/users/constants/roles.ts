export const ROLE_CATEGORIES = {
    'System Admin': ['SUPER_ADMIN', 'ADMIN'],
    'Main Management': ['OSP_MANAGER'],
    'OSP & Operations': ['AREA_MANAGER', 'ENGINEER', 'ASSISTANT_ENGINEER', 'AREA_COORDINATOR', 'QC_OFFICER'],
    'Stores & Inventory': ['STORES_MANAGER', 'STORES_ASSISTANT'],
    'Finance': ['FINANCE_MANAGER', 'FINANCE_ASSISTANT'],
    'Invoice Section': ['INVOICE_MANAGER', 'INVOICE_ASSISTANT'],
    'Service Assurance': ['SA_MANAGER', 'SA_ASSISTANT'],
    'Office Admin': ['OFFICE_ADMIN', 'OFFICE_ADMIN_ASSISTANT', 'SITE_OFFICE_STAFF'],
    'Procurement': ['PROCUREMENT_OFFICER']
};

export type RoleCategory = keyof typeof ROLE_CATEGORIES;
