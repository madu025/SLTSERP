import { Prisma } from '@prisma/client';
import { LedgerService } from './ledger.service';

export class OSPLedgerService {
  /**
   * Automatically resolves GL Mappings and posts a Subledger event to the Unified Ledger.
   */
  static async postAutomatedTransaction(
    tx: any,
    args: {
      sourceModule: string;
      transactionType: string;
      referenceId: string;
      description: string;
      amount: number;
      transactionDate: Date;
    }
  ) {
    // 1. Look up mapping
    const mapping = await tx.gLMappingConfig.findUnique({
      where: {
        sourceModule_transactionType: {
          sourceModule: args.sourceModule,
          transactionType: args.transactionType,
        }
      }
    });

    if (!mapping || !mapping.isActive) {
      console.warn(`[GL] No active mapping found for ${args.sourceModule}:${args.transactionType}`);
      return null;
    }

    // 2. Post to Unified Ledger via LedgerService
    return await LedgerService.postTransaction(tx, {
      referenceId: args.referenceId,
      referenceType: args.sourceModule,
      description: args.description,
      date: args.transactionDate,
      lines: [
        {
          accountCode: mapping.debitAccountCode,
          debit: args.amount,
          credit: 0,
          description: `DR: ${args.description}`
        },
        {
          accountCode: mapping.creditAccountCode,
          debit: 0,
          credit: args.amount,
          description: `CR: ${args.description}`
        }
      ]
    });
  }
}
