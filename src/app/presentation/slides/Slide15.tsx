/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React from "react";
import { Warehouse } from "lucide-react";

export default function Slide15() {
    const capabilities: any[] = [];
                                    return (
                                        <div className="flex flex-col h-full justify-center max-w-5xl mx-auto py-2 sm:py-6">
                                            {/* Chapter Header */}
                                            <div className="text-center mb-6 sm:mb-8">
                                                <span className="inline-block px-3 py-1 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-xs font-medium text-emerald-600 dark:text-emerald-400 mb-3">
                                                    Warehouse &amp; Stock Control
                                                </span>
                                                <h2 className="text-2xl sm:text-4xl font-bold mb-2">
                                                    Full inventory lifecycle from <span className="text-emerald-500">goods receipt to issue</span>
                                                </h2>
                                            </div>
    
                                            {/* 3 Capability Cards */}
                                            <div className="stagger-children grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-5 max-w-4xl mx-auto">
                                                {capabilities.map((cap) => {
                                                    const Icon = cap.icon;
                                                    return (
                                                        <div
                                                            key={cap.title}
                                                            className={`${cap.cardClass} rounded-xl p-5 sm:p-6 border transition-transform hover:scale-105 hover:shadow-lg`}
                                                        >
                                                            <div className="flex items-center gap-3 mb-3">
                                                                <div className={`w-10 h-10 rounded-lg ${cap.iconBg} flex items-center justify-center`}>
                                                                    <Icon className={`w-5 h-5 ${cap.iconColor}`} />
                                                                </div>
                                                                <h3 className="font-semibold text-base sm:text-lg">{cap.title}</h3>
                                                            </div>
                                                            <p className="text-sm text-slate-500 dark:text-slate-400">{cap.desc}</p>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    );
}
