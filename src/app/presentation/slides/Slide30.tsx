/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React from "react";
import { Layers } from "lucide-react";

export default function Slide30() {
    return (
            <div className="flex flex-col h-full justify-center max-w-5xl mx-auto py-2 sm:py-6 relative overflow-hidden">
                                    {/* Decorative Gradient Orbs */}
                                    <div className="absolute top-10 left-10 w-32 h-32 sm:w-48 sm:h-48 rounded-full bg-gradient-to-br from-blue-400/20 to-purple-400/20 blur-3xl pointer-events-none" />
                                    <div className="absolute bottom-10 right-10 w-40 h-40 sm:w-56 sm:h-56 rounded-full bg-gradient-to-br from-emerald-400/20 to-teal-400/20 blur-3xl pointer-events-none" />
                                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 sm:w-80 sm:h-80 rounded-full bg-gradient-to-br from-blue-300/10 to-emerald-300/10 blur-3xl pointer-events-none" />
    
                                    {/* Center Content */}
                                    <div className="relative z-10 text-center stagger-children">
                                        {/* Logo */}
                                        <div className="inline-block mb-6">
                                            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl bg-gradient-to-br from-blue-500 via-emerald-500 to-purple-500 flex items-center justify-center mx-auto shadow-xl">
                                                <Layers className="w-8 h-8 sm:w-10 sm:h-10 text-white" />
                                            </div>
                                        </div>
    
                                        
    
                                        
    
                                        {/* Decorative Line */}
                                        <div className="w-16 h-0.5 bg-gradient-to-r from-blue-500 to-emerald-500 mx-auto my-6 sm:my-8 rounded-full" />
    
                                        {/* Thank You */}
                                        <h2 className="text-2xl sm:text-4xl font-bold mb-8 sm:mb-12 text-slate-700 dark:text-slate-200">
                                            Thank You
                                        </h2>
    
                                        {/* Footer */}
                                        <p className="text-[10px] sm:text-xs text-slate-700 dark:text-slate-400">
                                            © 2026 SLTSERP • Sri Lanka Telecom Services
                                        </p>
                                    </div>
                                </div>
        );
}
