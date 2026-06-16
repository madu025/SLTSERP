"use client";

import React from 'react';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, Users } from 'lucide-react';

export default function DriverDetailPage() {
    const router = useRouter();
    const params = useParams();
    const id = params.id as string;

    return (
        <div className="erp-page-wrapper flex-row overflow-hidden">
            <Sidebar />
            <main className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
                <Header />
                <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
                    <div className="max-w-4xl mx-auto space-y-4">
                        <div className="flex items-center gap-3">
                            <Button variant="ghost" onClick={() => router.push('/drivers')} className="h-8 w-8 p-0 text-slate-400 hover:text-slate-600">
                                <ArrowLeft className="w-4 h-4" />
                            </Button>
                            <div>
                                <h1 className="text-xl font-black text-slate-900 tracking-tight">Driver Details</h1>
                                <p className="text-xs text-slate-500">ID: {id}</p>
                            </div>
                        </div>
                        <Card className="rounded-xl border border-dashed border-slate-300 bg-white">
                            <CardContent className="flex flex-col items-center justify-center py-20">
                                <div className="h-16 w-16 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mb-4">
                                    <Users className="w-8 h-8" />
                                </div>
                                <h3 className="text-lg font-bold text-slate-700 mb-1">Coming Soon</h3>
                                <p className="text-sm text-slate-500 text-center max-w-md">
                                    Driver detail view is coming soon. You will be able to view driver profile,
                                    license information, trip history, and compliance documents here.
                                </p>
                                <Button onClick={() => router.push('/drivers')} className="mt-4 h-8 px-4 bg-slate-200 text-slate-700 rounded-lg text-xs font-bold">
                                    Back to Drivers
                                </Button>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </main>
        </div>
    );
}
