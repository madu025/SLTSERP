/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React from "react";

export default function Slide20() {
    const kpis: any[] = [];
                                    return (
                                        <div className="flex flex-col h-full justify-center max-w-5xl mx-auto py-2 sm:py-6">
                                            {/* Chapter Header */}
                                            <div className="mb-6 sm:mb-8 text-center">
                                                <span className="inline-block px-3 py-1 rounded-full bg-purple-100 dark:bg-purple-900/40 text-xs font-medium text-purple-600 dark:text-purple-400 mb-3">
                                                    Managerial Insights
                                                </span>
                                                <h2 className="text-2xl sm:text-4xl font-bold">Analytics — KPI Dashboard</h2>
                                            </div>
    
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
