/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React from "react";

export default function Slide7() {
    const points: any[] = [];
                    return (
                        <div className="flex flex-col h-full justify-center max-w-5xl mx-auto py-2 sm:py-6">
                            {/* Chapter Header */}
                            <div className="text-center mb-6 sm:mb-8">
                                <span className="inline-block px-3 py-1 rounded-full bg-blue-100 dark:bg-blue-900/40 text-xs font-medium text-blue-600 dark:text-blue-400 mb-3">
                                    Service Order Details (SOD)
                                </span>
                                <h2 className="text-2xl sm:text-4xl font-bold">
                                    Preventing <span className="text-amber-500">material leakage</span>
                                </h2>
                            </div>
    
                            {/* 3 Points */}
                            <div className="stagger-children space-y-3 sm:space-y-4 mb-8">
                                {points.map((point) => {
                                    const Icon = point.icon;
                                    return (
                                        <div key={point.title} className="card-warning rounded-xl p-4 sm:p-5">
                                            <div className="flex items-start gap-3">
                                                <div className={`w-9 h-9 rounded-lg ${point.iconBg} flex items-center justify-center flex-shrink-0`}>
                                                    <Icon className={`w-4 h-4 ${point.iconColor}`} />
                                                </div>
                                                <div>
                                                    <h4 className="font-semibold text-sm sm:text-base">{point.title}</h4>
                                                    <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                                                        {point.desc}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
    
                            {/* Threshold Visual Example */}
                            <div className="card-primary rounded-xl p-5 sm:p-6 max-w-lg mx-auto w-full">
                                <h4 className="font-semibold text-sm sm:text-base mb-4">Threshold Example</h4>
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between text-sm mb-1">
                                        <span className="font-medium">Drop-wire</span>
                                        <span className="text-slate-500 dark:text-slate-400">4.2% used / 5% limit</span>
                                    </div>
                                    <div className="w-full h-3 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-gradient-to-r from-emerald-500 to-amber-500 rounded-full transition-all"
                                            style={{ width: "84%" }}
                                        />
                                    </div>
                                    <div className="flex items-center justify-between text-xs text-slate-400">
                                        <span>0%</span>
                                        <span className="text-amber-600 dark:text-amber-400 font-medium">4.2%</span>
                                        <span className="text-rose-500 font-medium">5% limit</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
}
