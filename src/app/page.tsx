import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { verifyJWTWithResult } from '@/lib/auth';
import { isContractorRole, isStoresRole } from '@/config/roles';

export const dynamic = 'force-dynamic';

// Root gateway: send authenticated users to their role home, everyone else to
// the login page. Previously this redirected unconditionally to /login, which
// broke the post-login redirect for anyone who entered via the root URL:
// middleware stored callbackUrl=/, the login page navigated back to /, and
// this page bounced the fresh session straight back to /login.
export default async function Home() {
    const token = (await cookies()).get('token')?.value;
    const result = token ? await verifyJWTWithResult(token) : null;

    if (result?.valid) {
        const role = result.payload.role as string;
        if (isContractorRole(role)) redirect('/contractor/dashboard');
        if (isStoresRole(role)) redirect('/inventory');
        redirect('/dashboard');
    }

    redirect('/login');
}
