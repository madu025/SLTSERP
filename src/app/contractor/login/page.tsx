"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Truck, Lock, User, ShieldCheck, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';

export default function ContractorLoginPage() {
    const router = useRouter();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!username || !password) {
            toast.error('Please enter username / phone number and password');
            return;
        }

        setLoading(true);
        try {
            const res = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

            const contentType = res.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
                throw new Error('Server returned invalid response format. Please try again.');
            }

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.message || data.error || 'Contractor login failed');
            }

            // Store contractor user session in localStorage
            localStorage.setItem('contractor_user', JSON.stringify(data.user));
            if (data.token) {
                localStorage.setItem('contractor_token', data.token);
            }

            // Fallback for general session if no admin user is currently logged in
            if (!localStorage.getItem('user')) {
                localStorage.setItem('user', JSON.stringify(data.user));
                if (data.token) localStorage.setItem('token', data.token);
            }

            toast.success(`Welcome back, ${data.user.name || 'Contractor'}!`);
            router.push('/contractor/dashboard');
        } catch (err: unknown) {
            const errorMessage = err instanceof Error ? err.message : 'Login failed. Please check credentials.';
            toast.error(errorMessage);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-950 text-white flex flex-col justify-between p-6 relative overflow-hidden font-sans">
            {/* Background Fiber Glow Effects */}
            <div className="absolute -top-32 -left-32 w-80 h-80 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-32 -right-32 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

            {/* Top App Branding */}
            <div className="pt-8 text-center space-y-3 z-10">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-black uppercase tracking-wider shadow-inner">
                    <Truck className="w-4 h-4" />
                    CONTRACTOR FIELD APP
                </div>
                <h1 className="text-3xl font-black tracking-tight text-white">SLTSERP Contractor</h1>
                <p className="text-xs text-slate-400 max-w-xs mx-auto">Standalone Field Access for Van Stock, Dual-Custody Dispatches & SOD Logging</p>
            </div>

            {/* Login Card Form */}
            <div className="w-full max-w-sm mx-auto my-auto z-10 bg-slate-900/90 backdrop-blur border border-slate-800 p-6 rounded-3xl shadow-2xl space-y-6">
                <div className="text-center space-y-1">
                    <h2 className="text-lg font-bold text-white">Contractor Login</h2>
                    <p className="text-xs text-slate-400">Enter your contractor team credentials</p>
                </div>

                <form onSubmit={handleLogin} className="space-y-4">
                    <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-400 block">Username / Phone Number</label>
                        <div className="relative">
                            <User className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                            <input
                                type="text"
                                placeholder="Contractor Username or Phone"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                className="w-full h-11 pl-10 pr-3 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-amber-500 font-mono transition-colors"
                            />
                        </div>
                    </div>

                    <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-400 block">Password / PIN</label>
                        <div className="relative">
                            <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                            <input
                                type="password"
                                placeholder="••••••••"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full h-11 pl-10 pr-3 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-amber-500 font-mono transition-colors"
                            />
                        </div>
                    </div>

                    <Button
                        type="submit"
                        disabled={loading}
                        className="w-full h-11 bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs rounded-xl shadow-lg flex items-center justify-center gap-2 mt-2 transition-all"
                    >
                        {loading ? 'Authenticating...' : 'Login to Contractor App'}
                        <ArrowRight className="w-4 h-4" />
                    </Button>
                </form>

                <div className="pt-2 text-center border-t border-slate-800/80">
                    <p className="text-[11px] text-slate-500 flex items-center justify-center gap-1">
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" /> Secure Multi-Tenant Contractor Authentication
                    </p>
                </div>
            </div>

            {/* Bottom Footer Version */}
            <div className="pb-4 text-center text-[10px] text-slate-500 font-mono z-10">
                SLTSERP Mobile PWA v4.5.0 • ISO 9001 Compliant
            </div>
        </div>
    );
}
