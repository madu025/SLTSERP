import { AppError } from '@/lib/error';
import { prisma } from '@/lib/prisma';
import { resolveOpmcScope } from '@/lib/opmc-scope';
import { assertProjectAccess } from '@/lib/project-access';

type ProjectRef = { projectId: string } | null;

/**
 * Resolvers that map a record id to its owning project. Used by flat
 * (non-`/projects/<uuid>/`) routes where api-handler cannot apply the OPMC
 * boundary centrally, and by sub-resource routes that must bind a record id
 * to the project id in the URL.
 */
const RESOLVERS = {
    boqItem: (id: string): Promise<ProjectRef> => prisma.projectBOQItem.findUnique({ where: { id }, select: { projectId: true } }),
    changeOrder: (id: string): Promise<ProjectRef> => prisma.projectChangeOrder.findUnique({ where: { id }, select: { projectId: true } }),
    milestone: (id: string): Promise<ProjectRef> => prisma.projectMilestone.findUnique({ where: { id }, select: { projectId: true } }),
    purchaseOrder: (id: string): Promise<ProjectRef> => prisma.projectPurchaseOrder.findUnique({ where: { id }, select: { projectId: true } }),
    requisition: (id: string): Promise<ProjectRef> => prisma.projectRequisition.findUnique({ where: { id }, select: { projectId: true } }),
    quotation: async (id: string): Promise<ProjectRef> => {
        const q = await prisma.quotation.findUnique({ where: { id }, select: { requisition: { select: { projectId: true } } } });
        return q ? { projectId: q.requisition.projectId } : null;
    },
    timesheet: (id: string): Promise<ProjectRef> => prisma.timesheet.findUnique({ where: { id }, select: { projectId: true } }),
    risk: (id: string): Promise<ProjectRef> => prisma.projectRisk.findUnique({ where: { id }, select: { projectId: true } }),
    hseLog: (id: string): Promise<ProjectRef> => prisma.hSESafetyLog.findUnique({ where: { id }, select: { projectId: true } }),
    inspection: (id: string): Promise<ProjectRef> => prisma.projectInspection.findUnique({ where: { id }, select: { projectId: true } }),
    asset: (id: string): Promise<ProjectRef> => prisma.projectAsset.findUnique({ where: { id }, select: { projectId: true } }),
    surveyPoint: (id: string): Promise<ProjectRef> => prisma.surveyPoint.findUnique({ where: { id }, select: { projectId: true } }),
} as const;

export type ProjectRecordKind = keyof typeof RESOLVERS;

const LABELS: Record<ProjectRecordKind, string> = {
    boqItem: 'BOQ item',
    changeOrder: 'Change order',
    milestone: 'Milestone',
    purchaseOrder: 'Purchase order',
    requisition: 'Requisition',
    quotation: 'Quotation',
    timesheet: 'Timesheet',
    risk: 'Risk',
    hseLog: 'HSE log',
    inspection: 'Inspection',
    asset: 'Asset',
    surveyPoint: 'Survey point',
};

/** Load a record's project and enforce OPMC access to it. Returns the projectId. */
export async function assertRecordProjectAccess(kind: ProjectRecordKind, recordId: string, userId: string | null | undefined): Promise<string> {
    const ref = await RESOLVERS[kind](recordId);
    if (!ref) throw AppError.notFound(`${LABELS[kind]} not found`);
    await assertProjectAccess(ref.projectId, userId);
    return ref.projectId;
}

/** Verify a record belongs to the project in the URL (record-to-project binding). */
export async function assertRecordInProject(kind: ProjectRecordKind, recordId: string, projectId: string): Promise<void> {
    const ref = await RESOLVERS[kind](recordId);
    if (!ref || ref.projectId !== projectId) throw AppError.notFound(`${LABELS[kind]} not found`);
}

/**
 * Set of project ids the user may access, or `undefined` for global access.
 * Use to post-filter list endpoints that accept an optional projectId.
 */
export async function getAccessibleProjectIds(userId: string | null | undefined): Promise<Set<string> | undefined> {
    if (!userId) throw AppError.unauthorized('Authentication required');
    const opmcs = await resolveOpmcScope(userId);
    if (opmcs === undefined) return undefined;
    if (opmcs.length === 0) return new Set();
    const projects = await prisma.project.findMany({ where: { opmcId: { in: opmcs } }, select: { id: true } });
    return new Set(projects.map((p) => p.id));
}

/** Return the authenticated user id or throw 401 (never default to 'SYSTEM'). */
export function requireUserId(userId: string | null | undefined): string {
    if (!userId) throw AppError.unauthorized('Authentication required');
    return userId;
}

/** Require at least one of the canonical permissions (DB-backed) for a status-dependent action. */
export async function requireAnyPermission(userId: string | null | undefined, permissions: string[], message: string): Promise<void> {
    const { getUserEffectivePermissions } = await import('@/lib/user-permissions');
    const effective = await getUserEffectivePermissions(userId);
    if (!permissions.some((p) => effective.includes(p))) throw AppError.forbidden(message);
}

/** Enforce that the user's OPMC scope includes the given OPMC (global-capability users pass). */
export async function assertOpmcAccess(opmcId: string, userId: string | null | undefined): Promise<void> {
    if (!userId) throw AppError.unauthorized('Authentication required');
    const opmcs = await resolveOpmcScope(userId);
    if (opmcs !== undefined && !opmcs.includes(opmcId)) {
        throw AppError.forbidden('You are not assigned to this OPMC scope');
    }
}
