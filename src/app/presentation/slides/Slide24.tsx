/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React from "react";
import { AlertOctagon, AlertTriangle, Bell, Clock, ExternalLink, Info, ShieldAlert } from "lucide-react";

export default function Slide24() {
    const slaRules = [
        {
            time: "2 Hours Before Slot",
            icon: Info,
            iconColor: "text-blue-500",
            badge: "INFO REMINDER",
            badgeColor: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-400"
        },
        {
            time: "1 Hour Before Slot",
            icon: AlertTriangle,
            iconColor: "text-amber-500",
            badge: "URGENT REMINDER",
            badgeColor: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-400"
        },
        {
            time: "30 Mins Before Slot",
            icon: AlertOctagon,
            iconColor: "text-rose-500",
            badge: "CRITICAL ALARM",
            badgeColor: "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-400"
        }
    ];
    const todayFeatures = [
        {
            title: "Login Summary Popup",
            desc: "On login, the system pops up a dashboard listing today's active tickets.",
            icon: Bell
        },
        {
            title: "Global Alarm Injections",
            desc: "SLA notifications display globally across all sections of the platform.",
            icon: ShieldAlert
        },
        {
            title: "Direct Ticket Jumps",
            desc: "Clicking any alert routes the operator directly to the service order record.",
            icon: ExternalLink
        }
    ];
                                    return (
                                        <div className="flex flex-col h-full justify-center max-w-5xl mx-auto py-2 sm:py-6">
                                            {/* Chapter Header */}
                                            <div className="mb-6 sm:mb-8 text-center">
                                                <span className="inline-block px-3 py-1 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-xs font-medium text-emerald-600 dark:text-emerald-400 mb-3">
                                                    Security &amp; Utilities
                                                </span>
                                                <h2 className="text-2xl sm:text-4xl font-bold">SLA Alarms &amp; Appointment Alerts</h2>
                                            </div>
    
                                            {/* Two Column Layout */}
                                            <div className="stagger-children grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                                                {/* Left: SLA Notification Rules */}
                                                <div className="card-warning rounded-xl p-4 sm:p-5">
                                                    <h3 className="font-bold text-sm sm:text-base mb-4">SLA Notification Rules</h3>
                                                    <div className="space-y-3">
                                                        {slaRules.map((rule) => {
                                                            const Icon = rule.icon;
                                                            return (
                                                                <div
                                                                    key={rule.time}
                                                                    className="bg-white/60 dark:bg-white/10 rounded-lg p-3 flex items-center gap-3"
                                                                >
                                                                    <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-white dark:bg-slate-800 flex items-center justify-center shadow-sm">
                                                                        <Icon className={`w-4 h-4 ${rule.iconColor}`} />
                                                                    </div>
                                                                    <div className="flex-1 min-w-0">
                                                                        <span className="font-semibold text-xs sm:text-sm">{rule.time}</span>
                                                                    </div>
                                                                    <span
                                                                        className={`text-[10px] sm:text-xs font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${rule.badgeColor}`}
                                                                    >
                                                                        {rule.badge}
                                                                    </span>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
    
                                                {/* Right: Today's Appointment Logins */}
                                                <div className="space-y-4">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <Clock className="w-5 h-5 text-amber-500" />
                                                        <h3 className="font-bold text-sm sm:text-base">Today&apos;s Appointment Logins</h3>
                                                    </div>
                                                    <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                                                        Time-sensitive SLA alerts keep teams on schedule. Appointments trigger escalating reminders, and login dashboards surface the most urgent items immediately.
                                                    </p>
    
                                                    <div className="space-y-3">
                                                        {todayFeatures.map((feature) => {
                                                            const Icon = feature.icon;
                                                            return (
                                                                <div
                                                                    key={feature.title}
                                                                    className="card-primary rounded-xl p-3 sm:p-4 flex items-start gap-3"
                                                                >
                                                                    <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center">
                                                                        <Icon className="w-4 h-4 text-blue-500" />
                                                                    </div>
                                                                    <div>
                                                                        <h4 className="font-semibold text-xs sm:text-sm">{feature.title}</h4>
                                                                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                                                            {feature.desc}
                                                                        </p>
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
}
