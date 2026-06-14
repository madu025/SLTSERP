/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React from "react";

export default function Slide2() {
    const modules: any[] = [];
                    return (
                        <div className="flex flex-col h-full justify-center max-w-5xl mx-auto py-2 sm:py-6">
                            {/* Chapter Header */}
                            <div className="text-center mb-8 sm:mb-10">
                                <span className="inline-block px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-xs font-medium text-slate-500 dark:text-slate-400 mb-3">
                                    Introduction
                                </span>
                                <h2 className="text-2xl sm:text-4xl font-bold">Five Core Modules</h2>
                                <p className="text-sm sm:text-base text-slate-500 dark:text-slate-400 mt-2">
                                    Each module connects seamlessly to power the full telecom workflow
                                </p>
                            </div>
    
                            {/* Module Cards */}
                            <div className="stagger-children grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                                {modules.map((mod) => {
                                    const Icon = mod.icon;
                                    return (
                                        <div
                                            key={mod.num}
                                            className={`${mod.cardClass} rounded-xl overflow-hidden transition-transform hover:scale-105 hover:shadow-lg cursor-pointer`}
                                        >
                                            {/* Gradient Top Border */}
                                            <div className={`h-1.5 bg-gradient-to-r ${mod.color}`} />
                                            <div className="p-4 sm:p-5">
                                                <div className="flex items-center gap-2 mb-3">
                                                    <span className="text-2xl sm:text-3xl font-bold text-slate-300 dark:text-slate-600">
                                                        {mod.num}
                                                    </span>
                                                    <Icon className="w-5 h-5 text-slate-400" />
                                                </div>
                                                <h3 className="font-semibold text-sm sm:text-base mb-1">{mod.title}</h3>
                                                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                                                    {mod.desc}
                                                </p>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    );
}
