import { AppError } from '@/lib/error';
import { prisma } from '@/lib/prisma';
import { resolveOpmcScope } from '@/lib/opmc-scope';

/** Enforce the project-to-OPMC boundary for dynamic project routes. */
export async function assertProjectAccess(projectId: string, userId: string | null | undefined) {
    if (!userId) throw AppError.unauthorized('Authentication required');

    const project = await prisma.project.findUnique({
        where: { id: projectId },
        select: { id: true, opmcId: true },
    });
    if (!project) throw AppError.notFound('Project not found');

    const accessibleOpmcs = await resolveOpmcScope(userId);
    if (accessibleOpmcs !== undefined && (!project.opmcId || !accessibleOpmcs.includes(project.opmcId))) {
        throw AppError.forbidden('You are not assigned to this project scope');
    }

    return project;
}
