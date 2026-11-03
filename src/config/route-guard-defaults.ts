/**
 * Paths that remain reachable while an account is locked into the mandatory
 * password-rotation flow. Every other API route must declare a canonical
 * permission or an explicit `publicRoute` boundary in apiHandler.
 */
export const PASSWORD_CHANGE_EXEMPT_PATHS = new Set([
    '/api/profile/change-password',
    '/api/logout',
    '/api/login',
]);
