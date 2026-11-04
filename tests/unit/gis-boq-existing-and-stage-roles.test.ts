import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BOQEngine, splitNewExisting } from '../../src/lib/gis/boq-engine';
import { defaultStageRole } from '../../src/lib/gis/workflow-definitions';

const pole = (exist: string) => ({ properties: { Exist_New: exist } });

test('splitNewExisting reads Exist_New / Exst_New and ignores features without the attribute', () => {
  assert.deepEqual(splitNewExisting([pole('Existing'), pole('Existing'), pole('New')]), { newCount: 1, existing: 2 });
  assert.deepEqual(splitNewExisting([{ properties: { Exst_New: 'Existing' } }, { properties: { Exst_New: 'New' } }]), { newCount: 1, existing: 1 });
  // No attribute: treated as new, which is the safe (never under-quoting) default.
  assert.deepEqual(splitNewExisting([{ properties: {} }, {}]), { newCount: 2, existing: 0 });
  assert.deepEqual(splitNewExisting(undefined), { newCount: 0, existing: 0 });
});

test('BOQ prices only new poles, joints and handholes (the Sammanthurai sample: 37 existing + 2 new poles)', () => {
  const poles = [...Array.from({ length: 37 }, () => pole('Existing')), pole('New'), pole('New')];
  const layers = new Map<string, unknown>([
    ['POLE', { layerName: 'poles', featureCount: poles.length, poles }],
    ['FIBER_JOINT', { layerName: 'fj', featureCount: 2, joints: [{ properties: { Exst_New: 'New' } }, { properties: { Exst_New: 'Existing' } }] }],
    ['HANDHOLE', { layerName: 'hh', featureCount: 1, assetType: 'HANDHOLE', assets: [{ properties: { Exist_New: 'Existing' } }] }],
  ]);
  const boq = new BOQEngine().generateBOQ(layers as never);
  const poleLine = boq.items.find((i) => i.category === 'POLE');
  assert.equal(poleLine?.quantity, 2);
  assert.match(poleLine?.description ?? '', /37 existing poles reused, not priced/);
  assert.equal(boq.items.find((i) => i.category === 'FIBER_JOINT')?.quantity, 1);
  // The only handhole is existing, so no line is quoted for it at all.
  assert.equal(boq.items.some((i) => i.category === 'HANDHOLE'), false);
});

test('every standard OSP stage name gets an owner role, so a stage start always has someone to notify', () => {
  const expected: Record<string, string> = {
    Survey: 'OSP_ENGINEER', Permit: 'AREA_MANAGER', Material: 'STORES_MANAGER', Installation: 'CONTRACTOR_SUPERVISOR',
    OTDR: 'QC_OFFICER', QA: 'QC_OFFICER', Closure: 'OSP_MANAGER', 'Feasibility Study': 'ENGINEER',
    'Survey & Route Planning': 'OSP_ENGINEER', 'Detailed Engineering': 'ENGINEER', 'Civil Works': 'CONTRACTOR_SUPERVISOR',
    'Cabling & Splicing': 'CONTRACTOR_SUPERVISOR', 'OTDR Testing': 'QC_OFFICER', 'QA/QC & Commissioning': 'QC_OFFICER',
    'Handover & Asset Registration': 'OSP_MANAGER', Access: 'AREA_MANAGER', Materials: 'STORES_MANAGER', Testing: 'QC_OFFICER',
  };
  for (const [name, role] of Object.entries(expected)) assert.equal(defaultStageRole(name), role, name);
  assert.equal(defaultStageRole('Something unrelated'), null);
});

test('OTDR gate: needs at least one trace, every trace passing/approved/waived, rejected uploads ignored', async () => {
  const { evaluateOtdrEvidence } = await import('../../src/lib/otdr-gate');
  assert.equal(evaluateOtdrEvidence([]).ok, false);
  assert.equal(evaluateOtdrEvidence([{ autoResult: 'PASS', status: 'PENDING_REVIEW' }]).ok, true);
  assert.equal(evaluateOtdrEvidence([{ autoResult: 'FAIL', status: 'PENDING_REVIEW' }]).ok, false);
  assert.equal(evaluateOtdrEvidence([{ autoResult: 'FAIL', status: 'WAIVED' }]).ok, true);
  assert.equal(evaluateOtdrEvidence([{ autoResult: null, status: 'APPROVED' }]).ok, true);
  assert.equal(evaluateOtdrEvidence([{ autoResult: null, status: 'PENDING_REVIEW' }]).ok, false);
  // A rejected bad file does not block once a good re-test exists, but alone it is "no evidence".
  assert.equal(evaluateOtdrEvidence([{ autoResult: 'FAIL', status: 'REJECTED' }, { autoResult: 'PASS', status: 'APPROVED' }]).ok, true);
  assert.equal(evaluateOtdrEvidence([{ autoResult: 'FAIL', status: 'REJECTED' }]).ok, false);
});

test('OTDR gate: a passing re-test of the same fibre supersedes the failed first attempt', async () => {
  const { evaluateOtdrEvidence } = await import('../../src/lib/otdr-gate');
  const fail = { autoResult: 'FAIL', status: 'PENDING_REVIEW', cableSegmentId: 's1', fiberNumber: 1, wavelength: 1550, testDate: '2026-11-01T10:00:00Z' };
  const pass = { autoResult: 'PASS', status: 'PENDING_REVIEW', cableSegmentId: 's1', fiberNumber: 1, wavelength: 1550, testDate: '2026-11-02T10:00:00Z' };
  assert.equal(evaluateOtdrEvidence([fail, pass]).ok, true);
  // The failure is the latest attempt: blocked. A different fibre is judged separately.
  assert.equal(evaluateOtdrEvidence([pass, { ...fail, testDate: '2026-11-03T10:00:00Z' }]).ok, false);
  assert.equal(evaluateOtdrEvidence([pass, { ...fail, fiberNumber: 2 }]).ok, false);
});

test('project status follows the stage the project is in, and never overwrites closed or held projects', async () => {
  const { statusForStage, STATUS_NOT_STAGE_DRIVEN } = await import('../../src/lib/project-stage-status');
  assert.equal(statusForStage('SURVEY_PLAN'), 'SURVEY_IN_PROGRESS');
  assert.equal(statusForStage('BOQ_APPROVAL'), 'BOQ_PENDING');
  assert.equal(statusForStage('IMPLEMENTATION'), 'IN_PROGRESS');
  assert.equal(statusForStage('SLT_PAT'), 'PRE_PAT_PASSED');
  assert.equal(statusForStage('AS_BUILT'), 'SLT_PAT_PASSED');
  assert.equal(statusForStage(null, 'OTDR Testing'), 'IN_PROGRESS');
  assert.equal(statusForStage(null, 'Permit Management'), 'BOQ_APPROVED');
  assert.equal(statusForStage(null, 'Something else'), null);
  for (const held of ['COMPLETED', 'CANCELLED', 'ON_HOLD', 'DELAYED']) assert.ok((STATUS_NOT_STAGE_DRIVEN as readonly string[]).includes(held));
});
