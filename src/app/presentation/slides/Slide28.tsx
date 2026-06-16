"use client";

import React from "react";
import { ArrowRight, Home, CheckCircle2, Mail, Users } from "lucide-react";

export default function Slide28() {
    const summaryItems = [
        "Unified Workflows",
        "Real-Time Tracking",
        "Inventory Security",
        "Automated Billing"
    ];
    
    const w = typeof window !== "undefined" ? (window as unknown as { __sltserp_navigate?: (index: number) => void; __sltserp_isLoggedIn?: boolean }) : null;
    
    return (
        <div className="flex flex-col h-full justify-center max-w-5xl mx-auto py-2 sm:py-6 relative overflow-hidden">
            {/* Decorative Gradient Orbs */}
            <div className="absolute top-10 left-10 w-32 h-32 rounded-full bg-gradient-to-br from-blue-400/10 to-purple-400/10 blur-3xl pointer-events-none" />
            <div className="absolute bottom-10 right-10 w-40 h-40 rounded-full bg-gradient-to-br from-emerald-400/10 to-teal-400/10 blur-3xl pointer-events-none" />

            <div className="text-center stagger-children relative z-10">
                {/* Big Checkmark Icon */}
                <div className="inline-block mb-4">
                    <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center mx-auto shadow-lg">
                        <CheckCircle2 className="w-8 h-8 sm:w-10 sm:h-10 text-white" />
                    </div>
                </div>

                {/* 4 Checkmark Summary Items */}
                <div className="flex flex-wrap justify-center gap-3 mb-6">
                    {summaryItems.map((item) => (
                        <div
                            key={item}
                            className="flex items-center gap-1.5 bg-emerald-100 dark:bg-emerald-900/30 rounded-full px-4 py-1.5"
                        >
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                            <span className="text-xs sm:text-sm font-medium text-emerald-700 dark:text-emerald-300">
                                {item}
                            </span>
                        </div>
                    ))}
                </div>

                {/* Contact Info Section */}
                <div className="inline-block bg-slate-100 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/60 rounded-xl p-4 sm:p-5 mb-6 max-w-2xl">
                    <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 mb-2.5 font-medium">
                        For demo access, contact the SLTSERP project team
                    </p>
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-6">
                        <div className="flex items-center gap-2">
                            <Mail className="w-4 h-4 text-blue-500" />
                            <a href="mailto:sltserp@slt.lk" className="text-sm font-semibold text-blue-600 dark:text-blue-400 hover:underline">
                                sltserp@slt.lk
                            </a>
                        </div>
                        <div className="hidden sm:block w-px h-4 bg-slate-300 dark:bg-slate-600" />
                        <div className="flex items-center gap-2">
                            <Users className="w-4 h-4 text-emerald-500" />
                            <span className="text-xs sm:text-sm text-slate-700 dark:text-slate-400 font-medium">
                                Reach out to your regional OPMC coordinator
                            </span>
                        </div>
                    </div>
                </div>

                {/* CTA Buttons */}
                <div className="flex flex-wrap justify-center gap-3 sm:gap-4 mb-8">
                    <button
                        onClick={() => { w?.__sltserp_navigate?.(0); }}
                        className="btn-focus inline-flex items-center gap-2 px-6 py-2.5 rounded-lg bg-gradient-to-r from-blue-500 to-emerald-500 text-white font-semibold text-sm hover:opacity-95 transition-opacity shadow-lg cursor-pointer"
                    >
                        {w?.__sltserp_isLoggedIn ? "Go to ERP Dashboard" : "Log In to ERP Portal"}
                        <ArrowRight className="w-4 h-4" />
                    </button>
                    <button
                        onClick={() => { w?.__sltserp_navigate?.(0); }}
                        className="btn-focus inline-flex items-center gap-2 px-6 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 font-medium text-sm hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                    >
                        <Home className="w-4 h-4" />
                        Restart Presentation
                    </button>
                </div>

                {/* Thank You & Footer */}
                <div className="border-t border-slate-800/80 pt-4 max-w-xs mx-auto">
                    <h3 className="text-lg sm:text-xl font-extrabold bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent mb-1">
                        Thank You
                    </h3>
                    <p className="text-[10px] sm:text-xs text-slate-500 font-medium">
                        © 2026 SLTSERP • Sri Lanka Telecom Services
                    </p>
                </div>
            </div>
        </div>
    );
}
