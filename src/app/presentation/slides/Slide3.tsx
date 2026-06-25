"use client";
import React from "react";
import { FileSpreadsheet, CheckCircle2, AlertTriangle, Clock } from "lucide-react";

export default function Slide3() {
    return (
        <div className="flex flex-col h-full justify-center max-w-6xl mx-auto py-2">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
                
                {/* Left: Module Introduction */}
                <div className="lg:col-span-5 space-y-4">
                    <div className="flex items-center gap-2">
                        <span className="bg-blue-500/15 p-1.5 rounded-lg text-blue-400">
                            <FileSpreadsheet className="w-5 h-5" />
                        </span>
                        <span className="text-xs font-bold text-blue-400 uppercase tracking-wider">
                            Module 01: Service Orders (SOD)
                        </span>
                    </div>
                    <h2 className="text-2xl sm:text-3xl font-extrabold bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent leading-tight">
                        SOD Module Overview
                    </h2>
                    <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                        The <strong className="text-white">Service Order Details (SOD)</strong> module is the operational core of SLTS. It maps all physical connection requests and technician job sheets.
                    </p>
                    <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                        It connects regional office administrators who assign jobs, field teams who perform installations, and storekeepers who issue hardware.
                    </p>
                    <div className="pt-2 grid grid-cols-2 gap-3 text-[11px] text-slate-300">
                        <div className="flex items-center gap-2 bg-slate-900/60 p-2 rounded-lg border border-slate-800">
                            <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                            <span>100% Real-time sync</span>
                        </div>
                        <div className="flex items-center gap-2 bg-slate-900/60 p-2 rounded-lg border border-slate-800">
                            <Clock className="w-4 h-4 text-blue-400 flex-shrink-0" />
                            <span>SLA tracking</span>
                        </div>
                    </div>
                </div>

                {/* Right: Dashboard Summary Mockup */}
                <div className="lg:col-span-7 bg-slate-950/80 border border-slate-800 rounded-2xl p-5 shadow-2xl space-y-4">
                    {/* Window chrome */}
                    <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                        <div className="flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
                            <span className="w-2.5 h-2.5 rounded-full bg-yellow-500" />
                            <span className="w-2.5 h-2.5 rounded-full bg-green-500" />
                        </div>
                        <span className="text-[10px] font-mono text-slate-500">SOD Operations Dashboard</span>
                    </div>

                    {/* Vector: Order Flow Pipeline */}
                    <div className="mb-2">
                        <svg viewBox="0 0 400 40" className="w-full h-12 opacity-65" xmlns="http://www.w3.org/2000/svg">
                            <rect x="10" y="10" width="55" height="20" rx="4" fill="#3b82f6" opacity="0.3" stroke="#60a5fa" strokeWidth="0.5" />
                            <text x="37" y="24" textAnchor="middle" fill="#93c5fd" fontSize="6" fontWeight="bold" fontFamily="sans-serif">Assign</text>
                            <line x1="65" y1="20" x2="85" y2="20" stroke="#475569" strokeWidth="1" />
                            <polygon points="85,20 80,17 80,23" fill="#475569" />
                            
                            <rect x="90" y="10" width="55" height="20" rx="4" fill="#f59e0b" opacity="0.3" stroke="#fbbf24" strokeWidth="0.5" />
                            <text x="117" y="24" textAnchor="middle" fill="#fcd34d" fontSize="6" fontWeight="bold" fontFamily="sans-serif">Install</text>
                            <line x1="145" y1="20" x2="165" y2="20" stroke="#475569" strokeWidth="1" />
                            <polygon points="165,20 160,17 160,23" fill="#475569" />

                            <rect x="170" y="10" width="55" height="20" rx="4" fill="#8b5cf6" opacity="0.3" stroke="#a78bfa" strokeWidth="0.5" />
                            <text x="197" y="24" textAnchor="middle" fill="#c4b5fd" fontSize="6" fontWeight="bold" fontFamily="sans-serif">Audit</text>
                            <line x1="225" y1="20" x2="245" y2="20" stroke="#475569" strokeWidth="1" />
                            <polygon points="245,20 240,17 240,23" fill="#475569" />

                            <rect x="250" y="10" width="55" height="20" rx="4" fill="#10b981" opacity="0.3" stroke="#34d399" strokeWidth="0.5" />
                            <text x="277" y="24" textAnchor="middle" fill="#6ee7b7" fontSize="6" fontWeight="bold" fontFamily="sans-serif">Invoice</text>
                            
                            <circle cx="320" cy="20" r="8" fill="#10b981" opacity="0.4" stroke="#34d399" strokeWidth="0.5" />
                            <text x="320" y="23" textAnchor="middle" fill="#6ee7b7" fontSize="7" fontWeight="bold">✓</text>
                            <line x1="305" y1="20" x2="312" y2="20" stroke="#475569" strokeWidth="1" />
                            
                            <text x="360" y="24" fill="#34d399" fontSize="6" fontWeight="bold" fontFamily="monospace">DONE</text>
                        </svg>
                    </div>
                    {/* Stats Grid */}
                    <div className="grid grid-cols-3 gap-3">
                        <div className="bg-slate-900/60 border border-slate-850 rounded-xl p-3">
                            <p className="text-[9px] text-slate-500 uppercase tracking-wider">Active Orders</p>
                            <p className="text-xl font-black text-white mt-1">1,482</p>
                        </div>
                        <div className="bg-slate-900/60 border border-slate-850 rounded-xl p-3">
                            <p className="text-[9px] text-slate-500 uppercase tracking-wider">Pending Audit</p>
                            <p className="text-xl font-black text-amber-400 mt-1">87</p>
                        </div>
                        <div className="bg-slate-900/60 border border-slate-850 rounded-xl p-3">
                            <p className="text-[9px] text-slate-500 uppercase tracking-wider">Completed Today</p>
                            <p className="text-xl font-black text-emerald-400 mt-1">42</p>
                        </div>
                    </div>

                    {/* Workflow status steps */}
                    <div className="bg-slate-900/30 border border-slate-800/80 rounded-xl p-4 space-y-3">
                        <h4 className="text-[11px] font-bold text-slate-300 uppercase tracking-wider">SOD Workflow Stages</h4>
                        <div className="flex items-center justify-between text-[10px] text-slate-400 relative">
                            {/* Connector line */}
                            <div className="absolute top-3 left-6 right-6 h-0.5 bg-slate-800 -z-10" />
                            
                            <div className="flex flex-col items-center gap-1 bg-slate-950 px-2">
                                <span className="w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30 flex items-center justify-center font-bold">1</span>
                                <span>Assign</span>
                            </div>
                            <div className="flex flex-col items-center gap-1 bg-slate-950 px-2">
                                <span className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center font-bold">2</span>
                                <span>Installation</span>
                            </div>
                            <div className="flex flex-col items-center gap-1 bg-slate-950 px-2">
                                <span className="w-6 h-6 rounded-full bg-purple-500/20 text-purple-400 border border-purple-500/30 flex items-center justify-center font-bold">3</span>
                                <span>Material Audit</span>
                            </div>
                            <div className="flex flex-col items-center gap-1 bg-slate-950 px-2">
                                <span className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center font-bold">4</span>
                                <span>Invoiced</span>
                            </div>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
}
