import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { describeStep, gateSentence, itemName, stepHealth } from '../../src/lib/gate-plain-language';

test('a step is described as people, not codes', () => {
    const role = describeStep({ requiredRole: 'QC_OFFICER' }, { queueMode: true, entityType: 'INVOICE' });
    assert.equal(role.title, 'QC Officer');
    assert.equal(role.who, "Anyone with the QC Officer role in the invoice's own area");
    assert.equal(role.rule, null);
    assert.equal(describeStep({ requiredRole: 'STORES_MANAGER' }, { queueMode: false, entityType: 'MATERIAL_REQUEST' }).who, 'Anyone with the Stores Manager role');
    assert.equal(describeStep({ requiredRole: 'CONTRACTOR', assignee: 'ORDER_CONTRACTOR' }, { queueMode: true, entityType: 'INVOICE' }).who, 'The contractor of the invoice');
    assert.equal(describeStep({ requiredRole: 'ADMIN', specificUserId: 'u1' }, { queueMode: false, entityType: 'INVOICE' }).who, 'One named person');
    assert.match(describeStep({ requiredRole: 'ENGINEER', skipIfNoApprover: true }, { queueMode: true, entityType: 'INVOICE' }).rule ?? '', /Skipped when nobody/);
});

test('the gate is one sentence an administrator can read', () => {
    assert.equal(itemName('SERVICE_ORDER'), 'service order');
    assert.equal(itemName('SOMETHING_NEW'), 'item');
    assert.equal(gateSentence('INVOICE', 'Invoice Generated', 'Area approvals complete'), 'An invoice moves from "Invoice Generated" to "Area approvals complete" once these steps have approved it, in this order.');
    assert.match(gateSentence('MATERIAL_REQUEST', 'Draft', 'Approved'), /^A request moves/);
});

test('a step nobody can act on is flagged, a skipped one is not an alarm', () => {
    assert.equal(stepHealth({ holders: 3, areasWithout: 0, skipIfNoApprover: false }).level, 'ok');
    assert.equal(stepHealth({ holders: 0, areasWithout: null, skipIfNoApprover: false }).level, 'warn');
    assert.equal(stepHealth({ holders: 0, areasWithout: null, skipIfNoApprover: true }).level, 'info');
    const gap = stepHealth({ holders: 2, areasWithout: 3, skipIfNoApprover: false });
    assert.equal(gap.level, 'warn'); assert.match(gap.text, /3 areas have nobody/);
    assert.equal(stepHealth({ holders: 2, areasWithout: 3, skipIfNoApprover: true }).level, 'ok', 'a step that is skipped where nobody holds it is fine');
    assert.equal(stepHealth({ holders: null, areasWithout: null, skipIfNoApprover: false }).level, 'info');
});

const read = (p: string) => fs.readFileSync(path.resolve(__dirname, '../..', p), 'utf8');

test('wiring: the gate screen shows the steps in plain words with live figures, and the wizard summarises before saving', () => {
    const pipe = read('src/app/admin/settings/process-gates/VisualWorkflowPipeline.tsx');
    assert.ok(pipe.includes('<GateSteps gate={gate} stats={stats[gate.id]} />') && pipe.includes('/api/admin/process-gates/stats'));
    assert.ok(!pipe.includes('L{lvl.level}: {lvl.requiredRole}'), 'the code chips are gone');
    const wiz = read('src/app/admin/settings/process-gates/StepByStepGateWizard.tsx');
    assert.ok(wiz.includes('What will happen after you save') && wiz.includes('<GateSteps'));
    const stats = read('src/services/admin/process-gate-stats.service.ts');
    assert.ok(stats.includes("status: 'PENDING'") && stats.includes('areasWithout'));
});

after(() => { setTimeout(() => process.exit(process.exitCode ?? 0), 100).unref?.(); });
