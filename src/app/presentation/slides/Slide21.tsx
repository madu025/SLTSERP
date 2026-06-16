"use client";

import React from "react";
import { CheckCircle2 } from "lucide-react";

export default function Slide21() {
    const features = [
        {
            title: "Budget Utilization Tracker",
            desc: "Instantly generates planned vs. actual project expense details to flag overruns.",
            icon: CheckCircle2
        },
        {
            title: "Contractor Rank & Waste Analysis",
            desc: "Audits contractor efficiency lists, logging task speed and wastage metrics.",
            icon: CheckCircle2
        },
        {
            title: "Regional Area Breakdowns",
            desc: "Groups metrics by OPMCs/RTOMs, highlighting areas with the highest backlog.",
            icon: CheckCircle2
        }
    ];
    const contractorRankings = [
        {
            rank: 1,
            name: "Lanka Tech Team A (Kandy)",
            efficiency: "95.8%",
            waste: "1.2%",
            color: "text-emerald-600 dark:text-emerald-400",
            bgColor: "bg-emerald-100/85 dark:bg-emerald-950/20"
        },
        {
            rank: 2,
            name: "Central OSP Builders",
            efficiency: "81.5%",
            waste: "4.8%",
            color: "text-amber-600 dark:text-amber-400",
            bgColor: "bg-amber-100/85 dark:bg-amber-950/20"
        }
    ];
                                    return (
                                        <div className="flex flex-col h-full justify-center max-w-5xl mx-auto py-2 sm:py-6">
                                            
    
                                            {/* Two Column Layout */}
                                            <div className="stagger-children grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                                                {/* Left: Features */}
                                                <div className="space-y-4">
                                                    {features.map((feature) => {
                                                        const Icon = feature.icon;
                                                        return (
                                                            <div
                                                                key={feature.title}
                                                                className="card-primary rounded-xl p-4 sm:p-5 flex items-start gap-3"
                                                            >
                                                                <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center">
                                                                    <CheckCircle2 className="w-4 h-4 text-blue-500" />
                                                                </div>
                                                                <div>
                                                                    <h3 className="font-semibold text-sm sm:text-base">{feature.title}</h3>
                                                                    <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-400 mt-0.5">
                                                                        {feature.desc}
                                                                    </p>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
    
                                                {/* Right: Demo Card */}
                                                <div className="card-analytics rounded-xl p-4 sm:p-5">
                                                    <div className="flex items-center justify-between mb-4">
                                                        <h3 className="font-bold text-sm sm:text-base">Kandy Region OSP Summary</h3>
                                                        <span className="text-xs text-slate-700 dark:text-slate-400">June 2026</span>
                                                    </div>
    
                                                    {/* 3 Small Stat Blocks */}
                                                    <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-4">
                                                        <div className="bg-slate-100 dark:bg-slate-900/40 rounded-lg p-2 sm:p-3 text-center">
                                                            <span className="block text-lg sm:text-2xl font-bold text-purple-500">8</span>
                                                            <span className="text-[10px] sm:text-xs text-slate-700 dark:text-slate-400">Projects</span>
                                                        </div>
                                                        <div className="bg-slate-100 dark:bg-slate-900/40 rounded-lg p-2 sm:p-3 text-center">
                                                            <span className="block text-lg sm:text-2xl font-bold text-emerald-500">92.4%</span>
                                                            <span className="text-[10px] sm:text-xs text-slate-700 dark:text-slate-400">Budget</span>
                                                        </div>
                                                        <div className="bg-slate-100 dark:bg-slate-900/40 rounded-lg p-2 sm:p-3 text-center">
                                                            <span className="block text-lg sm:text-2xl font-bold text-blue-500">74.2%</span>
                                                            <span className="text-[10px] sm:text-xs text-slate-700 dark:text-slate-400">Completion</span>
                                                        </div>
                                                    </div>
    
                                                    {/* Contractor Efficiency Rankings */}
                                                    <div className="border-t border-purple-200 dark:border-purple-700/40 pt-3">
                                                        <h4 className="text-xs font-semibold text-slate-700 dark:text-slate-400 uppercase tracking-wider mb-2">
                                                            Contractor Efficiency Rankings
                                                        </h4>
                                                        <div className="space-y-2">
                                                            {contractorRankings.map((c) => (
                                                                <div
                                                                    key={c.rank}
                                                                    className={`flex items-center justify-between rounded-lg p-2 sm:p-2.5 ${c.bgColor}`}
                                                                >
                                                                    <div className="flex items-center gap-2 min-w-0">
                                                                        <span className={`font-bold text-xs ${c.color}`}>{c.rank}.</span>
                                                                        <span className="text-xs sm:text-sm truncate text-slate-700 dark:text-slate-300">{c.name}</span>
                                                                    </div>
                                                                    <div className="flex items-center gap-2 flex-shrink-0">
                                                                        <span className={`text-xs font-semibold ${c.color}`}>{c.efficiency}</span>
                                                                        <span className="text-[10px] text-slate-700 dark:text-slate-400">
                                                                            ({c.waste} Waste)
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
}
