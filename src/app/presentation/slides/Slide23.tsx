/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React from "react";
import { AlertOctagon, AlertTriangle, Bell, Info, Settings } from "lucide-react";

export default function Slide23() {
    const notificationLevels = [
        {
            level: "CRITICAL",
            desc: "Security violations, failed audits, and stockouts.",
            icon: AlertOctagon,
            color: "text-rose-600 dark:text-rose-400",
            bg: "bg-rose-100/80 dark:bg-rose-950/20",
            border: "border-rose-200 dark:border-rose-800"
        },
        {
            level: "WARNING",
            desc: "Approvals pending, SLA timers expiring, high wastage.",
            icon: AlertTriangle,
            color: "text-amber-600 dark:text-amber-400",
            bg: "bg-amber-100/80 dark:bg-amber-950/20",
            border: "border-amber-200 dark:border-amber-800"
        },
        {
            level: "INFO",
            desc: "New service orders imported, status changes.",
            icon: Info,
            color: "text-blue-600 dark:text-blue-400",
            bg: "bg-blue-100/80 dark:bg-blue-950/20",
            border: "border-blue-200 dark:border-blue-800"
        }
    ];
    const preferences = [
        {
            name: "System / Core Updates",
            sub: "Core system notifications and errors.",
            status: "ACTIVE",
            statusColor: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-400"
        },
        {
            name: "Inventory & Stock Alerts",
            sub: "Safety level threshold and replenishment alerts.",
            status: "ACTIVE",
            statusColor: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-400"
        },
        {
            name: "Contractor Registrations",
            sub: "New contractor signups and code updates.",
            status: "MUTED",
            statusColor: "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-400"
        }
    ];
                                    return (
                                        <div className="flex flex-col h-full justify-center max-w-5xl mx-auto py-2 sm:py-6">
                                            
    
                                            {/* Two Column Layout: 2 left, 3 right */}
                                            <div className="stagger-children grid grid-cols-1 lg:grid-cols-5 gap-4 sm:gap-6">
                                                {/* Left: Global Broadcast System */}
                                                <div className="lg:col-span-2 space-y-4">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <Bell className="w-5 h-5 text-blue-500" />
                                                        <h3 className="font-bold text-sm sm:text-base">Global Broadcast System</h3>
                                                    </div>
                                                    <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-400">
                                                        Multi-tier notification engine delivering targeted alerts based on severity and role.
                                                    </p>
    
                                                    <div className="space-y-2">
                                                        {notificationLevels.map((nl) => {
                                                            const Icon = nl.icon;
                                                            return (
                                                                <div
                                                                    key={nl.level}
                                                                    className={`rounded-lg border p-3 ${nl.bg} ${nl.border}`}
                                                                >
                                                                    <div className="flex items-center gap-2 mb-1">
                                                                        <Icon className={`w-4 h-4 ${nl.color}`} />
                                                                        <span className={`font-mono text-xs font-bold ${nl.color}`}>
                                                                            {nl.level}
                                                                        </span>
                                                                    </div>
                                                                    <p className="text-xs text-slate-700 dark:text-slate-300">
                                                                        {nl.desc}
                                                                    </p>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
    
                                                {/* Right: Notification Preferences */}
                                                <div className="lg:col-span-3 card-info rounded-xl p-4 sm:p-5">
                                                    <div className="flex items-center justify-between mb-1">
                                                        <h3 className="font-bold text-sm sm:text-base">Notifications settings</h3>
                                                        <Settings className="w-4 h-4 text-slate-700" />
                                                    </div>
                                                    <span className="text-xs text-slate-700 dark:text-slate-400">Account Preferences</span>
                                                    <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-400 mt-2 mb-4">
                                                        Customize which notification channels are active for your account. Muted channels will still log events but won&apos;t push alerts.
                                                    </p>
    
                                                    <div className="space-y-2">
                                                        {preferences.map((pref) => (
                                                            <div
                                                                key={pref.name}
                                                                className="flex items-center justify-between bg-slate-100 dark:bg-slate-900/50 rounded-lg p-3"
                                                            >
                                                                <div className="flex items-center gap-3">
                                                                    <div className="w-8 h-8 rounded-lg bg-slate-200 dark:bg-slate-700/40 flex items-center justify-center">
                                                                        <Bell className="w-4 h-4 text-slate-700 dark:text-slate-300" />
                                                                    </div>
                                                                    <div>
                                                                        <span className="font-semibold text-xs sm:text-sm text-slate-700 dark:text-slate-300">{pref.name}</span>
                                                                        <span className="block text-[10px] sm:text-xs text-slate-700 dark:text-slate-400">
                                                                            {pref.sub}
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                                <span
                                                                    className={`text-[10px] sm:text-xs font-bold px-2 py-0.5 rounded-full ${pref.statusColor}`}
                                                                >
                                                                    {pref.status}
                                                                </span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
}
