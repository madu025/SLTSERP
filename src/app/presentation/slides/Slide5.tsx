"use client";

import React from "react";
import { Zap, Save, Pencil } from "lucide-react";

export default function Slide5() {
    const tableData = [
        { so: "SO-2026-0812", customer: "P. K. Silva, Kandy", contractor: "Lanka Tech Team A", comments: "Waiting for OSP path" },
        { so: "SO-2026-0813", customer: "A. G. Perera, Gampaha", contractor: "Select Team...", comments: "ONT swap required" }
    ];
    const statusDots = [
        { label: "Saving", color: "bg-blue-500" },
        { label: "Saved", color: "bg-emerald-500" },
        { label: "ERR", color: "bg-rose-500" }
    ];
                    return (
                        <div className="flex flex-col h-full justify-center max-w-5xl mx-auto py-2 sm:py-6">
                            
    
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8">
                                {/* Left - Description & Features */}
                                <div className="flex flex-col justify-center">
                                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-xs font-medium text-emerald-700 dark:text-emerald-400 mb-4 w-fit">
                                        <Zap className="w-3 h-3" />
                                        Built for speed
                                    </span>
                                    <p className="text-sm sm:text-base text-slate-700 dark:text-slate-300 mb-6">
                                        Edit service orders in a familiar spreadsheet interface — no page reloads, no modals, just cells.
                                    </p>
    
                                    <div className="space-y-4">
                                        <div className="flex items-start gap-3">
                                            <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center flex-shrink-0">
                                                <Pencil className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                                            </div>
                                            <div>
                                                <h4 className="font-semibold text-sm sm:text-base">Inline Field Editing</h4>
                                                <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-400">
                                                    Select any cell to make rapid adjustments, utilizing standard spreadsheet navigation.
                                                </p>
                                            </div>
                                        </div>

                                        <div className="flex items-start gap-3">
                                            <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center flex-shrink-0">
                                                <Save className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                                            </div>
                                            <div>
                                                <h4 className="font-semibold text-sm sm:text-base">Auto-Save States</h4>
                                                <div className="flex items-center gap-3 mt-1.5">
                                                    {statusDots.map((dot) => (
                                                        <span key={dot.label} className="inline-flex items-center gap-1.5 text-xs text-slate-700 dark:text-slate-400">
                                                            <span className={`w-2 h-2 rounded-full ${dot.color}`} />
                                                            {dot.label}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
    
                                {/* Right - Table Mockup */}
                                <div>
                                    {/* Desktop Table */}
                                    <div className="desktop-table">
                                        <div className="card-primary rounded-xl overflow-hidden">
                                            <div className="p-4 border-b border-slate-200 dark:border-slate-700">
                                                <h4 className="font-semibold text-sm">Service Orders</h4>
                                            </div>
                                            <div className="overflow-x-auto">
                                                <table className="w-full text-xs sm:text-sm">
                                                    <thead>
                                                        <tr className="bg-slate-100 dark:bg-slate-800/50">
                                                            <th className="text-left p-3 font-medium text-slate-700 dark:text-slate-300">SO Number</th>
                                                            <th className="text-left p-3 font-medium text-slate-700 dark:text-slate-300">Customer Details</th>
                                                            <th className="text-left p-3 font-medium text-slate-700 dark:text-slate-300">Contractor</th>
                                                            <th className="text-left p-3 font-medium text-slate-700 dark:text-slate-300">Comments</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {tableData.map((row) => (
                                                            <tr key={row.so} className="border-t border-slate-100 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800/30">
                                                                <td className="p-3 font-mono text-xs">{row.so}</td>
                                                                <td className="p-3">{row.customer}</td>
                                                                <td className="p-3">{row.contractor}</td>
                                                                <td className="p-3 text-slate-700 dark:text-slate-400">{row.comments}</td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    </div>
    
                                    {/* Mobile Cards */}
                                    <div className="mobile-card-row space-y-3">
                                        {tableData.map((row) => (
                                            <div key={row.so} className="card-primary rounded-xl p-4">
                                                <div className="flex items-center justify-between mb-2">
                                                    <span className="font-mono text-xs font-semibold text-blue-600 dark:text-blue-400">{row.so}</span>
                                                        <span className="text-xs text-slate-700 dark:text-slate-400">{row.contractor}</span>
                                                </div>
                                                <p className="text-sm font-medium">{row.customer}</p>
                                                <p className="text-xs text-slate-700 dark:text-slate-400 mt-1">{row.comments}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
}
