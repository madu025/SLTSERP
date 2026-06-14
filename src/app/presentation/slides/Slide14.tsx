/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React from "react";
import { Check, CheckCircle2, Clock, Lock, ShieldAlert } from "lucide-react";

export default function Slide14() {
    const closurePoints = [
        "All tasks at 100% = Closure eligible",
        "Auto-generates closure PDF report",
        "Locks project from further edits"
    ];
    const retentionFeatures = [
        {
            title: "Retention Percentage",
            desc: "Configurable per contract (e.g., 5% or 10% held).",
            icon: ShieldAlert
        },
        {
            title: "Defect Liability",
            desc: "Warranty window tracking for automated release.",
            icon: Clock
        },
        {
            title: "Release Workflows",
            desc: "Manual overrides, early release, or extensions.",
            icon: Check
        }
    ];
                                    return (
                                        <div className="flex flex-col h-full justify-center max-w-5xl mx-auto py-2 sm:py-6">
                                            
    
                                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8">
                                                {/* Left - Project Closure */}
                                                <div className="card-success rounded-xl p-5 sm:p-6 border flex flex-col justify-center">
                                                    <div className="flex items-center gap-3 mb-4">
                                                        <span className="inline-block px-2.5 py-0.5 rounded-full bg-emerald-600 text-white text-xs font-bold tracking-wider">
                                                            CLOSE
                                                        </span>
                                                        <h3 className="font-semibold text-lg sm:text-xl">Formalize Handover</h3>
                                                    </div>
                                                    <p className="text-sm sm:text-base text-slate-700 dark:text-slate-300 mb-5">
                                                        Systematic project closure ensures all deliverables are verified and formally handed over with complete documentation.
                                                    </p>
                                                    <div className="space-y-3">
                                                        {closurePoints.map((point) => (
                                                            <div key={point} className="flex items-center gap-2.5">
                                                                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                                                                <span className="text-sm sm:text-base font-mono font-medium">{point}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
    
                                                {/* Right - Retention Management */}
                                                <div className="card-warning rounded-xl p-5 sm:p-6 border flex flex-col justify-center">
                                                    <div className="flex items-center gap-3 mb-4">
                                                        <Lock className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                                                        <h3 className="font-semibold text-lg sm:text-xl">Retention Management</h3>
                                                    </div>
                                                    <p className="text-sm sm:text-base text-slate-700 dark:text-slate-300 mb-5">
                                                        Hold back a percentage of payment until the defect liability period is satisfied, then release through defined workflows.
                                                    </p>
                                                    <div className="space-y-3">
                                                        {retentionFeatures.map((feat) => {
                                                            const Icon = feat.icon;
                                                            return (
                                                                <div key={feat.title} className="flex items-start gap-2.5">
                                                                    <span className="w-5 h-5 rounded-full bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center flex-shrink-0 mt-0.5">
                                                                        <Icon className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                                                                    </span>
                                                                    <div>
                                                                        <span className="text-sm font-semibold">{feat.title}</span>
                                                                        <span className="text-sm text-slate-700 dark:text-slate-400"> — {feat.desc}</span>
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
}
