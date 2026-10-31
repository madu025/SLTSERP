/* eslint-disable @typescript-eslint/no-explicit-any -- Focused Prisma stubs exercise service authorization before writes. */
import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { prisma } from '../../src/lib/prisma';
import { RBAC_PERMISSIONS } from '../../src/config/rbac-permissions';
import { WorkflowEngine } from '../../src/services/core/WorkflowEngine';
import { ProjectWorkflowReviewService } from '../../src/services/project/project-workflow-review.service';

const db = prisma as any;
const originals = {
  user: db.user.findUnique,
  project: db.project.findUnique,
  stage: db.projectStageInstance.findUnique,
  approval: db.projectApprovalInstance.findUnique,
  transaction: db.$transaction,
  reviewFindFirst: db.workflowReviewCycle.findFirst,
};
afterEach(() => {
  db.user.findUnique = originals.user;
  db.project.findUnique = originals.project;
  db.projectStageInstance.findUnique = originals.stage;
  db.projectApprovalInstance.findUnique = originals.approval;
  db.$transaction = originals.transaction;
  db.workflowReviewCycle.findFirst = originals.reviewFindFirst;
});

function actor(options: { permissions?: string[]; roleCode?: string; sectionRoleCode?: string; activeRole?: boolean; opmcIds?: string[] } = {}) {
  db.user.findUnique = async () => ({
    id: 'actor-1', status: 'active', role: 'ENGINEER',
    permissions: JSON.stringify(options.permissions ?? [RBAC_PERMISSIONS.PROJECT_APPROVE]),
    systemRole: options.roleCode ? { code: options.roleCode, isActive: options.activeRole ?? true } : null,
    sectionAssignments: options.sectionRoleCode ? [{ role: { code: options.sectionRoleCode, isActive: options.activeRole ?? true } }] : [],
    accessibleOpmcs: (options.opmcIds ?? ['opmc-1']).map((id) => ({ id })),
  });
  db.project.findUnique = async () => ({ id: 'project-1', opmcId: 'opmc-1' });
}

function pendingApproval(priorApprovedById?: string) {
  db.projectApprovalInstance.findUnique = async () => ({
    id: 'approval-2', stageId: 'stage-1', level: 2, role: 'AREA_MANAGER', status: 'PENDING',
    stage: {
      status: 'IN_PROGRESS', projectWorkflowInstance: { projectId: 'project-1', currentStageId: 'stage-1' },
      approvals: [
        { id: 'approval-1', level: 1, status: 'APPROVED', approvedById: priorApprovedById ?? 'other-actor' },
        { id: 'approval-2', level: 2, status: 'PENDING', approvedById: null },
      ],
    },
  });
}

test('active canonical role and capability can approve despite unrelated legacy display role', async () => {
  actor({ roleCode: 'PROJECT_AREA_MANAGER_GLOBAL' });
  pendingApproval();
  let writes = 0;
  db.$transaction = async (callback: (tx: any) => Promise<unknown>) => callback({
    projectApprovalInstance: {
      update: async ({ data }: any) => { writes++; return { id: 'approval-2', ...data }; },
      count: async () => 0,
    },
    projectStageInstance: { update: async () => { writes++; } },
  });
  const result = await WorkflowEngine.submitApproval('approval-2', 'APPROVED', 'actor-1', undefined, 'project-1');
  assert.equal(result.status, 'APPROVED');
  assert.equal(writes, 2);
});

test('inactive canonical role cannot approve even when legacy display role matches', async () => {
  actor({ roleCode: 'AREA_MANAGER', activeRole: false });
  pendingApproval();
  db.$transaction = async () => { throw new Error('write reached'); };
  await assert.rejects(() => WorkflowEngine.submitApproval('approval-2', 'APPROVED', 'actor-1', undefined, 'project-1'), /not eligible/);
});

test('active section role qualifies for the configured approval level', async () => {
  actor({ sectionRoleCode: 'PROJECT_AREA_MANAGER' });
  pendingApproval();
  db.$transaction = async (callback: (tx: any) => Promise<unknown>) => callback({
    projectApprovalInstance: { update: async ({ data }: any) => data, count: async () => 1 },
  });
  const result = await WorkflowEngine.submitApproval('approval-2', 'APPROVED', 'actor-1', undefined, 'project-1');
  assert.equal(result.status, 'APPROVED');
});

test('direct permission override can deny inherited approval capability', async () => {
  actor({ permissions: [], roleCode: 'AREA_MANAGER' });
  pendingApproval();
  db.$transaction = async () => { throw new Error('write reached'); };
  await assert.rejects(() => WorkflowEngine.submitApproval('approval-2', 'APPROVED', 'actor-1', undefined, 'project-1'), /capability is required/);
});

test('project approval capability does not expand OPMC access', async () => {
  actor({ roleCode: 'AREA_MANAGER', opmcIds: ['opmc-2'] });
  pendingApproval();
  db.$transaction = async () => { throw new Error('write reached'); };
  await assert.rejects(() => WorkflowEngine.submitApproval('approval-2', 'APPROVED', 'actor-1', undefined, 'project-1'), /not assigned to this project scope/);
});

test('the same actor cannot approve two levels, including with admin override', async () => {
  actor({ permissions: [RBAC_PERMISSIONS.PROJECT_APPROVE, RBAC_PERMISSIONS.ADMIN_RBAC] });
  pendingApproval('actor-1');
  db.$transaction = async () => { throw new Error('write reached'); };
  await assert.rejects(() => WorkflowEngine.submitApproval('approval-2', 'APPROVED', 'actor-1', undefined, 'project-1'), /more than one approval level/);
});

test('stage transition uses canonical capability and scope, independent of legacy display role', async () => {
  actor();
  db.projectStageInstance.findUnique = async () => ({
    id: 'stage-1', status: 'IN_PROGRESS', projectWorkflowInstanceId: 'workflow-1', approvals: [],
    projectWorkflowInstance: { projectId: 'project-1', currentStageId: 'stage-1' },
  });
  let updated = false;
  db.$transaction = async (callback: (tx: any) => Promise<unknown>) => callback({
    projectStageInstance: { update: async () => { updated = true; } },
    workflowAuditLog: { create: async () => ({}) },
  });
  await WorkflowEngine.transitionStage('stage-1', 'BLOCKED', 'actor-1', 'project-1');
  assert.equal(updated, true);
});

test('stage transition denies a user whose direct permission override removes approval', async () => {
  actor({ permissions: [] });
  db.projectStageInstance.findUnique = async () => ({
    id: 'stage-1', status: 'IN_PROGRESS', approvals: [],
    projectWorkflowInstance: { projectId: 'project-1', currentStageId: 'stage-1' },
  });
  db.$transaction = async () => { throw new Error('write reached'); };
  await assert.rejects(() => WorkflowEngine.transitionStage('stage-1', 'BLOCKED', 'actor-1', 'project-1'), /capability is required/);
});

function review(submittedById = 'submitter-1') {
  db.workflowReviewCycle.findFirst = async () => ({
    id: 'review-1', projectId: 'project-1', stageId: 'stage-1', status: 'IN_REVIEW',
    reviewerRole: 'AREA_MANAGER', submittedById,
    stage: { projectWorkflowInstanceId: 'workflow-1', sequence: 1 },
  });
}

test('review decision accepts active DB role and canonical approval capability', async () => {
  actor({ roleCode: 'PROJECT_AREA_MANAGER_GLOBAL' });
  review();
  let wrote = false;
  db.$transaction = async (callback: (tx: any) => Promise<unknown>) => callback({
    workflowReviewCycle: { update: async ({ data }: any) => { wrote = true; return data; } },
    projectStageInstance: { update: async () => ({}) },
    workflowAuditLog: { create: async () => ({}) },
  });
  const result = await ProjectWorkflowReviewService.decide({
    projectId: 'project-1', reviewId: 'review-1', decision: 'REJECTED', reviewerUserId: 'actor-1',
  });
  assert.equal(result.status, 'REJECTED');
  assert.equal(wrote, true);
});

test('review decision rejects a submitter even with admin override', async () => {
  actor({ permissions: [RBAC_PERMISSIONS.PROJECT_APPROVE, RBAC_PERMISSIONS.ADMIN_RBAC] });
  review('actor-1');
  db.$transaction = async () => { throw new Error('write reached'); };
  await assert.rejects(() => ProjectWorkflowReviewService.decide({
    projectId: 'project-1', reviewId: 'review-1', decision: 'APPROVED', reviewerUserId: 'actor-1',
  }), /submitter cannot decide/);
});

test('review decision rejects a legacy display role without active DB role', async () => {
  actor({ roleCode: 'AREA_MANAGER', activeRole: false });
  review();
  db.$transaction = async () => { throw new Error('write reached'); };
  await assert.rejects(() => ProjectWorkflowReviewService.decide({
    projectId: 'project-1', reviewId: 'review-1', decision: 'APPROVED', reviewerUserId: 'actor-1',
  }), /requires the AREA_MANAGER role/);
});
