"use client";

import React from "react";
import { QrCode, Smartphone, Gauge, AlertTriangle, ShieldCheck, ArrowRight } from "lucide-react";

export default function Slide29() {
    const features = [
        {
            title: "Instant QR Code Generation",
            desc: "ERP generates a high-resolution, printable QR Code for every registered vehicle. Can be printed and pasted on the dashboard.",
            icon: QrCode,
            iconBg: "bg-blue-100 dark:bg-blue-900/40",
            iconColor: "text-blue-600 dark:text-blue-400"
        },
        {
            title: "Mobile Scan Duty Log",
            desc: "Drivers use their mobile devices to scan the vehicle's QR code, instantly loading the Duty On / Duty Off log submission screen.",
            icon: Smartphone,
            iconBg: "bg-emerald-100 dark:bg-emerald-900/40",
            iconColor: "text-emerald-600 dark:text-emerald-400"
        },
        {
            title: "Smart Odometer Validation",
            desc: "Automatic mileage verification against previous end logs. Fails validation if current start reading is lower than previous end reading.",
            icon: Gauge,
            iconBg: "bg-amber-100 dark:bg-amber-900/40",
            iconColor: "text-amber-600 dark:text-amber-400"
        },
        {
            title: "Odometer Out-of-Range Warnings",
            desc: "Highlights potential errors or fraud (e.g., duty run exceeding 500km in a single shift) with visual warnings in logs.",
            icon: AlertTriangle,
            iconBg: "bg-rose-100 dark:bg-rose-900/40",
            iconColor: "text-rose-600 dark:text-rose-400"
        }
    ];

    return (
        <div className="flex flex-col h-full justify-center max-w-6xl mx-auto py-2 sm:py-6 relative overflow-hidden">
            {/* Decorative Orbs */}
            <div className="absolute top-1/4 left-10 w-48 h-48 rounded-full bg-gradient-to-br from-blue-400/5 to-purple-400/5 blur-3xl pointer-events-none" />
            
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center relative z-10">
                {/* Left Side: Detail and Flow representation */}
                <div className="lg:col-span-5 flex flex-col justify-center space-y-4">
                    <div className="inline-flex items-center gap-2 bg-blue-100 dark:bg-blue-900/30 rounded-full px-3 py-1 w-fit">
                        <ShieldCheck className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                        <span className="text-xs font-semibold text-blue-800 dark:text-blue-300">
                            Secure Duty Tracking
                        </span>
                    </div>
                    
                    <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">
                        QR-Code Scan Vehicle Logs
                    </h2>
                    
                    <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                        Replaces traditional logbooks with automated, mobile-scannable check-in and check-out flows. Ensures data integrity and real-time vehicle availability tracking.
                    </p>

                    {/* Step-by-Step Flow Indicators */}
                    <div className="space-y-3 pt-2">
                        <div className="flex items-center gap-3 bg-slate-100 dark:bg-slate-800/40 border border-slate-200/50 dark:border-slate-850 p-2.5 rounded-lg">
                            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-500 text-white flex items-center justify-center text-xs font-bold">1</span>
                            <span className="text-xs font-medium text-slate-700 dark:text-slate-300">Scan QR Code on Vehicle Dashboard</span>
                        </div>
                        <div className="flex items-center gap-3 bg-slate-100 dark:bg-slate-800/40 border border-slate-200/50 dark:border-slate-850 p-2.5 rounded-lg">
                            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-500 text-white flex items-center justify-center text-xs font-bold">2</span>
                            <span className="text-xs font-medium text-slate-700 dark:text-slate-300">Enter Odometer and Submit Duty On / Off</span>
                        </div>
                        <div className="flex items-center gap-3 bg-slate-100 dark:bg-slate-800/40 border border-slate-200/50 dark:border-slate-850 p-2.5 rounded-lg">
                            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-500 text-white flex items-center justify-center text-xs font-bold">3</span>
                            <span className="text-xs font-medium text-slate-700 dark:text-slate-300">Real-Time Sync with ERP Ledger</span>
                        </div>
                    </div>
                </div>

                {/* Right Side: Features Cards Grid */}
                <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {features.map((feat) => {
                        const Icon = feat.icon;
                        return (
                            <div 
                                key={feat.title} 
                                className="card-primary rounded-xl p-4 border border-slate-200/60 dark:border-slate-800/80 hover:scale-[1.02] transition-transform flex flex-col justify-between"
                            >
                                <div>
                                    <div className={`w-9 h-9 rounded-lg ${feat.iconBg} flex items-center justify-center mb-3`}>
                                        <Icon className={`w-5 h-5 ${feat.iconColor}`} />
                                    </div>
                                    <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100 mb-1.5">
                                        {feat.title}
                                    </h3>
                                    <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                                        {feat.desc}
                                    </p>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
