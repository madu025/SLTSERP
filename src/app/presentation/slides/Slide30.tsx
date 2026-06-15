"use client";

import React from "react";
import { FileSpreadsheet, Calculator, ClipboardCheck, Users, TrendingUp, Sparkles } from "lucide-react";

export default function Slide30() {
    const details = [
        {
            title: "Automated Calculation Engine",
            desc: "Computes Base Hire, Fuel Allowance, Overtime, Odometer Difference, and Deductions (Unapproved Absences / Excess Fuel usage) in seconds.",
            icon: Calculator,
            iconBg: "bg-blue-100 dark:bg-blue-900/40",
            iconColor: "text-blue-600 dark:text-blue-400"
        },
        {
            title: "Automated Excel Matcher",
            desc: "Translates and processes traditional Excel structure directly inside the ERP database. Fully compatible with SLTS monthly audit workflows.",
            icon: FileSpreadsheet,
            iconBg: "bg-emerald-100 dark:bg-emerald-900/40",
            iconColor: "text-emerald-600 dark:text-emerald-400"
        },
        {
            title: "Multi-Role Approval Pipeline",
            desc: "Rigorous workflow states: Draft, Under Review, Approved, and Rejected. Actions restricted to regional managers and finance administrators.",
            icon: Users,
            iconBg: "bg-purple-100 dark:bg-purple-900/40",
            iconColor: "text-purple-600 dark:text-purple-400"
        },
        {
            title: "Audit Logs & Compliance",
            desc: "Tracks every recalculation, modification, and approval signature. Prevents unauthorized rate modifications or duplicate billing entries.",
            icon: ClipboardCheck,
            iconBg: "bg-amber-100 dark:bg-amber-900/40",
            iconColor: "text-amber-600 dark:text-amber-400"
        }
    ];

    return (
        <div className="flex flex-col h-full justify-center max-w-6xl mx-auto py-2 sm:py-6 relative overflow-hidden">
            {/* Decorative Orbs */}
            <div className="absolute bottom-1/4 right-10 w-48 h-48 rounded-full bg-gradient-to-br from-emerald-400/5 to-teal-400/5 blur-3xl pointer-events-none" />

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center relative z-10">
                {/* Left Side: Features Cards Grid */}
                <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-4 order-last lg:order-first">
                    {details.map((item) => {
                        const Icon = item.icon;
                        return (
                            <div 
                                key={item.title} 
                                className="card-primary rounded-xl p-4 border border-slate-200/60 dark:border-slate-800/80 hover:scale-[1.02] transition-transform flex flex-col justify-between"
                            >
                                <div>
                                    <div className={`w-9 h-9 rounded-lg ${item.iconBg} flex items-center justify-center mb-3`}>
                                        <Icon className={`w-5 h-5 ${item.iconColor}`} />
                                    </div>
                                    <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100 mb-1.5">
                                        {item.title}
                                    </h3>
                                    <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                                        {item.desc}
                                    </p>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Right Side: Detail and Flow representation */}
                <div className="lg:col-span-5 flex flex-col justify-center space-y-4">
                    <div className="inline-flex items-center gap-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-full px-3 py-1 w-fit">
                        <Sparkles className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                        <span className="text-xs font-semibold text-emerald-800 dark:text-emerald-300">
                            Excel-Free Auditing
                        </span>
                    </div>
                    
                    <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">
                        Monthly Rental Payment Summaries
                    </h2>
                    
                    <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                        Say goodbye to complex spreadsheets. Our dynamic computation engine automatically aggregates daily duty logs and calculates vehicle leasing bills with zero math errors.
                    </p>

                    {/* Quick Metric highlight */}
                    <div className="bg-gradient-to-r from-blue-500/10 to-emerald-500/10 border border-blue-500/20 rounded-xl p-4 flex items-center gap-4">
                        <div className="bg-white dark:bg-slate-900 p-2.5 rounded-lg shadow-sm border border-slate-200/50 dark:border-slate-800">
                            <TrendingUp className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div>
                            <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider">Operational Efficiency</h4>
                            <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-snug mt-0.5">
                                Reconcile monthly vehicle logs and approve payments in under 5 minutes per vehicle.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
