/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React from "react";

export default function Slide26() {
    const kpis: any[] = [];
                                    return (
                                        <div className="flex flex-col h-full justify-center max-w-5xl mx-auto py-2 sm:py-6">
                                            {/* Chapter Header */}
                                            <div className="mb-6 sm:mb-8 text-center">
                                                <span className="inline-block px-3 py-1 rounded-full bg-amber-100 dark:bg-amber-900/40 text-xs font-medium text-amber-600 dark:text-amber-400 mb-3">
                                                    Business Value
                                                </span>
                                                <h2 className="text-2xl sm:text-4xl font-bold">ROI &amp; Business Impact</h2>
                                            </div>
    
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
