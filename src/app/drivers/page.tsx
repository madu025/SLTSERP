"use client";

import React from 'react';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import { Card, CardContent } from '@/components/ui/card';
import { Users } from 'lucide-react';

export default function DriversPage() {
    return (
        <div className="erp-page-wrapper flex-row overflow-hidden">
            <Sidebar />
            <main className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
                <Header />
                <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
                    <div className="max-w-7xl mx-auto space-y-4">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                            <div className="space-y-0.5">
                                <h1 className="text-xl font-black text-slate-900 tracking-tight">Driver Management</h1>
                                <p className="text-xs text-slate-500">Manage driver records, assignments, and compliance documentation.</p>
                            </div>
                        </div>
                        <Card className="rounded-xl border border-dashed border-slate-300 bg-white">
                            <CardContent className="flex flex-col items-center justify-center py-20">
                                <div className="h-16 w-16 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mb-4">
                                    <Users className="w-8 h-8" />
                                </div>
                                <h3 className="text-lg font-bold text-slate-700 mb-1">Coming Soon</h3>
                                <p className="text-sm text-slate-500 text-center max-w-md">
                                    Driver management features are coming soon. You will be able to manage driver profiles,
                                    license tracking, assignment history, and compliance documentation here.
                                </p>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </main>
        </div>
    );
}
