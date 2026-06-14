/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React from "react";

export default function Slide11() {
    const concepts: any[] = [];
                                    return (
                                        <div className="flex flex-col h-full justify-center max-w-5xl mx-auto py-2 sm:py-6">
                                            {/* Chapter Header */}
                                            <div className="text-center mb-6 sm:mb-8">
                                                <span className="inline-block px-3 py-1 rounded-full bg-blue-100 dark:bg-blue-900/40 text-xs font-medium text-blue-600 dark:text-blue-400 mb-3">
                                                    OSP Project Management
                                                </span>
                                                <h2 className="text-2xl sm:text-4xl font-bold mb-2">
                                                    Organize OSP projects into hierarchical <span className="text-blue-500">Work Breakdown Structures</span>
                                                </h2>
                                            </div>
    
                                            {/* 3 Key Concept Cards */}
                                            <div className="stagger-children grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-5 max-w-4xl mx-auto">
                                                {concepts.map((concept) => {
                                                    const Icon = concept.icon;
                                                    return (
                                                        <div
                                                            key={concept.title}
                                                            className={`${concept.cardClass} rounded-xl p-5 sm:p-6 border transition-transform hover:scale-105 hover:shadow-lg`}
                                                        >
                                                            <div className="flex items-center gap-3 mb-3">
                                                                <div className={`w-10 h-10 rounded-lg ${concept.iconBg} flex items-center justify-center`}>
                                                                    <Icon className={`w-5 h-5 ${concept.iconColor}`} />
                                                                </div>
                                                                <h3 className="font-semibold text-base sm:text-lg">{concept.title}</h3>
                                                            </div>
                                                            <p className="text-sm text-slate-500 dark:text-slate-400">{concept.desc}</p>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    );
}
