"use client";

import React from "react";
import { AlertCircle, CheckCircle2, ArrowRight, TrendingDown } from "lucide-react";

export default function Slide2() {
    const roiMetrics = [
        { label: "Admin Overhead", value: "-40%", color: "text-rose-400", desc: "Less time chasing sheets" },
        { label: "Billing Cycles", value: "-75%", color: "text-emerald-400", desc: "Auto-split & report compile" },
        { label: "Audit Resolution", value: "-90%", color: "text-blue-400", desc: "Traceability search" },
        { label: "Data Accuracy", value: "99.9%", color: "text-purple-400", desc: "System validation blocks" },
    ];

    return (
        <div className="flex flex-col h-full justify-center max-w-4xl mx-auto py-2 sm:py-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative text-xs sm:text-sm">
                
                {/* Vector: Growth Arrow Chart */}
                <div className="col-span-full mb-2 flex justify-center">
                    <svg viewBox="0 0 400 50" className="w-full max-w-md h-16 opacity-65" xmlns="http://www.w3.org/2000/svg">
                        <defs>
                            <linearGradient id="g2red" x1="0%" y1="0%" x2="0%" y2="100%">
                                <stop offset="0%" stopColor="#ef4444" stopOpacity="0.6" />
                                <stop offset="100%" stopColor="#ef4444" stopOpacity="0" />
                            </linearGradient>
                            <linearGradient id="g2green" x1="0%" y1="0%" x2="0%" y2="100%">
                                <stop offset="0%" stopColor="#10b981" stopOpacity="0.6" />
                                <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
                            </linearGradient>
                        </defs>
                        {/* Red descending line */}
                        <polyline points="30,8 80,15 130,22 180,35" fill="none" stroke="#ef4444" strokeWidth="2" />
                        <polygon points="180,35 170,28 175,38" fill="#ef4444" />
                        <text x="30" y="48" fill="#ef4444" fontSize="7" fontWeight="bold" fontFamily="monospace">OLD</text>
                        {/* Arrow */}
                        <line x1="195" y1="25" x2="215" y2="25" stroke="#f59e0b" strokeWidth="1.5" markerEnd="url(#arrow2)" />
                        <defs><marker id="arrow2" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,0 L10,5 L0,10 Z" fill="#f59e0b" /></marker></defs>
                        {/* Green ascending line */}
                        <polyline points="230,35 275,22 330,12 370,8" fill="none" stroke="#10b981" strokeWidth="2.5" />
                        <polygon points="370,8 360,3 363,15" fill="#10b981" />
                        <text x="320" y="48" fill="#10b981" fontSize="7" fontWeight="bold" fontFamily="monospace">SLTS NEXUS</text>
                        {/* Area fills */}
                        <polygon points="30,8 80,15 130,22 180,35 180,45 130,45 80,45 30,45" fill="url(#g2red)" />
                        <polygon points="230,35 275,22 330,12 370,8 370,45 330,45 275,45 230,45" fill="url(#g2green)" />
                    </svg>
                </div>
                {/* Before Card */}
                <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-5">
                    <div className="flex items-center gap-2 mb-3 border-b border-red-500/10 pb-2">
                        <AlertCircle className="w-5 h-5 text-red-400" />
                        <h3 className="font-bold text-red-200">❌ The Old Way (Before)</h3>
                    </div>
                    <ul className="space-y-3.5 text-slate-400">
                        <li className="flex gap-2">
                            <span className="text-red-400 font-bold">•</span>
                            <span><strong>Offline spreadsheets:</strong> Fragmented stock lists on separate computers caused error logs.</span>
                        </li>
                        <li className="flex gap-2">
                            <span className="text-red-400 font-bold">•</span>
                            <span><strong>Material leakage:</strong> No trace of batch costs, FIFO rotation, or contractor wastage control.</span>
                        </li>
                        <li className="flex gap-2">
                            <span className="text-red-400 font-bold">•</span>
                            <span><strong>Chasing PAT approvals:</strong> Manually calling offices to confirm OPMC and Head Office PAT status.</span>
                        </li>
                        <li className="flex gap-2">
                            <span className="text-red-400 font-bold">•</span>
                            <span><strong>Manual vehicle logs:</strong> Drivers writing odometer values on paper logsheets, delaying fuel audits.</span>
                        </li>
                    </ul>
                </div>

                {/* Arrow indicator */}
                <div className="hidden md:flex absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-slate-900 border border-slate-700 items-center justify-center shadow-lg z-10">
                    <ArrowRight className="w-4 h-4 text-blue-400" />
                </div>

                {/* After Card */}
                <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-5">
                    <div className="flex items-center gap-2 mb-3 border-b border-emerald-500/10 pb-2">
                        <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                        <h3 className="font-bold text-emerald-200">✅ SLTS Nexus (After)</h3>
                    </div>
                    <ul className="space-y-3.5 text-slate-300">
                        <li className="flex gap-2">
                            <span className="text-emerald-400 font-bold">•</span>
                            <span><strong>Central multi-store:</strong> Real-time inventory sync from Main/Sub Stores to contractor custody.</span>
                        </li>
                        <li className="flex gap-2">
                            <span className="text-emerald-400 font-bold">•</span>
                            <span><strong>FIFO batch costing:</strong> Precision pricing, automatic wastage approval write-offs, and MRN rollbacks.</span>
                        </li>
                        <li className="flex gap-2">
                            <span className="text-emerald-400 font-bold">•</span>
                            <span><strong>3-Stage Portal Sync:</strong> Automated daily background queries for OPMC, HO, and SLT HQ PAT success/rejections.</span>
                        </li>
                        <li className="flex gap-2">
                            <span className="text-emerald-400 font-bold">•</span>
                            <span><strong>Mobile QR check-ins:</strong> Odometer values and driver lease payments computed instantly upon QR scans.</span>
                        </li>
                    </ul>
                </div>

            </div>

            {/* ROI Metrics Bar */}
            <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-3">
                {roiMetrics.map((m) => (
                    <div key={m.label} className="bg-slate-950/80 border border-slate-800 rounded-xl p-3 text-center hover:border-slate-700 transition-colors">
                        <p className={`text-lg font-black ${m.color}`}>{m.value}</p>
                        <p className="text-[9px] text-slate-500 uppercase tracking-wider font-bold">{m.label}</p>
                        <p className="text-[8px] text-slate-600 mt-0.5">{m.desc}</p>
                    </div>
                ))}
            </div>
            <p className="text-center text-[9px] text-slate-600 mt-3 font-medium">
                📈 Estimated improvements based on operational benchmarks
            </p>
        </div>
    );
}