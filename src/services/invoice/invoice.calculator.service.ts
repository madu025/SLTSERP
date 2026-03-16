import { InvoiceCalculationResult } from './invoice-types';

export class InvoiceCalculatorService {
    private static PART_A_PERCENTAGE = 0.90;
    private static PART_B_PERCENTAGE = 0.10;

    /**
     * Calculate 90/10 split for an invoice amount
     */
    static calculateSplit(total: number): InvoiceCalculationResult {
        return {
            totalAmount: total,
            amountA: total * this.PART_A_PERCENTAGE,
            amountB: total * this.PART_B_PERCENTAGE
        };
    }

    /**
     * Construct a prefix from contractor name
     */
    static getContractorPrefix(name: string): string {
        const nameParts = name.trim().split(/\s+/);
        if (nameParts.length >= 2) {
            return (nameParts[0][0] + nameParts[1][0]).toUpperCase();
        }
        return name.substring(0, 3).toUpperCase();
    }
}
