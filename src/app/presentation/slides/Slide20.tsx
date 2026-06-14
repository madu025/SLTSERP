/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React from "react";

export default function Slide20() {
    const kpis = [
        { label: "Active Projects", number: "8", sublabel: "Ongoing regional developments", textColor: "text-slate-800 dark:text-slate-200" },
        { label: "Budget Cap Spent", number: "92.4%", sublabel: "Planned vs actual utilization", textColor: "text-emerald-600 dark:text-emerald-400" },
        { label: "Avg completion", number: "74.2%", sublabel: "Average milestone milestone completion rate", textColor: "text-blue-600 dark:text-blue-400" }
    ];
                                    return (
                                        <div className="flex flex-col h-full justify-center max-w-5xl mx-auto py-2 sm:py-6">
                                            
    
                                            {/* 3 Massive KPI Blocks */}
                                            <div className="stagger-children grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 max-w-4xl mx-auto">
                                                {kpis.map((kpi) => (
                                                    <div key={kpi.label} className="kpi-block">
                                                        <span className={`kpi-number ${kpi.textColor}`}>{kpi.number}</span>
                                                        <span className="kpi-label">{kpi.label}</span>
                                                        <span className="kpi-sublabel">{kpi.sublabel}</span>
                                                    </div>
                                                ))}
                                            </div>
    
                                            {/* Subtitle */}
                                            <p className="text-center text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-6 sm:mt-8 font-medium">
                                                Real-time executive metrics — auto-compiled from operational data
                                            </p>
                                        </div>
                                    );
}
