import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const serviceOrder = readFileSync('src/services/service-order/index.ts', 'utf8');
const cycleCount = readFileSync('src/services/inventory/cycle-count.service.ts', 'utf8');
const supervisor = readFileSync('src/services/project/project-supervisor.service.ts', 'utf8');
const taskPlan = readFileSync('src/services/project/project-task-plan.service.ts', 'utf8');
const userService = readFileSync('src/services/hr/user.service.ts', 'utf8');
const contractorFinance = readFileSync('src/services/contractor-portal/finance.service.ts', 'utf8');
const nexusAgent = readFileSync('src/services/ai/nexus-agent.service.ts', 'utf8');
const nexusContext = readFileSync('src/services/ai/nexus-context.service.ts', 'utf8');
const notifications = readFileSync('src/services/notification/index.ts', 'utf8');
const notificationPolicy = readFileSync('src/services/notification/notification-policy.service.ts', 'utf8');
const processGate = readFileSync('src/services/approval/process-gate-engine.ts', 'utf8');
const opmcService = readFileSync('src/services/slt/opmc.service.ts', 'utf8');
const changeRequests = readFileSync('src/services/project/change-request.service.ts', 'utf8');

test('service-order reads derive global scope from canonical OPMC capability', () => {
    assert.match(serviceOrder, /resolveOpmcScope\(_userId\)/);
    assert.doesNotMatch(serviceOrder, /user\.role\s*!==\s*['"]SUPER_ADMIN/);
});

test('inventory approval SoD uses canonical capabilities instead of display roles', () => {
    assert.match(cycleCount, /getUserEffectivePermissions\(approvedById\)/);
    assert.match(cycleCount, /RBAC_PERMISSIONS\.ADMIN_RBAC/);
    assert.doesNotMatch(cycleCount, /approver\.role/);
});

test('project supervisor and task-plan services do not authorize from User.role', () => {
    assert.match(supervisor, /assertProjectAccess\(projectId, actorId\)/);
    assert.match(supervisor, /RBAC_PERMISSIONS\.PROJECT_PLAN_WRITE/);
    assert.doesNotMatch(supervisor, /projectManagerRoles|supervisorRoles\.has\(supervisor\.role\)/);
    assert.match(taskPlan, /userHasPermission\(actorId, RBAC_PERMISSIONS\.PROJECT_PLAN_WRITE\)/);
    assert.doesNotMatch(taskPlan, /user\.role !== requiredJobRole/);
});

test('admin and contractor portal services use canonical identity boundaries', () => {
    assert.match(userService, /getUserEffectivePermissions\(currentUserId\)/);
    assert.match(userService, /RBAC_PERMISSIONS\.ADMIN_RBAC/);
    assert.doesNotMatch(contractorFinance, /currentUser\?\.role/);
    assert.match(contractorFinance, /currentUser\?\.contractorId/);
});

test('Nexus AI uses canonical permissions and OPMC-scoped context tools', () => {
    assert.match(nexusAgent, /getUserEffectivePermissions\(userId\)/);
    assert.match(nexusAgent, /resolveOpmcScope\(userId\)/);
    assert.match(nexusAgent, /RBAC_PERMISSIONS\.FINANCE_READ/);
    assert.match(nexusAgent, /permissions\.has\(RBAC_PERMISSIONS\.INVENTORY_READ\)/);
    assert.match(nexusAgent, /getFinanceContext\(opmcScope\)/);
    assert.doesNotMatch(nexusAgent, /user\?\.role|user\.role/);
    assert.match(nexusContext, /static async getProjectsContext\(opmcScope/);
    assert.match(nexusContext, /static async getJobCostingContext\(args\?:.*opmcScope/);
    assert.match(nexusContext, /opmcId: \{ in: \[\.\.\.opmcScope\] \}/);
});

test('notification routing resolves active canonical role assignments', () => {
    assert.match(notifications, /canonicalRoleFilter/);
    assert.match(notifications, /systemRole: \{ code: \{ in: requestedRoles \}/);
    assert.match(notifications, /sectionAssignments: \{ some:/);
    assert.match(notifications, /status: 'active'/);
    assert.doesNotMatch(notifications, /role: \{ in: scopedRolesRequested \}/);
});

test('change-request approval is scoped, permissioned, ordered, and maker-checker safe', () => {
    assert.match(changeRequests, /assertProjectAccess\(approval\.changeRequest\.projectId, userId\)/);
    assert.match(changeRequests, /RBAC_PERMISSIONS\.PROJECT_APPROVE/);
    assert.match(changeRequests, /Segregation of Duties violation/);
    assert.match(changeRequests, /Previous change-request approval step is not completed/);
    assert.doesNotMatch(changeRequests, /user\.role|actor\.role/);
});

test('approval and notification dispatch do not resolve recipients from User.role', () => {
    assert.match(processGate, /canonicalApproverWhere/);
    assert.match(processGate, /systemRole: \{ isActive: true/);
    assert.doesNotMatch(processGate, /where: \{ role:/);
    assert.match(opmcService, /systemRole: \{ isActive: true/);
    assert.doesNotMatch(opmcService, /where: \{ role: 'AREA_MANAGER'/);
    assert.match(notificationPolicy, /getCanonicalRoleEmails/);
    assert.doesNotMatch(notificationPolicy, /where: \{ role: \{ in: INVENTORY_ALERT_EMAIL_ROLES \}/);
});
