"use client";

import { CheckCircle2, X } from "lucide-react";

import React from "react";

export default function Slide3() {
    const oldProblems = [
        { title: "Scattered Excel Sheets", desc: "Service orders tracked in separate sheets, leading to data synchronization lag.", icon: X },
        { title: "Manual Stock Reconciliation", desc: "Warehouse stock issues and contractor usage recorded in different sheets, causing inventory discrepancies.", icon: X },
        { title: "Slow Audit Trials", desc: "Finding which contractor completed which job and what specific items they used takes days of manual email search.", icon: X }
    ];
    const newSolutions = [
        { title: "One Shared Database", desc: "Single source of truth. Updates to service orders or material stock instantly propagate to all departments.", icon: CheckCircle2 },
        { title: "Real-time Stock & Procurement Control", desc: "Warehouse stock issues and contractor allocations are verified and tracked against active project purchase orders.", icon: CheckCircle2 },
        { title: "Manager Analytics & Audits", desc: "Automated reports for project budgets, contractor performance rankings, and approvals backed by transactional logs.", icon: CheckCircle2 }
    ];
                    return (
                        <div className="flex flex-col h-full justify-center max-w-5xl mx-auto py-2 sm:py-6">
                            
    
                            {/* Two Column Comparison */}
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8">
                                {/* Left - Old Flow */}
                                <div>
                                    <div className="text-center mb-4">
                                        <h3 className="text-lg sm:text-xl font-bold text-rose-600 dark:text-rose-400">
                                            The Old Offline Flow
                                        </h3>
                                    </div>
                                    <div className="stagger-children space-y-3">
                                        {oldProblems.map((item) => {
                                            const Icon = item.icon;
                                            return (
                                                <div
                                                    key={item.title}
                                                    className="card-critical rounded-xl p-4 sm:p-5"
                                                >
                                                    <div className="flex items-start gap-3">
                                                        <div className="w-9 h-9 rounded-lg bg-rose-100 dark:bg-rose-900/40 flex items-center justify-center flex-shrink-0">
                                                            <Icon className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                                                        </div>
                                                        <div>
                                                            <h4 className="font-semibold text-sm sm:text-base">{item.title}</h4>
                                                            <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-400 mt-0.5">
                                                                {item.desc}
                                                            </p>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
    
                                {/* Right - New Flow */}
                                <div>
                                    <div className="text-center mb-4">
                                        <h3 className="text-lg sm:text-xl font-bold text-emerald-600 dark:text-emerald-400">
                                            The Central ERP Flow
                                        </h3>
                                    </div>
                                    <div className="stagger-children space-y-3">
                                        {newSolutions.map((item) => {
                                            const Icon = item.icon;
                                            return (
                                                <div
                                                    key={item.title}
                                                    className="card-success rounded-xl p-4 sm:p-5"
                                                >
                                                    <div className="flex items-start gap-3">
                                                        <div className="w-9 h-9 rounded-lg bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center flex-shrink-0">
                                                            <Icon className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                                                        </div>
                                                        <div>
                                                            <h4 className="font-semibold text-sm sm:text-base">{item.title}</h4>
                                                            <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-400 mt-0.5">
                                                                {item.desc}
                                                            </p>
                                                        </div>
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
