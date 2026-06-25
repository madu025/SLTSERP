"use client";
import React from "react";
import { FileSpreadsheet, ArrowRight, Clock, AlertTriangle, CheckCircle2, Gauge, Wallet } from "lucide-react";

export default function Slide5() {
    return (
        <div className="flex flex-col h-full justify-center max-w-6xl mx-auto py-2">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
                
                {/* Left: Content */}
                <div className="lg:col-span-5 space-y-4">
                    <div className="flex items-center gap-2">
                        <span className="bg-blue-500/15 p-1.5 rounded-lg text-blue-400">
                            <FileSpreadsheet className="w-5 h-5" />
                        </span>
                        <span className="text-xs font-bold text-blue-400 uppercase tracking-wider">
                            SOD: Completion & Contractor Payouts
                        </span>
                    </div>
                    <h2 className="text-2xl sm:text-3xl font-extrabold bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent leading-tight">
                        Completion & Payouts
                    </h2>
                    <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                        Once an SOD is <strong className="text-white">PAT Passed</strong> (Post Installation Test), the system generates the contractor invoice automatically.
                    </p>
                    <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                        SLTS Nexus collects <strong className="text-emerald-400">fixed revenue from SLT</strong> per SOD. The contractor payment is calculated separately based on <strong className="text-white">drop wire distance</strong> (Rs. 3,500 – 6,500).
                    </p>

                    {/* Key Points */}
                    <div className="space-y-2">
                        <div className="flex items-center gap-2.5 bg-slate-900/60 border border-slate-800 rounded-lg p-2.5">
                            <Wallet className="w-4 h-4 text-green-400 flex-shrink-0" />
                            <div>
                                <p className="text-[11px] font-bold text-white">90% — Part A (Pay Now)</p>
                                <p className="text-[9px] text-slate-500">Paid immediately after PAT passes</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2.5 bg-slate-900/60 border border-amber-800/50 rounded-lg p-2.5">
                            <Clock className="w-4 h-4 text-amber-400 flex-shrink-0" />
                            <div>
                                <p className="text-[11px] font-bold text-amber-300">10% — Part B (Held 6 Months)</p>
                                <p className="text-[9px] text-slate-500">Retention released after defect liability period</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2.5 bg-slate-900/60 border border-red-800/40 rounded-lg p-2.5">
                            <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
                            <div>
                                <p className="text-[11px] font-bold text-red-300">Deductions Apply</p>
                                <p className="text-[9px] text-slate-500">Material mismatch / SLT line failures = penalty</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right: Payout Panel */}
                <div className="lg:col-span-7 bg-slate-950/80 border border-slate-800 rounded-2xl p-5 shadow-2xl space-y-3">
                    {/* Window chrome */}
                    <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                        <span className="text-[10px] font-mono text-slate-500">Contractor Invoice Calculator</span>
                        <span className="text-[9px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/15">PAT Passed ✓</span>
                    </div>

                    {/* Vector: Contractor Payout Flow */}
                    <div className="mb-1">
                        <svg viewBox="0 0 400 55" className="w-full h-14 opacity-65" xmlns="http://www.w3.org/2000/svg">
                            {/* SLT Revenue (top left, small) */}
                            <rect x="10" y="5" width="80" height="18" rx="3" fill="#3b82f6" opacity="0.2" stroke="#60a5fa" strokeWidth="0.5" />
                            <text x="50" y="17" textAnchor="middle" fill="#93c5fd" fontSize="5" fontWeight="bold">SLT Revenue (Fixed)</text>
                            {/* Arrow down to contractor box */}
                            <line x1="50" y1="23" x2="50" y2="35" stroke="#475569" strokeWidth="0.5" />
                            {/* Contractor amount box (main) */}
                            <rect x="80" y="28" width="100" height="20" rx="4" fill="#f59e0b" opacity="0.2" stroke="#fbbf24" strokeWidth="0.8" />
                            <text x="130" y="36" textAnchor="middle" fill="#fcd34d" fontSize="5" fontWeight="bold">Distance-based</text>
                            <text x="130" y="44" textAnchor="middle" fill="#fcd34d" fontSize="5">Rs. 3,500 – 6,500</text>
                            
                            {/* Arrow to split */}
                            <line x1="180" y1="38" x2="210" y2="38" stroke="#475569" strokeWidth="1" />
                            <polygon points="210,38 204,35 204,41" fill="#475569" />
                            
                            {/* Split point */}
                            <circle cx="220" cy="38" r="4" fill="#8b5cf6" opacity="0.5" />
                            <text x="220" y="41" textAnchor="middle" fill="#c4b5fd" fontSize="5">÷</text>
                            
                            {/* Part A (90%) - upper branch */}
                            <line x1="224" y1="34" x2="260" y2="18" stroke="#10b981" strokeWidth="1.5" />
                            <rect x="262" y="8" width="65" height="22" rx="4" fill="#10b981" opacity="0.2" stroke="#34d399" strokeWidth="0.8" />
                            <text x="294" y="17" textAnchor="middle" fill="#6ee7b7" fontSize="6" fontWeight="bold">Part A (90%)</text>
                            <text x="294" y="26" textAnchor="middle" fill="#6ee7b7" fontSize="5">Pay Now ✓</text>
                            
                            {/* Part B (10%) - lower branch */}
                            <line x1="224" y1="42" x2="260" y2="50" stroke="#f59e0b" strokeWidth="1.5" />
                            <rect x="262" y="38" width="80" height="16" rx="4" fill="#f59e0b" opacity="0.15" stroke="#fbbf24" strokeWidth="0.5" />
                            <text x="275" y="49" textAnchor="middle" fill="#fcd34d" fontSize="5" fontWeight="bold">Part B (10%)</text>
                            <text x="330" y="49" textAnchor="middle" fill="#fcd34d" fontSize="4">🔒 Held 6m</text>
                            
                            {/* After 6 months arrow */}
                            <line x1="342" y1="50" x2="360" y2="38" stroke="#475569" strokeWidth="0.8" />
                            <rect x="360" y="28" width="35" height="20" rx="3" fill="#ef4444" opacity="0.15" stroke="#f87171" strokeWidth="0.5" />
                            <text x="377" y="36" textAnchor="middle" fill="#fca5a5" fontSize="4">Deduct</text>
                            <text x="377" y="43" textAnchor="middle" fill="#fca5a5" fontSize="3">Penalty</text>
                        </svg>
                    </div>

                    {/* Drop Wire Distance → Payment Calculator */}
                    <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-3">
                        <div className="flex items-center gap-2 mb-2">
                            <Gauge className="w-3.5 h-3.5 text-blue-400" />
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Drop Wire Distance → Payment</span>
                        </div>
                        {/* Distance Slider Visual */}
                        <div className="relative h-2 bg-slate-800 rounded-full overflow-hidden mb-2">
                            <div className="absolute inset-0 bg-gradient-to-r from-blue-500 via-amber-500 to-emerald-500 opacity-40" />
                            <div className="absolute top-0 left-[65%] w-3 h-3 rounded-full bg-white shadow-lg border-2 border-blue-400 -translate-y-0.5" />
                        </div>
                        <div className="flex justify-between text-[8px] text-slate-500 font-mono">
                            <span>0m</span>
                            <span>50m: Rs. 3,500</span>
                            <span>100m: Rs. 4,800</span>
                            <span>150m: Rs. 6,500</span>
                            <span className="text-amber-400 font-bold bg-amber-500/10 px-1.5 py-0.5 rounded">▶ Rs. 100,000</span>
                        </div>
                    </div>

                    {/* Part A & Part B Cards */}
                    <div className="grid grid-cols-2 gap-3">
                        {/* Part A */}
                        <div className="bg-emerald-500/5 border border-emerald-500/25 rounded-xl p-3 space-y-1">
                            <div className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-400 uppercase tracking-wider">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>Part A (90%)</span>
                            </div>
                            <p className="font-mono font-extrabold text-lg text-emerald-400">Rs. 90,000.00</p>
                            <span className="text-[9px] bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded border border-emerald-500/20">Released Immediately</span>
                        </div>

                        {/* Part B */}
                        <div className="bg-amber-500/5 border border-amber-500/25 rounded-xl p-3 space-y-1">
                            <div className="flex items-center gap-1.5 text-[10px] font-bold text-amber-400 uppercase tracking-wider">
                                <Clock className="w-3.5 h-3.5" />
                                <span>Part B (10%)</span>
                            </div>
                            <p className="font-mono font-extrabold text-lg text-amber-400">Rs. 10,000.00</p>
                            <span className="text-[9px] bg-amber-500/10 text-amber-400 px-2 py-0.5 rounded border border-amber-500/20">
                                🔒 Held — 6 months
                            </span>
                        </div>
                    </div>

                    {/* Retention Release Note */}
                    <div className="bg-slate-900/40 border border-slate-800 rounded-lg p-2.5 space-y-1.5 text-xs">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">🔄 Retention Release (After 6 Months)</p>
                        <div className="flex justify-between text-slate-400">
                            <span>Part B Held:</span>
                            <span className="font-mono text-white">Rs. 10,000.00</span>
                        </div>
                        <div className="flex justify-between text-red-400">
                            <span className="flex items-center gap-1">
                                <AlertTriangle className="w-3 h-3" />
                                Material Mismatch (ODC):
                            </span>
                            <span className="font-mono">- Rs. 2,500.00</span>
                        </div>
                        <div className="flex justify-between text-red-400">
                            <span className="flex items-center gap-1">
                                <AlertTriangle className="w-3 h-3" />
                                SLT Line Fail Penalty:
                            </span>
                            <span className="font-mono">- Rs. 1,500.00</span>
                        </div>
                        <div className="flex justify-between border-t border-slate-800 pt-1.5 text-emerald-400 font-bold">
                            <span>Final Part B Release:</span>
                            <span className="font-mono">Rs. 6,000.00</span>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
}