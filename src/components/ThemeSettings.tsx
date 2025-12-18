"use client";

import React, { useState } from 'react';
import { useTheme } from '@/contexts/ThemeContext';

export default function ThemeSettings() {
    const { colorTheme, mode, setColorTheme, setMode } = useTheme();
    const [isOpen, setIsOpen] = useState(false);

    const colorThemes = [
        { name: 'Blue', value: 'blue' as const, color: 'bg-blue-500' },
        { name: 'Green', value: 'green' as const, color: 'bg-green-500' },
        { name: 'Teal', value: 'teal' as const, color: 'bg-teal-500' },
        { name: 'Cyan', value: 'cyan' as const, color: 'bg-cyan-500' },
        { name: 'Indigo', value: 'indigo' as const, color: 'bg-indigo-500' },
        { name: 'Purple', value: 'purple' as const, color: 'bg-purple-500' },
        { name: 'Pink', value: 'pink' as const, color: 'bg-pink-500' },
        { name: 'Orange', value: 'orange' as const, color: 'bg-orange-500' },
        { name: 'Red', value: 'red' as const, color: 'bg-red-500' },
        { name: 'Dark Blue', value: 'darkblue' as const, color: 'bg-blue-700' },
        { name: 'Ash Gray', value: 'ash' as const, color: 'bg-slate-500' },
    ];

    return (
        <div className="fixed bottom-6 right-6 z-50">
            {isOpen && (
                <div className="mb-4 bg-white dark-mode:bg-slate-800 rounded-2xl shadow-xl border border-slate-200 dark-mode:border-slate-700 p-4 w-72 animate-in slide-in-from-bottom-4 fade-in duration-200">
                    <h3 className="font-bold text-slate-900 dark-mode:text-white mb-4">Theme Settings</h3>

                    {/* Mode Toggle */}
                    <div className="mb-4">
                        <label className="text-xs font-semibold text-slate-500 dark-mode:text-slate-400 uppercase tracking-wider mb-2 block">Mode</label>
                        <div className="flex bg-slate-100 dark-mode:bg-slate-700 rounded-xl p-1">
                            <button
                                onClick={() => setMode('light')}
                                className={`flex-1 flex items-center justify-center space-x-2 px-3 py-2 rounded-lg font-medium text-sm transition-all ${mode === 'light'
                                    ? 'bg-white dark-mode:bg-slate-600 text-slate-900 dark-mode:text-white shadow-sm'
                                    : 'text-slate-600 dark-mode:text-slate-300'
                                    }`}
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                                </svg>
                                <span>Light</span>
                            </button>
                            <button
                                onClick={() => setMode('dark')}
                                className={`flex-1 flex items-center justify-center space-x-2 px-3 py-2 rounded-lg font-medium text-sm transition-all ${mode === 'dark'
                                    ? 'bg-white dark-mode:bg-slate-600 text-slate-900 dark-mode:text-white shadow-sm'
                                    : 'text-slate-600 dark-mode:text-slate-300'
                                    }`}
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                                </svg>
                                <span>Dark</span>
                            </button>
                        </div>
                    </div>

                    {/* Color Themes */}
                    <div>
                        <label className="text-xs font-semibold text-slate-500 dark-mode:text-slate-400 uppercase tracking-wider mb-2 block">Color</label>
                        <div className="space-y-2">
                            {colorThemes.map((t) => (
                                <button
                                    key={t.value}
                                    onClick={() => setColorTheme(t.value)}
                                    className={`w-full flex items-center space-x-3 p-3 rounded-xl transition-all ${colorTheme === t.value
                                        ? 'bg-slate-100 dark-mode:bg-slate-700 border-2 border-slate-300 dark-mode:border-slate-600'
                                        : 'hover:bg-slate-50 dark-mode:hover:bg-slate-700/50 border-2 border-transparent'
                                        }`}
                                >
                                    <div className={`w-6 h-6 rounded-full ${t.color} ${colorTheme === t.value ? 'ring-2 ring-offset-2 ring-slate-400 dark-mode:ring-slate-500' : ''}`}></div>
                                    <span className="font-medium text-slate-700 dark-mode:text-slate-200">{t.name}</span>
                                    {colorTheme === t.value && (
                                        <svg className="w-5 h-5 ml-auto text-slate-600 dark-mode:text-slate-300" fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                        </svg>
                                    )}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            <button
                onClick={() => setIsOpen(!isOpen)}
                className="bg-white dark-mode:bg-slate-800 hover:bg-slate-50 dark-mode:hover:bg-slate-700 text-slate-700 dark-mode:text-slate-200 p-4 rounded-full shadow-lg border border-slate-200 dark-mode:border-slate-700 transition-all hover:scale-110"
                title="Theme Settings"
            >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                </svg>
            </button>
        </div>
    );
}
