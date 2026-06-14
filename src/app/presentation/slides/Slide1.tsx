/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React from "react";
import { Shield } from "lucide-react";

export default function Slide1() {
    const roles = [
        { title: "Operations Team", icon: "📋", desc: "Service Order Sheets" },
        { title: "OSP Projects", icon: "📁", desc: "WBS & Task Schedules" },
        { title: "Store Keepers", icon: "🏭", desc: "Warehouse GRN & Stock" },
        { title: "Contractor Teams", icon: "👷", desc: "Job Completion Logs" },
        { title: "OSP Managers", icon: "👔", desc: "Analytics, Budgets & Audits" }
    ];
                    return (
                        <div className="flex flex-col h-full justify-center max-w-5xl mx-auto py-2 sm:py-6">
                            
    
                            {/* Role Cards Grid */}
                            <div className="stagger-children grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
                                {roles.map((role) => (
                                    <div
                                        key={role.title}
                                        className="card-primary rounded-xl p-4 sm:p-5 text-center cursor-pointer transition-transform hover:scale-105 hover:shadow-lg"
                                    >
                                        <div className="text-3xl sm:text-4xl mb-2">{role.icon}</div>
                                        <h3 className="font-semibold text-sm sm:text-base mb-1">{role.title}</h3>
                                        <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-400">{role.desc}</p>
                                    </div>
                                ))}
                            </div>
    
                            {/* Navigation Hint */}
                            <div className="text-center mt-8 sm:mt-10">
                                <button
                                    onClick={() => { if (typeof window !== "undefined" && (window as any).__sltserp_navigate) (window as any).__sltserp_navigate(0); }}
                                    className="btn-focus inline-flex items-center gap-2 px-6 py-2.5 rounded-lg bg-gradient-to-r from-blue-500 to-emerald-500 text-white font-medium text-sm hover:opacity-90 transition-opacity"
                                >
                                    Explore the Platform →
                                </button>
                            </div>
                        </div>
                    );
}
