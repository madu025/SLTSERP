"use client";

import React from "react";

export default function Slide1() {
    const items = [
        {
            num: "01",
            team: "Operations Team",
            module: "Service Orders",
            short: "Service Order Sheet",
            desc: "PAT verification gate, inline completions, and automated billing BOM allocation.",
            color: "from-blue-500 to-indigo-600",
            glow: "shadow-blue-500/10 hover:shadow-blue-500/20 hover:border-blue-500/50",
            icon: (
                <svg viewBox="0 0 100 100" className="w-10 h-10 transition-transform group-hover:scale-110 duration-300" xmlns="http://www.w3.org/2000/svg">
                    <defs>
                        <linearGradient id="s1Board" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stopColor="#1e3a5f" />
                            <stop offset="100%" stopColor="#0f1d2e" />
                        </linearGradient>
                        <linearGradient id="s1Paper" x1="0%" y1="0%" x2="0%" y2="100%">
                            <stop offset="0%" stopColor="#f8fafc" />
                            <stop offset="100%" stopColor="#cbd5e1" />
                        </linearGradient>
                        <linearGradient id="s1Clip" x1="0%" y1="0%" x2="100%" y2="0%">
                            <stop offset="0%" stopColor="#3b82f6" />
                            <stop offset="50%" stopColor="#60a5fa" />
                            <stop offset="100%" stopColor="#2563eb" />
                        </linearGradient>
                    </defs>
                    <rect x="25" y="20" width="50" height="60" rx="4" fill="url(#s1Board)" stroke="#3b82f6" strokeWidth="1.5" />
                    <rect x="30" y="30" width="40" height="42" rx="2" fill="url(#s1Paper)" />
                    <path d="M42 15h16v6a2 2 0 01-2 2h-12a2 2 0 01-2-2v-6z" fill="url(#s1Clip)" />
                    <rect x="36" y="38" width="18" height="2.5" rx="1.25" fill="#64748b" />
                    <rect x="36" y="46" width="28" height="2.5" rx="1.25" fill="#94a3b8" />
                    <rect x="36" y="54" width="22" height="2.5" rx="1.25" fill="#cbd5e1" />
                    <circle cx="66" cy="39" r="2.5" fill="#10b981" />
                    <circle cx="66" cy="47" r="2.5" fill="#10b981" />
                </svg>
            )
        },
        {
            num: "02",
            team: "OSP Projects",
            module: "OSP Projects",
            short: "WBS Task Schedules",
            desc: "Project structures, parent-child progress sync, trackers, and change orders.",
            color: "from-emerald-500 to-teal-600",
            glow: "shadow-emerald-500/10 hover:shadow-emerald-500/20 hover:border-emerald-500/50",
            icon: (
                <svg viewBox="0 0 100 100" className="w-10 h-10 transition-transform group-hover:scale-110 duration-300" xmlns="http://www.w3.org/2000/svg">
                    <defs>
                        <linearGradient id="s2Back" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stopColor="#065f46" />
                            <stop offset="100%" stopColor="#064e3b" />
                        </linearGradient>
                        <linearGradient id="s2Front" x1="0%" y1="0%" x2="0%" y2="100%">
                            <stop offset="0%" stopColor="#34d399" />
                            <stop offset="100%" stopColor="#059669" />
                        </linearGradient>
                    </defs>
                    <path d="M20 30a3 3 0 013-3h15l4 4h38a3 3 0 013 3v40a3 3 0 01-3 3H23a3 3 0 01-3-3V30z" fill="url(#s2Back)" />
                    <path d="M20 38h60v36a3 3 0 01-3 3H23a3 3 0 01-3-3V38z" fill="url(#s2Front)" />
                    <path d="M28 46h14M28 52h20" stroke="#065f46" strokeWidth="2" strokeLinecap="round" opacity="0.4" />
                </svg>
            )
        },
        {
            num: "03",
            team: "GIS Mapping",
            module: "GIS Map Integration",
            short: "National GIS Map",
            desc: "National map, dynamic surveys, active layers, and GPS-based coordinate sync.",
            color: "from-cyan-500 to-blue-600",
            glow: "shadow-cyan-500/10 hover:shadow-cyan-500/20 hover:border-cyan-500/50",
            icon: (
                <svg viewBox="0 0 100 100" className="w-10 h-10 transition-transform group-hover:scale-110 duration-300" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="50" cy="50" r="35" fill="none" stroke="#2563eb" strokeWidth="1.5" strokeDasharray="3 3" />
                    <circle cx="50" cy="50" r="25" fill="none" stroke="#38bdf8" strokeWidth="2" />
                    <circle cx="50" cy="50" r="6" fill="#0ea5e9" />
                    <path d="M50 15v70M15 50h70" stroke="#0284c7" strokeWidth="1" opacity="0.5" />
                    <path d="M42 35l16 10l-8 20z" fill="#0ea5e9" fillOpacity="0.4" stroke="#0ea5e9" strokeWidth="1.5" />
                </svg>
            )
        },
        {
            num: "04",
            team: "Store Keepers",
            module: "Inventory / Stores",
            short: "GRN & FIFO Issuing",
            desc: "GRN verification, FIFO batch picking, wastage logs, and virtual swaps.",
            color: "from-purple-500 to-pink-600",
            glow: "shadow-purple-500/10 hover:shadow-purple-500/20 hover:border-purple-500/50",
            icon: (
                <svg viewBox="0 0 100 100" className="w-10 h-10 transition-transform group-hover:scale-110 duration-300" xmlns="http://www.w3.org/2000/svg">
                    <defs>
                        <linearGradient id="s3Roof" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stopColor="#a855f7" />
                            <stop offset="100%" stopColor="#6b21a8" />
                        </linearGradient>
                    </defs>
                    <rect x="25" y="48" width="50" height="28" rx="2" fill="#1e1b4b" stroke="#a855f7" strokeWidth="1" />
                    <polygon points="20,48 50,28 80,48" fill="url(#s3Roof)" />
                    <rect x="42" y="58" width="16" height="18" rx="1" fill="#ec4899" opacity="0.6" />
                </svg>
            )
        },
        {
            num: "05",
            team: "Procurement Officers",
            module: "Procurement",
            short: "AI PO Builder",
            desc: "Demand forecasting, PO management, and automated procurement approvals.",
            color: "from-pink-500 to-rose-600",
            glow: "shadow-pink-500/10 hover:shadow-pink-500/20 hover:border-pink-500/50",
            icon: (
                <svg viewBox="0 0 100 100" className="w-10 h-10 transition-transform group-hover:scale-110 duration-300" xmlns="http://www.w3.org/2000/svg">
                    <path d="M30 30h40v40H30z" fill="none" stroke="#f43f5e" strokeWidth="2" />
                    <circle cx="50" cy="50" r="12" fill="none" stroke="#fb7185" strokeWidth="1.5" />
                    <path d="M50 20v10M50 70v10M20 50h10M70 50h10" stroke="#f43f5e" strokeWidth="2" strokeLinecap="round" />
                    <circle cx="50" cy="50" r="4" fill="#f43f5e" />
                </svg>
            )
        },
        {
            num: "06",
            team: "Finance & Accounts",
            module: "Finance & Accounts",
            short: "Vouchers & Penalties",
            desc: "Payment vouchers, petty cash registry, retention management, and LD penalties.",
            color: "from-indigo-500 to-blue-600",
            glow: "shadow-indigo-500/10 hover:shadow-indigo-500/20 hover:border-indigo-500/50",
            icon: (
                <svg viewBox="0 0 100 100" className="w-10 h-10 transition-transform group-hover:scale-110 duration-300" xmlns="http://www.w3.org/2000/svg">
                    <rect x="25" y="30" width="50" height="40" rx="4" fill="#1e1b4b" stroke="#6366f1" strokeWidth="1.5" />
                    <circle cx="50" cy="50" r="8" fill="#4f46e5" />
                    <path d="M44 50h12M50 44v12" stroke="#e0e7ff" strokeWidth="2" strokeLinecap="round" />
                </svg>
            )
        },
        {
            num: "07",
            team: "Fleet Management",
            module: "Vehicle Management",
            short: "Fleet & Trips Roster",
            desc: "Vehicle rosters, trip logsheets, driver management, and fuel/rental payments.",
            color: "from-amber-500 to-orange-600",
            glow: "shadow-amber-500/10 hover:shadow-amber-500/20 hover:border-amber-500/50",
            icon: (
                <svg viewBox="0 0 100 100" className="w-10 h-10 transition-transform group-hover:scale-110 duration-300" xmlns="http://www.w3.org/2000/svg">
                    <rect x="22" y="44" width="56" height="22" rx="3" fill="#d97706" />
                    <rect x="30" y="30" width="40" height="15" rx="2" fill="#f59e0b" />
                    <circle cx="35" cy="68" r="8" fill="#1e293b" stroke="#d97706" strokeWidth="1.5" />
                    <circle cx="65" cy="68" r="8" fill="#1e293b" stroke="#d97706" strokeWidth="1.5" />
                </svg>
            )
        },
        {
            num: "08",
            team: "Executive Managers",
            module: "Reports & Analytics",
            short: "Dashboards & Performance",
            desc: "Regional overview, contractor efficiency, budgets, and unified system logs.",
            color: "from-rose-500 to-red-600",
            glow: "shadow-rose-500/10 hover:shadow-rose-500/20 hover:border-rose-500/50",
            icon: (
                <svg viewBox="0 0 100 100" className="w-10 h-10 transition-transform group-hover:scale-110 duration-300" xmlns="http://www.w3.org/2000/svg">
                    <rect x="25" y="65" width="10" height="15" rx="1" fill="#e11d48" />
                    <rect x="40" y="45" width="10" height="35" rx="1" fill="#fb7185" />
                    <rect x="55" y="30" width="10" height="50" rx="1" fill="#f43f5e" />
                    <rect x="70" y="50" width="10" height="30" rx="1" fill="#be123c" />
                </svg>
            )
        }
    ];

    const w = typeof window !== "undefined" ? (window as unknown as { __sltserp_navigate?: (index: number) => void }) : null;

    return (
        <div className="flex flex-col h-full justify-between max-w-6xl mx-auto py-1">
            
            {/* Header: Brand Welcome */}
            <div className="text-center space-y-1.5 py-1.5 flex-none">
                <div className="inline-flex items-center gap-2 px-3 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/30 text-[9px] text-blue-400 font-bold uppercase tracking-wider animate-pulse">
                    ⚡ Production Ready Core
                </div>
                <h1 className="text-xl sm:text-2xl md:text-3xl font-black bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent tracking-tight">
                    SLTS Nexus
                </h1>
                <p className="text-[11px] sm:text-xs text-slate-400 font-medium max-w-2xl mx-auto leading-relaxed">
                    End-to-End Telecom Operations Management Platform for Sri Lanka Telecom
                </p>
            </div>

            {/* Unified 8-Card Grid: 4x2 Layout on Desktop */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 px-2 my-auto">
                {items.map((item) => (
                    <div
                        key={item.num}
                        className={`group cursor-pointer bg-slate-900/60 border border-slate-800/80 rounded-xl overflow-hidden transition-all duration-300 hover:-translate-y-1 shadow-lg ${item.glow}`}
                    >
                        {/* Gradient Top Border */}
                        <div className={`h-1 bg-gradient-to-r ${item.color}`} />
                        
                        <div className="p-2.5 text-center">
                            {/* Custom SVG Icon */}
                            <div className="flex justify-center mb-1.5">
                                {item.icon}
                            </div>
                            
                            {/* Module Number + Name */}
                            <span className="inline-block text-lg font-black bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent leading-none mb-0.5">
                                {item.num}
                            </span>
                            <h3 className="font-extrabold text-[10px] sm:text-xs text-white tracking-tight mb-0.5 group-hover:text-blue-400 transition-colors">
                                {item.module}
                            </h3>
                            
                            {/* Team Name (smaller) */}
                            <p className="text-[8px] sm:text-[9px] text-blue-400/60 font-semibold uppercase tracking-wider mb-0.5">
                                {item.team}
                            </p>
                            
                            {/* Description */}
                            <p className="text-[8px] sm:text-[9px] text-slate-400 leading-snug line-clamp-2">
                                {item.desc}
                            </p>
                        </div>
                    </div>
                ))}
            </div>

            {/* Bottom: Glowing Button */}
            <div className="text-center mt-3 pb-2 flex-none">
                <button
                    onClick={() => {
                        w?.__sltserp_navigate?.(1);
                    }}
                    className="group inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-gradient-to-r from-blue-600 via-indigo-600 to-emerald-500 text-white font-black text-[11px] sm:text-xs hover:opacity-95 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 shadow-[0_0_20px_rgba(59,130,246,0.3)] hover:shadow-[0_0_30px_rgba(59,130,246,0.5)] cursor-pointer"
                >
                    <span>Explore the Platform</span>
                    <span className="group-hover:translate-x-1 transition-transform duration-200">→</span>
                </button>
            </div>

        </div>
    );
}