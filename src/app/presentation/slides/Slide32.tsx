"use client";

import React from "react";
import { ShieldAlert, CheckSquare, Camera, Users, Lock, ChevronRight } from "lucide-react";

export default function Slide32() {
    const executionGains = [
        {
            title: "Template Snapshot Copying",
            desc: "When a new project is created, the system saves a copy of the assigned template. Future template edits do not affect ongoing projects, protecting historical compliance.",
            icon: Lock,
            iconBg: "bg-blue-100 dark:bg-blue-900/40",
            iconColor: "text-blue-600 dark:text-blue-400"
        },
        {
            title: "Quality Gate Blockers",
            desc: "Next-stage progression remains locked until all mandatory checklist points, OTDR reports, and GPS check-ins are verified by the system.",
            icon: ShieldAlert,
            iconBg: "bg-rose-100 dark:bg-rose-900/40",
            iconColor: "text-rose-600 dark:text-rose-400"
        },
        {
            title: "Verification Checklists",
            desc: "Configurable checkpoints enforce structural safety guidelines at the site, gating completion and reducing technical audit failures.",
            icon: CheckSquare,
            iconBg: "bg-emerald-100 dark:bg-emerald-900/40",
            iconColor: "text-emerald-600 dark:text-emerald-400"
        },
        {
            title: "Multi-Tier Approval Stepper",
            desc: "Provides regional coordinators, project managers, and finance officers with clear digital signature steps directly tied to completion milestones.",
            icon: Users,
            iconBg: "bg-amber-100 dark:bg-amber-900/40",
            iconColor: "text-amber-600 dark:text-amber-400"
        }
    ];

    return (
        <div className="flex flex-col h-full justify-center max-w-6xl mx-auto py-2 sm:py-6 relative overflow-hidden">
            <div className="absolute top-1/4 right-10 w-48 h-48 rounded-full bg-gradient-to-br from-emerald-400/5 to-teal-400/5 blur-3xl pointer-events-none" />
            
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center relative z-10">
                {/* Left Side: Detail and Flow representation */}
                <div className="lg:col-span-5 flex flex-col justify-center space-y-4">
                    <div className="inline-flex items-center gap-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-full px-3 py-1 w-fit">
                        <CheckSquare className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                        <span className="text-xs font-semibold text-emerald-800 dark:text-emerald-300">
                            Strict Compliance Control
                        </span>
                    </div>
                    
                    <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">
                        Workflow Snapshot & Execution Gating
                    </h2>
                    
                    <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                        Ensures absolute operational oversight. Standardizes field work by forcing verification proof submission and locking sequential execution until specifications are met.
                    </p>

                    <div className="bg-slate-50 dark:bg-slate-900/40 border dark:border-slate-800 p-3 rounded-lg flex items-center justify-between text-[11px] text-slate-500 font-medium">
                        <span className="flex items-center gap-1"><CheckSquare className="w-3.5 h-3.5 text-green-500" /> Checklist Done</span>
                        <ChevronRight className="w-3 h-3 text-slate-350" />
                        <span className="flex items-center gap-1"><Camera className="w-3.5 h-3.5 text-blue-500" /> Photos Logged</span>
                        <ChevronRight className="w-3 h-3 text-slate-350" />
                        <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5 text-amber-500" /> Approved</span>
                    </div>
                </div>

                {/* Right Side: Features Grid */}
                <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {executionGains.map((gain, idx) => (
                        <div
                            key={idx}
                            className="bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800/80 rounded-xl p-4 flex flex-col justify-between hover:shadow-md transition-shadow"
                        >
                            <div className="flex items-center gap-3 mb-2.5">
                                <div className={`p-2 rounded-lg ${gain.iconBg} ${gain.iconColor}`}>
                                    <gain.icon className="w-5 h-5" />
                                </div>
                                <h4 className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-200">
                                    {gain.title}
                                </h4>
                            </div>
                            <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                                {gain.desc}
                            </p>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
