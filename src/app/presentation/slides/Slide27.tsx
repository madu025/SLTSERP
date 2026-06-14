/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React from "react";

export default function Slide27() {
    const upgrades: any[] = [];
                                    return (
                                        <div className="flex flex-col h-full justify-center max-w-5xl mx-auto py-2 sm:py-6">
                                            {/* Chapter Header */}
                                            <div className="mb-6 sm:mb-8 text-center">
                                                <span className="inline-block px-3 py-1 rounded-full bg-cyan-100 dark:bg-cyan-900/40 text-xs font-medium text-cyan-600 dark:text-cyan-400 mb-3">
                                                    Future Roadmap
                                                </span>
                                                <h2 className="text-2xl sm:text-4xl font-bold">Upcoming Upgrades &amp; Enhancements</h2>
                                            </div>
    
                                            {/* 3x2 Grid of Cards */}
                                            <div className="stagger-children grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                                                {upgrades.map((item) => (
                                                    <div
                                                        key={item.title}
                                                        className="card-primary rounded-xl p-4 sm:p-5 transition-transform hover:scale-[1.02] hover:shadow-lg"
                                                    >
                                                        <div className="text-2xl sm:text-3xl mb-2">{item.emoji}</div>
                                                        <h3 className="font-mono text-xs sm:text-sm font-bold text-blue-500 uppercase mb-1.5">
                                                            {item.title}
                                                        </h3>
                                                        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                                                            {item.desc}
                                                        </p>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    );
}
