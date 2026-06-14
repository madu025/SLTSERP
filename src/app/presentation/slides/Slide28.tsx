/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React from "react";
import { ArrowRight, Home, CheckCircle2 } from "lucide-react";

export default function Slide28() {
    const summaryItems = [
        "Unified Workflows",
        "Real-Time Tracking",
        "Inventory Security",
        "Automated Billing"
    ];
                                    return (
                                        <div className="flex flex-col h-full justify-center max-w-5xl mx-auto py-2 sm:py-6">
                                            {/* Chapter Header */}
                                            <div className="mb-6 sm:mb-8 text-center">
                                                <span className="inline-block px-3 py-1 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-xs font-medium text-emerald-600 dark:text-emerald-400 mb-3">
                                                    Conclusion
                                                </span>
                                            </div>
    
                                            <div className="text-center stagger-children">
                                                {/* Big Checkmark Icon */}
                                                <div className="inline-block mb-6">
                                                    <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center mx-auto shadow-lg">
                                                        <CheckCircle2 className="w-10 h-10 sm:w-12 sm:h-12 text-white" />
                                                    </div>
                                                </div>
    
                                                {/* Title */}
                                                <h2 className="text-2xl sm:text-4xl font-bold mb-3">System Ready for Deployment</h2>
    
                                                {/* Subtitle */}
                                                <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300 max-w-2xl mx-auto mb-6 sm:mb-8">
                                                    By centering all workflows around a single web platform, SLTSERP reduces administrative delays, eliminates data discrepancies, and optimizes regional field work.
                                                </p>
    
                                                {/* 4 Checkmark Summary Items */}
                                                <div className="flex flex-wrap justify-center gap-3 sm:gap-4 mb-8 sm:mb-10">
                                                    {summaryItems.map((item) => (
                                                        <div
                                                            key={item}
                                                            className="flex items-center gap-1.5 bg-emerald-50 dark:bg-emerald-900/30 rounded-full px-4 py-2"
                                                        >
                                                            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                                                            <span className="text-xs sm:text-sm font-medium text-emerald-700 dark:text-emerald-300">
                                                                {item}
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>
    
                                                {/* CTA Buttons */}
                                                <div className="flex flex-wrap justify-center gap-3 sm:gap-4">
                                                    <button
                                                        onClick={() => { if (typeof window !== "undefined" && (window as any).__sltserp_navigate) (window as any).__sltserp_navigate(0); }}
                                                        className="btn-focus inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-gradient-to-r from-blue-500 to-emerald-500 text-white font-semibold text-sm hover:opacity-90 transition-opacity shadow-lg"
                                                    >
                                                        {(typeof window !== "undefined" && (window as any).__sltserp_isLoggedIn) ? "Go to ERP Dashboard" : "Log In to ERP Portal"}
                                                        <ArrowRight className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => { if (typeof window !== "undefined" && (window as any).__sltserp_navigate) (window as any).__sltserp_navigate(0); }}
                                                        className="btn-focus inline-flex items-center gap-2 px-6 py-3 rounded-lg border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 font-medium text-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                                                    >
                                                        <Home className="w-4 h-4" />
                                                        Restart Presentation
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    );
}
