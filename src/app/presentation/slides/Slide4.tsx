"use client";
import React from "react";
import { FileSpreadsheet, Upload, Check } from "lucide-react";

export default function Slide4() {
    return (
        <div className="flex flex-col h-full justify-center max-w-6xl mx-auto py-2">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
                
                {/* Left: Content */}
                <div className="lg:col-span-5 space-y-4">
                    <div className="flex items-center gap-2">
                        <span className="bg-blue-500/15 p-1.5 rounded-lg text-blue-400">
                            <FileSpreadsheet className="w-5 h-5" />
                        </span>
                        <span className="text-xs font-bold text-blue-400 uppercase tracking-wider">
                            SOD: Sheet Mode & Bulk Import
                        </span>
                    </div>
                    <h2 className="text-2xl sm:text-3xl font-extrabold bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent leading-tight">
                        Speed Up Data Entry
                    </h2>
                    <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                        Administrators frequently need to update multiple orders at once. <strong className="text-white">Sheet Mode</strong> turns the web page into an editable spreadsheet.
                    </p>
                    <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                        Rather than entering orders one-by-one, you can also perform a <strong className="text-emerald-400">Bulk Excel Import</strong> by dropping your SLT-formatted Excel file directly into the importer.
                    </p>
                    <div className="space-y-2 text-slate-300 text-xs">
                        <div className="flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                            <span>Navigate fields using Arrow/Tab keys</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                            <span>Instant background validation & auto-save</span>
                        </div>
                    </div>
                </div>

                {/* Right: Sheet Mode + Import UI Mockup */}
                <div className="lg:col-span-7 bg-slate-950/80 border border-slate-800 rounded-2xl p-5 shadow-2xl space-y-4">
                    {/* Window chrome */}
                    <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                        <div className="flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
                            <span className="w-2.5 h-2.5 rounded-full bg-yellow-500" />
                            <span className="w-2.5 h-2.5 rounded-full bg-green-500" />
                        </div>
                        <span className="text-[10px] font-mono text-slate-500">Sheet Mode Grid</span>
                    </div>

                    {/* Vector: Spreadsheet Graphic */}
                    <div className="mb-2">
                        <svg viewBox="0 0 400 45" className="w-full h-12 opacity-65" xmlns="http://www.w3.org/2000/svg">
                            {/* Table grid */}
                            <rect x="5" y="5" width="340" height="32" rx="3" fill="none" stroke="#475569" strokeWidth="0.5" />
                            <line x1="5" y1="15" x2="345" y2="15" stroke="#475569" strokeWidth="0.5" />
                            <line x1="85" y1="5" x2="85" y2="37" stroke="#475569" strokeWidth="0.5" />
                            <line x1="165" y1="5" x2="165" y2="37" stroke="#475569" strokeWidth="0.5" />
                            <line x1="245" y1="5" x2="245" y2="37" stroke="#475569" strokeWidth="0.5" />
                            {/* Upload arrow */}
                            <path d="M365,20 L380,8 L380,32 Z" fill="#10b981" opacity="0.6" />
                            <rect x="358" y="5" width="10" height="10" rx="1" fill="#10b981" opacity="0.4" />
                            <text x="363" y="13" textAnchor="middle" fill="#6ee7b7" fontSize="5">↑</text>
                        </svg>
                    </div>
                    {/* Miniature Editable Grid */}
                    <div className="overflow-x-auto border border-slate-800 rounded-xl bg-slate-900/20">
                        <table className="w-full text-left border-collapse text-[10px]">
                            <thead>
                                <tr className="border-b border-slate-800 bg-slate-900/60 text-slate-500 font-mono">
                                    <th className="p-2 border-r border-slate-800">Order ID</th>
                                    <th className="p-2 border-r border-slate-800">Client Name</th>
                                    <th className="p-2 border-r border-slate-800">Contact No</th>
                                    <th className="p-2">Location</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr className="border-b border-slate-850 hover:bg-slate-800/20 text-slate-300">
                                    <td className="p-2 border-r border-slate-800 font-mono text-blue-400">SO-2045</td>
                                    <td className="p-2 border-r border-slate-800 bg-blue-500/10 border-2 border-blue-500/50">
                                        <input type="text" defaultValue="P. K. Silva" className="bg-transparent text-white w-full focus:outline-none" />
                                    </td>
                                    <td className="p-2 border-r border-slate-800">0771234567</td>
                                    <td className="p-2">Kandy Central</td>
                                </tr>
                                <tr className="border-b border-slate-850 hover:bg-slate-800/20 text-slate-300">
                                    <td className="p-2 border-r border-slate-800 font-mono text-slate-500">SO-2046</td>
                                    <td className="p-2 border-r border-slate-800">M. Perera</td>
                                    <td className="p-2 border-r border-slate-800">0719876543</td>
                                    <td className="p-2">Colombo 04</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    {/* Bulk Excel Upload Dialog Box Mockup */}
                    <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4 flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <span className="p-2 bg-emerald-500/15 rounded-lg text-emerald-400">
                                <Upload className="w-5 h-5" />
                            </span>
                            <div>
                                <p className="text-xs font-bold text-white">slt_connections_june.xlsx</p>
                                <p className="text-[10px] text-slate-500">2.4 MB • Ready to import</p>
                            </div>
                        </div>
                        <button className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[10px] px-3 py-1.5 rounded-lg flex items-center gap-1">
                            <Check className="w-3.5 h-3.5" />
                            <span>Import (124 Rows)</span>
                        </button>
                    </div>
                </div>

            </div>
        </div>
    );
}
