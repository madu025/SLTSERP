/**
 * Predefined Status Registries per Entity Type / Module
 * Prevents human error / typos when defining Process Gates
 */

export interface StatusOption {
  value: string;
  label: string;
  badgeColor?: string;
}

export const MODULE_STATUS_REGISTRY: Record<string, StatusOption[]> = {
  MATERIAL_REQUEST: [
    { value: 'DRAFT', label: 'DRAFT (Initial Material Request)' },
    { value: 'PENDING', label: 'PENDING (Submitted for Review)' },
    { value: 'ARM_APPROVAL', label: 'ARM_APPROVAL (Area Manager Approval)' },
    { value: 'STORES_MANAGER_APPROVAL', label: 'STORES_MANAGER_APPROVAL (Stores Manager Review)' },
    { value: 'OSP_MANAGER_APPROVAL', label: 'OSP_MANAGER_APPROVAL (OSP Manager Approval)' },
    { value: 'PROCUREMENT', label: 'PROCUREMENT (Store Dispatch / Issue)' },
    { value: 'COMPLETED', label: 'COMPLETED (Issued & Fulfilled)' },
    { value: 'REJECTED', label: 'REJECTED (Returned / Rejected)' },
  ],

  SERVICE_ORDER: [
    { value: 'PENDING', label: 'PENDING (New SOD Received)' },
    { value: 'ASSIGNED', label: 'ASSIGNED (Contractor Assigned)' },
    { value: 'MATERIAL_ISSUED', label: 'MATERIAL_ISSUED (Stores Issue Completed)' },
    { value: 'WORK_IN_PROGRESS', label: 'WORK_IN_PROGRESS (Field Execution)' },
    { value: 'PENDING_PAT', label: 'PENDING_PAT (Awaiting Acceptance Test)' },
    { value: 'PAT_PASSED', label: 'PAT_PASSED (PAT Approved)' },
    { value: 'COMPLETED', label: 'COMPLETED (Work Finished)' },
    { value: 'INVOICED', label: 'INVOICED (Billed)' },
    { value: 'RETURN', label: 'RETURN (Returned to SLT)' },
    { value: 'CLOSED', label: 'CLOSED (Archived)' },
  ],

  INVOICE: [
    { value: 'DRAFT', label: 'DRAFT (Invoice Prepared)' },
    { value: 'SUBMITTED', label: 'SUBMITTED (Pending Audit)' },
    { value: 'SF_AUDIT_APPROVED', label: 'SF_AUDIT_APPROVED (SF Audit Verified)' },
    { value: 'FINANCE_APPROVED', label: 'FINANCE_APPROVED (Finance Manager Approved)' },
    { value: 'POSTED', label: 'POSTED (General Ledger Posted)' },
    { value: 'PAID', label: 'PAID (Disbursed)' },
    { value: 'REJECTED', label: 'REJECTED (Disputed / Returned)' },
  ],

  PROJECT_TASK: [
    { value: 'PLANNED', label: 'PLANNED (Task Created)' },
    { value: 'ASSIGNED', label: 'ASSIGNED (Team Assigned)' },
    { value: 'IN_PROGRESS', label: 'IN_PROGRESS (Survey / Civil Work)' },
    { value: 'INSPECTION_PENDING', label: 'INSPECTION_PENDING (QA Inspection)' },
    { value: 'COMPLETED', label: 'COMPLETED (Task Accepted)' },
  ],
};
