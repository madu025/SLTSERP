import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getTabsForStage, getAllProjectTabs, filterProjectTabsByPermissions } from '../../src/config/stage-tab-mapping';
import { resolveCurrentProjectStage } from '../../src/lib/project-navigation';

test('requirements and design stages expose actionable modules', () => {
    for (const stage of ['Requirements Evaluation', 'Design Plan', 'Design Review & Approval']) {
        const tabs = getTabsForStage(stage, 'CAD', 'BUILDING_FIBER').map(tab => tab.value);
        assert.ok(tabs.includes('documents'));
        assert.ok(tabs.includes('approvals'));
    }
});

test('CAD projects retain survey but do not expose GIS-only tools', () => {
    const tabs = getTabsForStage('Survey Plan & Field Survey', 'CAD', 'BUILDING_FIBER').map(tab => tab.value);
    assert.ok(tabs.includes('survey'));
    assert.ok(!tabs.includes('gis'));
});

test('module discovery retains finance, BOQ and closure without duplicates', () => {
    const tabs = getAllProjectTabs('CAD', 'BUILDING_FIBER').map(tab => tab.value);
    for (const key of ['finance', 'boq', 'closure', 'tasks', 'documents', 'as-built', 'budget']) assert.ok(tabs.includes(key));
    assert.equal(tabs.length, new Set(tabs).size);
    assert.ok(!tabs.includes('gis'));
    assert.ok(!getAllProjectTabs('MANUAL', 'CCTV').some(tab => tab.value === 'otdr'));
});

test('review, rework and blocked stages precede future pending work', () => {
    for (const status of ['IN_REVIEW', 'CHANGES_REQUESTED', 'BLOCKED']) {
        const stages = [{ id: 'a', name: 'Design', status, sequence: 1 }, { id: 'b', name: 'BOQ', status: 'PENDING', sequence: 2 }];
        assert.equal(resolveCurrentProjectStage(stages)?.id, 'a');
        assert.equal(resolveCurrentProjectStage(stages, 'a')?.id, 'a');
    }
});

test('persisted current stage wins and completed stages do not hide pending work', () => {
    const stages = [{ id: 'a', name: 'Survey', status: 'COMPLETED', sequence: 1 }, { id: 'b', name: 'Design', status: 'PENDING', sequence: 2 }];
    assert.equal(resolveCurrentProjectStage(stages, 'a')?.id, 'b');
    assert.equal(resolveCurrentProjectStage([]), undefined);
    assert.ok(getTabsForStage('Survey & Current-State Assessment', 'MANUAL', 'CCTV').some(tab => tab.value === 'survey'));
});

test('module discovery filters restricted modules by canonical read capabilities', () => {
    const all = getAllProjectTabs('GIS', 'BUILDING_FIBER');
    const reader = filterProjectTabsByPermissions(all, ['project.read']);
    assert.ok(reader.some(tab => tab.value === 'overview'));
    assert.ok(!reader.some(tab => tab.value === 'finance'));
    assert.ok(!reader.some(tab => tab.value === 'procurement'));
    assert.ok(filterProjectTabsByPermissions(all, ['project.finance.read']).some(tab => tab.value === 'finance'));
});
