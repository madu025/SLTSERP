"use client";

import React from "react";
import { Check, FileText } from "lucide-react";

export default function Slide10() {
    const features = [
        "Monthly Invoice Generation",
        "90/10 Payment Split",
        "PDF Invoice Export"
    ];
                                    return (
                                        <div className="flex flex-col h-full justify-center max-w-5xl mx-auto py-2 sm:py-6">
                                            
    
                                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8">
                                                {/* Left - Billing Description & Features */}
                                                <div className="card-primary rounded-xl p-5 sm:p-6 flex flex-col justify-center">
                                                    <div className="flex items-center gap-3 mb-4">
                                                        <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center">
                                                            <FileText className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                                                        </div>
                                                        <h3 className="font-semibold text-lg sm:text-xl">Billing Engine</h3>
                                                    </div>
                                                    <p className="text-sm sm:text-base text-slate-700 dark:text-slate-300 mb-5">
                                                        Processes monthly operational summaries to calculate billing splits and deductions automatically, ensuring transparent financial settlements with field contractors.
                                                    </p>
                                                    <div className="space-y-3">
                                                        {features.map((feat) => (
                                                            <div key={feat} className="flex items-center gap-2.5">
                                                                <span className="w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center flex-shrink-0">
                                                                    <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                                                                </span>
                                                                <span className="text-sm sm:text-base font-medium">{feat}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
    
                                                {/* Right - Visual Split with Progress Bars */}
                                                <div className="card-analytics rounded-xl p-5 sm:p-6 flex flex-col justify-center">
                                                    <h3 className="font-semibold text-base sm:text-lg mb-6 text-center">Payment Split</h3>
    
                                                    {/* Contractor Payment - 90% */}
                                                    <div className="mb-6">
                                                        <div className="flex items-center justify-between mb-2">
                                                            <span className="text-sm sm:text-base font-medium">Contractor Payment</span>
                                                            <span className="text-lg sm:text-xl font-bold text-blue-600 dark:text-blue-400">90%</span>
                                                        </div>
                                                        <div className="w-full h-5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                                                            <div
                                                                className="h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-full flex items-center justify-end pr-2"
                                                                style={{ width: "90%" }}
                                                            >
                                                                <span className="text-[10px] sm:text-xs font-bold text-white">90%</span>
                                                            </div>
                                                        </div>
                                                    </div>
     
                                                    {/* SLTS Retention - 10% */}
                                                    <div>
                                                        <div className="flex items-center justify-between mb-2">
                                                            <span className="text-sm sm:text-base font-medium">SLTS Retention</span>
                                                            <span className="text-lg sm:text-xl font-bold text-amber-600 dark:text-amber-400">10%</span>
                                                        </div>
                                                        <div className="w-full h-5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                                                            <div
                                                                className="h-full bg-gradient-to-r from-amber-500 to-amber-600 rounded-full flex items-center justify-end pr-2"
                                                                style={{ width: "10%" }}
                                                            >
                                                                <span className="text-[10px] sm:text-xs font-bold text-white">10%</span>
                                                            </div>
                                                        </div>
                                                    </div>
     
                                                    {/* KPI Block */}
                                                    <div className="mt-8 grid grid-cols-2 gap-3">
                                                        <div className="kpi-block text-center p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20">
                                                            <div className="kpi-number text-2xl sm:text-3xl font-bold text-blue-600 dark:text-blue-400">90%</div>
                                                            <div className="kpi-label text-xs text-slate-500 dark:text-slate-400">Contractor</div>
                                                        </div>
                                                        <div className="kpi-block text-center p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20">
                                                            <div className="kpi-number text-2xl sm:text-3xl font-bold text-amber-600 dark:text-amber-400">10%</div>
                                                            <div className="kpi-label text-xs text-slate-500 dark:text-slate-400">SLTS Retention</div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
}
