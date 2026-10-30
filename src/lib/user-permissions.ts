import { deriveEffectivePermissions } from '@/lib/effective-permissions';
import { prisma } from '@/lib/prisma';

/** Read the canonical capability set for a user outside apiHandler. */
export async function getUserEffectivePermissions(userId: string | null | undefined): Promise<string[]> {
  if (!userId) return [];
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      permissions: true,
      systemRole: {
        select: {
          isActive: true,
          permissions: true,
          rolePermissions: { select: { permission: true, permissionDefinition: { select: { code: true } } } },
        },
      },
      sectionAssignments: {
        select: {
          role: {
            select: {
              isActive: true,
              permissions: true,
              rolePermissions: { select: { permission: true, permissionDefinition: { select: { code: true } } } },
            },
          },
        },
      },
    },
  });
  return user ? deriveEffectivePermissions(user) : [];
}

export async function userHasPermission(userId: string | null | undefined, permission: string) {
  const permissions = await getUserEffectivePermissions(userId);
  return permissions.includes(permission);
}
