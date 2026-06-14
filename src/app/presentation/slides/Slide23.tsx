/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React from "react";
import { Settings, Bell } from "lucide-react";

export default function Slide23() {
    const notificationLevels: any[] = [];
    const preferences: any[] = [];
                                    return (
                                        <div className="flex flex-col h-full justify-center max-w-5xl mx-auto py-2 sm:py-6">
                                            {/* Chapter Header */}
                                            <div className="mb-6 sm:mb-8 text-center">
                                                <span className="inline-block px-3 py-1 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-xs font-medium text-emerald-600 dark:text-emerald-400 mb-3">
                                                    Security &amp; Utilities
                                                </span>
                                                <h2 className="text-2xl sm:text-4xl font-bold">Notifications &amp; Preferences</h2>
                                            </div>
    
                                            {/* Two Column Layout: 2 left, 3 right */}
                                            <div className="stagger-children grid grid-cols-1 lg:grid-cols-5 gap-4 sm:gap-6">
                                                {/* Left: Global Broadcast System */}
                                                <div className="lg:col-span-2 space-y-4">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <Bell className="w-5 h-5 text-blue-500" />
                                                        <h3 className="font-bold text-sm sm:text-base">Global Broadcast System</h3>
                                                    </div>
                                                    <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
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
                                                                    <p className="text-xs text-slate-600 dark:text-slate-300">
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
                                                        <Settings className="w-4 h-4 text-slate-400" />
                                                    </div>
                                                    <span className="text-xs text-slate-400 dark:text-slate-500">Account Preferences</span>
                                                    <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-2 mb-4">
                                                        Customize which notification channels are active for your account. Muted channels will still log events but won&apos;t push alerts.
                                                    </p>
    
                                                    <div className="space-y-2">
                                                        {preferences.map((pref) => (
                                                            <div
                                                                key={pref.name}
                                                                className="flex items-center justify-between bg-white/60 dark:bg-white/10 rounded-lg p-3"
                                                            >
                                                                <div className="flex items-center gap-3">
                                                                    <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-700/40 flex items-center justify-center">
                                                                        <Bell className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                                                                    </div>
                                                                    <div>
                                                                        <span className="font-semibold text-xs sm:text-sm">{pref.name}</span>
                                                                        <span className="block text-[10px] sm:text-xs text-slate-400 dark:text-slate-500">
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
