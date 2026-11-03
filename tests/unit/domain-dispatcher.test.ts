import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const dispatcher = readFileSync('src/services/approval/domain-dispatcher.service.ts', 'utf8');
const gateEngine = readFileSync('src/services/approval/process-gate-engine.ts', 'utf8');
const invoiceGenerator = readFileSync('src/services/invoice/invoice.generator.service.ts', 'utf8');

test('domain actions have real handlers and no silent stub fallback', () => {
    assert.doesNotMatch(dispatcher, /Stub:|TODO:\s*Implement|Unhandled domain action/);
    assert.match(dispatcher, /throw AppError\.badRequest\(`UNSUPPORTED_DOMAIN_ACTION:/);
    assert.match(dispatcher, /handleSodLedger\(payload, tx\)/);
    assert.match(dispatcher, /SODMaterialService\.rollbackMaterialUsage\(tx/);
    assert.match(dispatcher, /InvoiceGeneratorService\.generateContractorMonthlyInvoice\([\s\S]*?, tx\)/);
});

test('domain-action idempotency is successful only after the handler completes', () => {
    const processing = dispatcher.indexOf("status: 'PROCESSING'");
    const success = dispatcher.indexOf("data: { status: 'SUCCESS' }");
    const dispatchSwitch = dispatcher.indexOf('switch (actionId)');

    assert.notEqual(processing, -1);
    assert.notEqual(success, -1);
    assert.ok(processing < dispatchSwitch, 'the action must be marked processing before handler execution');
    assert.ok(success > dispatchSwitch, 'the action must be marked successful after handler execution');
});

test('final approval executes the domain action in the approval transaction', () => {
    assert.match(gateEngine, /DomainActionDispatcher\.dispatch\([\s\S]*?\}, tx\)/);
    assert.doesNotMatch(gateEngine, /fetch\(webhookUrl/);
});

test('invoice generation accepts the approval transaction client', () => {
    assert.match(invoiceGenerator, /transaction\?: TransactionClient/);
    assert.match(invoiceGenerator, /const db: InvoiceDbClient = transaction \|\| prisma/);
    assert.match(invoiceGenerator, /return transaction \? create\(transaction\) : prisma\.\$transaction\(create\)/);
});

test('process gates use canonical capabilities and DB role assignments', () => {
    assert.doesNotMatch(gateEngine, /user\?\.role|user\.role\s*[!=]=/);
    assert.match(gateEngine, /deriveEffectivePermissions\(user\)/);
    assert.match(gateEngine, /RBAC_PERMISSIONS\.INVENTORY_APPROVE/);
});
