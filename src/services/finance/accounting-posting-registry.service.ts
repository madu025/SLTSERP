import { LedgerService } from './ledger.service';
import { TransactionClient } from '../inventory/types';

export interface ContractorInvoicePostingPayload {
    invoiceId: string;
    invoiceNumber: string;
    netAmount: number;
    vatAmount?: number;
    ssclAmount?: number;
    totalAmount: number;
    description?: string;
    createdById?: string;
}

export interface RetentionLdPostingPayload {
    referenceId: string;
    type: 'RETENTION_RELEASE' | 'LD_PENALTY';
    amount: number;
    contractorName?: string;
    description?: string;
    createdById?: string;
}

export interface VehicleExpensePostingPayload {
    vehicleId: string;
    vehicleRegNo: string;
    amount: number;
    expenseType: string; // FUEL | MAINTENANCE | REPAIR
    paymentSource?: 'BANK' | 'PETTY_CASH';
    description?: string;
    createdById?: string;
}

export class AccountingPostingRegistry {
    /**
     * Post Contractor/Project Invoice (90/10 Split & Tax Breakdown) via Central Gateway.
     * DR: Client AR (AR-1110) - total amount
     * CR: Project Revenue (REV-4010) - net amount
     * CR: Output VAT Payable (VAT-PAY-2110) - vat amount
     * CR: SSCL Payable (SSCL-PAY-2115) - sscl amount
     */
    static async postContractorInvoice(tx: TransactionClient, payload: ContractorInvoicePostingPayload) {
        const vat = payload.vatAmount || 0;
        const sscl = payload.ssclAmount || 0;
        const lines = [
            {
                accountCode: 'AR-1110',
                debit: payload.totalAmount,
                credit: 0,
                description: `Receivable for Contractor Invoice ${payload.invoiceNumber}`
            },
            {
                accountCode: 'REV-4010',
                debit: 0,
                credit: payload.netAmount,
                description: `Net Project Revenue for Invoice ${payload.invoiceNumber}`
            }
        ];

        if (vat > 0) {
            lines.push({
                accountCode: 'VAT-PAY-2110',
                debit: 0,
                credit: vat,
                description: `Output VAT for Invoice ${payload.invoiceNumber}`
            });
        }

        if (sscl > 0) {
            lines.push({
                accountCode: 'SSCL-PAY-2115',
                debit: 0,
                credit: sscl,
                description: `SSCL Payable for Invoice ${payload.invoiceNumber}`
            });
        }

        return await LedgerService.postTransaction(tx, {
            referenceId: payload.invoiceId,
            referenceType: 'CONTRACTOR_INVOICE',
            description: payload.description || `Contractor Invoice ${payload.invoiceNumber} Posting`,
            createdById: payload.createdById,
            lines
        });
    }

    /**
     * Post Retention Release or LD Penalty via Central Gateway.
     */
    static async postRetentionAndLd(tx: TransactionClient, payload: RetentionLdPostingPayload) {
        if (payload.type === 'RETENTION_RELEASE') {
            // DR: Retention Payable (RET-PAY-2120) / CR: Bank Account (BANK-1000)
            return await LedgerService.postTransaction(tx, {
                referenceId: payload.referenceId,
                referenceType: 'RETENTION_RELEASE',
                description: payload.description || `Retention Payout to ${payload.contractorName || 'Contractor'}`,
                createdById: payload.createdById,
                lines: [
                    {
                        accountCode: 'RET-PAY-2120',
                        debit: payload.amount,
                        credit: 0,
                        description: 'Retention liability release'
                    },
                    {
                        accountCode: 'BANK-1000',
                        debit: 0,
                        credit: payload.amount,
                        description: 'Bank disbursement for retention payout'
                    }
                ]
            });
        } else {
            // LD Penalty: DR Accounts Payable (AP-2010) / CR Liquidated Damages Income (REV-LD-4090)
            return await LedgerService.postTransaction(tx, {
                referenceId: payload.referenceId,
                referenceType: 'LD_PENALTY',
                description: payload.description || `Liquidated Damages Penalty deduction for ${payload.contractorName || 'Contractor'}`,
                createdById: payload.createdById,
                lines: [
                    {
                        accountCode: 'AP-2010',
                        debit: payload.amount,
                        credit: 0,
                        description: 'AP reduction for LD penalty'
                    },
                    {
                        accountCode: 'REV-LD-4090',
                        debit: 0,
                        credit: payload.amount,
                        description: 'Liquidated damages penalty income'
                    }
                ]
            });
        }
    }

    /**
     * Post Vehicle Expenses (Fuel, Maintenance, Repairs) via Central Gateway.
     * DR: Vehicle Running Expense (EXP-VEH-6030)
     * CR: Bank (BANK-1000) or Petty Cash (PETTY-1020)
     */
    static async postVehicleExpense(tx: TransactionClient, payload: VehicleExpensePostingPayload) {
        const creditAccount = payload.paymentSource === 'PETTY_CASH' ? 'PETTY-1020' : 'BANK-1000';

        return await LedgerService.postTransaction(tx, {
            referenceId: payload.vehicleId,
            referenceType: 'VEHICLE_EXPENSE',
            description: payload.description || `Vehicle ${payload.expenseType} Expense for ${payload.vehicleRegNo}`,
            createdById: payload.createdById,
            lines: [
                {
                    accountCode: 'EXP-VEH-6030',
                    debit: payload.amount,
                    credit: 0,
                    description: `Vehicle ${payload.expenseType} cost for ${payload.vehicleRegNo}`
                },
                {
                    accountCode: creditAccount,
                    debit: 0,
                    credit: payload.amount,
                    description: `Payment for vehicle ${payload.expenseType}`
                }
            ]
        });
    }
}
