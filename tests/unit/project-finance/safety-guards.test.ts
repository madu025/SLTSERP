/**
 * Project Finance safety contracts.
 *
 * These tests describe controls required before project-finance endpoints can
 * be treated as safe for operational use. They are deliberately focused on
 * route intent and service boundaries, so they do not need a live database.
 *
 * Run: node --import tsx --test tests/unit/project-finance/safety-guards.test.ts
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { afterEach, describe, it } from 'node:test';

import { prisma } from '../../../src/lib/prisma';
import { ProjectRetentionService } from '../../../src/services/project/project-retention.service';
import { calculateProjectCostSummary } from '../../../src/services/finance/budget-tracking.service';

const source = (path: string) => readFileSync(path, 'utf8');

function methodBody(file: string, methodName: string): string {
    const start = file.indexOf(`static async ${methodName}`);
    assert.notEqual(start, -1, `Could not locate ${methodName}`);
    const nextMethod = file.indexOf('\n    /**', start + methodName.length);
    return file.slice(start, nextMethod === -1 ? undefined : nextMethod);
}

describe('Project Finance route authorization intent', () => {
    const protectedRoutes = [
        'src/app/api/projects/invoices/route.ts',
        'src/app/api/projects/payment-vouchers/route.ts',
        'src/app/api/projects/retentions/route.ts',
        'src/app/api/projects/expenses/route.ts',
        'src/app/api/projects/[id]/expenses/route.ts',
        'src/app/api/projects/[id]/budget/route.ts',
        'src/app/api/projects/ld-penalties/route.ts',
        'src/app/api/projects/[id]/approvals/route.ts',
        'src/app/api/finance/payment-vouchers/[id]/route.ts',
        'src/app/api/finance/retention/route.ts',
    ];

    it('requires an explicit capability or legacy guard on every financial read/write route', () => {
        for (const route of protectedRoutes) {
            assert.match(
                source(route),
                /(?:roles|permissions)\s*:/,
                `${route} must declare its own authorization guard; GET routes otherwise receive no apiHandler RBAC check`,
            );
        }
    });

    it('uses the canonical project-finance capabilities for project financial records', () => {
        for (const route of [
            'src/app/api/projects/invoices/route.ts',
            'src/app/api/projects/payment-vouchers/route.ts',
            'src/app/api/projects/retentions/route.ts',
            'src/app/api/projects/expenses/route.ts',
            'src/app/api/projects/ld-penalties/route.ts',
            'src/app/api/projects/[id]/budget/route.ts',
            'src/app/api/projects/finance-assignments/route.ts',
        ]) {
            assert.match(source(route), /RBAC_PERMISSIONS\.PROJECT_FINANCE_/, `${route} must use project-finance capabilities`);
            assert.match(source(route), /assertProjectAccess/, `${route} must enforce the project OPMC boundary`);
        }
    });

    it('does not allow a client supplied approval actor', () => {
        const route = source('src/app/api/projects/[id]/approvals/route.ts');
        assert.doesNotMatch(
            route,
            /actionedById:\s*z\.string\(\)\.min\(1\)/,
            'approval actioner must come from authenticated request metadata, not the request body',
        );
    });
});

describe('Payment voucher transition and posting guards', () => {
    const paymentVoucherService = source('src/services/finance/payment-voucher.service.ts');
    const ledgerService = source('src/services/finance/ledger.service.ts');

    it('applies the same explicit transition checks to the legacy project voucher path', () => {
        const legacyUpdate = methodBody(paymentVoucherService, 'updateVoucherStatus');
        assert.match(legacyUpdate, /const validStatuses\s*=/);
        assert.match(legacyUpdate, /currentStatus\s*=/);
        assert.match(legacyUpdate, /ONLY_APPROVED_VOUCHERS_CAN_BE_PAID/);
    });

    it('makes invoice issuance postings idempotent', () => {
        const issuance = methodBody(ledgerService, 'logInvoiceIssuance');
        assert.match(issuance, /idempotencyKey:\s*`INVOICE_ISSUANCE_\$\{invoiceId\}`/);
    });

    it('makes payment voucher postings idempotent', () => {
        const payment = methodBody(ledgerService, 'logPaymentVoucherPayment');
        assert.match(payment, /idempotencyKey:\s*`PV_PAYMENT_\$\{pvId\}`/);
    });
});

describe('Retention value validation', () => {
    type PrismaStub = {
        $transaction: (callback: (tx: unknown) => Promise<unknown>) => Promise<unknown>;
        projectRetention: {
            findUnique: (args: unknown) => Promise<unknown>;
        };
    };

    const db = prisma as unknown as PrismaStub;
    const originalTransaction = db.$transaction;
    const originalFindUnique = db.projectRetention.findUnique;

    afterEach(() => {
        db.$transaction = originalTransaction;
        db.projectRetention.findUnique = originalFindUnique;
    });

    it('rejects a negative release before it can create a negative audit record or increase the balance', async () => {
        db.projectRetention.findUnique = async () => ({
            id: 'retention-1',
            releasedAmount: { toNumber: () => 0 },
            retentionAmount: { toNumber: () => 100 },
            balanceAmount: { toNumber: () => 100 },
        });

        db.$transaction = async (callback) => callback({
            retentionRelease: { create: async () => ({ id: 'release-1' }) },
            projectRetention: { update: async () => ({ id: 'retention-1' }) },
        });

        await assert.rejects(
            () => ProjectRetentionService.releaseRetention('retention-1', -1, undefined, 'approver-1'),
            /RELEASE_AMOUNT_MUST_BE_POSITIVE/,
        );
    });
});

describe('Project cost basis integrity', () => {
    it('does not present a partial total as actual cost when material costs are unknown', () => {
        const summary = calculateProjectCostSummary({
            budget: 1_000_000,
            expenseCost: 125_000,
            laborCost: 75_000,
            hasApprovedMaterialIssues: true,
        });

        assert.equal(summary.knownActualCost, 200_000);
        assert.equal(summary.actualCost, null);
        assert.equal(summary.variance, null);
        assert.equal(summary.actualCostStatus, 'MATERIAL_COST_UNKNOWN');
    });

    it('calculates actual cost only when all cost categories have a valid basis', () => {
        const summary = calculateProjectCostSummary({
            budget: 1_000_000,
            expenseCost: 125_000,
            laborCost: 75_000,
            hasApprovedMaterialIssues: false,
        });

        assert.equal(summary.actualCost, 200_000);
        assert.equal(summary.variance, 800_000);
        assert.equal(summary.actualCostStatus, 'COMPLETE');
    });
});
