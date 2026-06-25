"use client";
import React from "react";
import { FolderTree, DollarSign, AlertTriangle } from "lucide-react";

export default function Slide8() {
    return (
        <div className="flex flex-col h-full justify-center max-w-6xl mx-auto py-2">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
                
                {/* Left: Content */}
                <div className="lg:col-span-5 space-y-4">
                    <div className="flex items-center gap-2">
                        <span className="bg-blue-500/15 p-1.5 rounded-lg text-blue-400">
                            <FolderTree className="w-5 h-5" />
                        </span>
                        <span className="text-xs font-bold text-blue-400 uppercase tracking-wider">
                            OSP Inner: Budget & Cost
                        </span>
                    </div>
                    <h2 className="text-2xl sm:text-3xl font-extrabold bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent leading-tight">
                        Budget & Cost Tracking
                    </h2>
                    <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                        To prevent financial leakages, this inner module performs real-time financial tracking for projects.
                    </p>
                    <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                        Managers log the <strong className="text-white">Estimated Budget</strong>. The system automatically rolls up physical materials issued and contractor claims approved to show a live cost-to-budget graph.
                    </p>
                </div>

                {/* Right: Budget tracking visualization mockup */}
                <div className="lg:col-span-7 bg-slate-950/80 border border-slate-800 rounded-2xl p-5 shadow-2xl space-y-4">
                    {/* Window chrome */}
                    <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                        <div className="flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
                            <span className="w-2.5 h-2.5 rounded-full bg-yellow-500" />
                            <span className="w-2.5 h-2.5 rounded-full bg-green-500" />
                        </div>
                        <span className="text-[10px] font-mono text-slate-500">Project Financial Ledger</span>
                    </div>

                    {/* Summary row */}
                    <div className="grid grid-cols-2 gap-3 text-xs">
                        <div className="bg-slate-900/40 border border-slate-850 rounded-xl p-3">
                            <p className="text-[9px] text-slate-500 uppercase tracking-wider">Total Allocated Budget</p>
                            <p className="text-sm font-bold text-white mt-1">LKR 12.0M</p>
                        </div>
                        <div className="bg-slate-900/40 border border-slate-850 rounded-xl p-3">
                            <p className="text-[9px] text-slate-500 uppercase tracking-wider">Total Actual Cost</p>
                            <p className="text-sm font-bold text-amber-400 mt-1">LKR 10.2M</p>
                        </div>
                    </div>

                    {/* Vector: Budget Gauge */}
                    <div className="mb-1">
                        <svg viewBox="0 0 400 45" className="w-full h-12 opacity-65" xmlns="http://www.w3.org/2000/svg">
                            {/* Gauge arc */}
                            <path d="M50,38 A130,130 0 0,1 350,38" fill="none" stroke="#334155" strokeWidth="6" strokeLinecap="round" />
                            {/* Colored arc segments */}
                            <path d="M50,38 A130,130 0 0,1 150,10" fill="none" stroke="#10b981" strokeWidth="5" strokeLinecap="round" opacity="0.6" />
                            <path d="M150,10 A130,130 0 0,1 260,6" fill="none" stroke="#f59e0b" strokeWidth="5" strokeLinecap="round" opacity="0.6" />
                            <path d="M260,6 A130,130 0 0,1 350,38" fill="none" stroke="#ef4444" strokeWidth="5" strokeLinecap="round" opacity="0.6" />
                            {/* Needle */}
                            <line x1="200" y1="38" x2="285" y2="14" stroke="#fbbf24" strokeWidth="1.5" />
                            <circle cx="200" cy="38" r="4" fill="#fbbf24" opacity="0.6" />
                            {/* Labels */}
                            <text x="80" y="30" fill="#6ee7b7" fontSize="5">Safe</text>
                            <text x="195" y="6" fill="#fcd34d" fontSize="5">Warn</text>
                            <text x="330" y="30" fill="#fca5a5" fontSize="5">Over</text>
                            <text x="200" y="43" textAnchor="middle" fill="#fbbf24" fontSize="7" fontWeight="bold">85%</text>
                        </svg>
                    </div>
                    {/* Warning Meter */}
                    <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-3.5 space-y-2">
                        <div className="flex justify-between items-center text-xs">
                            <div className="flex items-center gap-1.5 text-amber-400 font-bold">
                                <AlertTriangle className="w-4 h-4" />
                                <span>Budget Warning: 85% Exceeded</span>
                            </div>
                            <span className="font-mono text-[11px] font-bold text-white">85.0%</span>
                        </div>
                        
                        {/* Progress slider bar */}
                        <div className="w-full h-3 bg-slate-900 border border-slate-800 rounded-full overflow-hidden">
                            <div className="h-full bg-gradient-to-r from-blue-500 via-amber-500 to-red-500" style={{ width: "85%" }} />
                        </div>
                    </div>

                    {/* Cost breakdown */}
                    <div className="space-y-1.5 text-[10px] font-mono text-slate-400">
                        <div className="flex justify-between border-b border-slate-900 pb-1">
                            <span>• Contractor Work Claims Approved:</span>
                            <span className="text-slate-200">LKR 7,500,000</span>
                        </div>
                        <div className="flex justify-between border-b border-slate-900 pb-1">
                            <span>• Warehouse Materials Issued:</span>
                            <span className="text-slate-200">LKR 2,700,000</span>
                        </div>
                        <div className="flex justify-between border-b border-slate-900 pb-1">
                            <span>• Estimated Future Claims:</span>
                            <span className="text-slate-500">LKR 1,800,000</span>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
}
