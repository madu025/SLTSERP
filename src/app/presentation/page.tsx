"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import {
    ChevronLeft,
    ChevronRight,
    Play,
    Pause,
    Maximize2,
    Minimize2,
    BookOpen,
    ArrowRight,
    Home,
    Layers,
    CheckCircle2,
    Settings,
    Warehouse,
    Users,
    Bell,
    FileSpreadsheet,
    FileDown,
    Clock,
    ShieldAlert,
    X,
    TrendingUp,
    HelpCircle,
    Zap,
    ExternalLink,
    Banknote,
    Archive
} from "lucide-react";

interface Slide {
    id: number;
    chapter: string;
    title: string;
    subtitle: string;
    icon: React.ComponentType<{ className?: string }>;
    content: React.ReactNode;
}

// ─── Slide content defined outside the component to avoid re-renders ───
const SLIDES: Slide[] = [
    {
        id: 1,
        chapter: "Welcome to SLTSERP",
        title: "SLTS Workflow Management",
        subtitle: "End-to-End Telecom Operations Management Platform",
        icon: Layers,
        content: (
            <div className="flex flex-col items-center justify-center text-center space-y-6 sm:space-y-8 h-full max-w-4xl mx-auto py-2 sm:py-6">
                <div className="relative">
                    <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-emerald-600 rounded-full blur opacity-45 animate-pulse" />
                    <div className="relative bg-slate-900 border border-slate-700/80 p-5 sm:p-6 rounded-full">
                        <Layers className="w-12 h-12 sm:w-16 sm:h-16 text-blue-400" />
                    </div>
                </div>
                <div>
                    <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent tracking-tight">
                        SLTS Workflow Management
                    </h2>
                    <p className="text-slate-400 text-xs sm:text-sm md:text-base lg:text-lg mt-3 sm:mt-4 max-w-3xl font-medium leading-relaxed">
                        Built specifically for OSP teams to manage structured project lifecycles (WBS, retentions, change orders) and coordinate customer service orders, contractor assignments, and warehouse stock.
                    </p>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4 w-full pt-4 sm:pt-6 justify-center">
                    {[
                        { label: "Operations Team", emoji: "📋", desc: "Service Order Sheets" },
                        { label: "OSP Projects", emoji: "📁", desc: "WBS & Task Schedules" },
                        { label: "Store Keepers", emoji: "🏭", desc: "Warehouse GRN & Stock" },
                        { label: "Contractor Teams", emoji: "👷", desc: "Job Completion Logs" },
                        { label: "OSP Managers", emoji: "👔", desc: "Analytics, Budgets & Audits" }
                    ].map((role, i) => (
                        <div key={i} className="bg-slate-900/40 border border-slate-800/80 p-3 sm:p-4 rounded-xl backdrop-blur-sm hover:border-slate-700/50 transition-colors">
                            <p className="text-xs sm:text-sm font-bold text-slate-200">{role.emoji} {role.label}</p>
                            <p className="text-[10px] sm:text-xs text-slate-500 mt-1">{role.desc}</p>
                        </div>
                    ))}
                </div>
            </div>
        )
    },
    {
        id: 2,
        chapter: "Introduction to SLTSERP",
        title: "Presentation Flow & Key Modules",
        subtitle: "A structured walkthrough of the SLTSERP architecture and features",
        icon: BookOpen,
        content: (
            <div className="flex flex-col space-y-6 sm:space-y-8 h-full justify-center max-w-5xl mx-auto py-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4">
                    {[
                        { num: "01", title: "SOD Module", desc: "Service Order Sheets, inline editing, completions, wastage control, bulk imports, and billing split.", color: "from-blue-600 to-indigo-600" },
                        { num: "02", title: "OSP Projects", desc: "WBS hierarchies, parent-child progress syncing, change orders, procurement, and project closures.", color: "from-emerald-600 to-teal-600" },
                        { num: "03", title: "Warehouse Stock", desc: "Material ledgers, GRN tracking, safety level alerts, and client-side gate pass PDF exports.", color: "from-purple-600 to-pink-600" },
                        { num: "04", title: "Manager Analytics", desc: "Regional dashboards, contractor efficiency lists, wastage comparisons, and budget reports.", color: "from-amber-600 to-orange-600" },
                        { num: "05", title: "Security & Tools", desc: "Contractor verification codes, global SLA notification alarms, and notification preferences.", color: "from-rose-600 to-red-600" }
                    ].map((section, idx) => (
                        <div key={idx} className="bg-slate-900 border border-slate-800 p-4 sm:p-5 rounded-xl flex flex-col justify-between space-y-4 shadow-lg relative overflow-hidden group hover:border-slate-700/60 transition-colors min-h-[140px] sm:min-h-[185px]">
                            <div className={`absolute top-0 left-0 w-full h-1 bg-gradient-to-r ${section.color}`} />
                            <div className="space-y-2">
                                <div className="text-[10px] sm:text-xs font-black text-slate-500 font-mono tracking-widest uppercase">{section.num}</div>
                                <h4 className="text-xs sm:text-sm font-bold text-slate-200">{section.title}</h4>
                                <p className="text-[10px] sm:text-xs text-slate-400 leading-relaxed font-medium">{section.desc}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        )
    },
    {
        id: 3,
        chapter: "Introduction to SLTSERP",
        title: "Centralized Database vs. Scattered Excels",
        subtitle: "Solving operational disconnects and double data entry",
        icon: HelpCircle,
        content: (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 h-full items-center max-w-5xl mx-auto py-2 sm:py-6">
                <div className="space-y-4">
                    <h3 className="text-xl sm:text-2xl font-bold text-rose-400 flex items-center gap-2">
                        <X className="w-5 h-5 sm:w-6 sm:h-6" /> The Old Offline Flow
                    </h3>
                    <div className="space-y-3">
                        <div className="bg-rose-950/20 border border-rose-900/30 p-4 rounded-lg text-slate-400 text-xs sm:text-sm">
                            <span className="font-bold text-rose-300 block mb-1">Scattered Excel Sheets</span>
                            Service orders tracked in separate sheets, leading to data synchronization lag.
                        </div>
                        <div className="bg-rose-950/20 border border-rose-900/30 p-4 rounded-lg text-slate-400 text-xs sm:text-sm">
                            <span className="font-bold text-rose-300 block mb-1">Manual Stock Reconciliation</span>
                            Warehouse stock issues and contractor usage recorded in different sheets, causing inventory discrepancies.
                        </div>
                        <div className="bg-rose-950/20 border border-rose-900/30 p-4 rounded-lg text-slate-400 text-xs sm:text-sm">
                            <span className="font-bold text-rose-300 block mb-1">Slow Audit Trials</span>
                            Finding which contractor completed which job and what specific items they used takes days of manual email search.
                        </div>
                    </div>
                </div>

                <div className="space-y-4">
                    <h3 className="text-xl sm:text-2xl font-bold text-emerald-400 flex items-center gap-2">
                        <CheckCircle2 className="w-5 h-5 sm:w-6 sm:h-6" /> The Central ERP Flow
                    </h3>
                    <div className="space-y-3">
                        <div className="bg-emerald-950/20 border border-emerald-900/30 p-4 rounded-lg text-slate-300 text-xs sm:text-sm shadow-lg shadow-emerald-950/5">
                            <span className="font-bold text-emerald-300 block mb-1">One Shared Database</span>
                            Single source of truth. Updates to service orders or material stock instantly propagate to all departments.
                        </div>
                        <div className="bg-emerald-950/20 border border-emerald-900/30 p-4 rounded-lg text-slate-300 text-xs sm:text-sm shadow-lg shadow-emerald-950/5">
                            <span className="font-bold text-emerald-300 block mb-1">Real-time Stock & Procurement Control</span>
                            Warehouse stock issues and contractor allocations are verified and tracked against active project purchase orders.
                        </div>
                        <div className="bg-emerald-950/20 border border-emerald-900/30 p-4 rounded-lg text-slate-300 text-xs sm:text-sm shadow-lg shadow-emerald-950/5">
                            <span className="font-bold text-emerald-300 block mb-1">Manager Analytics & Audits</span>
                            Automated reports for project budgets, contractor performance rankings, and approvals backed by transactional logs.
                        </div>
                    </div>
                </div>
            </div>
        )
    },
    {
        id: 4,
        chapter: "Service Order Details (SOD)",
        title: "Service Order Sheet (Sheet Mode)",
        subtitle: "Dense, spreadsheet-style table optimized for rapid data updates",
        icon: FileSpreadsheet,
        content: (
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 h-full items-center max-w-5xl mx-auto py-2 sm:py-6">
                <div className="lg:col-span-2 space-y-4">
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 text-[10px] sm:text-xs font-black uppercase tracking-wider">
                        <Zap className="w-3 h-3" /> Built for speed
                    </div>
                    <h3 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">Smarter Google Sheets</h3>
                    <p className="text-slate-400 text-xs sm:text-sm leading-relaxed">
                        Allows operations officers to review hundreds of service orders in a dense spreadsheet view. Supports advanced keyboard shortcuts and background auto-save.
                    </p>
                    <ul className="space-y-2 text-xs sm:text-sm text-slate-300 font-medium">
                        <li className="flex items-start gap-2">
                            <span className="text-emerald-400 font-bold">✓</span>
                            <span><strong>Inline Field Editing:</strong> Click and type directly into DP details, comments, and schedule inputs.</span>
                        </li>
                        <li className="flex items-start gap-2">
                            <span className="text-emerald-400 font-bold">✓</span>
                            <span><strong>Column Filters & Sorting:</strong> Quick-filter search boxes underneath every column header.</span>
                        </li>
                        <li className="flex items-start gap-2">
                            <span className="text-emerald-400 font-bold">✓</span>
                            <span><strong>Keyboard Navigation:</strong> Use Up/Down arrows and Enter keys to navigate cells quickly.</span>
                        </li>
                        <li className="flex items-start gap-2">
                            <span className="text-emerald-400 font-bold">✓</span>
                            <span><strong>Auto-Save States:</strong> Real-time visual feedback: Spinner (saving), Checkmark (saved), and ERR (failed).</span>
                        </li>
                    </ul>
                </div>

                <div className="lg:col-span-3 bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-2xl p-4 sm:p-5 space-y-4">
                    <div className="border border-slate-800/80 rounded-lg overflow-hidden text-xs sm:text-sm">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-slate-800/60 border-b border-slate-800">
                                    <tr className="font-bold text-slate-400 uppercase tracking-tight text-[10px] sm:text-xs">
                                        <th className="p-3 border-r border-slate-800">SO Number</th>
                                        <th className="p-3 border-r border-slate-800">Customer Details</th>
                                        <th className="p-3 border-r border-slate-800">Contractor</th>
                                        <th className="p-3">Comments</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-800/60 bg-slate-950/40">
                                    <tr>
                                        <td className="p-3 font-mono border-r border-slate-800 text-slate-300">SO-2026-0812</td>
                                        <td className="p-3 border-r border-slate-800 text-slate-300">P. K. Silva, Kandy</td>
                                        <td className="p-3 border-r border-slate-800 bg-slate-900 text-blue-400 font-semibold select-none">
                                            Lanka Tech Team A
                                        </td>
                                        <td className="p-3 text-slate-400 relative">
                                            <span>Waiting for OSP path</span>
                                            <span className="absolute right-2 top-4 w-2 h-2 rounded-full bg-emerald-400 animate-pulse" title="Auto-saved" />
                                        </td>
                                    </tr>
                                    <tr className="bg-slate-900/20">
                                        <td className="p-3 font-mono border-r border-slate-800 text-slate-300">SO-2026-0813</td>
                                        <td className="p-3 border-r border-slate-800 text-slate-300">A. G. Perera, Gampaha</td>
                                        <td className="p-3 border-r border-slate-800 text-slate-300">Select Team...</td>
                                        <td className="p-3 text-slate-400">ONT swap required</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                    <div className="flex items-center justify-between text-[10px] sm:text-xs text-slate-500 border-t border-slate-800/80 pt-3 font-mono">
                        <span>* Use ↑↓ keys to jump rows</span>
                        <div className="flex gap-3">
                            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-blue-500" /> Saving</span>
                            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500" /> Saved</span>
                            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-rose-500" /> ERR</span>
                        </div>
                    </div>
                </div>
            </div>
        )
    },
    {
        id: 5,
        chapter: "Service Order Details (SOD)",
        title: "3-Step Order Completion Wizard",
        subtitle: "Clean, guided workflow to finalize service completions",
        icon: CheckCircle2,
        content: (
            <div className="flex flex-col space-y-6 sm:space-y-8 h-full justify-center max-w-5xl mx-auto py-2">
                <div className="text-center max-w-xl mx-auto space-y-2">
                    <h3 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">Structured Progress Wizard</h3>
                    <p className="text-slate-400 text-xs sm:text-sm">
                        Splits order closure fields into three logical tabs. Validates input values at each stage before submission.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-slate-900 border border-slate-800 p-5 sm:p-6 rounded-xl flex flex-col justify-between space-y-5 shadow-lg">
                        <div className="space-y-3">
                            <div className="text-xs font-black text-blue-400 font-mono tracking-widest uppercase">Step 01</div>
                            <h4 className="text-base font-bold text-slate-200">Details & Assignment</h4>
                            <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                                Define the job completion date. Enter the OSP Distribution Point (DP) ID. Assign the contractor team or log a direct SLT team.
                            </p>
                        </div>
                        <div className="bg-slate-950/50 p-3 rounded-lg border border-slate-800 text-xs sm:text-sm space-y-1.5 font-mono text-slate-400">
                            <div>• Completion Date</div>
                            <div>• DP Details</div>
                            <div>• Contractor Selection</div>
                        </div>
                    </div>

                    <div className="bg-slate-900 border border-slate-800 p-5 sm:p-6 rounded-xl flex flex-col justify-between space-y-5 shadow-lg">
                        <div className="space-y-3">
                            <div className="text-xs font-black text-blue-400 font-mono tracking-widest uppercase">Step 02</div>
                            <h4 className="text-base font-bold text-slate-200">Material Usage & Wastage</h4>
                            <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                                Log exact material usage quantities. Split drop-wire lengths into F1 and G1 runs. Input item-specific wastage values.
                            </p>
                        </div>
                        <div className="bg-slate-950/50 p-3 rounded-lg border border-slate-800 text-xs sm:text-sm space-y-1.5 font-mono text-slate-400">
                            <div>• F1 / G1 Drop-wire</div>
                            <div>• Connectors & Splitters</div>
                            <div>• Wastage Limit Check</div>
                        </div>
                    </div>

                    <div className="bg-slate-900 border border-slate-800 p-5 sm:p-6 rounded-xl flex flex-col justify-between space-y-5 shadow-lg">
                        <div className="space-y-3">
                            <div className="text-xs font-black text-blue-400 font-mono tracking-widest uppercase">Step 03</div>
                            <h4 className="text-base font-bold text-slate-200">Device Serials & Comments</h4>
                            <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                                Choose if the ONT Router is New or Existing. Record ONT and IPTV serial numbers. Enter operational comments.
                            </p>
                        </div>
                        <div className="bg-slate-950/50 p-3 rounded-lg border border-slate-800 text-xs sm:text-sm space-y-1.5 font-mono text-slate-400">
                            <div>• New/Existing ONT Type</div>
                            <div>• ONT & IPTV Serial Numbers</div>
                            <div>• Closing Notes / Remarks</div>
                        </div>
                    </div>
                </div>
            </div>
        )
    },
    {
        id: 6,
        chapter: "Service Order Details (SOD)",
        title: "Wastage Control & Material Sources",
        subtitle: "Enforcing compliance on OSP items and split billing records",
        icon: Settings,
        content: (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 h-full items-center max-w-5xl mx-auto py-2">
                <div className="space-y-4">
                    <div className="inline-flex items-center gap-1.5 py-0.5 px-2.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-bold">
                        RECONCILIATION PREP
                    </div>
                    <h3 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">Preventing Material Leakage</h3>
                    <p className="text-slate-400 text-xs sm:text-sm leading-relaxed">
                        To prevent contractor wastage, the system implements an active wastage monitoring system. It flags excessive usage at the point of completion.
                    </p>
                    <ul className="space-y-2 text-xs sm:text-sm text-slate-300 font-medium">
                        <li className="flex items-start gap-2">
                            <span className="text-emerald-400 font-bold">•</span>
                            <span><strong>Quick-Access Materials Grid:</strong> The most commonly consumed items (Drop-wire, Connectors, Splitters) are laid out as quick-entry fields.</span>
                        </li>
                        <li className="flex items-start gap-2">
                            <span className="text-emerald-400 font-bold">•</span>
                            <span><strong>Wastage Thresholds:</strong> If wastage values exceed maximum allowed limits (e.g. 5% on dropwire), a validation warning is logged.</span>
                        </li>
                        <li className="flex items-start gap-2">
                            <span className="text-emerald-400 font-bold">•</span>
                            <span><strong>Mandatory Reasons:</strong> Contractors must submit a valid explanation (e.g. &quot;damage on reel&quot;) for flagged wastage.</span>
                        </li>
                    </ul>
                </div>

                <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl space-y-4 shadow-xl">
                    <h4 className="text-sm sm:text-base font-bold text-slate-200">Strict Material Source Split</h4>
                    <p className="text-slate-400 text-xs leading-relaxed">
                        Materials are split by ownership tags to govern downstream accounting and contractor payments:
                    </p>

                    <div className="space-y-3 pt-2">
                        <div className="bg-slate-950/40 p-4 rounded-lg border border-slate-800 flex justify-between items-center gap-4">
                            <div className="space-y-1">
                                <span className="text-xs sm:text-sm font-bold text-emerald-400 uppercase tracking-widest font-mono">SLT Sourced</span>
                                <p className="text-[10px] sm:text-xs text-slate-500">Materials issued directly from Sri Lanka Telecom store. Cost deducted from SLTS monthly invoice by SLT.</p>
                            </div>
                            <span className="text-[9px] sm:text-[10px] font-black px-2.5 py-1 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20 shrink-0">DEDUCTED</span>
                        </div>

                        <div className="bg-slate-950/40 p-4 rounded-lg border border-slate-800 flex justify-between items-center gap-4">
                            <div className="space-y-1">
                                <span className="text-xs sm:text-sm font-bold text-amber-400 uppercase tracking-widest font-mono">SLTS Sourced</span>
                                <p className="text-[10px] sm:text-xs text-slate-500">Materials issued from SLTS warehouse. Owned by SLTS and tracked for internal project reconciliation.</p>
                            </div>
                            <span className="text-[9px] sm:text-[10px] font-black px-2.5 py-1 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 shrink-0">SLTS STOCK</span>
                        </div>
                    </div>
                </div>
            </div>
        )
    },
    {
        id: 7,
        chapter: "Service Order Details (SOD)",
        title: "Excel Import & Portal Sync",
        subtitle: "Import bulk datasets instantly and bridge direct with main monitoring",
        icon: FileSpreadsheet,
        content: (
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 h-full items-center max-w-5xl mx-auto py-2 sm:py-6">
                <div className="lg:col-span-2 space-y-4">
                    <h3 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">Smart Bulk Importing</h3>
                    <p className="text-slate-400 text-xs sm:text-sm leading-relaxed">
                        Avoid manually typing hundreds of customer records. Upload or paste Excel data directly.
                    </p>
                    <ul className="space-y-2 text-xs sm:text-sm text-slate-300 font-medium">
                        <li className="flex items-start gap-1.5">
                            <span className="text-emerald-400">✔</span>
                            <span><strong>Drag-and-Drop Files:</strong> Uploads `.xlsx`, `.xls` or `.csv` spreadsheets.</span>
                        </li>
                        <li className="flex items-start gap-1.5">
                            <span className="text-emerald-400">✔</span>
                            <span><strong>Copy & Paste Mode:</strong> Directly paste grid rows copied from desktop spreadsheets.</span>
                        </li>
                        <li className="flex items-start gap-1.5">
                            <span className="text-emerald-400">✔</span>
                            <span><strong>Validation Preview:</strong> Displays a table highlighting missing columns (like missing SOD or RTOM values) before saving.</span>
                        </li>
                    </ul>
                </div>

                <div className="lg:col-span-3 bg-slate-900 border border-slate-800 p-5 sm:p-6 rounded-xl space-y-4 shadow-xl">
                    <div className="flex items-center gap-2">
                        <div className="w-9 h-9 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                            <Zap className="w-5 h-5 text-blue-400" />
                        </div>
                        <span className="text-sm sm:text-base font-bold text-slate-200">Portal Sync Bridge API</span>
                    </div>
                    <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                        On the material completion stage, clicking <strong>Portal Sync</strong> makes an API bridge call to the telecom centralized server:
                    </p>
                    <div className="bg-slate-950/60 p-4 rounded-lg border border-slate-800 text-xs sm:text-sm space-y-2 font-mono text-slate-400">
                        <div>1. Fetches pre-logged material logs for the ticket from `/api/service-orders/bridge-sync`.</div>
                        <div>2. Parses aliases and maps code values to local stock items.</div>
                        <div>3. Automatically pre-fills quantities used, saving the contractor from double-entering data.</div>
                    </div>
                </div>
            </div>
        )
    },
    {
        id: 8,
        chapter: "Service Order Details (SOD)",
        title: "Contractor Invoicing & 90/10 Split",
        subtitle: "Seamless monthly billing generation and payment control",
        icon: Banknote,
        content: (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 h-full items-center max-w-5xl mx-auto py-2 sm:py-6">
                <div className="space-y-4">
                    <h3 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">Automated Billing Engine</h3>
                    <p className="text-slate-400 text-xs sm:text-sm leading-relaxed">
                        Generates contractor invoices on a monthly cycle based on verified completion records. Enforces the standard 90/10 payment split between SLTS and SLT.
                    </p>
                    <ul className="space-y-2 text-xs sm:text-sm text-slate-300 font-medium">
                        <li className="flex items-start gap-2">
                            <span className="text-emerald-400 font-bold">✓</span>
                            <span><strong>Monthly Invoice Generation:</strong> Automatically compiles all completed and verified service orders for the selected month.</span>
                        </li>
                        <li className="flex items-start gap-2">
                            <span className="text-emerald-400 font-bold">✓</span>
                            <span><strong>90/10 Payment Split:</strong> 90% of the billing value is allocated to SLTS (contractor portion) and 10% to SLT (service provider portion).</span>
                        </li>
                        <li className="flex items-start gap-2">
                            <span className="text-emerald-400 font-bold">✓</span>
                            <span><strong>PDF Invoice Export:</strong> Download formatted PDF invoices with itemized breakdowns for accounting and audit trails.</span>
                        </li>
                    </ul>
                </div>

                <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl space-y-4 shadow-xl">
                    <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
                        <Banknote className="w-5 h-5 text-emerald-400" />
                        <span className="text-sm font-bold text-slate-200">Payment Split Visualizer</span>
                    </div>
                    <div className="space-y-3">
                        <div className="bg-slate-950/40 p-4 rounded-lg border border-slate-800">
                            <div className="flex justify-between items-center mb-2">
                                <span className="text-xs font-bold text-blue-400">SLTS Contractor Share</span>
                                <span className="text-sm font-black text-blue-400">90%</span>
                            </div>
                            <div className="w-full bg-slate-800 rounded-full h-2">
                                <div className="bg-blue-500 h-2 rounded-full" style={{ width: "90%" }} />
                            </div>
                        </div>
                        <div className="bg-slate-950/40 p-4 rounded-lg border border-slate-800">
                            <div className="flex justify-between items-center mb-2">
                                <span className="text-xs font-bold text-amber-400">SLT Service Provider Share</span>
                                <span className="text-sm font-black text-amber-400">10%</span>
                            </div>
                            <div className="w-full bg-slate-800 rounded-full h-2">
                                <div className="bg-amber-500 h-2 rounded-full" style={{ width: "10%" }} />
                            </div>
                        </div>
                    </div>
                    <div className="bg-slate-950/40 p-3 rounded-lg border border-slate-800 text-xs text-slate-400 flex gap-3 items-center">
                        <Banknote className="w-5 h-5 text-amber-500 shrink-0" />
                        <p className="leading-tight">
                            <strong>Auto-Calculated:</strong> Split values are computed from verified order totals each billing cycle.
                        </p>
                    </div>
                </div>
            </div>
        )
    },
    {
        id: 9,
        chapter: "OSP Project Management",
        title: "WBS Hierarchies & Progress Tracking",
        subtitle: "Multi-level project structures with parent-child progress syncing",
        icon: Layers,
        content: (
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 h-full items-center max-w-5xl mx-auto py-2 sm:py-6">
                <div className="lg:col-span-2 space-y-4">
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-black uppercase tracking-wider">
                        <Layers className="w-3 h-3" /> Project Engine
                    </div>
                    <h3 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">Work Breakdown Structures</h3>
                    <p className="text-slate-400 text-xs sm:text-sm leading-relaxed">
                        Organize OSP projects into hierarchical WBS levels. Each parent task auto-syncs progress from child tasks, giving managers a real-time rollup view.
                    </p>
                    <ul className="space-y-2 text-xs sm:text-sm text-slate-300 font-medium">
                        <li className="flex items-start gap-2">
                            <span className="text-emerald-400 font-bold">✓</span>
                            <span><strong>Parent-Child Sync:</strong> Child task completions automatically update parent task progress percentages.</span>
                        </li>
                        <li className="flex items-start gap-2">
                            <span className="text-emerald-400 font-bold">✓</span>
                            <span><strong>Task Dependencies:</strong> Define prerequisite relationships between WBS items to enforce execution order.</span>
                        </li>
                        <li className="flex items-start gap-2">
                            <span className="text-emerald-400 font-bold">✓</span>
                            <span><strong>Progress Bars:</strong> Visual percentage bars on each task row for at-a-glance status checks.</span>
                        </li>
                    </ul>
                </div>

                <div className="lg:col-span-3 bg-slate-900 border border-slate-800 p-5 sm:p-6 rounded-xl space-y-4 shadow-xl">
                    <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                        <span className="text-xs sm:text-sm font-bold text-slate-200">Project: Kandy FTTH Expansion</span>
                        <span className="text-[10px] font-mono text-slate-500">WBS View</span>
                    </div>
                    <div className="space-y-2 text-xs font-mono">
                        <div className="bg-slate-950/40 p-3 rounded-lg border border-slate-800">
                            <div className="flex justify-between items-center mb-1.5">
                                <span className="text-slate-200 font-bold">1.0 Civil Works</span>
                                <span className="text-emerald-400 font-bold">78%</span>
                            </div>
                            <div className="w-full bg-slate-800 rounded-full h-1.5">
                                <div className="bg-emerald-500 h-1.5 rounded-full" style={{ width: "78%" }} />
                            </div>
                        </div>
                        <div className="bg-slate-950/40 p-3 rounded-lg border border-slate-800 ml-4">
                            <div className="flex justify-between items-center mb-1.5">
                                <span className="text-slate-300">1.1 Pole Installation</span>
                                <span className="text-emerald-400">100%</span>
                            </div>
                            <div className="w-full bg-slate-800 rounded-full h-1.5">
                                <div className="bg-emerald-500 h-1.5 rounded-full" style={{ width: "100%" }} />
                            </div>
                        </div>
                        <div className="bg-slate-950/40 p-3 rounded-lg border border-slate-800 ml-4">
                            <div className="flex justify-between items-center mb-1.5">
                                <span className="text-slate-300">1.2 Duct Laying</span>
                                <span className="text-amber-400">56%</span>
                            </div>
                            <div className="w-full bg-slate-800 rounded-full h-1.5">
                                <div className="bg-amber-500 h-1.5 rounded-full" style={{ width: "56%" }} />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        )
    },
    {
        id: 10,
        chapter: "OSP Project Management",
        title: "Change Orders & Procurement",
        subtitle: "Managing project scope changes and linking purchase orders",
        icon: Settings,
        content: (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 h-full items-center max-w-5xl mx-auto py-2 sm:py-6">
                <div className="space-y-4">
                    <h3 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">Change Order Management</h3>
                    <p className="text-slate-400 text-xs sm:text-sm leading-relaxed">
                        When project scope shifts, change orders are logged with full justification, cost impact, and approval chains. Every modification is tracked with timestamps.
                    </p>
                    <ul className="space-y-2 text-xs sm:text-sm text-slate-300 font-medium">
                        <li className="flex items-start gap-2">
                            <span className="text-emerald-400 font-bold">•</span>
                            <span><strong>Scope Adjustments:</strong> Document additions, deletions, or modifications to original project deliverables.</span>
                        </li>
                        <li className="flex items-start gap-2">
                            <span className="text-emerald-400 font-bold">•</span>
                            <span><strong>Cost Impact Analysis:</strong> Automatically calculates the financial delta between original and revised budgets.</span>
                        </li>
                        <li className="flex items-start gap-2">
                            <span className="text-emerald-400 font-bold">•</span>
                            <span><strong>Approval Workflow:</strong> Multi-level approval chain ensures only authorized managers authorize changes.</span>
                        </li>
                    </ul>
                </div>

                <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl space-y-4 shadow-xl">
                    <h4 className="text-sm sm:text-base font-bold text-slate-200 flex items-center gap-2">
                        <Archive className="w-5 h-5 text-blue-400" /> Procurement Linking
                    </h4>
                    <p className="text-slate-400 text-xs leading-relaxed">
                        Purchase orders are linked directly to WBS items, ensuring material procurement aligns with project timelines:
                    </p>
                    <div className="space-y-2.5 text-xs font-medium">
                        <div className="p-3 bg-slate-950/40 rounded-lg border border-slate-800 flex justify-between items-center">
                            <span className="text-slate-300">PO-2026-045: Fiber Cable</span>
                            <span className="text-[10px] font-black text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded">APPROVED</span>
                        </div>
                        <div className="p-3 bg-slate-950/40 rounded-lg border border-slate-800 flex justify-between items-center">
                            <span className="text-slate-300">PO-2026-046: Distribution Points</span>
                            <span className="text-[10px] font-black text-amber-400 bg-amber-500/10 px-2.5 py-0.5 rounded">PENDING</span>
                        </div>
                        <div className="p-3 bg-slate-950/40 rounded-lg border border-slate-800 flex justify-between items-center">
                            <span className="text-slate-300">PO-2026-047: Splitters & Connectors</span>
                            <span className="text-[10px] font-black text-blue-400 bg-blue-500/10 px-2.5 py-0.5 rounded">IN REVIEW</span>
                        </div>
                    </div>
                </div>
            </div>
        )
    },
    {
        id: 11,
        chapter: "OSP Project Management",
        title: "Project Closures & Retention Tracking",
        subtitle: "Formalizing project handovers and managing retention holds",
        icon: CheckCircle2,
        content: (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 h-full items-center max-w-5xl mx-auto py-2 sm:py-6">
                <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl space-y-4 shadow-xl">
                    <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center font-bold text-xs">
                            CLOSE
                        </div>
                        <div>
                            <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest font-mono">Project Closure</h4>
                            <p className="text-xs sm:text-sm font-bold text-slate-200">Formalize Handover</p>
                        </div>
                    </div>
                    <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                        Once all WBS tasks are complete, managers can initiate a formal project closure. This locks all task edits, generates a final completion report, and triggers retention hold calculations.
                    </p>
                    <div className="bg-slate-950/50 p-3 rounded-lg border border-slate-800 text-xs font-mono text-slate-400 space-y-1.5">
                        <div>• All tasks at 100% = Closure eligible</div>
                        <div>• Auto-generates closure PDF report</div>
                        <div>• Locks project from further edits</div>
                    </div>
                </div>

                <div className="space-y-4">
                    <h3 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">Retention Management</h3>
                    <p className="text-slate-400 text-xs sm:text-sm leading-relaxed">
                        A percentage of contractor payments is held back as retention until the defect liability period expires. The system tracks retention balances per project.
                    </p>
                    <ul className="space-y-2 text-xs sm:text-sm text-slate-300 font-medium">
                        <li className="flex items-start gap-2">
                            <span className="text-emerald-400 font-bold">•</span>
                            <span><strong>Retention Percentage:</strong> Configurable per contract (e.g. 5% or 10% held from each invoice payment).</span>
                        </li>
                        <li className="flex items-start gap-2">
                            <span className="text-emerald-400 font-bold">•</span>
                            <span><strong>Defect Liability Period:</strong> Tracks the warranty window. Automatically releases retention when the period expires without claims.</span>
                        </li>
                        <li className="flex items-start gap-2">
                            <span className="text-emerald-400 font-bold">•</span>
                            <span><strong>Release Workflows:</strong> Managers can manually release retention early or hold beyond the standard period if defects are reported.</span>
                        </li>
                    </ul>
                </div>
            </div>
        )
    },
    {
        id: 12,
        chapter: "Warehouse & Stock Control",
        title: "Material Ledger & GRN Tracking",
        subtitle: "Full warehouse inventory management with goods received note workflows",
        icon: Warehouse,
        content: (
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 h-full items-center max-w-5xl mx-auto py-2 sm:py-6">
                <div className="lg:col-span-2 space-y-4">
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20 text-[10px] font-black uppercase tracking-wider">
                        <Warehouse className="w-3 h-3" /> Inventory Core
                    </div>
                    <h3 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">Warehouse Operations</h3>
                    <p className="text-slate-400 text-xs sm:text-sm leading-relaxed">
                        Manages the complete material lifecycle from goods receipt to issue. Each item is tracked with quantity, source, and project allocation in a real-time ledger.
                    </p>
                    <ul className="space-y-2 text-xs sm:text-sm text-slate-300 font-medium">
                        <li className="flex items-start gap-2">
                            <span className="text-emerald-400 font-bold">✓</span>
                            <span><strong>Goods Received Notes (GRN):</strong> Record all incoming materials with supplier details, quantities, and date stamps.</span>
                        </li>
                        <li className="flex items-start gap-2">
                            <span className="text-emerald-400 font-bold">✓</span>
                            <span><strong>Material Issue Tracking:</strong> Track every item issued from the warehouse to specific contractors and projects.</span>
                        </li>
                        <li className="flex items-start gap-2">
                            <span className="text-emerald-400 font-bold">✓</span>
                            <span><strong>Stock Ledger:</strong> Running balance view showing receipts, issues, and current stock for each material item.</span>
                        </li>
                    </ul>
                </div>

                <div className="lg:col-span-3 bg-slate-900 border border-slate-800 p-5 sm:p-6 rounded-xl space-y-4 shadow-xl">
                    <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                        <span className="text-xs sm:text-sm font-bold text-slate-200 flex items-center gap-1.5"><Warehouse className="w-4 h-4 text-purple-400" /> Stock Ledger</span>
                        <span className="text-[10px] font-mono text-slate-500">Colombo Main Store</span>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse text-xs">
                            <thead className="bg-slate-800/60 border-b border-slate-800">
                                <tr className="font-bold text-slate-400 uppercase tracking-tight text-[10px]">
                                    <th className="p-2.5 border-r border-slate-800">Item</th>
                                    <th className="p-2.5 border-r border-slate-800">Received</th>
                                    <th className="p-2.5 border-r border-slate-800">Issued</th>
                                    <th className="p-2.5">Balance</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800/60 bg-slate-950/40">
                                <tr>
                                    <td className="p-2.5 border-r border-slate-800 text-slate-300 font-medium">Drop Wire (m)</td>
                                    <td className="p-2.5 border-r border-slate-800 text-emerald-400">+12,500</td>
                                    <td className="p-2.5 border-r border-slate-800 text-rose-400">-8,200</td>
                                    <td className="p-2.5 text-slate-200 font-bold">4,300</td>
                                </tr>
                                <tr>
                                    <td className="p-2.5 border-r border-slate-800 text-slate-300 font-medium">ONT Router</td>
                                    <td className="p-2.5 border-r border-slate-800 text-emerald-400">+320</td>
                                    <td className="p-2.5 border-r border-slate-800 text-rose-400">-285</td>
                                    <td className="p-2.5 text-slate-200 font-bold">35</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        )
    },
    {
        id: 13,
        chapter: "Warehouse & Stock Control",
        title: "Safety Stock Levels & Low Alerts",
        subtitle: "Automatic notifications when inventory falls below critical thresholds",
        icon: ShieldAlert,
        content: (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 h-full items-center max-w-5xl mx-auto py-2 sm:py-6">
                <div className="space-y-4">
                    <h3 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">Safety Level Monitoring</h3>
                    <p className="text-slate-400 text-xs sm:text-sm leading-relaxed">
                        Every material item in the warehouse has a configurable safety stock level. When current balance drops below this threshold, the system automatically triggers alerts to relevant personnel.
                    </p>
                    <ul className="space-y-2 text-xs sm:text-sm text-slate-300 font-medium">
                        <li className="flex items-start gap-2">
                            <span className="text-emerald-400 font-bold">•</span>
                            <span><strong>Configurable Thresholds:</strong> Each item has its own minimum stock level defined by store managers.</span>
                        </li>
                        <li className="flex items-start gap-2">
                            <span className="text-emerald-400 font-bold">•</span>
                            <span><strong>Multi-Store Support:</strong> Safety levels are tracked independently per warehouse location.</span>
                        </li>
                        <li className="flex items-start gap-2">
                            <span className="text-emerald-400 font-bold">•</span>
                            <span><strong>Auto-Procurement Suggestions:</strong> When stock is low, the system suggests reorder quantities based on historical consumption.</span>
                        </li>
                    </ul>
                </div>

                <div className="bg-slate-900 border border-slate-800 p-5 sm:p-6 rounded-xl space-y-4 shadow-xl">
                    <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                        <span className="text-xs sm:text-sm font-bold text-slate-200 flex items-center gap-1.5"><ShieldAlert className="w-4 h-4 text-amber-400" /> Stock Alert Dashboard</span>
                        <span className="text-[10px] font-mono text-rose-400">3 Items Below Safety</span>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                        <div className="bg-slate-950/60 p-4 rounded-lg border border-slate-800 text-center space-y-1.5">
                            <div className="text-[11px] font-bold text-slate-400">Colombo Store</div>
                            <div className="text-base font-black text-emerald-400">OK</div>
                            <span className="text-[9px] text-slate-600 block">Above Safety</span>
                        </div>
                        <div className="bg-slate-950/60 p-4 rounded-lg border border-slate-800 text-center space-y-1.5">
                            <div className="text-[11px] font-bold text-slate-400">Gampaha Store</div>
                            <div className="text-base font-black text-amber-400">LOW</div>
                            <span className="text-[9px] text-slate-600 block">Restock Warning</span>
                        </div>
                        <div className="bg-slate-950/60 p-4 rounded-lg border border-slate-800 text-center space-y-1.5">
                            <div className="text-[11px] font-bold text-slate-400">Kandy Store</div>
                            <div className="text-base font-black text-rose-500">CRIT</div>
                            <span className="text-[9px] text-slate-600 block">Below Safety Limit</span>
                        </div>
                    </div>
                    <div className="bg-slate-950/40 p-4 rounded-lg border border-slate-800 text-xs text-slate-400 flex gap-3 items-center">
                        <ShieldAlert className="w-6 h-6 text-amber-500 shrink-0" />
                        <p className="leading-tight">
                            <strong>Low Stock Alerts:</strong> Automatically broadcasts notification logs to Store Managers and Admins when stock falls below thresholds.
                        </p>
                    </div>
                </div>
            </div>
        )
    },
    {
        id: 14,
        chapter: "Warehouse & Stock Control",
        title: "Warehouse PDF Exports",
        subtitle: "Generate official store documents with audit signature lines",
        icon: FileDown,
        content: (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 h-full items-center max-w-5xl mx-auto py-2 sm:py-6">
                <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl space-y-4 shadow-xl">
                    <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                        <span className="text-xs sm:text-sm font-bold text-slate-200 flex items-center gap-1.5"><FileDown className="w-4 h-4 text-emerald-400" /> Store PDF Generator</span>
                        <span className="text-[10px] text-slate-500 font-mono">Client-side PDF</span>
                    </div>
                    <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                        Fully formatted, official documents compiled client-side using jsPDF. Perfect for store documentation and auditing:
                    </p>
                    <div className="space-y-2.5 text-xs font-medium">
                        <div className="p-3 bg-slate-950/40 rounded-lg border border-slate-800 flex justify-between items-center">
                            <span className="font-bold text-slate-200">Goods Received Note (GRN) PDF</span>
                            <span className="text-[10px] font-mono text-slate-500">Supplier/Store summary</span>
                        </div>
                        <div className="p-3 bg-slate-950/40 rounded-lg border border-slate-800 flex justify-between items-center">
                            <span className="font-bold text-slate-200">Gate Pass / Issue Note PDF</span>
                            <span className="text-[10px] font-mono text-slate-500">Security Check lines</span>
                        </div>
                    </div>
                </div>

                <div className="space-y-4">
                    <h3 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">Audit-Ready Paperwork</h3>
                    <p className="text-slate-400 text-xs sm:text-sm leading-relaxed">
                        Ensures every hardware item leaving the warehouse is authorized.
                    </p>
                    <ul className="space-y-2 text-xs sm:text-sm text-slate-300 font-medium">
                        <li className="flex items-start gap-2">
                            <span className="text-emerald-400 font-bold">•</span>
                            <span><strong>Standard Layout Templates:</strong> PDF layout headers include official company titles and generated references.</span>
                        </li>
                        <li className="flex items-start gap-2">
                            <span className="text-emerald-400 font-bold">•</span>
                            <span><strong>Authorized Sign-offs:</strong> Gate pass PDFs are generated with placeholder signature lines for the Store Keeper, Transport Operator, and Security Officer.</span>
                        </li>
                        <li className="flex items-start gap-2">
                            <span className="text-emerald-400 font-bold">•</span>
                            <span><strong>Direct Downloads:</strong> Save and print directly from the Inventory Requests or GRN list view with one click.</span>
                        </li>
                    </ul>
                </div>
            </div>
        )
    },
    {
        id: 15,
        chapter: "Managerial Insights",
        title: "Manager Analytics & Project Reports",
        subtitle: "Real-time dashboards tracking completion statuses, contractor performance, and regional workloads",
        icon: FileSpreadsheet,
        content: (
            <div className="grid grid-cols-1 xl:grid-cols-5 gap-8 h-full items-center max-w-5xl mx-auto py-2 sm:py-6">
                <div className="xl:col-span-2 space-y-4">
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 text-[10px] font-black uppercase tracking-wider">
                        <Zap className="w-3 h-3" /> Real-time Analytics
                    </div>
                    <h3 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">Executive Management Insights</h3>
                    <p className="text-slate-400 text-xs sm:text-sm leading-relaxed">
                        Empowers OSP Managers and Admins with direct business intelligence metrics. Auto-compiles delayed tasks, financial utilization scales, and operational summaries to streamline regional performance reviews.
                    </p>
                    <ul className="space-y-2 text-xs sm:text-sm text-slate-300 font-medium">
                        <li className="flex items-start gap-2">
                            <span className="text-emerald-400 font-bold">✓</span>
                            <span><strong>Budget Utilization Tracker:</strong> Instantly generates planned vs. actual project expense details to flag overruns before they happen.</span>
                        </li>
                        <li className="flex items-start gap-2">
                            <span className="text-emerald-400 font-bold">✓</span>
                            <span><strong>Contractor Rank & Waste Analysis:</strong> Audits contractor efficiency lists, logging active task speed, wastage metrics, and penalty counts.</span>
                        </li>
                        <li className="flex items-start gap-2">
                            <span className="text-emerald-400 font-bold">✓</span>
                            <span><strong>Regional Area Breakdowns:</strong> Groups metrics by OPMCs/RTOMs, enabling managers to assign resources where backlog load is highest.</span>
                        </li>
                    </ul>
                </div>

                <div className="xl:col-span-3 bg-slate-900 border border-slate-800 p-5 sm:p-6 rounded-xl space-y-4 shadow-xl">
                    <div className="flex justify-between items-center border-b border-slate-800 pb-2.5">
                        <span className="text-xs sm:text-sm font-bold text-slate-200 flex items-center gap-1.5"><FileSpreadsheet className="w-4 h-4 text-blue-400" /> Kandy Region OSP Summary</span>
                        <span className="text-[10px] font-mono text-slate-400">June 2026</span>
                    </div>
                    <div className="grid grid-cols-3 gap-3 text-xs text-center font-medium">
                        <div className="bg-slate-950/45 p-3 rounded-lg border border-slate-800">
                            <span className="text-slate-500 block mb-0.5">Active Projects</span>
                            <span className="text-sm sm:text-base font-black text-slate-200">8 Projects</span>
                        </div>
                        <div className="bg-slate-950/45 p-3 rounded-lg border border-slate-800">
                            <span className="text-slate-500 block mb-0.5">Budget Cap Spent</span>
                            <span className="text-sm sm:text-base font-black text-emerald-400">92.4%</span>
                        </div>
                        <div className="bg-slate-950/45 p-3 rounded-lg border border-slate-800">
                            <span className="text-slate-500 block mb-0.5">Avg completion</span>
                            <span className="text-sm sm:text-base font-black text-blue-400">74.2%</span>
                        </div>
                    </div>
                    <div className="bg-slate-950/50 p-3.5 rounded-lg border border-slate-800 space-y-2.5">
                        <div className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider">Contractor Efficiency Rankings</div>
                        <div className="space-y-2 font-mono text-xs">
                            <div className="flex justify-between items-center text-slate-300">
                                <span>1. Lanka Tech Team A (Kandy)</span>
                                <span className="text-emerald-400 font-bold">95.8% (1.2% Waste)</span>
                            </div>
                            <div className="flex justify-between items-center text-slate-300">
                                <span>2. Central OSP Builders</span>
                                <span className="text-amber-400 font-bold">81.5% (4.8% Waste)</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        )
    },
    {
        id: 16,
        chapter: "Security & Utilities",
        title: "Contractor & Verification Systems",
        subtitle: "Enforcing authorization barriers to ensure operational compliance",
        icon: Users,
        content: (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 h-full items-center max-w-5xl mx-auto py-2 sm:py-6">
                <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl space-y-4 shadow-xl">
                    <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center font-bold">
                            SEC
                        </div>
                        <div>
                            <h4 className="text-xs sm:text-sm font-black text-slate-400 uppercase tracking-widest font-mono">Verification Validation</h4>
                            <p className="text-xs sm:text-sm font-bold text-slate-200">Contractor verification codes checking</p>
                        </div>
                    </div>
                    <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                        When assigning job orders or completing work sheets, the system checks contractor data against registered master records:
                    </p>
                    <div className="bg-slate-950/50 p-4 rounded-lg border border-slate-800 text-xs font-mono text-rose-400 space-y-2">
                        <div className="font-bold text-rose-300">Warning: Code Mismatch Prevention:</div>
                        <div>If selected Contractor Team lacks a valid verification code, the system triggers a block and locks the save button.</div>
                    </div>
                </div>

                <div className="space-y-4">
                    <h3 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">Contractor Master Ledger</h3>
                    <p className="text-slate-400 text-xs sm:text-sm leading-relaxed">
                        Stores verified company details and coordinates active team pools.
                    </p>
                    <ul className="space-y-2 text-xs sm:text-sm text-slate-300 font-medium">
                        <li className="flex items-start gap-2">
                            <span className="text-emerald-400 font-bold">•</span>
                            <span><strong>Registered Contractor Profiles:</strong> Maps company codes, bank account details, and active OPMCs.</span>
                        </li>
                        <li className="flex items-start gap-2">
                            <span className="text-emerald-400 font-bold">•</span>
                            <span><strong>Team Splits:</strong> Supports multiple technical teams (Team A, Team B) registered under one parent contractor.</span>
                        </li>
                        <li className="flex items-start gap-2">
                            <span className="text-emerald-400 font-bold">•</span>
                            <span><strong>Performance Trackers:</strong> Allows filters to compare contractor completion ratios, returns, and material wastage history.</span>
                        </li>
                    </ul>
                </div>
            </div>
        )
    },
    {
        id: 17,
        chapter: "Security & Utilities",
        title: "Live Notifications & Preference Centers",
        subtitle: "Global broadcast updates with customized user preferences",
        icon: Bell,
        content: (
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 h-full items-center max-w-5xl mx-auto py-2 sm:py-6">
                <div className="lg:col-span-2 space-y-4">
                    <h3 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">Global Broadcast System</h3>
                    <p className="text-slate-400 text-xs sm:text-sm leading-relaxed">
                        Updates users of system mutations instantly. Alerts slide out as toasts on screen and populate a dedicated history log.
                    </p>
                    <div className="space-y-2.5 text-xs sm:text-sm text-slate-300 font-medium">
                        <div className="flex gap-2">
                            <span className="text-rose-400 font-bold font-mono">CRITICAL:</span>
                            <span>Security violations, failed audits, and stockouts. Bold red.</span>
                        </div>
                        <div className="flex gap-2">
                            <span className="text-amber-400 font-bold font-mono">WARNING:</span>
                            <span>Approvals pending, SLA timers expiring, high wastage.</span>
                        </div>
                        <div className="flex gap-2">
                            <span className="text-blue-400 font-bold font-mono">INFO:</span>
                            <span>New service orders imported, status changes.</span>
                        </div>
                    </div>
                </div>

                <div className="lg:col-span-3 bg-slate-900 border border-slate-800 p-5 sm:p-6 rounded-xl space-y-4 shadow-xl">
                    <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                        <span className="text-xs sm:text-sm font-bold text-slate-200 flex items-center gap-1.5"><Bell className="w-4 h-4 text-blue-400" /> Notifications settings</span>
                        <span className="text-[10px] sm:text-xs text-slate-500 font-mono">Account Preferences</span>
                    </div>
                    <p className="text-xs text-slate-500 leading-tight">
                        Users can customize notifications for their accounts. Toggle individual categories ON/OFF:
                    </p>
                    <div className="space-y-2.5 text-xs font-medium">
                        <div className="flex justify-between items-center p-3 bg-slate-950/35 rounded-lg border border-slate-800/80">
                            <span className="text-slate-300">System / Core Updates</span>
                            <span className="text-[10px] font-black text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded">ACTIVE</span>
                        </div>
                        <div className="flex justify-between items-center p-3 bg-slate-950/35 rounded-lg border border-slate-800/80">
                            <span className="text-slate-300">Inventory & Stock Alerts</span>
                            <span className="text-[10px] font-black text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded">ACTIVE</span>
                        </div>
                        <div className="flex justify-between items-center p-3 bg-slate-950/35 rounded-lg border border-slate-800/80">
                            <span className="text-slate-300">Contractor Registrations</span>
                            <span className="text-[10px] font-black text-slate-500 bg-slate-500/10 px-2.5 py-0.5 rounded">MUTED</span>
                        </div>
                    </div>
                </div>
            </div>
        )
    },
    {
        id: 18,
        chapter: "Security & Utilities",
        title: "Daily Reminders & Proactive SLA Alarms",
        subtitle: "Strict appointment notifications running globally across all views",
        icon: Clock,
        content: (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 h-full items-center max-w-5xl mx-auto py-2 sm:py-6">
                <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl space-y-4 shadow-xl">
                    <h4 className="text-xs sm:text-sm font-black text-slate-400 uppercase tracking-widest font-mono flex items-center gap-2"><Clock className="w-4 h-4 text-emerald-400" /> SLA Notification Rules</h4>
                    <p className="text-xs sm:text-sm text-slate-400 leading-relaxed font-medium">
                        Proactive alerts run in the background to ensure customer slots are met on time:
                    </p>

                    <div className="space-y-2.5 pt-2 text-xs font-mono">
                        <div className="flex justify-between items-center p-3 bg-slate-950/40 rounded-lg border border-slate-800">
                            <span className="text-slate-300 font-bold">2 Hours Before Slot</span>
                            <span className="text-blue-400 font-bold bg-blue-500/10 px-2.5 py-0.5 rounded border border-blue-500/20 font-sans">INFO REMINDER</span>
                        </div>
                        <div className="flex justify-between items-center p-3 bg-slate-950/40 rounded-lg border border-slate-800">
                            <span className="text-slate-300 font-bold">1 Hour Before Slot</span>
                            <span className="text-amber-400 font-bold bg-amber-500/10 px-2.5 py-0.5 rounded border border-amber-500/20 font-sans">URGENT REMINDER</span>
                        </div>
                        <div className="flex justify-between items-center p-3 bg-slate-950/40 rounded-lg border border-slate-800">
                            <span className="text-slate-300 font-bold">30 Mins Before Slot</span>
                            <span className="text-rose-400 font-bold bg-rose-500/10 px-2.5 py-0.5 rounded border border-rose-500/20 font-sans">CRITICAL ALARM</span>
                        </div>
                    </div>
                </div>

                <div className="space-y-4">
                    <h3 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">Today&apos;s Appointment Logins</h3>
                    <p className="text-slate-400 text-xs sm:text-sm leading-relaxed">
                        Keeps operations teams synced with daily customer slots.
                    </p>
                    <ul className="space-y-2 text-xs sm:text-sm text-slate-300 font-medium">
                        <li className="flex items-start gap-2">
                            <span className="text-emerald-400 font-bold">•</span>
                            <span><strong>Login Summary Popup:</strong> When logging in, the system checks today&apos;s schedules and pops up an overview listing all active tickets.</span>
                        </li>
                        <li className="flex items-start gap-2">
                            <span className="text-emerald-400 font-bold">•</span>
                            <span><strong>Global Alarm Injections:</strong> Proactive SLA reminders load on every page of the application, showing up no matter what the user is doing.</span>
                        </li>
                        <li className="flex items-start gap-2">
                            <span className="text-emerald-400 font-bold">•</span>
                            <span><strong>Direct Ticket Jumps:</strong> Clicking any alarm notification redirects the user straight to that service order row.</span>
                        </li>
                    </ul>
                </div>
            </div>
        )
    },
    {
        id: 19,
        chapter: "Future Roadmap",
        title: "Upcoming Upgrades & Enhancements",
        subtitle: "Proposed modules for the next phase of development",
        icon: TrendingUp,
        content: (
            <div className="flex flex-col space-y-6 sm:space-y-8 h-full justify-center max-w-5xl mx-auto py-2 sm:py-6">
                <div className="text-center max-w-xl mx-auto space-y-2">
                    <h3 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">ERP Future Roadmap</h3>
                    <p className="text-slate-400 text-xs sm:text-sm">
                        Highly anticipated features slated to extend system functionality:
                    </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                    {[
                        { title: "Cashflow Ledger", emoji: "📊", desc: "Track organizational income, outstanding payments, and regional cost centers." },
                        { title: "Accounting Package Sync", emoji: "🔌", desc: "Integrate with external accounting packages (e.g. QuickBooks, SAP) to sync contractor ledger balances." },
                        { title: "Technicians App", emoji: "📱", desc: "Technicians receive jobs, scan serial barcodes, and attach closure photos on site." },
                        { title: "GPS Dispatching", emoji: "🗺️", desc: "Track technical team locations on a live map and auto-assign tasks to closest units." },
                        { title: "Automated SMS", emoji: "📨", desc: "Auto-send confirmation messages to customers on job dispatch and completion." },
                        { title: "AI Stock Predictor", emoji: "🤖", desc: "Forecast safety stock depletion dates using historical consumption models." }
                    ].map((item, i) => (
                        <div key={i} className="bg-slate-900 border border-slate-800 p-4 sm:p-5 rounded-xl space-y-2">
                            <h4 className="text-xs sm:text-sm font-bold text-blue-400 font-mono uppercase tracking-wider">{item.emoji} {item.title}</h4>
                            <p className="text-[11px] sm:text-xs text-slate-500 leading-normal font-medium">{item.desc}</p>
                        </div>
                    ))}
                </div>
            </div>
        )
    },
    {
        id: 20,
        chapter: "Conclusion",
        title: "Unlock Operational Excellence",
        subtitle: "Transitioning SLTS connection logs to high-speed digital tracks",
        icon: CheckCircle2,
        content: (
            <div className="flex flex-col items-center justify-center text-center space-y-6 sm:space-y-8 h-full max-w-2xl mx-auto py-2 sm:py-6">
                <div className="w-16 h-16 bg-gradient-to-tr from-emerald-500 to-teal-400 text-slate-950 rounded-full flex items-center justify-center shadow-lg shadow-emerald-500/20">
                    <CheckCircle2 className="w-10 h-10" />
                </div>
                <div className="space-y-3">
                    <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-white tracking-tight">System Ready for Deployment</h2>
                    <p className="text-slate-400 text-xs sm:text-sm md:text-base leading-relaxed max-w-xl mx-auto font-medium">
                        By centering all workflows around a single web platform, SLTSERP reduces administrative delays, eliminates data discrepancies, and optimizes regional field work.
                    </p>
                </div>

                <div className="pt-4 flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
                    <button
                        onClick={() => {
                            // Navigation is handled by parent component state
                        }}
                        className="bg-gradient-to-r from-blue-600 to-emerald-600 hover:from-blue-500 hover:to-emerald-500 text-white font-bold text-xs sm:text-sm uppercase px-8 sm:px-10 py-3.5 sm:py-4 rounded-full transition-all flex items-center justify-center gap-2 group cursor-pointer shadow-lg shadow-blue-500/10"
                    >
                        <span>Log In to ERP Portal</span>
                        <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                    </button>

                    <button
                        onClick={() => {/* handled by parent */ }}
                        className="bg-slate-900 border border-slate-800 hover:bg-slate-800 hover:border-slate-700 text-slate-300 font-bold text-xs sm:text-sm uppercase px-6 sm:px-8 py-3.5 sm:py-4 rounded-full transition-all flex items-center justify-center gap-2 cursor-pointer"
                    >
                        <Home className="w-4 h-4" /> Restart Slides
                    </button>
                </div>
            </div>
        )
    }
];

export default function PresentationPage() {
    const router = useRouter();
    const [currentSlide, setCurrentSlide] = useState<number>(0);
    const [isPlaying, setIsPlaying] = useState<boolean>(false);
    const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
    const [isOutlineOpen, setIsOutlineOpen] = useState<boolean>(false);
    const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
    const [isTransitioning, setIsTransitioning] = useState<boolean>(false);

    const containerRef = useRef<HTMLDivElement>(null);
    const playTimerRef = useRef<NodeJS.Timeout | null>(null);
    const touchStartX = useRef<number | null>(null);
    const touchEndX = useRef<number | null>(null);
    const contentAreaRef = useRef<HTMLDivElement>(null);

    const slidesLength = SLIDES.length;

    // Check auth status locally to customize CTA button
    useEffect(() => {
        if (typeof window !== "undefined") {
            const token = document.cookie.split("; ").find(row => row.startsWith("token="));
            const savedSlide = localStorage.getItem("sltserp_presentation_slide");

            setTimeout(() => {
                setIsLoggedIn(!!token);
                if (savedSlide) {
                    const index = parseInt(savedSlide, 10);
                    if (index >= 0 && index < slidesLength) {
                        setCurrentSlide(index);
                    }
                }
            }, 0);
        }
    }, [slidesLength]);

    // Save active slide progress
    useEffect(() => {
        localStorage.setItem("sltserp_presentation_slide", String(currentSlide));
    }, [currentSlide]);

    const goToSlide = useCallback((index: number) => {
        if (isTransitioning) return;
        setIsTransitioning(true);
        setCurrentSlide(index);
        // Reset transition lock after animation completes
        setTimeout(() => setIsTransitioning(false), 350);
    }, [isTransitioning]);

    const handleNext = useCallback(() => {
        goToSlide((currentSlide + 1) % slidesLength);
    }, [currentSlide, slidesLength, goToSlide]);

    const handlePrev = useCallback(() => {
        goToSlide((currentSlide - 1 + slidesLength) % slidesLength);
    }, [currentSlide, slidesLength, goToSlide]);

    const handleTouchStart = (e: React.TouchEvent) => {
        touchStartX.current = e.targetTouches[0].clientX;
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        touchEndX.current = e.targetTouches[0].clientX;
    };

    const handleTouchEnd = () => {
        if (touchStartX.current === null || touchEndX.current === null) return;
        const diffX = touchStartX.current - touchEndX.current;
        const minSwipeDistance = 50;

        if (diffX > minSwipeDistance) {
            handleNext();
        } else if (diffX < -minSwipeDistance) {
            handlePrev();
        }

        touchStartX.current = null;
        touchEndX.current = null;
    };

    // Autoplay logic
    useEffect(() => {
        if (isPlaying) {
            playTimerRef.current = setInterval(() => {
                handleNext();
            }, 6000);
        } else {
            if (playTimerRef.current) clearInterval(playTimerRef.current);
        }
        return () => {
            if (playTimerRef.current) clearInterval(playTimerRef.current);
        };
    }, [isPlaying, handleNext]);

    // Keyboard handlers
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "ArrowRight" || e.key === " ") {
                e.preventDefault();
                handleNext();
            } else if (e.key === "ArrowLeft") {
                e.preventDefault();
                handlePrev();
            } else if (e.key === "Escape") {
                if (isFullscreen) {
                    setIsFullscreen(false);
                }
                if (isOutlineOpen) {
                    setIsOutlineOpen(false);
                }
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [handleNext, handlePrev, isFullscreen, isOutlineOpen]);

    // Fullscreen toggle with cross-browser support
    const toggleFullscreen = useCallback(async () => {
        const el = containerRef.current;
        if (!el) return;

        try {
            if (!document.fullscreenElement && !(document as unknown as Record<string, unknown>).webkitFullscreenElement) {
                // Enter fullscreen with vendor prefixes
                if (el.requestFullscreen) {
                    await el.requestFullscreen();
                } else if ((el as unknown as Record<string, unknown>).webkitRequestFullscreen) {
                    await (el as unknown as { webkitRequestFullscreen: () => Promise<void> }).webkitRequestFullscreen();
                } else if ((el as unknown as Record<string, unknown>).msRequestFullscreen) {
                    await (el as unknown as { msRequestFullscreen: () => Promise<void> }).msRequestFullscreen();
                }
            } else {
                // Exit fullscreen with vendor prefixes
                if (document.exitFullscreen) {
                    await document.exitFullscreen();
                } else if ((document as unknown as Record<string, unknown>).webkitExitFullscreen) {
                    await (document as unknown as { webkitExitFullscreen: () => Promise<void> }).webkitExitFullscreen();
                } else if ((document as unknown as Record<string, unknown>).msExitFullscreen) {
                    await (document as unknown as { msExitFullscreen: () => Promise<void> }).msExitFullscreen();
                }
            }
        } catch (err) {
            console.warn("Fullscreen request failed:", err);
        }
    }, []);

    // Monitor fullscreen change from browser (e.g. Esc key) — with vendor prefix support
    useEffect(() => {
        const handleFsChange = () => {
            const isFs = !!(
                document.fullscreenElement ||
                (document as unknown as Record<string, unknown>).webkitFullscreenElement ||
                (document as unknown as Record<string, unknown>).msFullscreenElement
            );
            setIsFullscreen(isFs);
        };
        document.addEventListener("fullscreenchange", handleFsChange);
        document.addEventListener("webkitfullscreenchange", handleFsChange);
        return () => {
            document.removeEventListener("fullscreenchange", handleFsChange);
            document.removeEventListener("webkitfullscreenchange", handleFsChange);
        };
    }, []);

    // Close outline when clicking outside
    useEffect(() => {
        if (!isOutlineOpen) return;
        const handleClickOutside = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            if (!target.closest("[data-outline-panel]")) {
                setIsOutlineOpen(false);
            }
        };
        // Delay to avoid closing immediately from the toggle button click
        const timer = setTimeout(() => {
            document.addEventListener("mousedown", handleClickOutside);
        }, 100);
        return () => {
            clearTimeout(timer);
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [isOutlineOpen]);

    const slide = SLIDES[currentSlide];
    const SlideIcon = slide.icon;

    return (
        <div
            ref={containerRef}
            className="min-h-[100dvh] bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white flex flex-col overflow-hidden relative font-sans select-none"
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            style={{
                paddingTop: "env(safe-area-inset-top)",
                paddingBottom: "env(safe-area-inset-bottom)"
            }}
        >
            {/* Inline custom-scrollbar styles */}
            <style jsx global>{`
                .custom-scrollbar::-webkit-scrollbar {
                    width: 4px;
                    height: 4px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: transparent;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: #334155;
                    border-radius: 9999px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: #475569;
                }

                @keyframes slideInFromLeft {
                    from { transform: translateX(-100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
                @keyframes slideInFromRight {
                    from { transform: translateX(30px); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
                @keyframes fadeSlideOut {
                    from { opacity: 1; }
                    to { opacity: 0; }
                }
                .slide-in-left {
                    animation: slideInFromLeft 0.3s ease-out forwards;
                }
                .slide-content-enter {
                    animation: slideInFromRight 0.35s ease-out forwards;
                }
            `}</style>

            {/* Background glowing decorations */}
            <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-blue-600/5 blur-3xl pointer-events-none" />
            <div className="absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full bg-emerald-500/5 blur-3xl pointer-events-none" />

            {/* HEADER */}
            <header className="flex-none px-3 sm:px-6 py-2 sm:py-4 flex items-center justify-between border-b border-slate-800/60 bg-slate-950/60 backdrop-blur-xl sticky top-0 z-50">
                <div className="flex items-center gap-2.5">
                    <span className="bg-gradient-to-r from-blue-600 to-emerald-500 text-white p-1.5 rounded-lg">
                        <Layers className="w-4 h-4 sm:w-5 sm:h-5" />
                    </span>
                    <div>
                        <h1 className="text-[10px] sm:text-xs font-black tracking-widest uppercase bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
                            SLTSERP
                        </h1>
                        <p className="text-[9px] text-slate-500 uppercase tracking-tight font-semibold">Features Showcase</p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setIsOutlineOpen(!isOutlineOpen)}
                        className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-900/60 border border-slate-800/80 transition-colors cursor-pointer flex items-center gap-1.5 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:ring-offset-1 focus:ring-offset-slate-900"
                        title="Show outline index"
                        aria-label="Toggle slide outline"
                    >
                        <BookOpen className="w-4 h-4 text-blue-400" />
                        <span className="hidden sm:inline">Outline</span>
                    </button>

                    <button
                        onClick={() => {
                            if (isLoggedIn) {
                                router.push("/dashboard");
                            } else {
                                router.push("/login");
                            }
                        }}
                        className="bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-200 font-bold text-xs uppercase px-4 py-2 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:ring-offset-1 focus:ring-offset-slate-900"
                        aria-label="Open ERP Portal"
                    >
                        <span>ERP Portal</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                    </button>
                </div>
            </header>

            {/* MAIN CONTENT AREA */}
            <main className="flex-1 min-h-0 flex overflow-hidden relative">
                {/* Backdrop overlay when outline is open */}
                {isOutlineOpen && (
                    <div
                        className="absolute inset-0 bg-black/50 backdrop-blur-sm z-30"
                        onClick={() => setIsOutlineOpen(false)}
                        aria-hidden="true"
                    />
                )}

                {/* SLIDE OUTLINE SIDEBAR (Drawer) */}
                {isOutlineOpen && (
                    <div
                        data-outline-panel
                        className="absolute inset-y-0 left-0 w-[90vw] max-w-[340px] bg-slate-950 border-r border-slate-800 p-4 flex flex-col justify-between z-40 shadow-2xl backdrop-blur-md slide-in-left"
                    >
                        <div className="space-y-4">
                            <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                                <span className="text-xs font-black tracking-widest uppercase text-slate-400">Slide Index</span>
                                <button
                                    onClick={() => setIsOutlineOpen(false)}
                                    className="p-1 rounded-md text-slate-500 hover:text-white hover:bg-slate-900 cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                                    aria-label="Close outline"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                            <div className="space-y-1 overflow-y-auto max-h-[calc(100dvh-140px)] custom-scrollbar pr-1">
                                {SLIDES.map((s, idx) => (
                                    <button
                                        key={s.id}
                                        onClick={() => {
                                            goToSlide(idx);
                                            setIsOutlineOpen(false);
                                        }}
                                        className={`w-full text-left p-2.5 rounded-lg text-xs transition-colors flex items-center gap-3 cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500/50 ${currentSlide === idx
                                                ? "bg-blue-600 text-white font-bold"
                                                : "text-slate-400 hover:bg-slate-900 hover:text-white"
                                            }`}
                                    >
                                        <span className="font-mono text-[9px] opacity-65">{s.id < 10 ? '0' : ''}{s.id}</span>
                                        <span className="truncate">{s.title}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className="text-[10px] text-slate-600 border-t border-slate-800 pt-3 font-mono">
                            Press Left/Right keys to navigate slides
                        </div>
                    </div>
                )}

                {/* SLIDE CANVAS */}
                <div
                    ref={contentAreaRef}
                    className="flex-1 flex flex-col p-2 sm:p-6 md:p-8 items-center justify-center overflow-y-auto custom-scrollbar"
                >
                    {/* Slide container (Glassmorphic) */}
                    <div className="w-full max-w-[95vw] xl:max-w-7xl bg-slate-900/50 border border-slate-800 p-4 sm:p-8 lg:p-10 rounded-2xl backdrop-blur-xl shadow-2xl flex flex-col justify-between min-h-[calc(100dvh-185px)] lg:min-h-[550px]">

                        {/* Slide Top Details */}
                        <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-4">
                            <div className="flex items-center gap-2">
                                <SlideIcon className="w-4 h-4 sm:w-5 sm:h-5 text-blue-400" />
                                <span className="text-[10px] sm:text-xs font-black uppercase tracking-widest text-slate-400 font-mono">
                                    {slide.chapter}
                                </span>
                            </div>
                            <span className="text-[10px] sm:text-xs font-black text-slate-500 font-mono bg-slate-950/60 px-2.5 py-0.5 rounded-full border border-slate-800">
                                {slide.id < 10 ? '0' : ''}{slide.id} / {slidesLength}
                            </span>
                        </div>

                        {/* Slide Core Content */}
                        <div className="flex-1 flex flex-col justify-center py-2 sm:py-4 md:py-6">
                            {/* Slide Title & Subtitle */}
                            <div className="mb-4 sm:mb-6 md:mb-8 slide-content-enter" key={`title-${slide.id}`}>
                                <h2 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent">
                                    {slide.title}
                                </h2>
                                <p className="text-xs sm:text-sm lg:text-base text-slate-400 mt-1 sm:mt-2 leading-relaxed font-medium">
                                    {slide.subtitle}
                                </p>
                            </div>

                            {/* Render Custom React Content */}
                            <div className="flex-1 flex flex-col justify-center slide-content-enter" key={`content-${slide.id}`}>
                                {slide.content}
                            </div>
                        </div>

                    </div>
                </div>
            </main>

            {/* FOOTER CONTROLS */}
            <footer className="flex-none px-2 sm:px-6 py-2 sm:py-4 border-t border-slate-800/60 bg-slate-950/70 backdrop-blur-xl sticky bottom-0 z-50 flex items-center justify-between">
                <div className="flex items-center gap-1.5 sm:gap-3">
                    <button
                        onClick={handlePrev}
                        className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-900/60 border border-slate-800/80 transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:ring-offset-1 focus:ring-offset-slate-900"
                        title="Previous Slide"
                        aria-label="Previous slide"
                    >
                        <ChevronLeft className="w-4 h-4" />
                    </button>

                    <button
                        onClick={() => setIsPlaying(!isPlaying)}
                        className={`p-2 rounded-lg border border-slate-800/80 transition-colors cursor-pointer flex items-center gap-1 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:ring-offset-1 focus:ring-offset-slate-900 ${isPlaying ? "bg-emerald-600 text-white hover:bg-emerald-500 border-emerald-500" : "text-slate-400 hover:text-white hover:bg-slate-900/60"
                            }`}
                        title={isPlaying ? "Pause Autoplay" : "Autoplay (6s interval)"}
                        aria-label={isPlaying ? "Pause autoplay" : "Start autoplay"}
                    >
                        {isPlaying ? <Pause className="w-3.5 h-3.5 animate-pulse" /> : <Play className="w-3.5 h-3.5" />}
                        <span className="hidden sm:inline">{isPlaying ? "Pause" : "Play"}</span>
                    </button>

                    <button
                        onClick={handleNext}
                        className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-900/60 border border-slate-800/80 transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:ring-offset-1 focus:ring-offset-slate-900"
                        title="Next Slide"
                        aria-label="Next slide"
                    >
                        <ChevronRight className="w-4 h-4" />
                    </button>
                </div>

                {/* Progress Indicators */}
                <div className="flex items-center gap-1 max-w-md w-full mx-2 sm:mx-6 bg-slate-950/80 p-1.5 rounded-full border border-slate-800 overflow-x-auto custom-scrollbar">
                    {SLIDES.map((s, idx) => (
                        <button
                            key={s.id}
                            onClick={() => goToSlide(idx)}
                            className={`h-1.5 rounded-full transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500/50 ${currentSlide === idx
                                    ? "bg-gradient-to-r from-blue-500 to-emerald-400 flex-1"
                                    : "bg-slate-800 hover:bg-slate-700 w-3"
                                }`}
                            title={`Jump to Slide ${s.id}: ${s.title}`}
                            aria-label={`Go to slide ${s.id}: ${s.title}`}
                        />
                    ))}
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={toggleFullscreen}
                        className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-900/60 border border-slate-800/80 transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:ring-offset-1 focus:ring-offset-slate-900"
                        title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
                        aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
                    >
                        {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                    </button>
                </div>
            </footer>
        </div>
    );
}