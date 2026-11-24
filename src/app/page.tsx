import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { verifyJWTWithResult } from '@/lib/auth';

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
        // the dashboard sends contractors and store people to their own first page by their capabilities
        redirect('/dashboard');
    }

    redirect('/login');
}
