import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { GENERIC_WORKFLOW_STAGES } from '../../src/config/project-type-catalog';

// seed-workflows.ts rebuilds every typed workflow from this catalog on each release, so a stage that only
// exists in a migration is silently deleted on the next deploy. These tests pin what the release must keep.
describe('project type workflow catalog', () => {
    const codes = GENERIC_WORKFLOW_STAGES.map((stage) => stage.code);

    it('has unique stage codes', () => {
        assert.equal(new Set(codes).size, codes.length);
    });

    it('defines the Invoice Submission stage with a finance task, right before closeout', () => {
        const index = codes.indexOf('INVOICE_SUBMISSION');
        assert.ok(index >= 0, 'INVOICE_SUBMISSION must be defined in the catalog');
        assert.equal(codes[index + 1], 'CLOSEOUT', 'invoice submission must come immediately before closeout');
        const stage = GENERIC_WORKFLOW_STAGES[index];
        assert.equal(stage.workstream, 'FINANCE');
        assert.ok(stage.tasks.length > 0, 'the stage needs at least one task');
    });
});
