"use client";
import React from "react";
import { Settings, Shield, Server, ArrowDown } from "lucide-react";

export default function Slide14() {
    return (
        <div className="flex flex-col h-full justify-center max-w-6xl mx-auto py-2">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
                
                {/* Left: Content */}
                <div className="lg:col-span-5 space-y-4">
                    <div className="flex items-center gap-2">
                        <span className="bg-blue-500/15 p-1.5 rounded-lg text-blue-400">
                            <Settings className="w-5 h-5" />
                        </span>
                        <span className="text-xs font-bold text-blue-400 uppercase tracking-wider">
                            Architecture & Security
                        </span>
                    </div>
                    <h2 className="text-2xl sm:text-3xl font-extrabold bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent leading-tight">
                        Security & Architecture
                    </h2>
                    <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                        SLTS Nexus uses the <strong className="text-white">Service-Repository Pattern</strong>. This decouples business logic from database interactions, facilitating modular code updates.
                    </p>
                    <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                        Security is enforced via <strong className="text-emerald-400">Role-Based Access Control (RBAC)</strong>. Contractors can only edit their own records, while SLT auditors can sign off and lock data layers.
                    </p>
                </div>

                {/* Right: Architecture Diagram Mockup */}
                <div className="lg:col-span-7 bg-slate-950/80 border border-slate-800 rounded-2xl p-5 shadow-2xl space-y-3">
                    {/* Window chrome */}
                    <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                        <div className="flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
                            <span className="w-2.5 h-2.5 rounded-full bg-yellow-500" />
                            <span className="w-2.5 h-2.5 rounded-full bg-green-500" />
                        </div>
                        <span className="text-[10px] font-mono text-slate-500">Service-Repository Architecture Stack</span>
                    </div>

                    {/* Vector: Shield with User Tiers */}
                    <div className="mb-2">
                        <svg viewBox="0 0 400 45" className="w-full h-12 opacity-65" xmlns="http://www.w3.org/2000/svg">
                            {/* Central shield */}
                            <path d="M195,5 L250,5 L260,12 L250,32 L222,37 L195,32 L185,12 Z" fill="none" stroke="#8b5cf6" strokeWidth="1" />
                            <text x="222" y="23" textAnchor="middle" fill="#a78bfa" fontSize="7" fontWeight="bold">RBAC</text>
                            {/* User tier 1 */}
                            <rect x="30" y="10" width="45" height="18" rx="3" fill="#ef4444" opacity="0.15" stroke="#f87171" strokeWidth="0.5" />
                            <circle cx="42" cy="16" r="4" fill="#ef4444" opacity="0.4" />
                            <text x="52" y="19" fill="#f87171" fontSize="5" fontWeight="bold">Admin</text>
                            <line x1="75" y1="19" x2="183" y2="15" stroke="#475569" strokeWidth="0.4" />
                            {/* User tier 2 */}
                            <rect x="30" y="30" width="45" height="14" rx="3" fill="#f59e0b" opacity="0.15" stroke="#fbbf24" strokeWidth="0.5" />
                            <circle cx="42" cy="37" r="3.5" fill="#f59e0b" opacity="0.4" />
                            <text x="52" y="39" fill="#fcd34d" fontSize="5" fontWeight="bold">Manager</text>
                            <line x1="75" y1="37" x2="183" y2="30" stroke="#475569" strokeWidth="0.4" />
                            {/* User tier 3 */}
                            <rect x="265" y="10" width="55" height="18" rx="3" fill="#10b981" opacity="0.15" stroke="#34d399" strokeWidth="0.5" />
                            <text x="292" y="17" fill="#6ee7b7" fontSize="5" fontWeight="bold">Contractor</text>
                            <text x="292" y="26" textAnchor="middle" fill="#6ee7b7" fontSize="4">Read Only</text>
                            <line x1="252" y1="19" x2="263" y2="19" stroke="#475569" strokeWidth="0.4" />
                            {/* User tier 4 */}
                            <rect x="265" y="30" width="55" height="14" rx="3" fill="#3b82f6" opacity="0.15" stroke="#60a5fa" strokeWidth="0.5" />
                            <text x="292" y="37" fill="#93c5fd" fontSize="5" fontWeight="bold">Storekeeper</text>
                            <text x="292" y="44" textAnchor="middle" fill="#93c5fd" fontSize="4">Issue Only</text>
                            <line x1="252" y1="37" x2="263" y2="37" stroke="#475569" strokeWidth="0.4" />
                            {/* Lock icons */}
                            <text x="345" y="15" fontSize="8" opacity="0.4">🔒</text>
                            <text x="365" y="15" fontSize="8" opacity="0.4">🔑</text>
                        </svg>
                    </div>
                    {/* Visual Architecture Layers */}
                    <div className="space-y-1.5 text-center text-xs">
                        
                        {/* UI Layer */}
                        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-2.5 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <span className="p-1 bg-blue-500/10 text-blue-400 rounded-md">UI</span>
                                <span className="font-bold text-white">Next.js Web Interface</span>
                            </div>
                            <span className="text-[9px] text-slate-500 font-mono">React / Tailwind</span>
                        </div>

                        <div className="flex justify-center text-blue-500">
                            <ArrowDown className="w-4 h-4" />
                        </div>

                        {/* Service Layer */}
                        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-2.5 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <span className="p-1 bg-purple-500/10 text-purple-400 rounded-md">SVC</span>
                                <span className="font-bold text-white">Service Layer (Business Logic)</span>
                            </div>
                            <span className="text-[9px] text-slate-500 font-mono">SLA & Invoice Calculations</span>
                        </div>

                        <div className="flex justify-center text-purple-500">
                            <ArrowDown className="w-4 h-4" />
                        </div>

                        {/* Repository Layer */}
                        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-2.5 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <span className="p-1 bg-emerald-500/10 text-emerald-400 rounded-md">REPO</span>
                                <span className="font-bold text-white">Repository Layer (Data Isolation)</span>
                            </div>
                            <span className="text-[9px] text-slate-500 font-mono">Prisma ORM Queries</span>
                        </div>

                        <div className="flex justify-center text-emerald-500">
                            <ArrowDown className="w-4 h-4" />
                        </div>

                        {/* Database */}
                        <div className="bg-slate-900/30 border border-slate-850 rounded-xl p-2.5 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Server className="w-4 h-4 text-slate-400" />
                                <span className="font-bold text-slate-300">PostgreSQL Database</span>
                            </div>
                            <span className="text-[9px] text-slate-500 font-mono">AWS RDS Host</span>
                        </div>

                    </div>
                </div>

            </div>
        </div>
    );
}
