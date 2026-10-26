/**
 * Shared validation for the SOD -> contractor invoice boundary.
 *
 * A completed SOD is not billable merely because its status is completed.
 * Revenue, contractor cost, assignment, completion date and any recorded
 * material costs must be present before an engineer can verify it for billing.
 */

export interface SodFinancialValidationInput {
    soNum: string;
    contractorId?: string | null;
    completedDate?: Date | null;
    revenueAmount?: unknown;
    contractorAmount?: unknown;
    materialUsage?: Array<{
        quantity?: unknown;
        unitPrice?: unknown;
        costPrice?: unknown;
    }>;
}
export interface SodFinancialValidationResult {
    eligible: boolean;
    reasons: string[];
}

function asFiniteNumber(value: unknown): number | null {
    if (value === null || value === undefined || value === '') return null;
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
}

export function validateSodForInvoicing(input: SodFinancialValidationInput): SodFinancialValidationResult {
    const reasons: string[] = [];
    const revenue = asFiniteNumber(input.revenueAmount);
    const contractorAmount = asFiniteNumber(input.contractorAmount);

    if (!input.contractorId) reasons.push('CONTRACTOR_ASSIGNMENT_MISSING');
    if (!input.completedDate) reasons.push('COMPLETION_DATE_MISSING');
    if (revenue === null || revenue <= 0) reasons.push('REVENUE_SNAPSHOT_MISSING_OR_INVALID');
    if (contractorAmount === null || contractorAmount <= 0) {
        reasons.push('CONTRACTOR_COST_SNAPSHOT_MISSING_OR_INVALID');
    }

    for (const material of input.materialUsage ?? []) {
        const quantity = asFiniteNumber(material.quantity);
        // Inventory valuation uses costPrice first and falls back to unitPrice
        // when costPrice is unset/zero. Keep the invoice gate consistent with
        // that rule; `costPrice ?? unitPrice` incorrectly treats a default 0
        // costPrice as authoritative and rejects a valid positive unitPrice.
        const costPrice = asFiniteNumber(material.costPrice);
        const unitPrice = asFiniteNumber(material.unitPrice);
        const unitCost = costPrice !== null && costPrice > 0 ? costPrice : unitPrice;
        if (quantity === null || quantity <= 0 || unitCost === null || unitCost <= 0) {
            reasons.push('MATERIAL_COST_MISSING_OR_INVALID');
            break;
        }
    }

    return { eligible: reasons.length === 0, reasons };
}
