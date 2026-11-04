/**
 * The public base URL of this deployment, used for links inside emails and notifications
 * (approval buttons, set-password links, action links).
 *
 * Read it at call time from the server environment. The old code fell back to a hard-coded
 * https://sltserp.vercel.app, so any deployment without NEXT_PUBLIC_APP_URL (or with the old Vercel value
 * still set) mailed links to a site that is no longer the system. With nothing configured we now fall back to
 * localhost, which is obviously wrong in a mail rather than silently pointing at another host.
 */
export function getAppBaseUrl(): string {
  const raw = process.env.APP_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || '';
  return (raw.trim() || 'http://localhost:3000').replace(/\/+$/, '');
}
