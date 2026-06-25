"use client";
import React from "react";
import { FolderTree, ShieldAlert, FileCheck, CheckCircle2, XCircle, Lock, Camera, Users, CheckSquare } from "lucide-react";

export default function Slide7() {
    const gatingFeatures = [
        { icon: Lock, label: "Snapshot Copying", desc: "Templates frozen at project creation", color: "text-blue-400" },
        { icon: Camera, label: "Photo Proof", desc: "Mandatory on-site uploads", color: "text-purple-400" },
        { icon: Users, label: "Multi-Tier Approval", desc: "Coordinator → PM → Finance", color: "text-amber-400" },
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
                            OSP Projects: Quality Gates & Closures
                        </span>
                    </div>
                    <h2 className="text-2xl sm:text-3xl font-extrabold bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent leading-tight">
                        Quality Gates & Closures
                    </h2>
                    <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                        To maintain high construction standards, OSP projects enforce <strong className="text-white">Quality Gates</strong>. A contractor cannot unlock the next stage until the current gate is verified.
                    </p>
                    <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                        Configurable checkpoints enforce structural safety guidelines. Next-stage progression remains <strong className="text-rose-400">locked</strong> until all mandatory checklist points, OTDR reports, and GPS check-ins are verified by the system.
                    </p>

                    {/* Gating Flow */}
                    <div className="grid grid-cols-3 gap-2">
                        {gatingFeatures.map((g) => {
                            const Icon = g.icon;
                            return (
                                <div key={g.label} className="bg-slate-900/40 border border-slate-800 rounded-lg p-2 text-center">
                                    <Icon className={`w-4 h-4 ${g.color} mx-auto mb-1`} />
                                    <p className="text-[9px] font-bold text-white">{g.label}</p>
                                    <p className="text-[7px] text-slate-500">{g.desc}</p>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Right: Quality Check Checklist Mockup */}
                <div className="lg:col-span-7 bg-slate-950/80 border border-slate-800 rounded-2xl p-5 shadow-2xl space-y-4">
                    {/* Window chrome */}
                    <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                        <div className="flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
                            <span className="w-2.5 h-2.5 rounded-full bg-yellow-500" />
                            <span className="w-2.5 h-2.5 rounded-full bg-green-500" />
                        </div>
                        <span className="text-[10px] font-mono text-slate-500">Quality Gate Verification Check</span>
                    </div>

                    {/* Vector: Shield Lock Gate */}
                    <div className="mb-2">
                        <svg viewBox="0 0 400 40" className="w-full h-12 opacity-65" xmlns="http://www.w3.org/2000/svg">
                            {/* Shield shape */}
                            <path d="M140,5 L260,5 L280,15 L260,35 L200,38 L140,35 L120,15 Z" fill="none" stroke="#8b5cf6" strokeWidth="1" />
                            {/* Lock inside shield */}
                            <rect x="185" y="15" width="30" height="18" rx="3" fill="#ef4444" opacity="0.4" stroke="#f87171" strokeWidth="0.5" />
                            <path d="M190,15 L190,10 Q190,5 200,5 Q210,5 210,10 L210,15" fill="none" stroke="#f87171" strokeWidth="1" />
                            {/* Checkmark shield */}
                            <path d="M310,5 L370,5 L380,12 L370,30 L340,35 L310,30 L300,12 Z" fill="none" stroke="#10b981" strokeWidth="1" />
                            <polyline points="325,20 337,28 365,12" fill="none" stroke="#34d399" strokeWidth="1.5" />
                            {/* Arrow between */}
                            <line x1="283" y1="20" x2="298" y2="20" stroke="#475569" strokeWidth="1" />
                            <polygon points="298,20 293,17 293,23" fill="#475569" />
                            <text x="290" y="35" textAnchor="middle" fill="#fbbf24" fontSize="5">→ Verify →</text>
                            {/* Labels */}
                            <text x="200" y="8" textAnchor="middle" fill="#c4b5fd" fontSize="5" fontWeight="bold">LOCKED</text>
                            <text x="340" y="8" textAnchor="middle" fill="#6ee7b7" fontSize="5" fontWeight="bold">UNLOCK</text>
                        </svg>
                    </div>
                    {/* Gate Header */}
                    <div className="flex justify-between items-center bg-slate-900/60 border border-slate-800 rounded-xl p-3.5">
                        <div>
                            <p className="text-xs font-bold text-white">Stage 3 Gate: Fiber Splice Audits</p>
                            <p className="text-[10px] text-slate-500">Required before launching final testing</p>
                        </div>
                        <span className="text-[9px] bg-red-500/10 text-red-400 px-2 py-0.5 rounded border border-red-500/20 font-bold uppercase">🔒 Blocked</span>
                    </div>

                    {/* Checklist */}
                    <div className="space-y-2">
                        
                        <div className="flex items-center justify-between bg-slate-900/20 border border-slate-850 p-2.5 rounded-lg">
                            <div className="flex items-center gap-2.5 text-xs text-slate-300">
                                <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                                <span>Fiber Splice Test Log Sheets (.pdf)</span>
                            </div>
                            <span className="text-[9px] text-slate-500">Uploaded</span>
                        </div>

                        <div className="flex items-center justify-between bg-slate-900/20 border border-slate-850 p-2.5 rounded-lg">
                            <div className="flex items-center gap-2.5 text-xs text-slate-300">
                                <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                                <span>GIS chamber coordinate verification</span>
                                <span className="bg-emerald-500/10 text-emerald-400 text-[8px] px-1.5 py-0.2 rounded font-mono">Matched</span>
                            </div>
                            <span className="text-[9px] text-slate-500">Auto-Verified</span>
                        </div>

                        <div className="flex items-center justify-between bg-slate-900/20 border border-slate-850 p-2.5 rounded-lg">
                            <div className="flex items-center gap-2.5 text-xs text-slate-300">
                                <XCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                                <span>Site restoration photos (Road asphalted)</span>
                            </div>
                            <span className="text-[9px] text-red-400 font-bold">📸 Missing</span>
                        </div>

                        <div className="flex items-center justify-between bg-slate-900/20 border border-slate-850 p-2.5 rounded-lg">
                            <div className="flex items-center gap-2.5 text-xs text-slate-300">
                                <XCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                                <span>QA Manager Digital Sign-off</span>
                            </div>
                            <span className="text-[9px] text-red-400 font-bold">⏳ Pending</span>
                        </div>

                    </div>

                    {/* Approval Flow */}
                    <div className="flex items-center justify-center gap-2 text-[9px] text-slate-500">
                        <CheckSquare className="w-3 h-3 text-emerald-500" />
                        <span>Checklist</span>
                        <span>→</span>
                        <Camera className="w-3 h-3 text-blue-500" />
                        <span>Photos</span>
                        <span>→</span>
                        <Users className="w-3 h-3 text-amber-500" />
                        <span>Approved</span>
                    </div>

                    {/* Control Buttons */}
                    <div className="flex gap-2 pt-2">
                        <button disabled className="flex-1 bg-slate-850 text-slate-500 text-xs font-bold py-2 rounded-lg cursor-not-allowed border border-slate-800">
                            Approve & Unlock
                        </button>
                        <button className="bg-red-900/30 text-red-400 border border-red-800/50 hover:bg-red-900/50 text-xs font-bold px-4 py-2 rounded-lg">
                            Reject & Notify
                        </button>
                    </div>
                </div>

            </div>
        </div>
    );
}