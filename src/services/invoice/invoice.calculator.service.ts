import { InvoiceCalculationResult } from './invoice-types';

export class InvoiceCalculatorService {
    private static PART_A_PERCENTAGE = 0.90;
    private static PART_B_PERCENTAGE = 0.10;

    /**
     * Calculate 90/10 split for an invoice amount with 2 decimal precision
     */
    static calculateSplit(total: number): InvoiceCalculationResult {
        const amountA = Math.round(total * this.PART_A_PERCENTAGE * 100) / 100;
        const amountB = Math.round((total - amountA) * 100) / 100; // Remaining ensures no floating point loss
        
        return {
            totalAmount: total,
            amountA,
            amountB
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
