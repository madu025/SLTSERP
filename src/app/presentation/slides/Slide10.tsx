"use client";
import React from "react";
import { FolderTree, Award, HardDrive, CheckCircle2, Trophy } from "lucide-react";

export default function Slide10() {
    const contractorRankings = [
        { rank: 1, name: "Lanka Tech Team A (Kandy)", efficiency: "95.8%", waste: "1.2%", grade: "A+", color: "text-emerald-400" },
        { rank: 2, name: "Central OSP Builders", efficiency: "81.5%", waste: "4.8%", grade: "B", color: "text-amber-400" },
    ];

    const kpiMetrics = [
        { label: "Timeline", value: "96%", color: "bg-blue-500" },
        { label: "Quality Gates", value: "91%", color: "bg-emerald-500" },
    ];

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
                            OSP Inner: As-Built & KPI
                        </span>
                    </div>
                    <h2 className="text-2xl sm:text-3xl font-extrabold bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent leading-tight">
                        As-Built & Contractor KPIs
                    </h2>
                    <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                        The final step of the OSP lifecycle is collecting <strong className="text-white">As-Built CAD/GIS files</strong>, ensuring the SLT physical plant registry database is kept updated.
                    </p>
                    <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                        Simultaneously, the system calculates <strong className="text-blue-400">Contractor KPIs</strong>. We track delays, gate failures, and compliance to grade contractors and award future tenders.
                    </p>

                    {/* KPI Meters */}
                    <div className="space-y-2">
                        {kpiMetrics.map((k) => (
                            <div key={k.label} className="space-y-1">
                                <div className="flex justify-between text-[10px]">
                                    <span className="text-slate-400">{k.label} Compliance</span>
                                    <span className="text-white font-mono font-bold">{k.value}</span>
                                </div>
                                <div className="w-full h-1.5 bg-slate-900 border border-slate-850 rounded-full overflow-hidden">
                                    <div className={`h-full ${k.color}`} style={{ width: k.value }} />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Right: Scorecard and Rankings */}
                <div className="lg:col-span-7 bg-slate-950/80 border border-slate-800 rounded-2xl p-5 shadow-2xl space-y-4">
                    {/* Window chrome */}
                    <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                        <div className="flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
                            <span className="w-2.5 h-2.5 rounded-full bg-yellow-500" />
                            <span className="w-2.5 h-2.5 rounded-full bg-green-500" />
                        </div>
                        <span className="text-[10px] font-mono text-slate-500">Contractor Performance Report</span>
                    </div>

                    {/* Vector: Trophy Podium */}
                    <div className="mb-2">
                        <svg viewBox="0 0 400 45" className="w-full h-12 opacity-65" xmlns="http://www.w3.org/2000/svg">
                            {/* Podium */}
                            <rect x="80" y="20" width="60" height="22" rx="2" fill="#fbbf24" opacity="0.3" stroke="#f59e0b" strokeWidth="0.5" />
                            <text x="110" y="38" textAnchor="middle" fill="#fcd34d" fontSize="6" fontWeight="bold">#1</text>
                            <rect x="170" y="28" width="60" height="14" rx="2" fill="#94a3b8" opacity="0.25" stroke="#64748b" strokeWidth="0.5" />
                            <text x="200" y="38" textAnchor="middle" fill="#cbd5e1" fontSize="6" fontWeight="bold">#2</text>
                            <rect x="260" y="32" width="60" height="10" rx="2" fill="#d97706" opacity="0.25" stroke="#b45309" strokeWidth="0.5" />
                            <text x="290" y="39" textAnchor="middle" fill="#fcd34d" fontSize="6" fontWeight="bold">#3</text>
                            {/* Trophy on #1 */}
                            <path d="M100,8 L120,8 L118,18 L102,18 Z" fill="#fbbf24" opacity="0.5" stroke="#f59e0b" strokeWidth="0.5" />
                            <rect x="105" y="18" width="10" height="4" fill="#f59e0b" opacity="0.4" />
                            <line x1="98" y1="12" x2="92" y2="18" stroke="#fbbf24" strokeWidth="1" opacity="0.5" />
                            <line x1="122" y1="12" x2="128" y2="18" stroke="#fbbf24" strokeWidth="1" opacity="0.5" />
                            {/* Star sparkle */}
                            <text x="340" y="15" fill="#fbbf24" fontSize="10" opacity="0.5">⭐</text>
                            <text x="360" y="25" fill="#fbbf24" fontSize="7" opacity="0.4">A+</text>
                        </svg>
                    </div>
                    {/* Scorecard Header */}
                    <div className="flex justify-between items-center bg-slate-900/60 border border-slate-800 rounded-xl p-3">
                        <div className="flex items-center gap-3">
                            <span className="p-2.5 bg-blue-500/10 rounded-lg text-blue-400">
                                <Award className="w-6 h-6" />
                            </span>
                            <div>
                                <h4 className="text-xs font-bold text-white">Sierra Engineering Ltd</h4>
                                <p className="text-[10px] text-slate-500">Rank #02 in Civil OSP Division</p>
                            </div>
                        </div>
                        <div className="text-right">
                            <p className="text-lg font-black text-emerald-400">A+ (94.2%)</p>
                            <p className="text-[9px] text-slate-500 uppercase">Performance Grade</p>
                        </div>
                    </div>

                    {/* Contractor Efficiency Rankings */}
                    <div className="bg-slate-900/30 border border-slate-850 rounded-xl p-3">
                        <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                            <Trophy className="w-3.5 h-3.5 text-amber-400" />
                            <span>🏆 Contractor Efficiency Rankings</span>
                        </h4>
                        <div className="space-y-1.5">
                            {contractorRankings.map((c) => (
                                <div key={c.rank} className="flex items-center justify-between bg-slate-900/40 rounded-lg p-2">
                                    <div className="flex items-center gap-2 min-w-0">
                                        <span className={`font-bold text-xs ${c.color}`}>{c.rank}.</span>
                                        <span className="text-[10px] truncate text-slate-300">{c.name}</span>
                                    </div>
                                    <div className="flex items-center gap-2 flex-shrink-0">
                                        <span className={`text-[10px] font-bold ${c.color}`}>{c.efficiency}</span>
                                        <span className="text-[8px] text-slate-500">({c.waste} Waste)</span>
                                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${c.color} bg-opacity-10 border border-opacity-20`}>{c.grade}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* As-Built status info */}
                    <div className="bg-slate-900/30 border border-slate-850 rounded-xl p-3 flex justify-between items-center text-xs">
                        <div className="flex items-center gap-2">
                            <HardDrive className="w-4 h-4 text-purple-400" />
                            <span className="text-slate-300 font-medium">As-Built GIS Survey File</span>
                        </div>
                        <span className="text-[9px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/15 px-2 py-0.5 rounded flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Verified</span>
                        </span>
                    </div>
                </div>

            </div>
        </div>
    );
}