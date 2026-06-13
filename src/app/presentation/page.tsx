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
    Banknote
} from "lucide-react";

interface Slide {
    id: number;
    chapter: string;
    title: string;
    subtitle: string;
    icon: React.ComponentType<{ className?: string }>;
    content: React.ReactNode;
}

export default function PresentationPage() {
    const router = useRouter();
    const [currentSlide, setCurrentSlide] = useState<number>(0);
    const [isPlaying, setIsPlaying] = useState<boolean>(false);
    const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
    const [isOutlineOpen, setIsOutlineOpen] = useState<boolean>(false);
    const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const playTimerRef = useRef<NodeJS.Timeout | null>(null);

    // Check auth status locally to customize CTA button
    useEffect(() => {
        if (typeof window !== "undefined") {
            const token = document.cookie.split("; ").find(row => row.startsWith("token="));
            const savedSlide = localStorage.getItem("sltserp_presentation_slide");
            
            setTimeout(() => {
                setIsLoggedIn(!!token);
                if (savedSlide) {
                    const index = parseInt(savedSlide, 10);
                    if (index >= 0 && index < 14) {
                        setCurrentSlide(index);
                    }
                }
            }, 0);
        }
    }, []);

    // Save active slide progress
    useEffect(() => {
        localStorage.setItem("sltserp_presentation_slide", String(currentSlide));
    }, [currentSlide]);

    const handleNext = useCallback(() => {
        setCurrentSlide((prev) => (prev + 1) % 14);
    }, []);

    const handlePrev = useCallback(() => {
        setCurrentSlide((prev) => (prev - 1 + 14) % 14);
    }, []);

    // Autoplay logic
    useEffect(() => {
        if (isPlaying) {
            playTimerRef.current = setInterval(() => {
                handleNext();
            }, 6000); // 6 seconds per slide
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
            } else if (e.key === "Escape" && isFullscreen) {
                setIsFullscreen(false);
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [handleNext, handlePrev, isFullscreen]);

    // Fullscreen toggle
    const toggleFullscreen = () => {
        if (!containerRef.current) return;
        if (!isFullscreen) {
            if (containerRef.current.requestFullscreen) {
                containerRef.current.requestFullscreen();
            }
            setIsFullscreen(true);
        } else {
            if (document.exitFullscreen) {
                document.exitFullscreen();
            }
            setIsFullscreen(false);
        }
    };

    // Monitor fullscreen change from browser (e.g. Esc key)
    useEffect(() => {
        const handleFsChange = () => {
            const isCurrentlyFs = !!document.fullscreenElement;
            setIsFullscreen(isCurrentlyFs);
        };
        document.addEventListener("fullscreenchange", handleFsChange);
        return () => document.removeEventListener("fullscreenchange", handleFsChange);
    }, []);

    const slides: Slide[] = [
        {
            id: 1,
            chapter: "Welcome to SLTSERP",
            title: "SLTSERP Platform",
            subtitle: "Next-Generation Telecom Operations Portal",
            icon: Layers,
            content: (
                <div className="flex flex-col items-center justify-center text-center space-y-8 h-full max-w-3xl mx-auto">
                    <div className="relative">
                        <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-emerald-600 rounded-full blur opacity-45 animate-pulse"></div>
                        <div className="relative bg-slate-900 border border-slate-700/80 p-6 rounded-full">
                            <Layers className="w-16 h-16 text-blue-400" />
                        </div>
                    </div>
                    <div>
                        <h2 className="text-3xl md:text-5xl font-black bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent tracking-tight">
                            SLTS Operations Management
                        </h2>
                        <p className="text-slate-400 text-sm md:text-base mt-3 max-w-2xl font-medium leading-relaxed">
                            Built specifically for OSP and Service Provisioning teams to coordinate customer service orders, contractor assignments, materials utilization, and warehouse stock balances.
                        </p>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 w-full pt-4">
                        {[
                            { label: "📋 Operations Team", desc: "Service Order Sheets" },
                            { label: "🏭 Store Keepers", desc: "Warehouse GRN & stock" },
                            { label: "👷 Contractor Teams", desc: "Job tracking & details" },
                            { label: "👔 Regional Managers", desc: "Performance & Audits" }
                        ].map((role, i) => (
                            <div key={i} className="bg-slate-900/40 border border-slate-800/80 p-3.5 rounded-xl backdrop-blur-sm hover:border-slate-700/50 transition-colors">
                                <p className="text-xs font-bold text-slate-200">{role.label}</p>
                                <p className="text-[10px] text-slate-500 mt-0.5">{role.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            )
        },
        {
            id: 2,
            chapter: "Introduction to SLTSERP",
            title: "Centralized Database vs. Scattered Excels",
            subtitle: "Solving operational disconnects and double data entry",
            icon: HelpCircle,
            content: (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 h-full items-center max-w-5xl mx-auto">
                    <div className="space-y-4">
                        <h3 className="text-xl font-bold text-rose-400 flex items-center gap-2">
                            <X className="w-5 h-5" /> The Old Offline Flow
                        </h3>
                        <div className="space-y-2 text-xs">
                            <div className="bg-rose-950/20 border border-rose-900/30 p-3 rounded-lg text-slate-400">
                                <span className="font-bold text-rose-300 block mb-0.5">Scattered Excel Sheets</span>
                                Service orders tracked in separate sheets, leading to data synchronization lag.
                            </div>
                            <div className="bg-rose-950/20 border border-rose-900/30 p-3 rounded-lg text-slate-400">
                                <span className="font-bold text-rose-300 block mb-0.5">Manual Stock Reconciliation</span>
                                Warehouse stock issues and contractor usage recorded in different sheets, causing inventory discrepancies.
                            </div>
                            <div className="bg-rose-950/20 border border-rose-900/30 p-3 rounded-lg text-slate-400">
                                <span className="font-bold text-rose-300 block mb-0.5">Slow Audit Trials</span>
                                Finding which contractor completed which job and what specific items they used takes days of manual email search.
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <h3 className="text-xl font-bold text-emerald-400 flex items-center gap-2">
                            <CheckCircle2 className="w-5 h-5" /> The Central ERP Flow
                        </h3>
                        <div className="space-y-2 text-xs">
                            <div className="bg-emerald-950/20 border border-emerald-900/30 p-3 rounded-lg text-slate-300 shadow-lg shadow-emerald-950/5">
                                <span className="font-bold text-emerald-300 block mb-0.5">One Shared Database</span>
                                Single source of truth. Updates to service orders or material stock instantly propagate to all departments.
                            </div>
                            <div className="bg-emerald-950/20 border border-emerald-900/30 p-3 rounded-lg text-slate-300 shadow-lg shadow-emerald-950/5">
                                <span className="font-bold text-emerald-300 block mb-0.5">Real-time Stock Deductions</span>
                                When a service order is finalized, materials are verified and balanced against contractor stock records.
                            </div>
                            <div className="bg-emerald-950/20 border border-emerald-900/30 p-3 rounded-lg text-slate-300 shadow-lg shadow-emerald-950/5">
                                <span className="font-bold text-emerald-300 block mb-0.5">Transparent Audit History</span>
                                System captures exact contractor registration, verification code, stock issues, usage details, and dates.
                            </div>
                        </div>
                    </div>
                </div>
            )
        },
        {
            id: 3,
            chapter: "Core Workflow Features",
            title: "Service Order Sheet (Sheet Mode)",
            subtitle: "Dense, spreadsheet-style table optimized for rapid data updates",
            icon: FileSpreadsheet,
            content: (
                <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 h-full items-center max-w-5xl mx-auto">
                    <div className="lg:col-span-2 space-y-4">
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 text-[10px] font-black uppercase tracking-wider">
                            <Zap className="w-3 h-3" /> Built for speed
                        </div>
                        <h3 className="text-2xl font-bold text-white tracking-tight">Smarter Google Sheets</h3>
                        <p className="text-slate-400 text-xs leading-relaxed">
                            Allows operations officers to review hundreds of service orders in a dense spreadsheet view. Supports advanced keyboard shortcuts and background auto-save.
                        </p>
                        <ul className="space-y-2 text-[11px] text-slate-300">
                            <li className="flex items-start gap-2">
                                <span className="text-emerald-400 font-bold">✓</span>
                                <span>**Inline Field Editing:** Click and type directly into DP details, comments, and schedule inputs.</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-emerald-400 font-bold">✓</span>
                                <span>**Column Filters & Sorting:** Quick-filter search boxes underneath every column header.</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-emerald-400 font-bold">✓</span>
                                <span>**Keyboard Navigation:** Use Up/Down arrows and Enter keys to navigate cells quickly.</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-emerald-400 font-bold">✓</span>
                                <span>**Auto-Save States:** Real-time visual feedback: Spinner (saving), Checkmark (saved), and ERR (failed).</span>
                            </li>
                        </ul>
                    </div>

                    <div className="lg:col-span-3 bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-2xl p-4 space-y-4">
                        {/* Mock spreadsheet UI */}
                        <div className="border border-slate-800/80 rounded-lg overflow-hidden text-[10px]">
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-slate-800/60 border-b border-slate-800">
                                    <tr className="font-bold text-slate-400 uppercase tracking-tight text-[9px]">
                                        <th className="p-2 border-r border-slate-800">SO Number</th>
                                        <th className="p-2 border-r border-slate-800">Customer Details</th>
                                        <th className="p-2 border-r border-slate-800">Contractor</th>
                                        <th className="p-2">Comments</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-800/60 bg-slate-950/40">
                                    <tr>
                                        <td className="p-2 font-mono border-r border-slate-800 text-slate-300">SO-2026-0812</td>
                                        <td className="p-2 border-r border-slate-800 text-slate-300">P. K. Silva, Kandy</td>
                                        <td className="p-2 border-r border-slate-800 bg-slate-900 text-blue-400 font-semibold select-none">
                                            Lanka Tech Team A
                                        </td>
                                        <td className="p-2 text-slate-400 relative">
                                            <span>Waiting for OSP path</span>
                                            <span className="absolute right-1 top-2.5 w-2 h-2 rounded-full bg-emerald-400 animate-pulse" title="Auto-saved" />
                                        </td>
                                    </tr>
                                    <tr className="bg-slate-900/20">
                                        <td className="p-2 font-mono border-r border-slate-800 text-slate-300">SO-2026-0813</td>
                                        <td className="p-2 border-r border-slate-800 text-slate-300">A. G. Perera, Gampaha</td>
                                        <td className="p-2 border-r border-slate-800 text-slate-300">Select Team...</td>
                                        <td className="p-2 text-slate-400">ONT swap required</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                        <div className="flex items-center justify-between text-[9px] text-slate-500 border-t border-slate-800/80 pt-2 font-mono">
                            <span>* Use ↑↓ keys to jump rows</span>
                            <div className="flex gap-2">
                                <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-blue-500" /> Saving</span>
                                <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Saved</span>
                                <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-rose-500" /> ERR</span>
                            </div>
                        </div>
                    </div>
                </div>
            )
        },
        {
            id: 4,
            chapter: "Core Workflow Features",
            title: "3-Step Order Completion Wizard",
            subtitle: "Clean, guided workflow to finalize service completions",
            icon: CheckCircle2,
            content: (
                <div className="flex flex-col space-y-6 h-full justify-center max-w-4xl mx-auto">
                    <div className="text-center max-w-xl mx-auto space-y-2">
                        <h3 className="text-2xl font-bold text-white tracking-tight">Structured Progress Wizard</h3>
                        <p className="text-slate-400 text-xs">
                            Splits order closure fields into three logical tabs. Validates input values at each stage before submission.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex flex-col justify-between space-y-4 shadow-lg">
                            <div className="space-y-2">
                                <div className="text-xs font-black text-blue-400 font-mono tracking-widest uppercase">Step 01</div>
                                <h4 className="text-sm font-bold text-slate-200">Details & Assignment</h4>
                                <p className="text-[11px] text-slate-500 leading-relaxed">
                                    Define the job completion date. Enter the OSP Distribution Point (DP) ID. Assign the contractor team or log a direct SLT team.
                                </p>
                            </div>
                            <div className="bg-slate-950/50 p-2.5 rounded-lg border border-slate-800 text-[10px] space-y-1 font-mono text-slate-400">
                                <div>• Completion Date</div>
                                <div>• DP Details</div>
                                <div>• Contractor Selection</div>
                            </div>
                        </div>

                        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex flex-col justify-between space-y-4 shadow-lg">
                            <div className="space-y-2">
                                <div className="text-xs font-black text-blue-400 font-mono tracking-widest uppercase">Step 02</div>
                                <h4 className="text-sm font-bold text-slate-200">Material Usage & Wastage</h4>
                                <p className="text-[11px] text-slate-500 leading-relaxed">
                                    Log exact material usage quantities. Split drop-wire lengths into F1 and G1 runs. Input item-specific wastage values.
                                </p>
                            </div>
                            <div className="bg-slate-950/50 p-2.5 rounded-lg border border-slate-800 text-[10px] space-y-1 font-mono text-slate-400">
                                <div>• F1 / G1 Drop-wire</div>
                                <div>• Connectors & Splitters</div>
                                <div>• Wastage Limit Check</div>
                            </div>
                        </div>

                        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex flex-col justify-between space-y-4 shadow-lg">
                            <div className="space-y-2">
                                <div className="text-xs font-black text-blue-400 font-mono tracking-widest uppercase">Step 03</div>
                                <h4 className="text-sm font-bold text-slate-200">Device Serials & Comments</h4>
                                <p className="text-[11px] text-slate-500 leading-relaxed">
                                    Choose if the ONT Router is New or Existing. Record ONT and IPTV serial numbers. Enter operational comments.
                                </p>
                            </div>
                            <div className="bg-slate-950/50 p-2.5 rounded-lg border border-slate-800 text-[10px] space-y-1 font-mono text-slate-400">
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
            id: 5,
            chapter: "Core Workflow Features",
            title: "Wastage Control & Material Sources",
            subtitle: "Enforcing compliance on OSP items and split billing records",
            icon: Settings,
            content: (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 h-full items-center max-w-4xl mx-auto">
                    <div className="space-y-4">
                        <div className="inline-flex items-center gap-1 py-0.5 px-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[9px] font-bold">
                            RECONCILIATION PREP
                        </div>
                        <h3 className="text-2xl font-bold text-white tracking-tight">Preventing Material Leakage</h3>
                        <p className="text-slate-400 text-xs leading-relaxed">
                            To prevent contractor wastage, the system implements an active wastage monitoring system. It flags excessive usage at the point of completion.
                        </p>
                        <ul className="space-y-2 text-xs text-slate-300">
                            <li className="flex items-start gap-2">
                                <span className="text-emerald-400 font-bold">•</span>
                                <span>**Quick-Access Materials Grid:** The most commonly consumed items (Drop-wire, Connectors, Splitters) are laid out as quick-entry fields.</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-emerald-400 font-bold">•</span>
                                <span>**Wastage Thresholds:** If wastage values exceed maximum allowed limits (e.g. 5% on dropwire), a validation warning is logged.</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-emerald-400 font-bold">•</span>
                                <span>**Mandatory Reasons:** Contractors must submit a valid explanation (e.g. &quot;damage on reel&quot;) for flagged wastage.</span>
                            </li>
                        </ul>
                    </div>

                    <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl space-y-4 shadow-xl">
                        <h4 className="text-sm font-bold text-slate-200">Strict Material Source Split</h4>
                        <p className="text-slate-400 text-[11px] leading-relaxed">
                            Materials are split by ownership tags to govern downstream accounting and contractor payments:
                        </p>

                        <div className="space-y-3 pt-2">
                            <div className="bg-slate-950/40 p-3 rounded-lg border border-slate-800 flex justify-between items-center gap-4">
                                <div className="space-y-0.5">
                                    <span className="text-xs font-bold text-emerald-400 uppercase tracking-widest font-mono">SLT Sourced</span>
                                    <p className="text-[10px] text-slate-500">Materials issued directly from Sri Lanka Telecom store. Not chargeable to contractor invoices.</p>
                                </div>
                                <span className="text-[9px] font-black px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">FREE</span>
                            </div>

                            <div className="bg-slate-950/40 p-3 rounded-lg border border-slate-800 flex justify-between items-center gap-4">
                                <div className="space-y-0.5">
                                    <span className="text-xs font-bold text-amber-400 uppercase tracking-widest font-mono">SLTS Sourced</span>
                                    <p className="text-[10px] text-slate-500">Materials sourced from subsidiary services. Deducted from contractor payments based on usage.</p>
                                </div>
                                <span className="text-[9px] font-black px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">BILLED</span>
                            </div>
                        </div>
                    </div>
                </div>
            )
        },
        {
            id: 6,
            chapter: "Operations Management",
            title: "Inventory & Stock Control",
            subtitle: "Warehouse workflows tracking items from arrival to installation",
            icon: Warehouse,
            content: (
                <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 h-full items-center max-w-5xl mx-auto">
                    <div className="lg:col-span-2 space-y-4">
                        <h3 className="text-2xl font-bold text-white tracking-tight">End-to-End Stock Ledger</h3>
                        <p className="text-slate-400 text-xs leading-relaxed">
                            Tracks the lifecycle of telecom hardware and cables. Governs multi-store balance sheets and keeps warehouse managers alert of stockouts.
                        </p>
                        <div className="grid grid-cols-1 gap-2.5 pt-2">
                            <div className="flex gap-2 items-start text-[11px] text-slate-300">
                                <span className="w-5 h-5 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold text-[9px] font-mono shrink-0">1</span>
                                <div>**GRN Receipt:** Logs supplier invoices and costs. Automatically calculates batch values.</div>
                            </div>
                            <div className="flex gap-2 items-start text-[11px] text-slate-300">
                                <span className="w-5 h-5 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold text-[9px] font-mono shrink-0">2</span>
                                <div>**Request & Approval:** Contractors request items. OSP managers authorize via approval dashboard.</div>
                            </div>
                            <div className="flex gap-2 items-start text-[11px] text-slate-300">
                                <span className="w-5 h-5 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold text-[9px] font-mono shrink-0">3</span>
                                <div>**Store Reconciliation:** Periodically audits stock issued vs. actually reported on tickets.</div>
                            </div>
                        </div>
                    </div>

                    <div className="lg:col-span-3 bg-slate-900 border border-slate-800 p-5 rounded-xl space-y-4 shadow-xl">
                        <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest font-mono">Store Architecture & Safety levels</h4>
                        <div className="grid grid-cols-3 gap-3">
                            <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800 text-center space-y-1">
                                <div className="text-[10px] font-bold text-slate-400">Main Store</div>
                                <div className="text-sm font-black text-emerald-400">OK</div>
                                <span className="text-[8px] text-slate-600 block">General Depot</span>
                            </div>
                            <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800 text-center space-y-1">
                                <div className="text-[10px] font-bold text-slate-400">Gampaha Store</div>
                                <div className="text-sm font-black text-amber-400">LOW</div>
                                <span className="text-[8px] text-slate-600 block">Restock Warning</span>
                            </div>
                            <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800 text-center space-y-1">
                                <div className="text-[10px] font-bold text-slate-400">Kandy Store</div>
                                <div className="text-sm font-black text-rose-500">CRIT</div>
                                <span className="text-[8px] text-slate-600 block">Below Safety Limit</span>
                            </div>
                        </div>
                        <div className="bg-slate-950/40 p-3 rounded-lg border border-slate-850 text-xs text-slate-400 flex gap-2 items-center">
                            <ShieldAlert className="w-5 h-5 text-amber-500 shrink-0" />
                            <p className="text-[10px] leading-tight">
                                **Low Stock Alerts:** Automatically broadcasts notification logs to Store Managers and Admins when stock falls below thresholds.
                            </p>
                        </div>
                    </div>
                </div>
            )
        },
        {
            id: 7,
            chapter: "Operations Management",
            title: "Contractor & Verification Systems",
            subtitle: "Enforcing authorization barriers to ensure operational compliance",
            icon: Users,
            content: (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 h-full items-center max-w-4xl mx-auto">
                    <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl space-y-4 shadow-xl">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center font-bold">
                                SEC
                            </div>
                            <div>
                                <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest font-mono">Verification Validation</h4>
                                <p className="text-xs font-bold text-slate-200">Contractor verification codes checking</p>
                            </div>
                        </div>
                        <p className="text-[11px] text-slate-400 leading-relaxed">
                            When assigning job orders or completing work sheets, the system checks contractor data against registered master records:
                        </p>
                        <div className="bg-slate-950/50 p-3 rounded-lg border border-slate-800/80 text-[10px] font-mono text-rose-400 space-y-1">
                            <div className="font-bold text-rose-300">⚠️ Code Mismatch Prevention:</div>
                            <div>If selected Contractor Team lacks a valid verification code, the system triggers a block and locks the save button.</div>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <h3 className="text-2xl font-bold text-white tracking-tight">Contractor Master Ledger</h3>
                        <p className="text-slate-400 text-xs leading-relaxed">
                            Stores verified company details and coordinates active team pools.
                        </p>
                        <ul className="space-y-2 text-[11px] text-slate-300">
                            <li className="flex items-start gap-2">
                                <span className="text-emerald-400 font-bold">•</span>
                                <span>**Registered Contractor Profiles:** Maps company codes, bank account details, and active OPMCs.</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-emerald-400 font-bold">•</span>
                                <span>**Team Splits:** Supports multiple technical teams (Team A, Team B) registered under one parent contractor.</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-emerald-400 font-bold">•</span>
                                <span>**Performance Trackers:** Allows filters to compare contractor completion ratios, returns, and material wastage history.</span>
                            </li>
                        </ul>
                    </div>
                </div>
            )
        },
        {
            id: 8,
            chapter: "Operations Management",
            title: "Live Notifications & Preference Centers",
            subtitle: "Global broadcast updates with customized user preferences",
            icon: Bell,
            content: (
                <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 h-full items-center max-w-5xl mx-auto">
                    <div className="lg:col-span-2 space-y-4">
                        <h3 className="text-2xl font-bold text-white tracking-tight">Global Broadcast System</h3>
                        <p className="text-slate-400 text-xs leading-relaxed">
                            Updates users of system mutations instantly. Alerts slide out as toasts on screen and populate a dedicated history log.
                        </p>
                        <div className="space-y-2 text-[11px] text-slate-300">
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

                    <div className="lg:col-span-3 bg-slate-900 border border-slate-800 p-5 rounded-xl space-y-4 shadow-xl">
                        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                            <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5"><Bell className="w-4 h-4 text-blue-400" /> Notifications settings</span>
                            <span className="text-[10px] text-slate-500 font-mono">Account Preferences</span>
                        </div>
                        <p className="text-[10px] text-slate-500 leading-tight">
                            Users can customize notifications for their accounts. Toggle individual categories ON/OFF:
                        </p>
                        <div className="space-y-2 text-xs">
                            <div className="flex justify-between items-center p-2 bg-slate-950/35 rounded border border-slate-800/80">
                                <span className="text-slate-300 font-medium">System / Core Updates</span>
                                <span className="text-[9px] font-black text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">ACTIVE</span>
                            </div>
                            <div className="flex justify-between items-center p-2 bg-slate-950/35 rounded border border-slate-800/80">
                                <span className="text-slate-300 font-medium">Inventory & Stock Alerts</span>
                                <span className="text-[9px] font-black text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">ACTIVE</span>
                            </div>
                            <div className="flex justify-between items-center p-2 bg-slate-950/35 rounded border border-slate-800/80">
                                <span className="text-slate-300 font-medium">Contractor Registrations</span>
                                <span className="text-[9px] font-black text-slate-500 bg-slate-500/10 px-1.5 py-0.5 rounded">MUTED</span>
                            </div>
                        </div>
                    </div>
                </div>
            )
        },
        {
            id: 9,
            chapter: "Operations Management",
            title: "Daily Reminders & Proactive SLA Alarms",
            subtitle: "Strict appointment notifications running globally across all views",
            icon: Clock,
            content: (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 h-full items-center max-w-4xl mx-auto">
                    <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl space-y-4 shadow-xl">
                        <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest font-mono flex items-center gap-1.5"><Clock className="w-4 h-4 text-emerald-400" /> SLA Notification Rules</h4>
                        <p className="text-[11px] text-slate-400 leading-relaxed">
                            Proactive alerts run in the background to ensure customer slots are met on time:
                        </p>

                        <div className="space-y-2 pt-2 text-[10px]">
                            <div className="flex justify-between items-center p-2 bg-slate-950/40 rounded border border-slate-850">
                                <span className="text-slate-300 font-bold">2 Hours Before Slot</span>
                                <span className="text-blue-400 font-bold bg-blue-500/10 px-1.5 py-0.5 rounded border border-blue-500/20">INFO REMINDER</span>
                            </div>
                            <div className="flex justify-between items-center p-2 bg-slate-950/40 rounded border border-slate-850">
                                <span className="text-slate-300 font-bold">1 Hour Before Slot</span>
                                <span className="text-amber-400 font-bold bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">URGENT REMINDER</span>
                            </div>
                            <div className="flex justify-between items-center p-2 bg-slate-950/40 rounded border border-slate-850">
                                <span className="text-slate-300 font-bold">30 Mins Before Slot</span>
                                <span className="text-rose-400 font-bold bg-rose-500/10 px-1.5 py-0.5 rounded border border-rose-500/20">CRITICAL ALARM</span>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <h3 className="text-2xl font-bold text-white tracking-tight">Today&apos;s Appointment Logins</h3>
                        <p className="text-slate-400 text-xs leading-relaxed">
                            Keeps operations teams synced with daily customer slots.
                        </p>
                        <ul className="space-y-2 text-xs text-slate-300">
                            <li className="flex items-start gap-2">
                                <span className="text-emerald-400 font-bold">•</span>
                                <span>**Login Summary Popup:** When logging in, the system checks today&apos;s schedules and pops up an overview listing all active tickets.</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-emerald-400 font-bold">•</span>
                                <span>**Global Alarm Injections:** Proactive SLA reminders load on every page of the application, showing up no matter what the user is doing.</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-emerald-400 font-bold">•</span>
                                <span>**Direct Ticket Jumps:** Clicking any alarm notification redirects the user straight to that service order row.</span>
                            </li>
                        </ul>
                    </div>
                </div>
            )
        },
        {
            id: 10,
            chapter: "Efficiency & Reporting",
            title: "Excel Import & Portal Sync",
            subtitle: "Import bulk datasets instantly and bridge direct with main monitoring",
            icon: FileSpreadsheet,
            content: (
                <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 h-full items-center max-w-5xl mx-auto">
                    <div className="lg:col-span-2 space-y-4">
                        <h3 className="text-2xl font-bold text-white tracking-tight">Smart Bulk Importing</h3>
                        <p className="text-slate-400 text-xs leading-relaxed">
                            Avoid manually typing hundreds of customer records. Upload or paste Excel data directly.
                        </p>
                        <ul className="space-y-2 text-[11px] text-slate-300 font-medium">
                            <li className="flex items-start gap-1.5">
                                <span className="text-emerald-400">✔</span>
                                <span>**Drag-and-Drop Files:** Uploads `.xlsx`, `.xls` or `.csv` spreadsheets.</span>
                            </li>
                            <li className="flex items-start gap-1.5">
                                <span className="text-emerald-400">✔</span>
                                <span>**Copy & Paste Mode:** Directly paste grid rows copied from desktop spreadsheets.</span>
                            </li>
                            <li className="flex items-start gap-1.5">
                                <span className="text-emerald-400">✔</span>
                                <span>**Validation Preview:** Displays a table highlighting missing columns (like missing SOD or RTOM values) before saving.</span>
                            </li>
                        </ul>
                    </div>

                    <div className="lg:col-span-3 bg-slate-900 border border-slate-800 p-5 rounded-xl space-y-4 shadow-xl">
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                                <Zap className="w-4 h-4 text-blue-400" />
                            </div>
                            <span className="text-sm font-bold text-slate-200">Portal Sync Bridge API</span>
                        </div>
                        <p className="text-[11px] text-slate-400 leading-relaxed">
                            On the material completion stage, clicking **Portal Sync** makes an API bridge call to the telecom centralized server:
                        </p>
                        <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800 text-[10px] space-y-1 font-mono text-slate-400">
                            <div>1. Fetches pre-logged material logs for the ticket from `/api/service-orders/bridge-sync`.</div>
                            <div>2. Parses aliases and maps code values to local stock items.</div>
                            <div>3. Automatically pre-fills quantities used, saving the contractor from double-entering data.</div>
                        </div>
                    </div>
                </div>
            )
        },
        {
            id: 11,
            chapter: "Efficiency & Reporting",
            title: "Warehouse PDF Exports",
            subtitle: "Generate official store documents with audit signature lines",
            icon: FileDown,
            content: (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 h-full items-center max-w-4xl mx-auto">
                    <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl space-y-4 shadow-xl">
                        <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                            <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5"><FileDown className="w-4 h-4 text-emerald-400" /> Store PDF Generator</span>
                            <span className="text-[9px] text-slate-500 font-mono">Client-side PDF</span>
                        </div>
                        <p className="text-[11px] text-slate-400 leading-relaxed">
                            Fully formatted, official documents compiled client-side using jsPDF. Perfect for store documentation and auditing:
                        </p>
                        <div className="space-y-2 text-[10px]">
                            <div className="p-2.5 bg-slate-950/40 rounded border border-slate-850 flex justify-between items-center">
                                <span className="font-bold text-slate-300">Goods Received Note (GRN) PDF</span>
                                <span className="text-[9px] font-mono text-slate-500">Supplier/Store summary</span>
                            </div>
                            <div className="p-2.5 bg-slate-950/40 rounded border border-slate-850 flex justify-between items-center">
                                <span className="font-bold text-slate-300">Gate Pass / Issue Note PDF</span>
                                <span className="text-[9px] font-mono text-slate-500">Security Check lines</span>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <h3 className="text-2xl font-bold text-white tracking-tight">Audit-Ready Paperwork</h3>
                        <p className="text-slate-400 text-xs leading-relaxed">
                            Ensures every hardware item leaving the warehouse is authorized.
                        </p>
                        <ul className="space-y-2 text-xs text-slate-300">
                            <li className="flex items-start gap-2">
                                <span className="text-emerald-400 font-bold">•</span>
                                <span>**Standard Layout Templates:** PDF layout headers include official company titles and generated references.</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-emerald-400 font-bold">•</span>
                                <span>**Authorized Sign-offs:** Gate pass PDFs are generated with placeholder signature lines for the Store Keeper, Transport Operator, and Security Officer.</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-emerald-400 font-bold">•</span>
                                <span>**Direct Downloads:** Save and print directly from the Inventory Requests or GRN list view with one click.</span>
                            </li>
                        </ul>
                    </div>
                </div>
            )
        },
        {
            id: 12,
            chapter: "Efficiency & Reporting",
            title: "Contractor Invoicing & 90/10 Split",
            subtitle: "Seamless monthly billing generation and payment control",
            icon: Banknote,
            content: (
                <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 h-full items-center max-w-5xl mx-auto font-sans">
                    <div className="lg:col-span-2 space-y-4">
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-black uppercase tracking-wider">
                            <CheckCircle2 className="w-3 h-3" /> Built-in Feature
                        </div>
                        <h3 className="text-2xl font-bold text-white tracking-tight">Automated Contractor Invoices</h3>
                        <p className="text-slate-405 text-xs leading-relaxed">
                            Generates monthly contractor invoices grouped by region and month, fully integrated with completed service orders and actual material consumption records.
                        </p>
                        <ul className="space-y-2 text-[11px] text-slate-300">
                            <li className="flex items-start gap-2">
                                <span className="text-emerald-450 font-bold">✓</span>
                                <span>**90/10 Payment Split:** Automatically retains a 10% retention (Part B) for warranty checks and releases Part A (90%) for immediate settlement.</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-emerald-455 font-bold">✓</span>
                                <span>**Automated Penalties:** Auto-deducts penalties (QC check failure: LKR 1.5k, SLT PAT reject: LKR 2.5k, material mismatch: LKR 1k) directly from the Part B retention amount.</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-emerald-460 font-bold">✓</span>
                                <span>**Landscape Work Detail Sheet:** Generates an exhaustive material grid page listing items used (F-1, G-1, etc.) per TP order to eliminate payment disputes.</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-emerald-465 font-bold">✓</span>
                                <span>**Approval Workflow:** Follows strict transition checks (Pending, Approved, and Paid), matching verified regional coordinate sign-offs.</span>
                            </li>
                        </ul>
                    </div>

                    <div className="lg:col-span-3 bg-slate-900 border border-slate-800 p-5 rounded-xl space-y-4 shadow-xl">
                        {/* Mock Invoice UI */}
                        <div className="flex justify-between items-center border-b border-slate-800 pb-2.5">
                            <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5"><Banknote className="w-4 h-4 text-emerald-400" /> Invoice - LANKA-KANDY-26-06</span>
                            <span className="text-[9px] font-mono text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">90% APPROVED</span>
                        </div>
                        <div className="grid grid-cols-2 gap-3 text-[10px]">
                            <div className="bg-slate-950/40 p-2.5 rounded border border-slate-850">
                                <span className="text-slate-500 block">Total Work Done Value</span>
                                <span className="text-sm font-black text-slate-200">LKR 450,000.00</span>
                            </div>
                            <div className="bg-slate-950/40 p-2.5 rounded border border-slate-850">
                                <span className="text-slate-500 block">Immediate Payout (90%)</span>
                                <span className="text-sm font-black text-blue-400">LKR 405,000.00</span>
                            </div>
                        </div>
                        <div className="bg-slate-950/45 p-3 rounded-lg border border-slate-850/80 space-y-2">
                            <div className="flex justify-between items-center text-[10px]">
                                <span className="text-slate-400 font-medium">Part B Retention (10%)</span>
                                <span className="font-bold text-amber-400">LKR 45,000.00</span>
                            </div>
                            <div className="flex justify-between items-center text-[10px] text-rose-400 border-t border-slate-800/40 pt-1.5">
                                <span className="font-medium">QC / PAT Penalty Deductions</span>
                                <span className="font-bold">- LKR 5,000.00</span>
                            </div>
                            <div className="flex justify-between items-center text-[10px] text-emerald-400 font-bold border-t border-slate-800/40 pt-1.5">
                                <span>Net Retention Balance</span>
                                <span>LKR 40,000.00</span>
                            </div>
                            <div className="flex justify-between items-center text-[9px] text-slate-500 border-t border-slate-850 pt-2">
                                <span>Auto-releases after warranty period expires.</span>
                                <span className="text-slate-400 font-bold flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-amber-500" /> ELIGIBLE</span>
                            </div>
                        </div>
                    </div>
                </div>
            )
        },
        {
            id: 13,
            chapter: "Future Roadmap",
            title: "Upcoming Upgrades & Enhancements",
            subtitle: "Proposed modules for the next phase of development",
            icon: TrendingUp,
            content: (
                <div className="flex flex-col space-y-6 h-full justify-center max-w-4xl mx-auto">
                    <div className="text-center max-w-xl mx-auto space-y-1">
                        <h3 className="text-2xl font-bold text-white tracking-tight">ERP Future Roadmap</h3>
                        <p className="text-slate-400 text-xs">
                            Highly anticipated features slated to extend system functionality:
                        </p>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        {[
                            { title: "📊 Cashflow Ledger", desc: "Track organizational income, outstanding payments, and regional cost centers." },
                            { title: "🔌 Accounting Package Sync", desc: "Integrate with external accounting packages (e.g. QuickBooks, SAP) to sync contractor ledger balances." },
                            { title: "📱 Technicians App", desc: "Technicians receive jobs, scan serial barcodes, and attach closure photos on site." },
                            { title: "🗺️ GPS Dispatching", desc: "Track technical team locations on a live map and auto-assign tasks to closest units." },
                            { title: "📨 Automated SMS", desc: "Auto-send confirmation messages to customers on job dispatch and completion." },
                            { title: "🤖 AI Stock Predictor", desc: "Forecast safety stock depletion dates using historical consumption models." }
                        ].map((item, i) => (
                            <div key={i} className="bg-slate-900 border border-slate-800 p-3.5 rounded-xl space-y-1">
                                <h4 className="text-xs font-bold text-blue-400 font-mono uppercase tracking-wider">{item.title}</h4>
                                <p className="text-[10px] text-slate-500 leading-tight">{item.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            )
        },
        {
            id: 14,
            chapter: "Conclusion",
            title: "Unlock Operational Excellence",
            subtitle: "Transitioning SLTS connection logs to high-speed digital tracks",
            icon: CheckCircle2,
            content: (
                <div className="flex flex-col items-center justify-center text-center space-y-6 h-full max-w-2xl mx-auto">
                    <div className="w-14 h-14 bg-gradient-to-tr from-emerald-500 to-teal-400 text-slate-950 rounded-full flex items-center justify-center shadow-lg shadow-emerald-550/20">
                        <CheckCircle2 className="w-8 h-8" />
                    </div>
                    <div className="space-y-2">
                        <h2 className="text-2xl md:text-3xl font-black text-white tracking-tight">System Ready for Deployment</h2>
                        <p className="text-slate-400 text-xs md:text-sm leading-relaxed max-w-lg mx-auto">
                            By centering all workflows around a single web platform, SLTSERP reduces administrative delays, eliminates data discrepancies, and optimizes regional field work.
                        </p>
                    </div>

                    <div className="pt-4 flex flex-col sm:flex-row gap-3">
                        <button
                            onClick={() => {
                                if (isLoggedIn) {
                                    router.push("/dashboard");
                                } else {
                                    router.push("/login");
                                }
                            }}
                            className="bg-gradient-to-r from-blue-600 to-emerald-600 hover:from-blue-500 hover:to-emerald-500 text-white font-bold text-xs uppercase px-8 py-3.5 rounded-full transition-all flex items-center justify-center gap-2 group cursor-pointer shadow-lg shadow-blue-500/10"
                        >
                            <span>{isLoggedIn ? "Go to ERP Dashboard" : "Log In to ERP Portal"}</span>
                            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                        </button>

                        <button
                            onClick={() => setCurrentSlide(0)}
                            className="bg-slate-900 border border-slate-800 hover:bg-slate-850 hover:border-slate-700 text-slate-300 font-bold text-xs uppercase px-6 py-3.5 rounded-full transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                            <Home className="w-3.5 h-3.5" /> Restart Slides
                        </button>
                    </div>
                </div>
            )
        }
    ];

    const slide = slides[currentSlide];
    const SlideIcon = slide.icon;

    return (
        <div
            ref={containerRef}
            className="w-screen h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white flex flex-col justify-between overflow-hidden relative select-none font-sans"
        >
            {/* Background glowing decorations */}
            <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-blue-600/5 blur-3xl pointer-events-none" />
            <div className="absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full bg-emerald-500/5 blur-3xl pointer-events-none" />

            {/* HEADER */}
            <header className="flex-none px-6 py-4 flex items-center justify-between border-b border-slate-900 bg-slate-950/30 backdrop-blur-sm z-30">
                <div className="flex items-center gap-2.5">
                    <span className="bg-gradient-to-r from-blue-600 to-emerald-500 text-white p-1.5 rounded-lg">
                        <Layers className="w-5 h-5" />
                    </span>
                    <div>
                        <h1 className="text-xs font-black tracking-widest uppercase bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
                            SLTSERP
                        </h1>
                        <p className="text-[9px] text-slate-500 uppercase tracking-tight font-semibold">Features Showcase</p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setIsOutlineOpen(!isOutlineOpen)}
                        className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-900/60 border border-slate-800/80 transition-colors cursor-pointer flex items-center gap-1.5 text-xs font-bold"
                        title="Show outline index"
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
                        className="bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-200 font-bold text-xs uppercase px-4 py-2 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm"
                    >
                        <span>ERP Portal</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                    </button>
                </div>
            </header>

            {/* MAIN CONTENT AREA */}
            <main className="flex-1 min-h-0 flex overflow-hidden relative">
                {/* SLIDE OUTLINE SIDEBAR (Drawer) */}
                {isOutlineOpen && (
                    <div className="absolute inset-y-0 left-0 w-80 bg-slate-950 border-r border-slate-900 p-4 flex flex-col justify-between z-40 shadow-2xl backdrop-blur-md animate-in slide-in-from-left duration-250">
                        <div className="space-y-4">
                            <div className="flex justify-between items-center border-b border-slate-900 pb-2">
                                <span className="text-xs font-black tracking-widest uppercase text-slate-400">Slide Index</span>
                                <button
                                    onClick={() => setIsOutlineOpen(false)}
                                    className="p-1 rounded-md text-slate-500 hover:text-white hover:bg-slate-900 cursor-pointer"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                            <div className="space-y-1 overflow-y-auto max-h-[70vh] custom-scrollbar pr-1">
                                {slides.map((s, idx) => (
                                    <button
                                        key={s.id}
                                        onClick={() => {
                                            setCurrentSlide(idx);
                                            setIsOutlineOpen(false);
                                        }}
                                        className={`w-full text-left p-2.5 rounded-lg text-xs transition-colors flex items-center gap-3 cursor-pointer ${
                                            currentSlide === idx
                                                ? "bg-blue-600 text-white font-bold"
                                                : "text-slate-450 hover:bg-slate-900 hover:text-white"
                                        }`}
                                    >
                                        <span className="font-mono text-[9px] opacity-65">{s.id < 10 ? '0' : ''}{s.id}</span>
                                        <span className="truncate">{s.title}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className="text-[10px] text-slate-600 border-t border-slate-900 pt-3 font-mono">
                            Press Left/Right key to turn pages
                        </div>
                    </div>
                )}

                {/* SLIDE CANVAS */}
                <div className="flex-1 flex flex-col p-6 md:p-12 items-center justify-center overflow-y-auto custom-scrollbar">
                    {/* Slide container (Glassmorphic) */}
                    <div className="w-full max-w-5xl bg-slate-900/50 border border-slate-800 p-8 md:p-12 rounded-2xl backdrop-blur-xl shadow-2xl flex flex-col justify-between min-h-[480px] lg:min-h-[520px]">
                        
                        {/* Slide Top Details */}
                        <div className="flex items-center justify-between border-b border-slate-850 pb-4 mb-4">
                            <div className="flex items-center gap-2">
                                <SlideIcon className="w-4 h-4 text-blue-400" />
                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 font-mono">
                                    {slide.chapter}
                                </span>
                            </div>
                            <span className="text-[10px] font-black text-slate-500 font-mono bg-slate-950/60 px-2.5 py-0.5 rounded-full border border-slate-850">
                                {slide.id < 10 ? '0' : ''}{slide.id} / 14
                            </span>
                        </div>

                        {/* Slide Core Content */}
                        <div className="flex-1 flex flex-col justify-center py-4">
                            {/* Slide Title & Subtitle */}
                            <div className="mb-6">
                                <h2 className="text-xl md:text-3xl font-bold tracking-tight text-white">
                                    {slide.title}
                                </h2>
                                <p className="text-slate-400 text-xs md:text-sm mt-1">
                                    {slide.subtitle}
                                </p>
                            </div>

                            {/* Render Custom React Content */}
                            <div className="flex-1">{slide.content}</div>
                        </div>

                    </div>
                </div>
            </main>

            {/* FOOTER CONTROLS */}
            <footer className="flex-none px-6 py-4 flex items-center justify-between border-t border-slate-900 bg-slate-950/20 backdrop-blur-sm z-30">
                <div className="flex items-center gap-1.5 sm:gap-3">
                    <button
                        onClick={handlePrev}
                        className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-900/60 border border-slate-800/80 transition-colors cursor-pointer"
                        title="Previous Slide"
                    >
                        <ChevronLeft className="w-4 h-4" />
                    </button>
                    
                    <button
                        onClick={() => setIsPlaying(!isPlaying)}
                        className={`p-2 rounded-lg border border-slate-800/80 transition-colors cursor-pointer flex items-center gap-1 text-xs font-bold ${
                            isPlaying ? "bg-emerald-600 text-white hover:bg-emerald-500" : "text-slate-400 hover:text-white hover:bg-slate-900/60"
                        }`}
                        title={isPlaying ? "Pause Autoplay" : "Autoplay (6s interval)"}
                    >
                        {isPlaying ? <Pause className="w-3.5 h-3.5 animate-pulse" /> : <Play className="w-3.5 h-3.5" />}
                        <span className="hidden sm:inline">{isPlaying ? "Pause" : "Play"}</span>
                    </button>

                    <button
                        onClick={handleNext}
                        className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-900/60 border border-slate-800/80 transition-colors cursor-pointer"
                        title="Next Slide"
                    >
                        <ChevronRight className="w-4 h-4" />
                    </button>
                </div>

                {/* Progress Indicators */}
                <div className="hidden md:flex items-center gap-1 max-w-md w-full mx-6 bg-slate-950/80 p-1.5 rounded-full border border-slate-850">
                    {slides.map((s, idx) => (
                        <button
                            key={s.id}
                            onClick={() => setCurrentSlide(idx)}
                            className={`h-1.5 rounded-full transition-all cursor-pointer ${
                                currentSlide === idx
                                    ? "bg-gradient-to-r from-blue-500 to-emerald-400 flex-1"
                                    : "bg-slate-800 hover:bg-slate-700 w-3"
                            }`}
                            title={`Jump to Slide ${s.id}: ${s.title}`}
                        />
                    ))}
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={toggleFullscreen}
                        className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-900/60 border border-slate-800/80 transition-colors cursor-pointer"
                        title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
                    >
                        {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                    </button>
                </div>
            </footer>
        </div>
    );
}
