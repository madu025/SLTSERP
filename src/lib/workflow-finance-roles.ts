/** Stage owner roles that mean "the project's finance team" rather than a staff role someone holds. */
export const FINANCE_STAGE_ROLES: readonly string[] = ['CONTRACTOR_FINANCE', 'INVOICE_MANAGER'];

/** Project finance assignment roles that do the invoice work (reviewers/approvers are handed off separately). */
export const FINANCE_TEAM_ROLES = ['LEAD_CONTROLLER', 'PREPARER', 'REVIEWER'] as const;
