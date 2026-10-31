import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const source = (path: string) => readFileSync(path, 'utf8');

test('document revisions use authenticated uploader, never a client actor selector', () => {
    const text = source('src/components/projects/ProjectDocuments.tsx');
    assert.doesNotMatch(text, /\/api\/admin\/users/);
    assert.doesNotMatch(text, /!uploadedById/);
});
test('as-built layer exports reuse the backend canonical registry', () => {
    const text = source('src/components/projects/ProjectAsBuilt.tsx');
    assert.match(text, /import \{ SURVEY_LAYERS \} from '@\/config\/survey-layers'/);
    assert.doesNotMatch(text, /id: 'fiber_route'/);
});
test('approval UI cannot select a simulated identity', () => {
    const text = source('src/components/projects/ProjectApprovals.tsx');
    assert.doesNotMatch(text, /usr-dev-|Role Simulator|actionedById:/);
});
test('workflow shell and tracker share stage resolution and refresh contract', () => {
    const page = source('src/app/projects/[id]/page.tsx');
    const tracker = source('src/components/projects/ProjectWorkflowTracker.tsx');
    assert.match(page, /resolveCurrentProjectStage/);
    assert.match(tracker, /resolveCurrentProjectStage/);
    assert.match(tracker, /refreshProject\?\.\(\)/);
    assert.match(page, /controller\.abort\(\)/);
});
test('approval eligibility uses DB capabilities rather than the legacy user enum', () => {
    const service = source('src/services/project/project-approval.service.ts');
    assert.doesNotMatch(service, /actor\.role/);
    assert.match(service, /RBAC_PERMISSIONS\.PROJECT_APPROVE/);
    assert.match(service, /assertProjectAccess\(step\.request\.projectId/);
});

test('workflow mutations enforce project OPMC scope before changing stages or approvals', () => {
    for (const path of [
        'src/app/api/projects/[id]/workflow/stages/route.ts',
        'src/app/api/projects/[id]/workflow/approvals/route.ts',
    ]) {
        const route = source(path);
        assert.match(route, /assertProjectAccess\(params\.id, userId\)/);
        assert.match(route, /permissions: \[RBAC_PERMISSIONS\.PROJECT_APPROVE\]/);
    }
});

test('workflow review and handoff routes scope both reads and writes', () => {
    for (const path of [
        'src/app/api/projects/[id]/workflow/reviews/route.ts',
        'src/app/api/projects/[id]/workflow/handoffs/route.ts',
    ]) {
        const route = source(path);
        assert.equal((route.match(/await assertProjectAccess\(params\.id,/g) || []).length, 2);
    }
});

test('workflow review route allows canonical writers and approvers without a client reviewer role', () => {
    const route = source('src/app/api/projects/[id]/workflow/reviews/route.ts');
    assert.match(route, /permissions: \[RBAC_PERMISSIONS\.PROJECT_WRITE, RBAC_PERMISSIONS\.PROJECT_APPROVE\]/);
    assert.doesNotMatch(route, /reviewerRole: z\.|_userRole/);
});
