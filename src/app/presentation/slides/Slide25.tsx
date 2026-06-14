/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React from "react";
import { X, Check } from "lucide-react";

export default function Slide25() {
    const beforeItems = [
        "Scattered Excel sheets with 24-48h sync delays.",
        "Manual calculations of contractor invoices and 90/10 splits.",
        "Inventory discrepancies due to manual reconciliations."
    ];
    const afterItems = [
        "Real-time database updates immediately visible to all teams.",
        "Automated monthly invoice runs with precise payment breakdowns.",
        "Real-time ledger entries, safety level alerts, and PDF sign-offs."
    ];
                                    return (
                                        <div className="flex flex-col h-full justify-center max-w-5xl mx-auto py-2 sm:py-6">
                                            
    
                                            {/* Two Column Comparison */}
                                            <div className="stagger-children grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                                                {/* BEFORE */}
                                                <div className="card-critical comparison-col rounded-xl p-4 sm:p-6">
                                                    <div className="flex items-center gap-2 mb-4">
                                                        <X className="w-5 h-5 text-rose-500" />
                                                        <h3 className="text-xl sm:text-2xl font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wide">
                                                            Before
                                                        </h3>
                                                    </div>
                                                    <div className="space-y-3">
                                                        {beforeItems.map((item, idx) => (
                                                            <div
                                                                key={idx}
                                                                className="flex items-start gap-3 bg-rose-50/60 dark:bg-rose-900/20 rounded-lg p-3"
                                                            >
                                                                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-rose-200 dark:bg-rose-800/60 flex items-center justify-center mt-0.5">
                                                                    <X className="w-3.5 h-3.5 text-rose-600 dark:text-rose-300" />
                                                                </div>
                                                                <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300">{item}</p>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
    
                                                {/* AFTER */}
                                                <div className="card-success comparison-col rounded-xl p-4 sm:p-6">
                                                    <div className="flex items-center gap-2 mb-4">
                                                        <Check className="w-5 h-5 text-emerald-500" />
                                                        <h3 className="text-xl sm:text-2xl font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wide">
                                                            After
                                                        </h3>
                                                    </div>
                                                    <div className="space-y-3">
                                                        {afterItems.map((item, idx) => (
                                                            <div
                                                                key={idx}
                                                                className="flex items-start gap-3 bg-emerald-50/60 dark:bg-emerald-900/20 rounded-lg p-3"
                                                            >
                                                                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-emerald-200 dark:bg-emerald-800/60 flex items-center justify-center mt-0.5">
                                                                    <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-300" />
                                                                </div>
                                                                <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300">{item}</p>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
}
