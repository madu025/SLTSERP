/**
 * Centralized registry of all notification template codes used by the system.
 * Each code maps to a specific email-sending function in the codebase.
 * Admin UI uses this to populate the template code dropdown.
 */

export interface TemplateCodeDef {
  code: string;
  label: string;
  description: string;
  category: 'APPROVAL' | 'ALERT' | 'NOTIFICATION' | 'INVENTORY';
  placeholders: string[];
  defaultEntityType: string;
}

export const TEMPLATE_CODES: TemplateCodeDef[] = [
  {
    code: 'APPROVAL_GENERIC',
    label: 'Generic Approval',
    description: 'Used for any ProcessGate approval (PO, GRN, SOD, etc.)',
    category: 'APPROVAL',
    placeholders: [
      'user', 'entityType', 'entityId', 'entityName',
      'approveUrl', 'rejectUrl', 'expiryHours', 'status', 'amount'
    ],
    defaultEntityType: 'GENERIC'
  },
  {
    code: 'APPROVAL_MATERIAL_REQUEST',
    label: 'Material Request Approval',
    description: 'Stock request multi-level approval with item list',
    category: 'APPROVAL',
    placeholders: [
      'user', 'entityId', 'userRole', 'priority', 'purpose',
      'fromStore', 'toStore', 'items',
      'approveUrl', 'rejectUrl', 'expiryHours', 'status'
    ],
    defaultEntityType: 'MATERIAL_REQUEST'
  },
  {
    code: 'APPROVAL_WASTAGE',
    label: 'Wastage Approval',
    description: 'Wastage record approval workflow',
    category: 'APPROVAL',
    placeholders: [
      'user', 'entityId', 'entityName', 'date',
      'approveUrl', 'rejectUrl', 'expiryHours'
    ],
    defaultEntityType: 'WASTAGE'
  },
  {
    code: 'ALERT_GENERIC',
    label: 'Generic System Alert',
    description: 'Role-based system alerts (low stock, policy violations)',
    category: 'ALERT',
    placeholders: ['user', 'title', 'message', 'date', 'actionUrl'],
    defaultEntityType: 'ALERT'
  },
  {
    code: 'ALERT_FEFO_EXPIRY',
    label: 'FEFO Batch Expiry Alert',
    description: 'Batch expiry warning digest for stores managers',
    category: 'ALERT',
    placeholders: ['user', 'itemCount', 'items', 'date', 'storeName'],
    defaultEntityType: 'FEFO_ALERT'
  },
  {
    code: 'NOTIFICATION_DAILY_SUMMARY',
    label: 'Daily Notification Summary',
    description: 'Daily unread notification digest email',
    category: 'NOTIFICATION',
    placeholders: ['user', 'unreadCount', 'notifications', 'date'],
    defaultEntityType: 'DAILY_SUMMARY'
  },
  {
    code: 'NOTIFICATION_GENERIC',
    label: 'Generic Notification',
    description: 'In-app notification sent via email fallback',
    category: 'NOTIFICATION',
    placeholders: ['user', 'title', 'message', 'actionUrl', 'date'],
    defaultEntityType: 'NOTIFICATION'
  }
];

/**
 * Lookup helper: get template code definition by code string.
 */
export function getTemplateCodeDef(code: string): TemplateCodeDef | undefined {
  return TEMPLATE_CODES.find(t => t.code === code);
}

/**
 * Get all template codes groupeded by category.
 */
export function getTemplateCodesByCategory(): Record<string, TemplateCodeDef[]> {
  const grouped: Record<string, TemplateCodeDef[]> = {};
  for (const def of TEMPLATE_CODES) {
    if (!grouped[def.category]) grouped[def.category] = [];
    grouped[def.category].push(def);
  }
  return grouped;
}
