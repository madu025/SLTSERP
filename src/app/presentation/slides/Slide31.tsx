"use client";

import React from "react";
import { Workflow, Settings, ShieldCheck, ChevronRight, Activity, Database } from "lucide-react";

export default function Slide31() {
    const designerFeatures = [
        {
            title: "Drag & Drop Stage Builder",
            desc: "Administrators can reorder, add, or remove OSP pipeline stages (e.g. Survey, Splicing, OTDR, QA) instantly via a visual design grid.",
            icon: Workflow,
            iconBg: "bg-blue-100 dark:bg-blue-900/40",
            iconColor: "text-blue-600 dark:text-blue-400"
        },
        {
            title: "Configurable Quality Gates",
            desc: "Define strict completion rules for each stage (e.g. require multi-level approvals, photo uploads, or GPS coordinates).",
            icon: Settings,
            iconBg: "bg-emerald-100 dark:bg-emerald-900/40",
            iconColor: "text-emerald-600 dark:text-emerald-400"
        },
        {
            title: "Conditional Stage Execution",
            desc: "Skip or require specific stages dynamically depending on site parameters (e.g., skip 'Permit Stage' if no municipal authorization is required).",
            icon: Activity,
            iconBg: "bg-amber-100 dark:bg-amber-900/40",
            iconColor: "text-amber-600 dark:text-amber-400"
        },
        {
            title: "Plugin Module Attachments",
            desc: "Attach specialized tools directly to stages, such as OTDR result logs, material requests (MRNs), and site inspection (IR/NCR) checklists.",
            icon: Database,
            iconBg: "bg-purple-100 dark:bg-purple-900/40",
            iconColor: "text-purple-600 dark:text-purple-400"
        }
    ];

    return (
        <div className="flex flex-col h-full justify-center max-w-6xl mx-auto py-2 sm:py-6 relative overflow-hidden">
            <div className="absolute top-1/4 left-10 w-48 h-48 rounded-full bg-gradient-to-br from-blue-400/5 to-purple-400/5 blur-3xl pointer-events-none" />
            
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center relative z-10">
                {/* Left Side: General Overview */}
                <div className="lg:col-span-5 flex flex-col justify-center space-y-4">
                    <div className="inline-flex items-center gap-2 bg-blue-100 dark:bg-blue-900/30 rounded-full px-3 py-1 w-fit">
                        <ShieldCheck className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                        <span className="text-xs font-semibold text-blue-800 dark:text-blue-300">
                            Enterprise Governance
                        </span>
                    </div>
                    
                    <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">
                        Dynamic OSP Workflow Builder
                    </h2>
                    
                    <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                        Enables the SLTSERP system to dynamically orchestrate Outside Plant (OSP) deployments without hardcoded business rules. Administrators manage stages, tasks, and gates tailored to each deployment.
                    </p>

                    <div className="hidden lg:flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                        <span>Stages Flow</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                        <span className="bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-[10px]">Survey</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                        <span className="bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-[10px]">Civil</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                        <span className="bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-[10px]">Splicing</span>
                    </div>
                </div>

                {/* Right Side: Features Grid */}
                <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {designerFeatures.map((feat, idx) => (
                        <div
                            key={idx}
                            className="bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800/80 rounded-xl p-4 flex flex-col justify-between hover:shadow-md transition-shadow"
                        >
                            <div className="flex items-center gap-3 mb-2.5">
                                <div className={`p-2 rounded-lg ${feat.iconBg} ${feat.iconColor}`}>
                                    <feat.icon className="w-5 h-5" />
                                </div>
                                <h4 className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-200">
                                    {feat.title}
                                </h4>
                            </div>
                            <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                                {feat.desc}
                            </p>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
