"use client";
import React from "react";
import { Truck, QrCode, DollarSign, Calendar, Smartphone, Gauge, AlertTriangle, TrendingUp } from "lucide-react";

export default function Slide12() {
    const qrFeatures = [
        { icon: QrCode, label: "Scan QR Code", desc: "Vehicle dashboard sticker", color: "text-blue-400" },
        { icon: Gauge, label: "Enter Odometer", desc: "Start/End readings", color: "text-amber-400" },
        { icon: Smartphone, label: "Mobile Submit", desc: "Duty On / Off log", color: "text-emerald-400" },
        { icon: AlertTriangle, label: "Validate", desc: "Out-of-range warnings", color: "text-rose-400" },
    ];

    return (
        <div className="flex flex-col h-full justify-center max-w-6xl mx-auto py-2">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
                
                {/* Left: Content */}
                <div className="lg:col-span-5 space-y-4">
                    <div className="flex items-center gap-2">
                        <span className="bg-blue-500/15 p-1.5 rounded-lg text-blue-400">
                            <Truck className="w-5 h-5" />
                        </span>
                        <span className="text-xs font-bold text-blue-400 uppercase tracking-wider">
                            Module 04: Vehicle Management
                        </span>
                    </div>
                    <h2 className="text-2xl sm:text-3xl font-extrabold bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent leading-tight">
                        Vehicle Logs & Rental Payouts
                    </h2>
                    <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                        SLT utilizes dozens of contracted vehicles for daily operations. This module tracks fleet movement and rental costs.
                    </p>
                    <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                        Drivers use their smartphones to scan a cabin <strong className="text-white">QR Code</strong> to submit start/end odometer values. The system auto-calculates monthly lease payments based on trips and fuel rates.
                    </p>

                    {/* QR Flow */}
                    <div className="space-y-1.5">
                        {qrFeatures.map((f, idx) => {
                            const Icon = f.icon;
                            return (
                                <div key={f.label} className="flex items-center gap-2.5 bg-slate-900/50 border border-slate-800 rounded-lg p-2">
                                    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-blue-500 text-white flex items-center justify-center text-[9px] font-bold">{idx + 1}</span>
                                    <Icon className={`w-4 h-4 ${f.color}`} />
                                    <span className="text-[10px] text-slate-300 font-medium">{f.desc}</span>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Right: Driver Log Check-In Card Mockup */}
                <div className="lg:col-span-7 bg-slate-950/80 border border-slate-800 rounded-2xl p-5 shadow-2xl space-y-4">
                    {/* Window chrome */}
                    <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                        <div className="flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
                            <span className="w-2.5 h-2.5 rounded-full bg-yellow-500" />
                            <span className="w-2.5 h-2.5 rounded-full bg-green-500" />
                        </div>
                        <span className="text-[10px] font-mono text-slate-500">QR Mobile Driver Log View</span>
                    </div>

                    {/* Vector: Truck QR Scan */}
                    <div className="mb-2">
                        <svg viewBox="0 0 400 45" className="w-full h-12 opacity-65" xmlns="http://www.w3.org/2000/svg">
                            {/* Truck body */}
                            <rect x="50" y="18" width="80" height="20" rx="2" fill="#3b82f6" opacity="0.25" stroke="#60a5fa" strokeWidth="0.5" />
                            <rect x="130" y="12" width="40" height="26" rx="3" fill="#3b82f6" opacity="0.2" stroke="#60a5fa" strokeWidth="0.5" />
                            {/* Wheels */}
                            <circle cx="75" cy="40" r="5" fill="#94a3b8" opacity="0.4" stroke="#64748b" strokeWidth="0.5" />
                            <circle cx="155" cy="40" r="5" fill="#94a3b8" opacity="0.4" stroke="#64748b" strokeWidth="0.5" />
                            {/* QR code on truck */}
                            <rect x="60" y="22" width="14" height="14" rx="1" fill="#1e293b" stroke="#475569" strokeWidth="0.3" />
                            <rect x="62" y="24" width="3" height="3" fill="#60a5fa" opacity="0.6" />
                            <rect x="67" y="24" width="3" height="3" fill="#60a5fa" opacity="0.6" />
                            <rect x="62" y="29" width="3" height="3" fill="#60a5fa" opacity="0.6" />
                            <rect x="67" y="29" width="3" height="3" fill="#60a5fa" opacity="0.4" />
                            {/* Scan beam */}
                            <line x1="195" y1="10" x2="215" y2="35" stroke="#10b981" strokeWidth="0.5" strokeDasharray="2,2" />
                            {/* Phone */}
                            <rect x="215" y="8" width="20" height="30" rx="3" fill="#334155" stroke="#475569" strokeWidth="0.5" />
                            <rect x="218" y="12" width="14" height="18" rx="1" fill="#1e293b" />
                            <text x="225" y="23" textAnchor="middle" fill="#34d399" fontSize="6" fontWeight="bold">✓</text>
                            {/* Check */}
                            <circle cx="250" cy="23" r="8" fill="#10b981" opacity="0.3" stroke="#34d399" strokeWidth="0.5" />
                            <polyline points="246,23 249,26 255,19" fill="none" stroke="#34d399" strokeWidth="1" />
                            {/* Odometer icon */}
                            <circle cx="310" cy="22" r="10" fill="none" stroke="#fbbf24" strokeWidth="1" opacity="0.5" />
                            <text x="310" y="25" textAnchor="middle" fill="#fcd34d" fontSize="5" fontWeight="bold">ODO</text>
                            <line x1="320" y1="22" x2="340" y2="22" stroke="#475569" strokeWidth="0.5" />
                            <rect x="340" y="16" width="35" height="12" rx="2" fill="#fbbf24" opacity="0.15" stroke="#f59e0b" strokeWidth="0.4" />
                            <text x="357" y="24" textAnchor="middle" fill="#fcd34d" fontSize="5">+135km</text>
                        </svg>
                    </div>
                    {/* Driver & vehicle summary info */}
                    <div className="flex justify-between items-center text-xs bg-slate-900/60 border border-slate-800 rounded-xl p-3.5">
                        <div className="flex items-center gap-3">
                            <span className="p-2.5 bg-blue-500/10 rounded-lg text-blue-400">
                                <Truck className="w-5 h-5" />
                            </span>
                            <div>
                                <h4 className="font-bold text-white">Toyota Hilux (WP CAD-4024)</h4>
                                <p className="text-[10px] text-slate-500">Driver: K. A. Wickramasinghe</p>
                            </div>
                        </div>
                        <QrCode className="w-7 h-7 text-slate-400" />
                    </div>

                    {/* Trip Ledger details */}
                    <div className="grid grid-cols-2 gap-3 text-xs">
                        <div className="bg-slate-900/30 border border-slate-850 p-2.5 rounded-lg space-y-1">
                            <span className="text-[9px] text-slate-500 uppercase">Start Odometer</span>
                            <p className="font-mono font-bold text-white">124,150 km</p>
                        </div>
                        <div className="bg-slate-900/30 border border-slate-850 p-2.5 rounded-lg space-y-1">
                            <span className="text-[9px] text-slate-500 uppercase">End Odometer</span>
                            <p className="font-mono font-bold text-white">124,285 km <span className="text-blue-400 font-bold">(+135 km)</span></p>
                        </div>
                    </div>

                    {/* Lease Cost Block & Payment Summary */}
                    <div className="grid grid-cols-2 gap-3">
                        <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-3 text-xs">
                            <span className="text-[9px] text-slate-500 uppercase block">Lease Cost</span>
                            <p className="font-mono text-emerald-400 font-extrabold text-sm">LKR 6,500.00</p>
                            <p className="text-[8px] text-slate-500">0% Mileage Surcharge</p>
                        </div>
                        <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-3 text-xs">
                            <div className="flex items-center gap-1.5">
                                <TrendingUp className="w-3.5 h-3.5 text-blue-400" />
                                <span className="text-[9px] text-slate-500 uppercase">Efficiency</span>
                            </div>
                            <p className="text-[9px] text-slate-400 mt-1">Reconcile & approve in 5 min per vehicle ⚡</p>
                        </div>
                    </div>

                    {/* Warning */}
                    <div className="flex items-center gap-2 bg-rose-500/5 border border-rose-500/20 rounded-lg p-2 text-[10px] text-rose-300">
                        <AlertTriangle className="w-3.5 h-3.5 text-rose-400 flex-shrink-0" />
                        <span>Odometer out-of-range warnings flag potential errors (e.g., 500km+ single shift)</span>
                    </div>
                </div>

            </div>
        </div>
    );
}