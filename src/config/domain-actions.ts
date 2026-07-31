export interface DomainAction {
  value: string; // The Webhook API URL (e.g. /api/projects/update-sod-phase)
  label: string; // Human readable name (e.g. Update Project Phase)
  desc: string;  // Description
  entityType: string; // Maps to Module e.g. SERVICE_ORDER, MATERIAL_REQUEST
}

// Global System Registry for Webhook Event Actions
// This is exposed via GET /api/admin/domain-actions so the frontend can build dropdowns dynamically
// without hardcoding anything in React. True zero-coding UI!
export const DOMAIN_ACTIONS_REGISTRY: DomainAction[] = [
  // MATERIAL_REQUEST
  { entityType: 'MATERIAL_REQUEST', value: '', label: 'None (Only Status Update)', desc: 'Just update the status of the request' },
  { entityType: 'MATERIAL_REQUEST', value: '/api/inventory/reserve-stock', label: 'Reserve Stock (Main Store)', desc: 'Automatically reserve inventory quantities' },
  { entityType: 'MATERIAL_REQUEST', value: '/api/inventory/dispatch-mrn', label: 'Dispatch & Generate MIN', desc: 'Deduct stock and create Material Issue Note' },
  { entityType: 'MATERIAL_REQUEST', value: '/api/inventory/emergency-petty-purchase', label: 'Emergency Fast-Track Petty Cash Purchase', desc: 'Auto-generate Petty Cash Voucher & Direct GRN for emergency local purchases' },
  
  // SERVICE_ORDER
  { entityType: 'SERVICE_ORDER', value: '', label: 'None (Only Status Update)', desc: 'Just update the status of the SOD' },
  { entityType: 'SERVICE_ORDER', value: '/api/projects/update-sod-phase', label: 'Update Project Phase', desc: 'Move SOD to next implementation phase' },
  { entityType: 'SERVICE_ORDER', value: '/api/projects/trigger-pat', label: 'Trigger PAT Workflow', desc: 'Initiate Provisional Acceptance Testing' },
  
  // INVOICE
  { entityType: 'INVOICE', value: '', label: 'None (Only Status Update)', desc: 'Just update the status of the invoice' },
  { entityType: 'INVOICE', value: '/api/finance/post-ledger', label: 'Post to General Ledger', desc: 'Record financial transactions automatically' },
  { entityType: 'INVOICE', value: '/api/finance/approve-payment', label: 'Approve Contractor Payment', desc: 'Authorize payout split for the contractor' }
];
