/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React from "react";

export default function Slide26() {
    const kpis = [
        { label: "Admin Overhead", number: "-40%", sublabel: "Less time spent chasing sheets", textColor: "text-rose-500" },
        { label: "Billing Cycles", number: "-75%", sublabel: "Auto-split & report compile time", textColor: "text-emerald-500" },
        { label: "Audit Resolution", number: "-90%", sublabel: "Traceability search reduction", textColor: "text-blue-500" },
        { label: "Data Accuracy", number: "99.9%", sublabel: "System validation blocks", textColor: "text-purple-500" }
    ];
                                    return (
                                        <div className="flex flex-col h-full justify-center max-w-5xl mx-auto py-2 sm:py-6">
                                            
    
                                            {/* 4 KPI Blocks in 2x2 Grid */}
                                            <div className="stagger-children grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 max-w-3xl mx-auto">
                                                {kpis.map((kpi) => (
                                                    <div key={kpi.label} className="kpi-block">
                                                        <span className={`kpi-number ${kpi.textColor}`}>{kpi.number}</span>
                                                        <span className="kpi-label">{kpi.label}</span>
                                                        <span className="kpi-sublabel">{kpi.sublabel}</span>
                                                    </div>
                                                ))}
                                            </div>
    
                                            {/* Disclaimer */}
                                            <p className="text-center text-[10px] sm:text-xs text-slate-400 dark:text-slate-500 mt-6 sm:mt-8 font-medium">
                                                Estimated improvements based on operational benchmarks
                                            </p>
                                        </div>
                                    );
}
