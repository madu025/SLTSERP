"use client";

import React from "react";
import { Warehouse, Building2 } from "lucide-react";

export default function Slide8() {
    return (
            <div className="flex flex-col h-full justify-center max-w-5xl mx-auto py-2 sm:py-6">
                    
    
                    {/* Two Cards */}
                    <div className="stagger-children grid grid-cols-1 sm:grid-cols-2 gap-6 sm:gap-8 max-w-3xl mx-auto w-full">
                        {/* SLT Sourced */}
                        <div className="card-success rounded-xl p-6 sm:p-8 text-center">
                            <div className="w-14 h-14 rounded-xl bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center mx-auto mb-4">
                                <Building2 className="w-7 h-7 text-emerald-600 dark:text-emerald-400" />
                            </div>
                            <h3 className="text-xl sm:text-2xl font-bold mb-2 text-emerald-700 dark:text-emerald-400">
                                SLT Sourced
                            </h3>
                            <p className="text-sm text-slate-700 dark:text-slate-300 mb-4">
                                Materials from SLT store, cost deducted from monthly invoice
                            </p>
                            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-rose-100 dark:bg-rose-900/40 text-xs font-semibold text-rose-600 dark:text-rose-400">
                                DEDUCTED
                            </span>
                        </div>
    
                        {/* SLTS Sourced */}
                        <div className="card-warning rounded-xl p-6 sm:p-8 text-center">
                            <div className="w-14 h-14 rounded-xl bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center mx-auto mb-4">
                                <Warehouse className="w-7 h-7 text-amber-600 dark:text-amber-400" />
                            </div>
                            <h3 className="text-xl sm:text-2xl font-bold mb-2 text-amber-700 dark:text-amber-400">
                                SLTS Sourced
                            </h3>
                            <p className="text-sm text-slate-700 dark:text-slate-300 mb-4">
                                Materials from SLTS warehouse, tracked for internal reconciliation
                            </p>
                            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-xs font-semibold text-blue-600 dark:text-blue-400">
                                SLTS STOCK
                            </span>
                        </div>
                    </div>
                </div>
        );
}
