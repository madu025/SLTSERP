import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getIncompleteClosureStages } from '../../src/services/project/project-closure';

test('a new workflow cannot close before delivery stages complete', () => {
    assert.deepEqual(getIncompleteClosureStages([
        { code: 'DESIGN', name: 'Design', sequence: 1, status: 'IN_PROGRESS' },
        { code: 'PROJECT_CLOSURE', name: 'Closure', sequence: 2, status: 'PENDING' },
    ]), ['Design']);
    assert.deepEqual(getIncompleteClosureStages([]), ['Workflow has no stages']);
});

test('the closure stage itself may remain active after all earlier stages complete', () => {
    assert.deepEqual(getIncompleteClosureStages([
        { code: 'DESIGN', name: 'Design', sequence: 1, status: 'COMPLETED' },
        { code: 'PROJECT_CLOSURE', name: 'Closure', sequence: 2, status: 'IN_PROGRESS' },
    ]), []);
});

test('a misordered stage after closure still blocks completion', () => {
    assert.deepEqual(getIncompleteClosureStages([
        { code: 'PROJECT_CLOSURE', name: 'Closure', sequence: 2, status: 'IN_PROGRESS' },
        { code: 'SLT_PAT', name: 'SLT PAT', sequence: 3, status: 'PENDING' },
    ]), ['SLT PAT']);
});
