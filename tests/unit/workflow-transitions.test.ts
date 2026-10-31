import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { getStageTransitionError } from '../../src/services/core/workflow-transitions';

describe('workflow stage transitions', () => {
  it('allows the current stage to block, hold and resume', () => {
    assert.equal(getStageTransitionError('IN_PROGRESS', 'BLOCKED', true), null);
    assert.equal(getStageTransitionError('IN_PROGRESS', 'ON_HOLD', true), null);
    assert.equal(getStageTransitionError('BLOCKED', 'IN_PROGRESS', true), null);
    assert.equal(getStageTransitionError('ON_HOLD', 'IN_PROGRESS', true), null);
    assert.equal(getStageTransitionError('IN_PROGRESS', 'COMPLETED', true), null);
  });

  it('allows rework resume for the current stage', () => {
    assert.equal(getStageTransitionError('CHANGES_REQUESTED', 'IN_PROGRESS', true), null);
  });

  it('rejects any transition out of COMPLETED', () => {
    assert.ok(getStageTransitionError('COMPLETED', 'IN_PROGRESS', true));
    assert.ok(getStageTransitionError('COMPLETED', 'BLOCKED', false));
  });

  it('rejects activating a non-current or pending stage', () => {
    assert.ok(getStageTransitionError('PENDING', 'IN_PROGRESS', false));
    assert.ok(getStageTransitionError('PENDING', 'IN_PROGRESS', true));
    assert.ok(getStageTransitionError('BLOCKED', 'IN_PROGRESS', false));
  });

  it('rejects completing a blocked stage and no-op transitions', () => {
    assert.ok(getStageTransitionError('BLOCKED', 'COMPLETED', true));
    assert.ok(getStageTransitionError('IN_PROGRESS', 'IN_PROGRESS', true));
  });
});
