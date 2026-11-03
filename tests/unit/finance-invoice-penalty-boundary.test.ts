import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const service = readFileSync('src/services/invoice/invoice.service.ts', 'utf8');
const route = readFileSync('src/app/api/invoices/[id]/penalties/route.ts', 'utf8');

function methodBody(source: string, methodName: string) {
    const start = source.indexOf(`static async ${methodName}`);
    assert.notEqual(start, -1, `Could not locate ${methodName}`);
    const nextMethod = source.indexOf('\n    /**', start + methodName.length);
    return source.slice(start, nextMethod === -1 ? undefined : nextMethod);
}

test('invoice penalty status updates require the authenticated actor and canonical scoped capability', () => {
    const updateMethod = methodBody(service, 'updatePenaltyStatus');
    const guard = methodBody(service, 'assertPenaltyUpdateAccess');

    assert.match(updateMethod, /actorUserId: string/);
    assert.match(updateMethod, /await this\.assertPenaltyUpdateAccess\(invoiceId, actorUserId\)/);
    assert.ok(updateMethod.indexOf('assertPenaltyUpdateAccess') < updateMethod.indexOf('$transaction'));

    assert.match(guard, /getUserEffectivePermissions\(actorUserId\)/);
    assert.match(guard, /RBAC_PERMISSIONS\.SOD_INVOICE/);
    assert.match(guard, /assertProjectAccess\(invoice\.projectId, actorUserId\)/);
    assert.match(guard, /resolveOpmcScope\(actorUserId\)/);
    assert.match(guard, /Authentication required/);
});

test('invoice penalty route binds the service mutation to the authenticated request identity', () => {
    assert.match(route, /const actorUserId = getAuthenticatedUserId\(\)/);
    assert.match(route, /if \(!actorUserId\)/);
    assert.match(route, /InvoiceService\.updatePenaltyStatus\(id, data\.penaltyId, data\.status, actorUserId\)/);
    assert.match(route, /permissions: \[RBAC_PERMISSIONS\.SOD_INVOICE\]/);
    assert.doesNotMatch(route, /InvoiceService\.updatePenaltyStatus\(id, data\.penaltyId, data\.status\)\)/);
});
