"use client";
import React from "react";
import { FolderTree, MapPin, Eye, FileSignature } from "lucide-react";

export default function Slide9() {
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
                            OSP Inner: Change Requests & GIS
                        </span>
                    </div>
                    <h2 className="text-2xl sm:text-3xl font-extrabold bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent leading-tight">
                        Change Requests & GIS Audits
                    </h2>
                    <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                        When unexpected rocks or utility pipes block trenches, contractors file a <strong className="text-white">Change Request (CR)</strong> with drawings and coordinate updates.
                    </p>
                    <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                        The <strong className="text-purple-400">GIS Audit engine</strong> overlays GPS points from the field against SLT fiber maps to verify if the reported bypass matches actual coordinates.
                    </p>
                </div>

                {/* Right: Map detours and CR approvals mockup */}
                <div className="lg:col-span-7 bg-slate-950/80 border border-slate-800 rounded-2xl p-5 shadow-2xl space-y-4">
                    {/* Window chrome */}
                    <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                        <div className="flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
                            <span className="w-2.5 h-2.5 rounded-full bg-yellow-500" />
                            <span className="w-2.5 h-2.5 rounded-full bg-green-500" />
                        </div>
                        <span className="text-[10px] font-mono text-slate-500">GIS Alignment Audit Map</span>
                    </div>

                    {/* Vector: Map Route Header */}
                    <div className="mb-1">
                        <svg viewBox="0 0 400 35" className="w-full h-10 opacity-60" xmlns="http://www.w3.org/2000/svg">
                            {/* Curvy route */}
                            <path d="M30,25 C80,25 80,5 140,12 C180,17 160,30 220,18 C280,6 300,25 370,15" fill="none" stroke="#a855f7" strokeWidth="2" />
                            <circle cx="30" cy="25" r="3" fill="#3b82f6" />
                            <circle cx="140" cy="12" r="3" fill="#f59e0b" />
                            <circle cx="220" cy="18" r="3.5" fill="#ef4444" />
                            <circle cx="370" cy="15" r="3" fill="#10b981" />
                            {/* Pin icons */}
                            <line x1="220" y1="8" x2="220" y2="14" stroke="#ef4444" strokeWidth="1" />
                            <text x="220" y="7" textAnchor="middle" fill="#f87171" fontSize="5">📍</text>
                            <line x1="370" y1="5" x2="370" y2="11" stroke="#10b981" strokeWidth="1" />
                            <text x="370" y="4" textAnchor="middle" fill="#34d399" fontSize="5">✓</text>
                            <text x="100" y="30" fill="#a78bfa" fontSize="5">CR-104 Detour</text>
                        </svg>
                    </div>
                    {/* Miniature Map Panel */}
                    <div className="h-28 bg-slate-900 border border-slate-850 rounded-xl relative overflow-hidden flex items-center justify-center">
                        {/* Grid background effect */}
                        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-blue-900/10 via-transparent to-transparent pointer-events-none" />
                        
                        {/* Map paths */}
                        <svg className="w-full h-full absolute inset-0 opacity-40" xmlns="http://www.w3.org/2000/svg">
                            <line x1="20" y1="60" x2="350" y2="60" stroke="#475569" strokeWidth="2" strokeDasharray="4 4" />
                            <path d="M 20 60 L 150 60 L 180 20 L 250 20 L 280 60 L 350 60" fill="none" stroke="#a855f7" strokeWidth="3" />
                        </svg>

                        {/* Map Pins */}
                        <div className="absolute top-[50px] left-[140px] flex flex-col items-center">
                            <span className="w-2 h-2 rounded-full bg-blue-500 animate-ping absolute" />
                            <MapPin className="w-4 h-4 text-blue-500" />
                        </div>
                        <div className="absolute top-[10px] left-[200px] flex flex-col items-center">
                            <span className="w-2 h-2 rounded-full bg-purple-500 animate-ping absolute" />
                            <MapPin className="w-4 h-4 text-purple- purple-500" style={{ color: "#a855f7" }} />
                            <span className="text-[7px] bg-slate-950 px-1 py-0.2 rounded border border-purple-500/30 text-white font-mono absolute -bottom-3">Detour: 42m</span>
                        </div>

                        <span className="absolute top-2 left-3 text-[9px] text-slate-500 font-mono bg-slate-950/80 px-2 py-0.5 rounded border border-slate-800">Map View Mode: Active detours</span>
                    </div>

                    {/* Change Request card details */}
                    <div className="bg-slate-900/40 border border-slate-850 rounded-xl p-3.5 flex justify-between items-center">
                        <div className="space-y-1">
                            <div className="flex items-center gap-2">
                                <span className="bg-purple-500/10 text-purple-400 font-mono text-[9px] px-2 py-0.5 rounded border border-purple-500/15">CR-104</span>
                                <h4 className="text-xs font-bold text-white">Detour near municipal channel</h4>
                            </div>
                            <p className="text-[10px] text-slate-500">Requested Increase: +LKR 145,000.00</p>
                        </div>
                        <div className="flex items-center gap-1 bg-emerald-500/10 text-emerald-400 text-[10px] px-3 py-1 rounded-full border border-emerald-500/15 font-bold font-mono">
                            <FileSignature className="w-3.5 h-3.5" />
                            <span>APPROVED</span>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
}
