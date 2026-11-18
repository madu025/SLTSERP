import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { defaultGateDomainAction } from '../../src/services/approval/gate-default-action';

test('an approved service order gate applies its own target status when its policy has no action', () => {
    assert.equal(defaultGateDomainAction('SERVICE_ORDER', 'COMPLETED'), 'HANDLE_SOD_COMPLETED');
    assert.equal(defaultGateDomainAction('SERVICE_ORDER', 'INPROGRESS'), 'HANDLE_SOD_ASSIGNED');
});

test('other gates and unknown targets get no default action', () => {
    assert.equal(defaultGateDomainAction('MATERIAL_REQUEST', 'COMPLETED'), undefined);
    assert.equal(defaultGateDomainAction('SERVICE_ORDER', 'ASSIGNED'), undefined);
    assert.equal(defaultGateDomainAction('SERVICE_ORDER', undefined), undefined);
});

after(() => { setTimeout(() => process.exit(process.exitCode ?? 0), 100).unref?.(); });
