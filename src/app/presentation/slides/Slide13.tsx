"use client";
import React from "react";
import { TrendingUp, BellRing, Clock, AlertTriangle, AlertOctagon, Info, ExternalLink } from "lucide-react";

export default function Slide13() {
    const slaAlerts = [
        { time: "2h Before", icon: Info, color: "text-blue-400", badge: "INFO", badgeBg: "bg-blue-500/10 border-blue-500/20" },
        { time: "1h Before", icon: AlertTriangle, color: "text-amber-400", badge: "URGENT", badgeBg: "bg-amber-500/10 border-amber-500/20" },
        { time: "30m Before", icon: AlertOctagon, color: "text-rose-400", badge: "CRITICAL", badgeBg: "bg-rose-500/10 border-rose-500/20" },
    ];

    return (
        <div className="flex flex-col h-full justify-center max-w-6xl mx-auto py-2">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
                
                {/* Left: Content */}
                <div className="lg:col-span-5 space-y-4">
                    <div className="flex items-center gap-2">
                        <span className="bg-blue-500/15 p-1.5 rounded-lg text-blue-400">
                            <TrendingUp className="w-5 h-5" />
                        </span>
                        <span className="text-xs font-bold text-blue-400 uppercase tracking-wider">
                            Module 05: Manager Analytics
                        </span>
                    </div>
                    <h2 className="text-2xl sm:text-3xl font-extrabold bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent leading-tight">
                        Analytics & SLA Alarms
                    </h2>
                    <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                        To maintain high client satisfaction, the system monitors connection speeds and field delays via the <strong className="text-white">SLA Alarm Engine</strong>.
                    </p>
                    <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                        If a service order approaches its deadline, the status turns <strong className="text-red-400">Critical</strong>, triggering in-app notifications, dashboard alarms, and escalation to regional manager leads.
                    </p>

                    {/* Notification Levels */}
                    <div className="space-y-1.5">
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">🔔 Escalation Rules</p>
                        {slaAlerts.map((rule) => {
                            const Icon = rule.icon;
                            return (
                                <div key={rule.time} className="flex items-center justify-between bg-slate-900/40 border border-slate-800 rounded-lg p-2">
                                    <div className="flex items-center gap-2 text-[10px]">
                                        <Icon className={`w-3.5 h-3.5 ${rule.color}`} />
                                        <span className="text-slate-300 font-medium">{rule.time}</span>
                                    </div>
                                    <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded uppercase ${rule.badgeBg} ${rule.color}`}>{rule.badge}</span>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Right: SLA Alarms Dashboard Mockup */}
                <div className="lg:col-span-7 bg-slate-950/80 border border-slate-800 rounded-2xl p-5 shadow-2xl space-y-4">
                    {/* Window chrome */}
                    <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                        <div className="flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
                            <span className="w-2.5 h-2.5 rounded-full bg-yellow-500" />
                            <span className="w-2.5 h-2.5 rounded-full bg-green-500" />
                        </div>
                        <span className="text-[10px] font-mono text-slate-500">Live SLA Alert Monitor</span>
                    </div>

                    {/* Vector: Bell Clock Timer */}
                    <div className="mb-2">
                        <svg viewBox="0 0 400 45" className="w-full h-12 opacity-65" xmlns="http://www.w3.org/2000/svg">
                            {/* Bell body */}
                            <path d="M60,15 Q60,5 80,5 Q100,5 100,15 L100,22 L56,22 L56,15 Q56,5 60,5" fill="none" stroke="#f59e0b" strokeWidth="1" />
                            <rect x="70" y="22" width="20" height="3" rx="1" fill="#f59e0b" opacity="0.4" />
                            {/* Bell ring */}
                            <path d="M48,20 Q40,15 38,22" fill="none" stroke="#fbbf24" strokeWidth="0.8" />
                            <path d="M108,20 Q116,15 118,22" fill="none" stroke="#fbbf24" strokeWidth="0.8" />
                            {/* Clock face */}
                            <circle cx="180" cy="20" r="14" fill="none" stroke="#3b82f6" strokeWidth="1" opacity="0.6" />
                            <circle cx="180" cy="20" r="2" fill="#60a5fa" opacity="0.6" />
                            <line x1="180" y1="20" x2="180" y2="12" stroke="#60a5fa" strokeWidth="1" opacity="0.6" />
                            <line x1="180" y1="20" x2="188" y2="22" stroke="#60a5fa" strokeWidth="1" opacity="0.6" />
                            {/* Alarm wave */}
                            <line x1="210" y1="14" x2="230" y2="14" stroke="#ef4444" strokeWidth="0.6" strokeDasharray="2,1" />
                            <line x1="210" y1="20" x2="240" y2="20" stroke="#ef4444" strokeWidth="0.8" strokeDasharray="3,1.5" />
                            <line x1="210" y1="26" x2="230" y2="26" stroke="#ef4444" strokeWidth="0.6" strokeDasharray="2,1" />
                            {/* SLA stages */}
                            <rect x="260" y="6" width="30" height="10" rx="2" fill="#3b82f6" opacity="0.2" stroke="#60a5fa" strokeWidth="0.4" />
                            <text x="275" y="13" textAnchor="middle" fill="#93c5fd" fontSize="5">2h INFO</text>
                            <rect x="295" y="6" width="30" height="10" rx="2" fill="#f59e0b" opacity="0.2" stroke="#fbbf24" strokeWidth="0.4" />
                            <text x="310" y="13" textAnchor="middle" fill="#fcd34d" fontSize="5">1h URG</text>
                            <rect x="330" y="6" width="30" height="10" rx="2" fill="#ef4444" opacity="0.25" stroke="#f87171" strokeWidth="0.4" />
                            <text x="345" y="13" textAnchor="middle" fill="#fca5a5" fontSize="5">30m CRT</text>
                            {/* Arrow escalation */}
                            <line x1="260" y1="28" x2="350" y2="28" stroke="#ef4444" strokeWidth="0.5" strokeDasharray="2,2" />
                            <polygon points="350,28 345,25 345,31" fill="#ef4444" />
                            <text x="305" y="38" textAnchor="middle" fill="#f87171" fontSize="5">Escalation Path</text>
                        </svg>
                    </div>
                    {/* Alarm Banner */}
                    <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                            <span className="p-2 bg-red-500/20 rounded-lg text-red-400 animate-pulse">
                                <BellRing className="w-5 h-5" />
                            </span>
                            <div>
                                <h4 className="text-xs font-bold text-white">🚨 Critical SLA Warning (Priority 1)</h4>
                                <p className="text-[10px] text-slate-400">Escalation path triggered to Kandy Hub</p>
                            </div>
                        </div>
                        <span className="text-[10px] bg-red-500 text-white font-mono font-bold px-2 py-0.5 rounded-full">Level 3</span>
                    </div>

                    {/* Order details */}
                    <div className="bg-slate-900/30 border border-slate-850 rounded-xl p-3.5 space-y-3">
                        <div className="flex justify-between items-center text-xs">
                            <div>
                                <p className="font-bold text-white">SO-94812 — FTTH Dual Play Connection</p>
                                <p className="text-[9px] text-slate-500">Assigned: Lanka Telecom Techs Ltd</p>
                            </div>
                            <span className="font-mono text-red-400 font-bold bg-red-500/5 px-2 py-1 rounded border border-red-500/15 flex items-center gap-1 text-[10px]">
                                <Clock className="w-3.5 h-3.5" />
                                <span>1h 14m left</span>
                            </span>
                        </div>

                        {/* Timeline bar */}
                        <div className="space-y-1">
                            <div className="flex justify-between text-[8px] text-slate-500 font-mono">
                                <span>0h (Assigned)</span>
                                <span>12h (Threshold)</span>
                                <span>24h (Breach)</span>
                            </div>
                            <div className="w-full h-2 bg-slate-900 border border-slate-800 rounded-full overflow-hidden">
                                <div className="h-full bg-gradient-to-r from-blue-500 via-amber-500 to-red-500" style={{ width: "95%" }} />
                            </div>
                        </div>
                    </div>

                    {/* Today's Appointment Features */}
                    <div className="grid grid-cols-3 gap-2">
                        {[
                            { label: "Login Popup", desc: "Today's tickets", icon: BellRing },
                            { label: "Global Alarms", desc: "Cross-platform", icon: AlertTriangle },
                            { label: "Direct Jump", desc: "Click → ticket", icon: ExternalLink },
                        ].map((f) => {
                            const Fi = f.icon;
                            return (
                                <div key={f.label} className="bg-slate-900/30 border border-slate-800 rounded-lg p-2 text-center">
                                    <Fi className="w-3.5 h-3.5 text-blue-400 mx-auto mb-1" />
                                    <p className="text-[9px] font-bold text-white">{f.label}</p>
                                    <p className="text-[7px] text-slate-500">{f.desc}</p>
                                </div>
                            );
                        })}
                    </div>

                    {/* Escalate action */}
                    <div className="flex justify-end">
                        <button className="bg-red-950/40 text-red-400 border border-red-800/40 hover:bg-red-950/60 font-bold text-xs px-4 py-2 rounded-lg cursor-pointer">
                            Force Manual Escalation
                        </button>
                    </div>
                </div>

            </div>
        </div>
    );
}