"use client";
import React from "react";
import { Warehouse, AlertTriangle, CheckCircle, Package, FileDown, ShieldAlert, ClipboardCheck } from "lucide-react";

export default function Slide11() {
    const stockItems = [
        { name: "Fiber Optic Cable (2-Core G657)", qty: "250m", status: "Critical Low", statusColor: "text-red-400 bg-red-500/10 border-red-500/20", threshold: "1,500m" },
        { name: "GPON ONT Routers", qty: "420 Units", status: "Safe", statusColor: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20", threshold: "100 Units" },
        { name: "Duct Pipes (110m Class D)", qty: "1,820m", status: "Safe", statusColor: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20", threshold: "500m" },
    ];

    const pdfTypes = [
        { title: "Goods Received Note (GRN)", desc: "Supplier & Store receipt summary", icon: FileDown, color: "text-purple-400" },
        { title: "Gate Pass / Issue Note", desc: "Security Check sign-off lines", icon: ClipboardCheck, color: "text-emerald-400" },
    ];

    return (
        <div className="flex flex-col h-full justify-center max-w-6xl mx-auto py-2">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
                
                {/* Left: Content */}
                <div className="lg:col-span-5 space-y-4">
                    <div className="flex items-center gap-2">
                        <span className="bg-blue-500/15 p-1.5 rounded-lg text-blue-400">
                            <Warehouse className="w-5 h-5" />
                        </span>
                        <span className="text-xs font-bold text-blue-400 uppercase tracking-wider">
                            Module 03: Warehouse & Stock
                        </span>
                    </div>
                    <h2 className="text-2xl sm:text-3xl font-extrabold bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent leading-tight">
                        Precision Inventory Control
                    </h2>
                    <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                        The <strong className="text-white">Warehouse & Inventory</strong> module handles stock levels across all SLT regional hubs and contractor custody accounts.
                    </p>
                    <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                        Coordinates <strong className="text-white">Material Requisition Notes (MRN)</strong>, Good Received Notes (GRN), and Material Issue Tracking — all with audit-ready PDFs and auto low-stock alerts.
                    </p>

                    {/* PDF Generator */}
                    <div className="grid grid-cols-2 gap-2">
                        {pdfTypes.map((p) => {
                            const Icon = p.icon;
                            return (
                                <div key={p.title} className="bg-slate-900/40 border border-slate-800 rounded-lg p-2 text-center">
                                    <Icon className={`w-4 h-4 ${p.color} mx-auto mb-1`} />
                                    <p className="text-[9px] font-bold text-white">{p.title}</p>
                                    <p className="text-[7px] text-slate-500">{p.desc}</p>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Right: Stock Alert Dashboard */}
                <div className="lg:col-span-7 bg-slate-950/80 border border-slate-800 rounded-2xl p-5 shadow-2xl space-y-3">
                    {/* Window chrome */}
                    <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                        <div className="flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
                            <span className="w-2.5 h-2.5 rounded-full bg-yellow-500" />
                            <span className="w-2.5 h-2.5 rounded-full bg-green-500" />
                        </div>
                        <span className="text-[10px] font-mono text-slate-500">Live Inventory Safety Ledger</span>
                    </div>

                    {/* Vector: Warehouse Shelves */}
                    <div className="mb-2">
                        <svg viewBox="0 0 400 45" className="w-full h-12 opacity-65" xmlns="http://www.w3.org/2000/svg">
                            {/* Shelf structure */}
                            <line x1="30" y1="10" x2="370" y2="10" stroke="#475569" strokeWidth="1.5" />
                            <line x1="30" y1="25" x2="370" y2="25" stroke="#475569" strokeWidth="1.5" />
                            <line x1="30" y1="40" x2="370" y2="40" stroke="#475569" strokeWidth="1.5" />
                            {/* Boxes on shelves */}
                            <rect x="40" y="2" width="22" height="8" rx="1" fill="#3b82f6" opacity="0.3" stroke="#60a5fa" strokeWidth="0.3" />
                            <rect x="68" y="3" width="22" height="7" rx="1" fill="#8b5cf6" opacity="0.3" stroke="#a78bfa" strokeWidth="0.3" />
                            <rect x="96" y="2" width="22" height="8" rx="1" fill="#f59e0b" opacity="0.3" stroke="#fbbf24" strokeWidth="0.3" />
                            <rect x="140" y="4" width="18" height="6" rx="1" fill="#10b981" opacity="0.3" stroke="#34d399" strokeWidth="0.3" />
                            {/* Low stock alert */}
                            <rect x="200" y="4" width="18" height="6" rx="1" fill="#ef4444" opacity="0.4" stroke="#f87171" strokeWidth="0.5" />
                            <text x="209" y="9" textAnchor="middle" fill="#fca5a5" fontSize="3" fontWeight="bold">!</text>
                            {/* More boxes */}
                            <rect x="50" y="14" width="20" height="10" rx="1" fill="#10b981" opacity="0.25" stroke="#34d399" strokeWidth="0.3" />
                            <rect x="76" y="16" width="18" height="8" rx="1" fill="#3b82f6" opacity="0.25" stroke="#60a5fa" strokeWidth="0.3" />
                            <rect x="110" y="14" width="20" height="10" rx="1" fill="#8b5cf6" opacity="0.25" stroke="#a78bfa" strokeWidth="0.3" />
                            {/* Critical */}
                            <rect x="230" y="15" width="16" height="8" rx="1" fill="#ef4444" opacity="0.35" stroke="#f87171" strokeWidth="0.4" />
                            <text x="238" y="21" textAnchor="middle" fill="#fca5a5" fontSize="3">LOW</text>
                            {/* Barcode effect */}
                            <rect x="300" y="30" width="55" height="8" rx="1" fill="#94a3b8" opacity="0.15" stroke="#64748b" strokeWidth="0.3" />
                            <line x1="310" y1="31" x2="310" y2="37" stroke="#64748b" strokeWidth="0.8" />
                            <line x1="315" y1="31" x2="315" y2="37" stroke="#64748b" strokeWidth="0.5" />
                            <line x1="320" y1="31" x2="320" y2="37" stroke="#64748b" strokeWidth="0.4" />
                            <line x1="325" y1="31" x2="325" y2="37" stroke="#64748b" strokeWidth="0.7" />
                            <line x1="330" y1="31" x2="330" y2="37" stroke="#64748b" strokeWidth="0.4" />
                            <line x1="335" y1="31" x2="335" y2="37" stroke="#64748b" strokeWidth="0.6" />
                            <line x1="340" y1="31" x2="340" y2="37" stroke="#64748b" strokeWidth="0.3" />
                            <line x1="345" y1="31" x2="345" y2="37" stroke="#64748b" strokeWidth="0.5" />
                            <text x="327" y="42" textAnchor="middle" fill="#94a3b8" fontSize="4">SCAN</text>
                        </svg>
                    </div>
                    {/* Store Status */}
                    <div className="grid grid-cols-3 gap-2 text-center">
                        {[
                            { name: "Colombo Store", status: "OK ✅", dot: "bg-emerald-500" },
                            { name: "Gampaha Store", status: "LOW ⚠️", dot: "bg-amber-500" },
                            { name: "Kandy Store", status: "CRIT 🚨", dot: "bg-rose-500" },
                        ].map((s) => (
                            <div key={s.name} className="bg-slate-900/30 border border-slate-800 rounded-lg p-2">
                                <span className="text-[9px] text-slate-400">{s.name}</span>
                                <div className="flex items-center justify-center gap-1 mt-1">
                                    <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
                                    <span className="text-[9px] font-bold text-white">{s.status}</span>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Stock items lists */}
                    <div className="space-y-2">
                        {stockItems.map((item) => (
                            <div key={item.name} className={`rounded-xl p-3 flex justify-between items-center text-xs border ${item.status === "Critical Low" ? "bg-red-500/5 border-red-500/20" : "bg-slate-900/30 border-slate-850"}`}>
                                <div className="flex gap-2.5 items-center">
                                    <span className={`p-1.5 rounded-lg ${item.statusColor.split(" ")[1]} ${item.statusColor.split(" ")[2]}`}>
                                        <Package className="w-4 h-4" />
                                    </span>
                                    <div>
                                        <p className="font-bold text-white">{item.name}</p>
                                        <p className="text-[9px] text-slate-500">Threshold: {item.threshold}</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className={`font-mono font-bold ${item.status === "Critical Low" ? "text-red-400" : "text-slate-300"}`}>{item.qty}</p>
                                    <span className={`text-[8px] px-1.5 py-0.2 rounded font-bold uppercase tracking-wider ${item.statusColor}`}>{item.status}</span>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Auto-Alert Note */}
                    <div className="flex items-center gap-2 bg-amber-500/5 border border-amber-500/20 rounded-lg p-2 text-[10px] text-amber-300">
                        <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
                        <span>Auto-notifications broadcast when stock falls below thresholds 🔔</span>
                    </div>
                </div>

            </div>
        </div>
    );
}