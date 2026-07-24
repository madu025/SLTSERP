"use client";

import React, { useState, useEffect } from 'react';
import { Download, X, Share2, PlusSquare, Smartphone, Check } from 'lucide-react';
import { Button } from './ui/button';

interface BeforeInstallPromptEvent extends Event {
    readonly platforms: Array<string>;
    readonly userChoice: Promise<{
        outcome: 'accepted' | 'dismissed';
    }>;
    prompt(): Promise<void>;
}

export default function PWAInstallPrompt() {
    const [showPrompt, setShowPrompt] = useState(false);
    const [isIOS, setIsIOS] = useState(false);
    const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
    const [installed, setInstalled] = useState(false);

    useEffect(() => {
        if (typeof window === 'undefined') return;

        // 1. Check if already running in standalone mode (installed app)
        const isStandalone = 
            window.matchMedia('(display-mode: standalone)').matches || 
            (window.navigator as unknown as { standalone?: boolean }).standalone === true;

        if (isStandalone) {
            setInstalled(true);
            return;
        }

        // 2. Check if dismissed recently (ignore for 7 days)
        const dismissedTime = localStorage.getItem('pwa_prompt_dismissed');
        if (dismissedTime) {
            const timePassed = Date.now() - parseInt(dismissedTime);
            const sevenDays = 7 * 24 * 60 * 60 * 1000;
            if (timePassed < sevenDays) {
                return;
            }
        }

        // 3. Detect iOS
        const userAgent = window.navigator.userAgent.toLowerCase();
        const isIpadOrIphone = /iphone|ipad|ipod/.test(userAgent);
        setIsIOS(isIpadOrIphone);

        // 4. Android / Chrome: Listen to beforeinstallprompt event
        const handleBeforeInstallPrompt = (e: Event) => {
            e.preventDefault();
            setDeferredPrompt(e as BeforeInstallPromptEvent);
            setShowPrompt(true);
        };

        window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

        // 5. iOS: If iOS and not standalone, show prompt after a 3s delay for better UX
        if (isIpadOrIphone && !isStandalone) {
            const timer = setTimeout(() => {
                setShowPrompt(true);
            }, 3000);
            return () => clearTimeout(timer);
        }

        return () => {
            window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
        };
    }, []);

    const handleInstallAndroid = async () => {
        if (!deferredPrompt) return;
        
        await deferredPrompt.prompt();
        const choiceResult = await deferredPrompt.userChoice;
        
        if (choiceResult.outcome === 'accepted') {
            setInstalled(true);
            setShowPrompt(false);
        }
        setDeferredPrompt(null);
    };

    const handleDismiss = () => {
        localStorage.setItem('pwa_prompt_dismissed', String(Date.now()));
        setShowPrompt(false);
    };

    if (!showPrompt || installed) return null;

    return (
        <div className="fixed bottom-20 left-4 right-4 md:bottom-6 md:left-auto md:right-6 md:w-96 z-50 animate-in slide-in-from-bottom-5 duration-300">
            <div className="bg-slate-900/95 backdrop-blur-md border border-slate-800 p-4 rounded-3xl shadow-2xl space-y-3.5 relative overflow-hidden">
                {/* Visual Glow Header Accent */}
                <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600" />
                
                <button 
                    onClick={handleDismiss}
                    className="absolute top-3.5 right-3.5 text-slate-500 hover:text-slate-300 transition-colors p-1"
                >
                    <X className="w-4 h-4" />
                </button>

                <div className="flex gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 shrink-0 shadow-inner">
                        <Smartphone className="w-5 h-5 animate-pulse" />
                    </div>
                    <div className="space-y-0.5 pr-6">
                        <h4 className="text-xs font-bold text-white tracking-tight">Install SLTSERP Mobile App</h4>
                        <p className="text-[10.5px] text-slate-400 leading-relaxed">
                            Access your van stock, accept dispatches, and log SODs offline with instant standalone launch.
                        </p>
                    </div>
                </div>

                {isIOS ? (
                    /* iOS Add to Home Screen Instructions */
                    <div className="bg-slate-950/60 rounded-2xl border border-slate-800/80 p-3 space-y-2 text-[10.5px] text-slate-300 font-medium">
                        <p className="text-slate-400 font-bold uppercase tracking-wider text-[9px]">To install on iPhone / Safari:</p>
                        <div className="flex items-start gap-2">
                            <span className="flex items-center justify-center w-4 h-4 bg-slate-800 rounded text-[9.5px] font-bold text-slate-400 shrink-0">1</span>
                            <span className="flex items-center gap-1 flex-wrap">
                                Tap the 
                                <span className="inline-flex items-center gap-0.5 bg-slate-800 px-1.5 py-0.5 rounded text-white text-[9.5px]">
                                    <Share2 className="w-3 h-3 text-blue-400" /> Share
                                </span> 
                                button in the Safari browser.
                            </span>
                        </div>
                        <div className="flex items-start gap-2">
                            <span className="flex items-center justify-center w-4 h-4 bg-slate-800 rounded text-[9.5px] font-bold text-slate-400 shrink-0">2</span>
                            <span className="flex items-center gap-1 flex-wrap">
                                Scroll down and select
                                <span className="inline-flex items-center gap-0.5 bg-slate-800 px-1.5 py-0.5 rounded text-white text-[9.5px]">
                                    <PlusSquare className="w-3 h-3 text-amber-400" /> Add to Home Screen
                                </span>.
                            </span>
                        </div>
                        <div className="flex justify-end pt-1">
                            <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={handleDismiss} 
                                className="h-7 text-[10px] text-slate-400 hover:text-white"
                            >
                                Maybe Later
                            </Button>
                        </div>
                    </div>
                ) : (
                    /* Android / Chrome One-Tap Install */
                    <div className="flex gap-2 pt-1">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleDismiss}
                            className="flex-1 h-9 bg-transparent border-slate-800 text-slate-400 hover:text-white text-[11px] rounded-xl font-bold"
                        >
                            Maybe Later
                        </Button>
                        <Button
                            size="sm"
                            onClick={handleInstallAndroid}
                            className="flex-1 h-9 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white text-[11px] rounded-xl font-bold shadow-lg shadow-amber-950/20 flex items-center justify-center gap-1"
                        >
                            <Download className="w-3.5 h-3.5" /> Install App
                        </Button>
                    </div>
                )}
            </div>
        </div>
    );
}
