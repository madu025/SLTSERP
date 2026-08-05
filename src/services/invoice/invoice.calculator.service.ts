import { InvoiceCalculationResult } from '@/types/finance/invoice-service.types';

export interface StatutoryInvoiceBreakdown {
    subtotal: number;
    vatPercent: number;
    vatAmount: number;
    ssclPercent: number;
    ssclAmount: number;
    retentionPercent: number;
    retentionAmount: number;
    whtPercent: number;
    whtAmount: number;
    penaltyTotal: number;
    grossWithTaxes: number;
    netPayableAmount: number;
    requiredApprovalRole: 'AREA_MANAGER' | 'OSP_MANAGER' | 'HEAD_OF_OSP' | 'CEO' | 'GENERAL_MANAGER' | 'DIRECTOR';
}

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
     * Calculate 100% Statutorily Auditable Sri Lanka Enterprise Billing Invoice Breakdown
     */
    static calculateStatutoryInvoiceBreakdown(
        subtotal: number,
        penaltyTotal: number = 0,
        config: {
            vatPercent: number;
            ssclPercent: number;
            whtPercent: number;
            retentionPercent: number;
            approvalLimitManager: number;
            approvalLimitGM: number;
        }
    ): StatutoryInvoiceBreakdown {
        const round2 = (val: number) => Math.round(val * 100) / 100;

        const vatAmount = round2(subtotal * (config.vatPercent / 100));
        const ssclAmount = round2(subtotal * (config.ssclPercent / 100));
        const retentionAmount = round2(subtotal * (config.retentionPercent / 100));
        const whtAmount = round2(subtotal * (config.whtPercent / 100));

        const grossWithTaxes = round2(subtotal + vatAmount + ssclAmount);
        const netPayableAmount = round2(grossWithTaxes - retentionAmount - whtAmount - penaltyTotal);

        let requiredApprovalRole: 'AREA_MANAGER' | 'OSP_MANAGER' | 'HEAD_OF_OSP' | 'CEO' = 'AREA_MANAGER';
        if (netPayableAmount > (config as unknown as { approvalLimitDirector?: number }).approvalLimitDirector! || netPayableAmount > 5000000) {
            requiredApprovalRole = 'CEO';
        } else if (netPayableAmount > config.approvalLimitGM || netPayableAmount > 1000000) {
            requiredApprovalRole = 'HEAD_OF_OSP';
        } else if (netPayableAmount > config.approvalLimitManager || netPayableAmount > 100000) {
            requiredApprovalRole = 'OSP_MANAGER';
        }

        return {
            subtotal,
            vatPercent: config.vatPercent,
            vatAmount,
            ssclPercent: config.ssclPercent,
            ssclAmount,
            retentionPercent: config.retentionPercent,
            retentionAmount,
            whtPercent: config.whtPercent,
            whtAmount,
            penaltyTotal,
            grossWithTaxes,
            netPayableAmount,
            requiredApprovalRole
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
