import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { summariseGateChange } from '../../src/lib/gate-history';
import { stepHealth } from '../../src/lib/gate-plain-language';

const read = (p: string) => fs.readFileSync(path.resolve(__dirname, '../..', p), 'utf8');

test('a change to the steps is told in words, with what it was before', () => {
    const before = [{ id: 'a', requiredRole: 'AREA_COORDINATOR' }, { id: 'b', requiredRole: 'QC_OFFICER' }];
    assert.equal(
        summariseGateChange('REORDER_LEVELS', 'PROCESS_GATE_LEVEL', before, { orderedLevelIds: ['b', 'a'] }),
        'Steps reordered: QC Officer → Area Coordinator (was Area Coordinator → QC Officer)',
    );
    assert.equal(
        summariseGateChange('REPLACE_LEVELS', 'PROCESS_GATE_LEVEL', before, { levels: [{ requiredRole: 'AREA_MANAGER' }] }),
        'Steps changed: Area Manager (ARM) (was Area Coordinator → QC Officer)',
    );
    assert.match(summariseGateChange('UPDATE', 'PROCESS_GATE', null, { queueMode: true, isEnabled: false }), /shared queue, on\/off/);
    assert.equal(summariseGateChange('DELETE', 'PROCESS_GATE', null, null), 'The gate was deleted');
});

test('the warning names the areas that have nobody', () => {
    const h = stepHealth({ holders: 4, areasWithout: 2, skipIfNoApprover: false, missingAreas: ['Kalutara', 'Galle'] });
    assert.equal(h.level, 'warn');
    assert.match(h.text, /\(Kalutara, Galle\)/);
    assert.match(stepHealth({ holders: 4, areasWithout: 15, skipIfNoApprover: false, missingAreas: ['A', 'B'] }).text, /\(A, B, …\)/);
});

test('wiring: test button, history, advanced settings and the invoice warning are connected', () => {
    const pipe = read('src/app/admin/settings/process-gates/VisualWorkflowPipeline.tsx');
    assert.ok(pipe.includes('<GateTestPanel') && pipe.includes('<GateHistoryPanel'));
    assert.ok(read('src/app/admin/settings/process-gates/GateTestPanel.tsx').includes('/simulate'));
    assert.ok(read('src/app/api/admin/process-gates/[id]/simulate/route.ts').includes('ProcessGateStatsService.simulate'));
    assert.ok(read('src/app/api/admin/process-gates/[id]/history/route.ts').includes('ProcessGateAdminService.history'));
    const levels = read('src/app/api/admin/process-gates/[id]/levels/route.ts');
    assert.ok(levels.includes("entityIdParam: 'id'") && levels.includes('stepSnapshot'), 'step changes are recorded against the gate');
    const wiz = read('src/app/admin/settings/process-gates/StepByStepGateWizard.tsx');
    assert.ok(wiz.includes('Advanced settings') && wiz.includes('ROLE_CAPABILITY'));
    assert.ok(read('src/app/api/invoices/generate/route.ts').includes('approvalGap'));
    assert.ok(read('src/services/admin/process-gate-stats.service.ts').includes("outcome: 'NOBODY'") || read('src/services/admin/process-gate-stats.service.ts').includes("'NOBODY'"));
});

after(() => { setTimeout(() => process.exit(process.exitCode ?? 0), 100).unref?.(); });
