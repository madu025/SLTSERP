"use client";
import React from "react";
import { FolderTree, GitCommit, ChevronRight, Workflow, Settings } from "lucide-react";

export default function Slide6() {
    const builderFeatures = [
        { title: "Drag & Drop Stages", desc: "Reorder OSP pipeline stages visually", icon: Workflow, color: "text-blue-400" },
        { title: "Configurable Gates", desc: "Define multi-level approval rules", icon: Settings, color: "text-emerald-400" },
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
                            Module 02: OSP Projects
                        </span>
                    </div>
                    <h2 className="text-2xl sm:text-3xl font-extrabold bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent leading-tight">
                        WBS & Stage Builder
                    </h2>
                    <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                        Outside Plant <strong className="text-white">(OSP) Projects</strong> represent large-scale engineering works like trenching roads and running fiber loops.
                    </p>
                    <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                        We organize work using a <strong className="text-blue-400">Work Breakdown Structure (WBS)</strong>. Project stages and milestones are configured inside the Stage Builder to enforce standardized execution.
                    </p>
                    <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3 text-xs text-slate-400 space-y-1.5">
                        <p className="text-white font-bold text-[11px] uppercase">⚙️ Dynamic Workflow Builder</p>
                        <p>Administrators can reorder, add, or remove OSP pipeline stages instantly via a visual design grid — no hardcoded rules needed.</p>
                    </div>

                    {/* Builder Features */}
                    <div className="grid grid-cols-2 gap-2">
                        {builderFeatures.map((f) => {
                            const Icon = f.icon;
                            return (
                                <div key={f.title} className="bg-slate-900/40 border border-slate-800 rounded-lg p-2.5 text-center">
                                    <Icon className={`w-4 h-4 ${f.color} mx-auto mb-1`} />
                                    <p className="text-[10px] font-bold text-white">{f.title}</p>
                                    <p className="text-[8px] text-slate-500">{f.desc}</p>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Right: WBS Tree Diagram Mockup */}
                <div className="lg:col-span-7 bg-slate-950/80 border border-slate-800 rounded-2xl p-5 shadow-2xl space-y-4">
                    {/* Window chrome */}
                    <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                        <div className="flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
                            <span className="w-2.5 h-2.5 rounded-full bg-yellow-500" />
                            <span className="w-2.5 h-2.5 rounded-full bg-green-500" />
                        </div>
                        <span className="text-[10px] font-mono text-slate-500">OSP Work Breakdown Structure (WBS)</span>
                    </div>

                    {/* Vector: Tree Hierarchy */}
                    <div className="mb-2">
                        <svg viewBox="0 0 400 40" className="w-full h-12 opacity-60" xmlns="http://www.w3.org/2000/svg">
                            {/* Root */}
                            <circle cx="200" cy="8" r="5" fill="#3b82f6" opacity="0.7" />
                            <text x="200" y="12" textAnchor="middle" fill="#93c5fd" fontSize="5" fontWeight="bold">P</text>
                            {/* Branches */}
                            <line x1="200" y1="13" x2="80" y2="30" stroke="#475569" strokeWidth="0.5" />
                            <line x1="200" y1="13" x2="200" y2="30" stroke="#475569" strokeWidth="0.5" />
                            <line x1="200" y1="13" x2="320" y2="30" stroke="#475569" strokeWidth="0.5" />
                            {/* Children */}
                            <circle cx="80" cy="32" r="4" fill="#8b5cf6" opacity="0.6" />
                            <circle cx="200" cy="32" r="4" fill="#10b981" opacity="0.6" />
                            <circle cx="320" cy="32" r="4" fill="#f59e0b" opacity="0.6" />
                            <line x1="80" y1="36" x2="60" y2="38" stroke="#475569" strokeWidth="0.4" />
                            <line x1="80" y1="36" x2="100" y2="38" stroke="#475569" strokeWidth="0.4" />
                            <circle cx="60" cy="39" r="2.5" fill="#a78bfa" opacity="0.5" />
                            <circle cx="100" cy="39" r="2.5" fill="#a78bfa" opacity="0.5" />
                        </svg>
                    </div>
                    {/* Hierarchy Nodes */}
                    <div className="space-y-3 font-sans text-xs">
                        
                        {/* Parent Project */}
                        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3 flex justify-between items-center">
                            <div className="flex items-center gap-2">
                                <FolderTree className="w-4 h-4 text-blue-400" />
                                <span className="font-bold text-white">Colombo Loop C-45 Expansion</span>
                            </div>
                            <span className="font-mono text-xs font-black text-blue-400">62% Done</span>
                        </div>

                        {/* Indented children */}
                        <div className="pl-6 space-y-2 border-l-2 border-slate-800/80 ml-5">
                            
                            {/* Milestone 1 */}
                            <div className="bg-slate-900/30 border border-slate-850 rounded-lg p-2.5 flex justify-between items-center">
                                <div className="flex items-center gap-2">
                                    <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
                                    <span className="text-slate-300">Phase 1: Civil Surveying</span>
                                </div>
                                <span className="bg-emerald-500/10 text-emerald-400 text-[9px] px-2 py-0.5 rounded-full border border-emerald-500/20">Completed</span>
                            </div>

                            {/* Milestone 2 */}
                            <div className="bg-slate-900/30 border border-slate-850 rounded-lg p-2.5 space-y-2">
                                <div className="flex justify-between items-center">
                                    <div className="flex items-center gap-2">
                                        <ChevronRight className="w-3.5 h-3.5 text-blue-400 rotate-90" />
                                        <span className="text-white font-medium">Phase 2: Cable Trenching</span>
                                    </div>
                                    <span className="text-amber-400 font-mono text-[10px] font-bold">45% In-Progress</span>
                                </div>
                                
                                {/* Leaf Subtasks */}
                                <div className="pl-6 space-y-1.5 border-l border-slate-800 ml-2">
                                    <div className="flex justify-between text-[10px] text-slate-400">
                                        <span>• Road excavation & clearing</span>
                                        <span className="text-emerald-400">100%</span>
                                    </div>
                                    <div className="flex justify-between text-[10px] text-slate-400">
                                        <span>• Duct pipe installation</span>
                                        <span className="text-amber-400">30%</span>
                                    </div>
                                    <div className="flex justify-between text-[10px] text-slate-400 opacity-60">
                                        <span>• Backfill & site reinstatement</span>
                                        <span>0%</span>
                                    </div>
                                </div>
                            </div>

                            {/* Stage Flow Indicator */}
                            <div className="flex items-center justify-center gap-2 pt-1">
                                <span className="text-[9px] text-slate-500 bg-slate-900/40 px-2 py-0.5 rounded">Survey → Civil → Splicing → QA</span>
                            </div>
                        </div>

                    </div>
                </div>

            </div>
        </div>
    );
}