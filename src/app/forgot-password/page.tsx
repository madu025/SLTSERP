import Link from "next/link";
import { ArrowLeft, ShieldCheck } from "lucide-react";

/**
 * There is no self-service password reset: it needed only a username, an employee number and a security answer,
 * which is too weak for an ERP that holds payments. An administrator sets a temporary password
 * (Administration > Users > Reset password); the person must choose a new one at the next sign-in.
 */
export default function ForgotPasswordPage() {
    return (
        <main className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
            <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
                <div className="mb-4 flex items-center gap-3">
                    <ShieldCheck className="h-8 w-8 text-blue-700" aria-hidden="true" />
                    <h1 className="text-xl font-bold text-slate-900">Forgot your password?</h1>
                </div>
                <p className="text-sm text-slate-800">
                    For your security the password cannot be reset on this page. Please ask your administrator to reset it for you.
                </p>
                <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm text-slate-800">
                    <li>Tell your administrator your username.</li>
                    <li>They give you a temporary password.</li>
                    <li>Sign in with it. You will be asked to choose a new password straight away.</li>
                </ol>
                <Link href="/login" className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-blue-800 hover:underline">
                    <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back to sign in
                </Link>
            </div>
        </main>
    );
}
