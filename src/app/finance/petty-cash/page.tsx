import { redirect } from 'next/navigation';

/**
 * Preserve the sidebar's legacy Petty Cash entry while keeping the canonical
 * OSP petty-cash reporting route as the single landing page.
 */
export default function PettyCashRedirectPage() {
  redirect('/finance/osp-account-reports');
}
