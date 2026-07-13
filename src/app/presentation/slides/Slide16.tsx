"use client";
import React from "react";
import { Server, Database, Cloud, HardDrive, Layers, Bot, Globe, Mail, Plus } from "lucide-react";

export default function Slide16() {
    const doItems = [
        { title: "VPS 1: App Host", desc: "DigitalOcean Droplet (4GB RAM, 2 vCPUs)", cost: "$24.00/mo", icon: Server, color: "text-blue-400" },
        { title: "VPS 2: Write Master", desc: "DO Droplet - PostgreSQL Primary", cost: "$24.00/mo", icon: Database, color: "text-blue-400" },
        { title: "VPS 3: Read Replica", desc: "DO Droplet - PostgreSQL Replica", cost: "$24.00/mo", icon: Database, color: "text-blue-400" },
        { title: "Object Storage", desc: "DigitalOcean Spaces (250GB, S3 Compatible)", cost: "$5.00/mo", icon: HardDrive, color: "text-blue-400" },
    ];

    const supabaseItems = [
        { title: "VPS 1: App Host", desc: "DigitalOcean Droplet (4GB RAM, 2 vCPUs)", cost: "$24.00/mo", icon: Server, color: "text-emerald-400" },
        { title: "Supabase Primary DB", desc: "Managed PostgreSQL (PostGIS, auto-backups)", cost: "$25.00/mo", icon: Database, color: "text-emerald-400" },
        { title: "Supabase Read Replica", desc: "Managed Read Replica node for heavy reporting", cost: "$25.00/mo", icon: Database, color: "text-emerald-400" },
        { title: "Object Storage", desc: "Supabase Storage (Built-in CDN storage)", cost: "$0.00", icon: HardDrive, color: "text-emerald-400" },
    ];

    return (
        <div className="flex flex-col h-full justify-center max-w-6xl mx-auto py-2 space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
                
                {/* Left: Content */}
                <div className="lg:col-span-4 space-y-4">
                    <div className="flex items-center gap-2">
                        <span className="bg-blue-500/15 p-1.5 rounded-lg text-blue-400">
                            <Layers className="w-5 h-5" />
                        </span>
                        <span className="text-xs font-bold text-blue-400 uppercase tracking-wider">
                            Database Architecture & Costing
                        </span>
                    </div>
                    <h2 className="text-2xl sm:text-3xl font-extrabold bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent leading-tight">
                        Deployment Costing
                    </h2>
                    <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                        To handle 200,000 JSON writes/hour and 200 active users, a split read-write architecture on sustained-CPU infrastructure is required.
                    </p>
                    <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                        Below is the comparative server cost (Option A vs B) alongside the shared API and operational costs required to run the full application.
                    </p>
                </div>

                {/* Right: Comparative Costing Grid */}
                <div className="lg:col-span-8 grid grid-cols-1 md:grid-cols-2 gap-4">
                    
                    {/* Option A: Self-Hosted DO Stack */}
                    <div className="bg-slate-950/80 border border-blue-900/40 rounded-2xl p-5 shadow-2xl flex flex-col justify-between space-y-4 relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 rounded-full blur-2xl pointer-events-none" />
                        <div>
                            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-3">
                                <div>
                                    <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                                        Option A: Self-Hosted
                                    </h3>
                                    <span className="text-[9px] text-slate-500 uppercase font-bold tracking-wider">DigitalOcean Droplets</span>
                                </div>
                                <span className="text-[10px] font-mono text-blue-400 font-bold">A</span>
                            </div>

                            <div className="space-y-3">
                                {doItems.map((item, idx) => {
                                    const Icon = item.icon;
                                    return (
                                        <div key={idx} className="flex items-start gap-2.5">
                                            <Icon className={`w-4 h-4 ${item.color} flex-shrink-0 mt-0.5`} />
                                            <div className="space-y-0.5">
                                                <div className="flex justify-between w-full gap-2">
                                                    <p className="text-[10px] font-bold text-slate-200">{item.title}</p>
                                                    <span className="text-[10px] font-mono text-slate-400 font-bold">{item.cost}</span>
                                                </div>
                                                <p className="text-[8px] text-slate-500 leading-normal">{item.desc}</p>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="bg-blue-500/5 border border-blue-500/15 rounded-xl p-3 flex justify-between items-center mt-2">
                            <div>
                                <p className="text-[8px] text-slate-400 uppercase tracking-wider font-bold">Server Cost</p>
                                <p className="text-lg font-extrabold text-blue-400 font-mono mt-0.5">~$77.00/mo</p>
                            </div>
                        </div>
                    </div>

                    {/* Option B: Managed Supabase Stack */}
                    <div className="bg-slate-950/80 border border-emerald-900/40 rounded-2xl p-5 shadow-2xl flex flex-col justify-between space-y-4 relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none" />
                        <div>
                            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-3">
                                <div>
                                    <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                                        Option B: Managed Cloud
                                    </h3>
                                    <span className="text-[9px] text-slate-500 uppercase font-bold tracking-wider">DO App + Supabase DB</span>
                                </div>
                                <span className="text-[10px] font-mono text-emerald-500 font-bold">B</span>
                            </div>

                            <div className="space-y-3">
                                {supabaseItems.map((item, idx) => {
                                    const Icon = item.icon;
                                    return (
                                        <div key={idx} className="flex items-start gap-2.5">
                                            <Icon className={`w-4 h-4 ${item.color} flex-shrink-0 mt-0.5`} />
                                            <div className="space-y-0.5">
                                                <div className="flex justify-between w-full gap-2">
                                                    <p className="text-[10px] font-bold text-slate-200">{item.title}</p>
                                                    <span className="text-[10px] font-mono text-emerald-400 font-bold">{item.cost}</span>
                                                </div>
                                                <p className="text-[8px] text-slate-500 leading-normal">{item.desc}</p>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-3 flex justify-between items-center mt-2">
                            <div>
                                <p className="text-[8px] text-slate-400 uppercase tracking-wider font-bold">Server Cost</p>
                                <p className="text-lg font-extrabold text-emerald-400 font-mono mt-0.5">~$74.00/mo</p>
                            </div>
                        </div>
                    </div>

                </div>
            </div>

            {/* Shared API & Operational Costs */}
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 shadow-inner relative overflow-hidden">
                <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Plus className="w-4 h-4 text-purple-400" />
                        <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                            Shared API & Operational Costs
                        </h3>
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full sm:w-auto">
                        <div className="flex items-center gap-3 bg-slate-950/50 p-2.5 rounded-lg border border-slate-800/50">
                            <Bot className="text-purple-400 w-5 h-5 flex-shrink-0" />
                            <div>
                                <div className="flex items-center justify-between gap-3">
                                    <p className="text-[10px] font-bold text-slate-200">Gemini API</p>
                                    <span className="text-[10px] font-mono text-purple-400 font-bold">~$15.00/mo</span>
                                </div>
                                <p className="text-[8px] text-slate-400">AI spatial analysis & NLP queries</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-3 bg-slate-950/50 p-2.5 rounded-lg border border-slate-800/50">
                            <Mail className="text-orange-400 w-5 h-5 flex-shrink-0" />
                            <div>
                                <div className="flex items-center justify-between gap-3">
                                    <p className="text-[10px] font-bold text-slate-200">Transactional Email</p>
                                    <span className="text-[10px] font-mono text-orange-400 font-bold">$0.00/mo</span>
                                </div>
                                <p className="text-[8px] text-slate-400">Resend/SendGrid (Free Tier)</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-3 bg-slate-950/50 p-2.5 rounded-lg border border-slate-800/50">
                            <Globe className="text-cyan-400 w-5 h-5 flex-shrink-0" />
                            <div>
                                <div className="flex items-center justify-between gap-3">
                                    <p className="text-[10px] font-bold text-slate-200">Domain & DNS</p>
                                    <span className="text-[10px] font-mono text-cyan-400 font-bold">~$2.00/mo</span>
                                </div>
                                <p className="text-[8px] text-slate-400">Cloudflare DNS routing & SSL</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

        </div>
    );
}
