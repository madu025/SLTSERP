"use client";

import React from "react";

export default function Slide1() {
    const items = [
        {
            num: "01",
            team: "Operations Team",
            module: "SOD Module",
            short: "Service Order Sheets",
            desc: "Inline editing, completions, wastage control, bulk imports, and billing split.",
            color: "from-blue-500 to-indigo-600",
            glow: "shadow-blue-500/10 hover:shadow-blue-500/20 hover:border-blue-500/50",
            icon: (
                <svg viewBox="0 0 100 100" className="w-12 h-12 transition-transform group-hover:scale-110 duration-300" xmlns="http://www.w3.org/2000/svg">
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
                        <filter id="s1Shadow">
                            <feDropShadow dx="2" dy="4" stdDeviation="3" floodColor="#000000" floodOpacity="0.5" />
                        </filter>
                    </defs>
                    <rect x="20" y="18" width="60" height="70" rx="6" fill="url(#s1Board)" stroke="#3b82f6" strokeWidth="1.5" filter="url(#s1Shadow)" />
                    <rect x="26" y="30" width="48" height="52" rx="3" fill="url(#s1Paper)" />
                    <path d="M40 12h20v8a4 4 0 01-4 4H44a4 4 0 01-4-4v-8z" fill="url(#s1Clip)" filter="url(#s1Shadow)" />
                    <circle cx="50" cy="17" r="2" fill="#1e3a5f" />
                    <rect x="34" y="42" width="18" height="3" rx="1.5" fill="#64748b" />
                    <rect x="34" y="52" width="26" height="3" rx="1.5" fill="#94a3b8" />
                    <rect x="34" y="62" width="22" height="3" rx="1.5" fill="#cbd5e1" />
                    <rect x="63" y="41" width="5" height="5" rx="1.5" fill="#10b981" />
                    <rect x="63" y="51" width="5" height="5" rx="1.5" fill="#10b981" />
                    <rect x="63" y="61" width="5" height="5" rx="1.5" fill="#e2e8f0" />
                    <path d="M64 43.5 l1 1 l1.5-2" stroke="white" strokeWidth="0.8" fill="none" strokeLinecap="round" />
                    <path d="M64 53.5 l1 1 l1.5-2" stroke="white" strokeWidth="0.8" fill="none" strokeLinecap="round" />
                </svg>
            )
        },
        {
            num: "02",
            team: "OSP Projects",
            module: "OSP Projects",
            short: "WBS & Task Schedules",
            desc: "Hierarchies, parent-child progress sync, change orders, procurement, and closures.",
            color: "from-emerald-500 to-teal-600",
            glow: "shadow-emerald-500/10 hover:shadow-emerald-500/20 hover:border-emerald-500/50",
            icon: (
                <svg viewBox="0 0 100 100" className="w-12 h-12 transition-transform group-hover:scale-110 duration-300" xmlns="http://www.w3.org/2000/svg">
                    <defs>
                        <linearGradient id="s2Back" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stopColor="#065f46" />
                            <stop offset="100%" stopColor="#064e3b" />
                        </linearGradient>
                        <linearGradient id="s2Front" x1="0%" y1="0%" x2="0%" y2="100%">
                            <stop offset="0%" stopColor="#34d399" />
                            <stop offset="100%" stopColor="#059669" />
                        </linearGradient>
                        <linearGradient id="s2Node" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stopColor="#fbbf24" />
                            <stop offset="100%" stopColor="#f59e0b" />
                        </linearGradient>
                    </defs>
                    <path d="M15 28a4 4 0 014-4h20l6 6h40a4 4 0 014 4v46a4 4 0 01-4 4H19a4 4 0 01-4-4V28z" fill="url(#s2Back)" />
                    <g opacity="0.85">
                        <line x1="38" y1="42" x2="55" y2="32" stroke="#a7f3d0" strokeWidth="1.5" />
                        <line x1="38" y1="42" x2="55" y2="50" stroke="#a7f3d0" strokeWidth="1.5" />
                        <line x1="38" y1="42" x2="65" y2="40" stroke="#a7f3d0" strokeWidth="1.5" />
                        <circle cx="38" cy="42" r="5" fill="url(#s2Node)" stroke="#d97706" strokeWidth="1" />
                        <circle cx="55" cy="32" r="4" fill="#60a5fa" stroke="#3b82f6" strokeWidth="0.8" />
                        <circle cx="55" cy="50" r="3.5" fill="#fb7185" stroke="#f43f5e" strokeWidth="0.8" />
                        <circle cx="65" cy="40" r="3.5" fill="#a78bfa" stroke="#7c3aed" strokeWidth="0.8" />
                    </g>
                    <path d="M15 38h70v36a4 4 0 01-4 4H19a4 4 0 01-4-4V38z" fill="url(#s2Front)" filter="url(#s1Shadow)" />
                    <path d="M22 46h14M22 52h26" stroke="#065f46" strokeWidth="2" strokeLinecap="round" opacity="0.35" />
                </svg>
            )
        },
        {
            num: "03",
            team: "Store Keepers",
            module: "Warehouse Stock",
            short: "Warehouse GRN & Stock",
            desc: "Material ledgers, GRN tracking, safety alerts, and gate pass PDF exports.",
            color: "from-purple-500 to-pink-600",
            glow: "shadow-purple-500/10 hover:shadow-purple-500/20 hover:border-purple-500/50",
            icon: (
                <svg viewBox="0 0 100 100" className="w-12 h-12 transition-transform group-hover:scale-110 duration-300" xmlns="http://www.w3.org/2000/svg">
                    <defs>
                        <linearGradient id="s3Roof" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stopColor="#a855f7" />
                            <stop offset="100%" stopColor="#6b21a8" />
                        </linearGradient>
                        <linearGradient id="s3Wall" x1="0%" y1="0%" x2="100%" y2="0%">
                            <stop offset="0%" stopColor="#1e1b4b" />
                            <stop offset="100%" stopColor="#0f0825" />
                        </linearGradient>
                    </defs>
                    <ellipse cx="50" cy="84" rx="34" ry="6" fill="#020617" opacity="0.7" />
                    <rect x="22" y="50" width="56" height="30" rx="3" fill="url(#s3Wall)" stroke="#a855f7" strokeWidth="1" />
                    <polygon points="18,50 50,28 82,50" fill="url(#s3Roof)" />
                    <rect x="40" y="60" width="20" height="20" rx="2" fill="#1e1b4b" stroke="#a855f7" strokeWidth="1" />
                    <line x1="50" y1="60" x2="50" y2="80" stroke="#a855f7" strokeWidth="0.8" opacity="0.5" />
                    <line x1="40" y1="70" x2="60" y2="70" stroke="#a855f7" strokeWidth="0.8" opacity="0.5" />
                    <rect x="62" y="62" width="10" height="10" rx="1.5" fill="#ec4899" opacity="0.6" />
                    <rect x="63" y="64" width="8" height="6" rx="1" fill="#fdf2f8" opacity="0.3" />
                    <polyline points="18,50 50,28 82,50" fill="none" stroke="#c084fc" strokeWidth="2" opacity="0.7" />
                </svg>
            )
        },
        {
            num: "04",
            team: "Contractor Teams",
            module: "Security & Tools",
            short: "Job Completion Logs",
            desc: "Verification codes, global SLA alarms, contractor efficiency scores, and audits.",
            color: "from-rose-500 to-red-600",
            glow: "shadow-rose-500/10 hover:shadow-rose-500/20 hover:border-rose-500/50",
            icon: (
                <svg viewBox="0 0 100 100" className="w-12 h-12 transition-transform group-hover:scale-110 duration-300" xmlns="http://www.w3.org/2000/svg">
                    <defs>
                        <linearGradient id="s4Shield" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stopColor="#e11d48" />
                            <stop offset="100%" stopColor="#881337" />
                        </linearGradient>
                        <linearGradient id="s4Lock" x1="0%" y1="0%" x2="0%" y2="100%">
                            <stop offset="0%" stopColor="#fecdd3" />
                            <stop offset="100%" stopColor="#f43f5e" />
                        </linearGradient>
                        <linearGradient id="s4HatGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                            <stop offset="0%" stopColor="#fef08a" />
                            <stop offset="60%" stopColor="#eab308" />
                            <stop offset="100%" stopColor="#ca8a04" />
                        </linearGradient>
                        <filter id="s4Shadow">
                            <feDropShadow dx="2" dy="3" stdDeviation="3" floodColor="#000000" floodOpacity="0.5" />
                        </filter>
                    </defs>
                    <path d="M50 12 L82 22 C82 52 50 84 50 84 C50 84 18 52 18 22 Z" fill="url(#s4Shield)" opacity="0.2" stroke="#e11d48" strokeWidth="1.5" strokeDasharray="3 2" />
                    <path d="M50 18 L72 26 C72 48 50 72 50 72 C50 72 28 48 28 26 Z" fill="url(#s4Shield)" filter="url(#s4Shadow)" />
                    <rect x="42" y="42" width="16" height="14" rx="2" fill="#1e293b" />
                    <path d="M45 42 V36 a5 5 0 0110 0 V42" fill="none" stroke="url(#s4Lock)" strokeWidth="3" strokeLinecap="round" />
                    <circle cx="50" cy="49" r="2.5" fill="#fecdd3" />
                    <line x1="50" y1="51" x2="50" y2="54" stroke="#fecdd3" strokeWidth="1.5" strokeLinecap="round" />
                    <path d="M44 26 C44 18 48 15 50 15 C52 15 56 18 56 26 Z" fill="url(#s4HatGrad)" opacity="0.9" />
                    <path d="M38 26 C38 26 40 24 44 24 C46 24 54 24 56 24 C60 24 62 26 62 26 C62 28 60 29 56 29 C54 29 46 29 44 29 C40 29 38 28 38 26 Z" fill="#ca8a04" opacity="0.7" />
                </svg>
            )
        },
        {
            num: "05",
            team: "OSP Managers",
            module: "Manager Analytics",
            short: "Analytics, Budgets & Audits",
            desc: "Regional dashboards, contractor efficiency, wastage comparisons, and budget reports.",
            color: "from-amber-500 to-orange-600",
            glow: "shadow-amber-500/10 hover:shadow-amber-500/20 hover:border-amber-500/50",
            icon: (
                <svg viewBox="0 0 100 100" className="w-12 h-12 transition-transform group-hover:scale-110 duration-300" xmlns="http://www.w3.org/2000/svg">
                    <defs>
                        <linearGradient id="s5TieGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stopColor="#818cf8" />
                            <stop offset="50%" stopColor="#4f46e5" />
                            <stop offset="100%" stopColor="#312e81" />
                        </linearGradient>
                        <linearGradient id="s5Collar" x1="0%" y1="0%" x2="0%" y2="100%">
                            <stop offset="0%" stopColor="#f8fafc" />
                            <stop offset="100%" stopColor="#cbd5e1" />
                        </linearGradient>
                    </defs>
                    <g opacity="0.3">
                        <rect x="22" y="55" width="6" height="20" rx="1" fill="#f59e0b" />
                        <rect x="32" y="42" width="6" height="33" rx="1" fill="#fbbf24" />
                        <rect x="62" y="48" width="6" height="27" rx="1" fill="#d97706" />
                        <rect x="72" y="30" width="6" height="45" rx="1" fill="#b45309" />
                    </g>
                    <polyline points="72,30 72,22 82,22" fill="none" stroke="#10b981" strokeWidth="1.5" strokeLinecap="round" />
                    <text x="65" y="26" fill="#10b981" fontSize="6" fontWeight="bold" fontFamily="monospace">+24%</text>
                    <path d="M30 24 L50 44 L70 24 L60 20 L50 26 L40 20 Z" fill="url(#s5Collar)" stroke="#94a3b8" strokeWidth="0.5" filter="url(#s1Shadow)" />
                    <path d="M40 20 L50 26 L60 20 Z" fill="#0f172a" />
                    <path d="M45 28 L55 28 L53 36 L47 36 Z" fill="url(#s5TieGrad)" stroke="#4338ca" strokeWidth="0.5" />
                    <path d="M47 36 L53 36 L56 68 L50 78 L44 68 Z" fill="url(#s5TieGrad)" stroke="#4338ca" strokeWidth="0.5" filter="url(#s1Shadow)" />
                    <path d="M47.5 40 L52.5 44 M46.5 48 L53.5 54 M45.5 57 L54.5 63 M44.5 66 L55.5 72" stroke="#fbbf24" strokeWidth="1.5" opacity="0.6" strokeLinecap="round" />
                </svg>
            )
        }
    ];

    const w = typeof window !== "undefined" ? (window as unknown as { __sltserp_navigate?: (index: number) => void }) : null;

    return (
        <div className="flex flex-col h-full justify-between max-w-6xl mx-auto py-1">
            
            {/* Header: Brand Welcome */}
            <div className="text-center space-y-2 py-2 flex-none">
                <div className="inline-flex items-center gap-2 px-3 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/30 text-[10px] text-blue-400 font-bold uppercase tracking-wider animate-pulse">
                    ⚡ Production Ready Core
                </div>
                <h1 className="text-2xl sm:text-3xl md:text-4xl font-black bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent tracking-tight">
                    SLTS Nexus
                </h1>
                <p className="text-xs sm:text-sm text-slate-400 font-medium max-w-2xl mx-auto leading-relaxed">
                    End-to-End Telecom Operations Management Platform for Sri Lanka Telecom
                </p>
            </div>

            {/* Unified 5-Column Grid: Role → Module cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 lg:gap-4 px-2 my-auto">
                {items.map((item) => (
                    <div
                        key={item.num}
                        className={`group cursor-pointer bg-slate-900/60 border border-slate-800/80 rounded-2xl overflow-hidden transition-all duration-300 hover:-translate-y-1 shadow-lg ${item.glow}`}
                    >
                        {/* Gradient Top Border */}
                        <div className={`h-1.5 bg-gradient-to-r ${item.color}`} />
                        
                        <div className="p-3 sm:p-4 text-center">
                            {/* Custom SVG Icon */}
                            <div className="flex justify-center mb-2">
                                {item.icon}
                            </div>
                            
                            {/* Module Number + Name */}
                            <span className="inline-block text-xl sm:text-2xl font-black bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent leading-none mb-0.5">
                                {item.num}
                            </span>
                            <h3 className="font-extrabold text-[11px] sm:text-sm text-white tracking-tight mb-0.5 group-hover:text-blue-400 transition-colors">
                                {item.module}
                            </h3>
                            
                            {/* Team Name (smaller) */}
                            <p className="text-[9px] sm:text-[10px] text-blue-400/60 font-semibold uppercase tracking-wider mb-1">
                                {item.team}
                            </p>
                            
                            {/* Description */}
                            <p className="text-[9px] sm:text-[10px] text-slate-400 leading-snug line-clamp-2">
                                {item.desc}
                            </p>
                        </div>
                    </div>
                ))}
            </div>

            {/* Bottom: Glowing Button */}
            <div className="text-center mt-4 lg:mt-6 pb-3 flex-none">
                <button
                    onClick={() => {
                        w?.__sltserp_navigate?.(1);
                    }}
                    className="group inline-flex items-center gap-2.5 px-7 py-3 rounded-full bg-gradient-to-r from-blue-600 via-indigo-600 to-emerald-500 text-white font-black text-xs sm:text-sm hover:opacity-95 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 shadow-[0_0_25px_rgba(59,130,246,0.3)] hover:shadow-[0_0_35px_rgba(59,130,246,0.5)] cursor-pointer"
                >
                    <span>Explore the Platform</span>
                    <span className="group-hover:translate-x-1 transition-transform duration-200">→</span>
                </button>
            </div>

        </div>
    );
}