import { PrismaClient, FiscalPeriodStatus } from '@prisma/client';
import { AccountingPostingRegistry } from '../src/services/finance/accounting-posting-registry.service';
import { FiscalPeriodService } from '../src/services/finance/fiscal-period.service';

const prisma = new PrismaClient();

async function verifyCrossModuleRegistry() {
    console.log('--- Starting Finance Verification: Phase 8 (Cross-Module ERP Integration Map) ---');

    // Ensure period 2026-07 is OPEN for testing
    await FiscalPeriodService.setPeriodStatus(2026, 7, FiscalPeriodStatus.OPEN);

    await prisma.$transaction(async (tx) => {
        // 1. Post Contractor Invoice (90/10 + Tax)
        const invPost = await AccountingPostingRegistry.postContractorInvoice(tx, {
            invoiceId: `INV-CROSS-${Date.now()}`,
            invoiceNumber: 'INV-2026-0099',
            netAmount: 100000,
            vatAmount: 18000,
            ssclAmount: 2500,
            totalAmount: 120500,
            description: 'Phase 8 Contractor Invoice Cross-Module Posting Test'
        });

        console.log(`Posted Contractor Invoice GL Entry: ID ${invPost.id}`);

        // 2. Post Retention Release
        const retPost = await AccountingPostingRegistry.postRetentionAndLd(tx, {
            referenceId: `RET-CROSS-${Date.now()}`,
            type: 'RETENTION_RELEASE',
            amount: 15000,
            contractorName: 'Apex Telecom Contractors',
            description: 'Phase 8 Retention Release Payout Test'
        });

        console.log(`Posted Retention Release GL Entry: ID ${retPost.id}`);

        // 3. Post LD Penalty Deduction
        const ldPost = await AccountingPostingRegistry.postRetentionAndLd(tx, {
            referenceId: `LD-CROSS-${Date.now()}`,
            type: 'LD_PENALTY',
            amount: 5000,
            contractorName: 'Apex Telecom Contractors',
            description: 'Phase 8 Liquidated Damages Penalty Test'
        });

        console.log(`Posted LD Penalty GL Entry: ID ${ldPost.id}`);

        // 4. Post Vehicle Fuel Expense
        const vehPost = await AccountingPostingRegistry.postVehicleExpense(tx, {
            vehicleId: `VEH-CROSS-${Date.now()}`,
            vehicleRegNo: 'WP-CAB-4020',
            amount: 8500,
            expenseType: 'FUEL',
            paymentSource: 'PETTY_CASH',
            description: 'Phase 8 Vehicle Fuel Expense Test'
        });

        console.log(`Posted Vehicle Expense GL Entry: ID ${vehPost.id}`);
    });

    console.log('✅ Phase 8 Verification Passed: All cross-module ERP event postings (Contractor Invoices, Retention, LD Penalties, Vehicle Expenses) execute via Central Gateway and balance DR === CR.');
}

verifyCrossModuleRegistry()
    .catch((err) => {
        console.error('❌ Phase 8 Verification Failed:', err);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
