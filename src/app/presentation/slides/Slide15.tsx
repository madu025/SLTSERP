"use client";
import React from "react";
import { Zap, Calendar, ArrowRight, BrainCircuit, Smartphone, Landmark, ArrowLeftRight, Calculator, MessageSquare, Printer } from "lucide-react";

export default function Slide15() {
    const upcomingFeatures = [
        { title: "Offline Technician App", desc: "Field work logging without cellular signal", icon: Smartphone, color: "text-emerald-400", timeline: "Q3 2026" },
        { title: "Bank Portal Integration", desc: "Bulk payment files with dual authorization", icon: Landmark, color: "text-amber-400", timeline: "Q4 2026" },
        { title: "AI Material Predictor", desc: "Forecast inventory using historical data", icon: BrainCircuit, color: "text-purple-400", timeline: "Q1 2027" },
        { title: "Inter-Store Routing", desc: "Dynamic material transfers across stores", icon: ArrowLeftRight, color: "text-blue-400", timeline: "Q4 2026" },
    ];

    return (
        <div className="flex flex-col h-full justify-center max-w-6xl mx-auto py-2">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
                
                {/* Left: Content */}
                <div className="lg:col-span-5 space-y-4">
                    <div className="flex items-center gap-2">
                        <span className="bg-blue-500/15 p-1.5 rounded-lg text-blue-400">
                            <Zap className="w-5 h-5" />
                        </span>
                        <span className="text-xs font-bold text-blue-400 uppercase tracking-wider">
                            Roadmap & Conclusion
                        </span>
                    </div>
                    <h2 className="text-2xl sm:text-3xl font-extrabold bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent leading-tight">
                        Upcoming Roadmap
                    </h2>
                    <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                        🎯 SLTS Nexus Phase 1 is code-complete and ready for pilot rollout across Sri Lanka Telecom regional operations.
                    </p>
                    <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                        The next phases add <strong className="text-blue-400">offline mobile apps</strong>, <strong className="text-emerald-400">direct banking integrations</strong>, and <strong className="text-purple-400">AI-powered predictions</strong>.
                    </p>
                    <div className="pt-2">
                        <button className="bg-gradient-to-r from-blue-600 to-emerald-500 text-white font-bold text-xs uppercase px-5 py-2.5 rounded-xl transition-all shadow-lg hover:shadow-emerald-500/10 flex items-center gap-2">
                            <span>Ready to Deploy</span>
                            <ArrowRight className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                {/* Right: Timeline + Upcoming Features */}
                <div className="lg:col-span-7 bg-slate-950/80 border border-slate-800 rounded-2xl p-5 shadow-2xl space-y-4">
                    {/* Window chrome */}
                    <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                        <div className="flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
                            <span className="w-2.5 h-2.5 rounded-full bg-yellow-500" />
                            <span className="w-2.5 h-2.5 rounded-full bg-green-500" />
                        </div>
                        <span className="text-[10px] font-mono text-slate-500">Upcoming Release Timeline</span>
                    </div>

                    {/* Vector: Roadmap Path with Milestone Flags */}
                    <div className="mb-2">
                        <svg viewBox="0 0 400 45" className="w-full h-12 opacity-65" xmlns="http://www.w3.org/2000/svg">
                            {/* Curvy path */}
                            <path d="M20,35 C60,35 60,10 100,10 C140,10 140,35 180,35 C220,35 220,10 260,10 C300,10 300,35 340,35 C360,35 370,22 380,15" fill="none" stroke="#60a5fa" strokeWidth="1.5" strokeLinecap="round" />
                            {/* Milestone flags */}
                            <line x1="100" y1="10" x2="100" y2="2" stroke="#fbbf24" strokeWidth="0.8" />
                            <polygon points="100,2 115,6 100,10" fill="#f59e0b" opacity="0.6" />
                            <text x="100" y="16" textAnchor="middle" fill="#fcd34d" fontSize="5" fontWeight="bold">Q3'26</text>
                            
                            <line x1="180" y1="35" x2="180" y2="43" stroke="#a78bfa" strokeWidth="0.8" />
                            <polygon points="180,43 195,39 180,35" fill="#8b5cf6" opacity="0.6" />
                            <text x="180" y="8" textAnchor="middle" fill="#c4b5fd" fontSize="5" fontWeight="bold">Q4'26</text>
                            
                            <line x1="260" y1="10" x2="260" y2="2" stroke="#34d399" strokeWidth="0.8" />
                            <polygon points="260,2 275,6 260,10" fill="#10b981" opacity="0.6" />
                            <text x="260" y="16" textAnchor="middle" fill="#6ee7b7" fontSize="5" fontWeight="bold">Q1'27</text>
                            
                            <line x1="340" y1="35" x2="340" y2="43" stroke="#60a5fa" strokeWidth="0.8" />
                            <polygon points="340,43 355,39 340,35" fill="#3b82f6" opacity="0.6" />
                            <text x="370" y="8" textAnchor="middle" fill="#93c5fd" fontSize="5" fontWeight="bold">AI Era</text>
                            {/* Destination star */}
                            <circle cx="380" cy="14" r="6" fill="none" stroke="#fbbf24" strokeWidth="0.6" opacity="0.5" />
                            <text x="380" y="17" textAnchor="middle" fill="#fbbf24" fontSize="6" opacity="0.5">★</text>
                            {/* Start point */}
                            <circle cx="20" cy="35" r="4" fill="#10b981" opacity="0.5" />
                            <text x="20" y="42" textAnchor="middle" fill="#6ee7b7" fontSize="4">v1.0</text>
                        </svg>
                    </div>
                    {/* Timeline items */}
                    <div className="relative pl-6 border-l border-slate-850 space-y-4 text-xs ml-3 py-1">
                        {/* Point 1 */}
                        <div className="relative">
                            <span className="absolute -left-[30px] top-0.5 w-4 h-4 rounded-full bg-blue-500 border-2 border-slate-950 flex items-center justify-center font-bold" />
                            <div>
                                <span className="text-[9px] font-mono bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded border border-blue-500/15 font-bold uppercase">Q3 2026</span>
                                <h4 className="font-bold text-white mt-1">Offline-Ready Mobile Application</h4>
                                <p className="text-[10px] text-slate-500 mt-0.5">Allow field technicians to log work coordinates even when cellular signals fail in rural zones.</p>
                            </div>
                        </div>

                        {/* Point 2 */}
                        <div className="relative">
                            <span className="absolute -left-[30px] top-0.5 w-4 h-4 rounded-full bg-purple-500 border-2 border-slate-950 flex items-center justify-center font-bold" />
                            <div>
                                <span className="text-[9px] font-mono bg-purple-500/10 text-purple-400 px-2 py-0.5 rounded border border-purple-500/15 font-bold uppercase">Q4 2026</span>
                                <h4 className="font-bold text-white mt-1">Direct Core ERP Billing Core Connect</h4>
                                <p className="text-[10px] text-slate-500 mt-0.5">Integrate payouts directly into Sri Lanka Telecom's central ledger systems for automatic wire transfers.</p>
                            </div>
                        </div>

                        {/* Point 3 */}
                        <div className="relative">
                            <span className="absolute -left-[30px] top-0.5 w-4 h-4 rounded-full bg-emerald-500 border-2 border-slate-950 flex items-center justify-center font-bold" />
                            <div>
                                <span className="text-[9px] font-mono bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded border border-emerald-500/15 font-bold uppercase">Q1 2027</span>
                                <h4 className="font-bold text-white mt-1">AI Dispatch & Scheduling Helper</h4>
                                <p className="text-[10px] text-slate-500 mt-0.5">Assign technician teams dynamically based on their live locations, current workloads, and travel speeds.</p>
                            </div>
                        </div>
                    </div>

                    {/* Feature Cards Grid */}
                    <div className="grid grid-cols-2 gap-2">
                        {upcomingFeatures.map((f) => {
                            const Icon = f.icon;
                            return (
                                <div key={f.title} className="bg-slate-900/40 border border-slate-800 rounded-lg p-2.5 flex items-start gap-2">
                                    <Icon className={`w-4 h-4 ${f.color} flex-shrink-0 mt-0.5`} />
                                    <div>
                                        <p className="text-[10px] font-bold text-white">{f.title}</p>
                                        <p className="text-[8px] text-slate-500">{f.desc}</p>
                                        <span className={`text-[7px] font-mono font-bold ${f.color}`}>{f.timeline}</span>
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