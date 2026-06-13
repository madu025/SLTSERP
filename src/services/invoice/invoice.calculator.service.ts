import { InvoiceCalculationResult } from './invoice-types';

export class InvoiceCalculatorService {
    private static PART_A_PERCENTAGE = 0.90;
    private static PART_B_PERCENTAGE = 0.10;

    /**
     * Calculate 90/10 split for an invoice amount with 2 decimal precision, applying penalty deductions
     */
    static calculateSplit(total: number, penaltyTotal: number = 0): InvoiceCalculationResult {
        const baseAmountA = Math.round(total * this.PART_A_PERCENTAGE * 100) / 100;
        const baseAmountB = Math.round((total - baseAmountA) * 100) / 100;
        
        let amountB = Math.round((baseAmountB - penaltyTotal) * 100) / 100;
        let amountA = baseAmountA;

        if (amountB < 0) {
            amountA = Math.round((amountA + amountB) * 100) / 100; // amountB is negative, so this subtracts
            amountB = 0;
        }

        if (amountA < 0) {
            amountA = 0;
        }

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
