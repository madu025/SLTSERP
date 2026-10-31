interface ActiveRole { code: string; isActive: boolean }

export function hasActiveWorkflowRole(
  requiredRole: string,
  roles: ReadonlyArray<ActiveRole | null | undefined>,
): boolean {
  return roles.some((role) => {
    if (!role?.isActive) return false;
    const code = role.code.replace(/_GLOBAL$/, '');
    return code === requiredRole || code.endsWith(`_${requiredRole}`);
  });
}
