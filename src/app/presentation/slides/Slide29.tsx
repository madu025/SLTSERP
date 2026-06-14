/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React from "react";
import { Home, Users, ExternalLink, Info, Mail, MessageCircle } from "lucide-react";

export default function Slide29() {
    return (
            <div className="flex flex-col h-full justify-center max-w-5xl mx-auto py-2 sm:py-6">
                                    {/* Chapter Header */}
                                    <div className="mb-6 sm:mb-8 text-center">
                                        <span className="inline-block px-3 py-1 rounded-full bg-blue-100 dark:bg-blue-900/40 text-xs font-medium text-blue-600 dark:text-blue-400 mb-3">
                                            Discussion
                                        </span>
                                    </div>
    
                                    <div className="text-center stagger-children">
                                        {/* Big Chat Icon */}
                                        <div className="inline-block mb-6">
                                            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center mx-auto shadow-lg">
                                                <MessageCircle className="w-10 h-10 sm:w-12 sm:h-12 text-white" />
                                            </div>
                                        </div>
    
                                        {/* Title */}
                                        <h2 className="text-3xl sm:text-5xl font-bold mb-3">Questions &amp; Discussion</h2>
    
                                        {/* Subtitle */}
                                        <p className="text-sm sm:text-lg text-slate-600 dark:text-slate-300 max-w-xl mx-auto mb-8 sm:mb-10">
                                            Open floor for feedback, queries, and next steps
                                        </p>
    
                                        {/* Contact Info Section */}
                                        <div className="inline-block bg-slate-50 dark:bg-slate-800/60 rounded-xl p-5 sm:p-6 mb-8 sm:mb-10">
                                            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 mb-3">
                                                For demo access, contact the SLTSERP project team
                                            </p>
                                            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-6">
                                                <div className="flex items-center gap-2">
                                                    <Mail className="w-4 h-4 text-blue-500" />
                                                    <span className="text-sm font-medium text-blue-600 dark:text-blue-400">
                                                        sltserp@slt.lk
                                                    </span>
                                                </div>
                                                <div className="hidden sm:block w-px h-4 bg-slate-300 dark:bg-slate-600" />
                                                <div className="flex items-center gap-2">
                                                    <Users className="w-4 h-4 text-emerald-500" />
                                                    <span className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                                                        Reach out to your regional OPMC coordinator
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
    
                                        {/* Buttons */}
                                        <div className="flex flex-wrap justify-center gap-3 sm:gap-4">
                                            <button
                                                onClick={() => { if (typeof window !== "undefined" && (window as any).__sltserp_navigate) (window as any).__sltserp_navigate(0); }}
                                                className="btn-focus inline-flex items-center gap-2 px-6 py-3 rounded-lg border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 font-medium text-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                                            >
                                                <Home className="w-4 h-4" />
                                                Restart Presentation
                                            </button>
                                            <button
                                                onClick={() => { if (typeof window !== "undefined" && (window as any).__sltserp_navigate) (window as any).__sltserp_navigate(0); }}
                                                className="btn-focus inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-blue-500 text-white font-medium text-sm hover:bg-blue-600 transition-colors"
                                            >
                                                <ExternalLink className="w-4 h-4" />
                                                Open ERP Portal
                                            </button>
                                        </div>
                                    </div>
                                </div>
        );
}
