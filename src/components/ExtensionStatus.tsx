"use client";

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Download, AlertCircle, CheckCircle2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";

interface BridgeInfo {
    installed: boolean;
    version: string;
    type: 'phoenix' | 'ishamp' | 'slt' | 'legacy' | null;
    timestamp?: string;
}

export default function ExtensionStatus() {
    const [status, setStatus] = useState<'checking' | 'installed' | 'missing'>('checking');
    const [bridgeInfo, setBridgeInfo] = useState<BridgeInfo>({
        installed: false,
        version: "",
        type: null
    });
    const [lastChecked, setLastChecked] = useState<Date | null>(null);
    const checkCount = useRef(0);
    const maxChecks = 10;

    // Multiple detection methods combined
    const detectExtension = useCallback((): BridgeInfo => {
        if (typeof document === 'undefined' || typeof window === 'undefined') {
            return { installed: false, version: "", type: null };
        }

        const root = document.documentElement;
        const result: BridgeInfo = { installed: false, version: "", type: null };

        // Method 1: Check i-Shamp specific attributes (Primary)
        if (root.hasAttribute('data-ishamp-bridge')) {
            result.installed = true;
            result.type = 'ishamp';
            result.version = root.getAttribute('data-ishamp-version') || "";
            result.timestamp = root.getAttribute('data-ishamp-detected') || undefined;
        }

        // Method 2: Check for data attributes on HTML element (Phoenix Bridge / Legacy)
        else if (root.hasAttribute('data-phoenix-bridge')) {
            result.installed = true;
            result.type = 'phoenix';
            result.version = root.getAttribute('data-phoenix-version') || "";
            result.timestamp = root.getAttribute('data-phoenix-detected') || undefined;
        }

        // Method 3: Check legacy SLT Bridge
        else if (root.hasAttribute('data-slt-bridge-installed')) {
            result.installed = true;
            result.type = 'slt';
            result.version = root.getAttribute('data-slt-bridge-version') || "";
        }

        // Method 4: Check for Phoenix HUD element in DOM
        if (!result.installed) {
            const phoenixHud = document.getElementById('phoenix-hud');
            if (phoenixHud) {
                result.installed = true;
                result.type = 'phoenix';
                const hudText = phoenixHud.innerText || "";
                const versionMatch = hudText.match(/v?(\d+\.\d+\.\d+)/);
                result.version = versionMatch ? versionMatch[1] : "4.x.x";
            }
        }

        // Method 5: Check for global objects
        if (!result.installed) {
            const win = window as unknown as {
                ISHAMP_BRIDGE?: { version: string },
                PHOENIX_BRIDGE?: { version: string }
            };
            if (win.ISHAMP_BRIDGE) {
                result.installed = true;
                result.type = 'ishamp';
                result.version = win.ISHAMP_BRIDGE.version || "4.x.x";
            } else if (win.PHOENIX_BRIDGE) {
                result.installed = true;
                result.type = 'phoenix';
                result.version = win.PHOENIX_BRIDGE.version || "4.x.x";
            }
        }

        return result;
    }, []);


    const checkExtension = useCallback(() => {
        const result = detectExtension();
        checkCount.current += 1;

        if (result.installed) {
            setStatus('installed');
            setBridgeInfo(result);
            setLastChecked(new Date());
            return true;
        }

        if (checkCount.current >= maxChecks) {
            setStatus('missing');
            setLastChecked(new Date());
        }

        return false;
    }, [detectExtension]);

    useEffect(() => {
        // Run check after mount to avoid SSR issues and potential sync state update issues
        const timer = setTimeout(() => {
            if (checkExtension()) return;
        }, 100);

        // Listen for custom events from extension
        const handleBridgeDetected = (e: Event) => {
            const detail = (e as CustomEvent).detail;
            console.log("⚡ [Bridge Detection] Event Received:", detail);

            setStatus('installed');
            setBridgeInfo({
                installed: true,
                version: detail?.version || "4.4.3",
                type: detail?.type || 'ishamp',
                timestamp: new Date().toISOString()
            });
            setLastChecked(new Date());
        };

        window.addEventListener('PHOENIX_BRIDGE_DETECTED', handleBridgeDetected);
        window.addEventListener('SLT_BRIDGE_DETECTED', handleBridgeDetected);
        window.addEventListener('ISHAMP_BRIDGE_DETECTED', handleBridgeDetected);

        // Polling
        const pollInterval = setInterval(() => {
            if (checkExtension()) {
                clearInterval(pollInterval);
            }
        }, 2000);

        return () => {
            clearTimeout(timer);
            clearInterval(pollInterval);
            window.removeEventListener('PHOENIX_BRIDGE_DETECTED', handleBridgeDetected);
            window.removeEventListener('SLT_BRIDGE_DETECTED', handleBridgeDetected);
            window.removeEventListener('ISHAMP_BRIDGE_DETECTED', handleBridgeDetected);
        };
    }, [checkExtension]);

    const handleRecheck = () => {
        setStatus('checking');
        checkCount.current = 0;
        setTimeout(() => checkExtension(), 500);
    };

    if (status === 'checking') {
        return (
            <div className="flex items-center gap-1.5 px-3 py-1 bg-slate-50 text-slate-400 rounded-full border border-slate-200">
                <RefreshCw className="w-3 h-3 animate-spin" />
                <span className="text-[10px] uppercase tracking-wider">Checking...</span>
            </div>
        );
    }

    if (status === 'installed') {
        const typeLabel = {
            'phoenix': 'Phoenix',
            'ishamp': 'i-Shamp',
            'slt': 'SLT Bridge',
            'legacy': 'Extension'
        }[bridgeInfo.type || 'ishamp'];

        return (
            <Popover>
                <PopoverTrigger asChild>
                    <button className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-600 rounded-full border border-emerald-100 hover:bg-emerald-100 transition-all font-bold shadow-sm">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span className="text-[10px] uppercase tracking-wider">
                            {typeLabel} Connected
                        </span>
                        {bridgeInfo.version && (
                            <span className="text-[9px] bg-emerald-200 text-emerald-800 px-1.5 py-0.5 rounded-full ml-1">
                                v{bridgeInfo.version}
                            </span>
                        )}
                    </button>
                </PopoverTrigger>
                <PopoverContent className="w-72 p-4 shadow-xl border-emerald-100" align="end">
                    <div className="flex flex-col gap-3">
                        <div className="flex items-center justify-between pb-2 border-b border-emerald-100">
                            <span className="text-xs font-semibold text-slate-500">Bridge Status</span>
                            <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full flex items-center gap-1">
                                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
                                ONLINE
                            </span>
                        </div>

                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <span className="text-xs text-slate-500">Type</span>
                                <span className="text-xs font-medium text-slate-700">{typeLabel}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-xs text-slate-500">Version</span>
                                <span className="text-[10px] font-mono bg-slate-100 px-2 py-0.5 rounded">
                                    {bridgeInfo.version || "4.4.3"}
                                </span>
                            </div>
                            {lastChecked && (
                                <div className="flex items-center justify-between">
                                    <span className="text-xs text-slate-500">Last Verified</span>
                                    <span className="text-[10px] text-slate-400">
                                        {lastChecked.toLocaleTimeString()}
                                    </span>
                                </div>
                            )}
                        </div>

                        <div className="pt-2 border-t border-slate-100">
                            <p className="text-[10px] text-slate-500 leading-relaxed">
                                i-Shamp Bridge is active. Your data will automatically sync between SLT Portal and ERP.
                            </p>
                        </div>

                        <button
                            onClick={handleRecheck}
                            className="text-[10px] text-slate-400 hover:text-slate-600 flex items-center justify-center gap-1 mt-1"
                        >
                            <RefreshCw className="w-3 h-3" />
                            Verify Again
                        </button>
                    </div>
                </PopoverContent>
            </Popover>
        );
    }

    return (
        <Popover>
            <PopoverTrigger asChild>
                <button className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 text-amber-600 rounded-full border border-amber-200 hover:bg-amber-100 transition-all shadow-sm animate-pulse">
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span className="text-[10px] font-bold uppercase tracking-wider">
                        Extension Missing
                    </span>
                </button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-0 shadow-xl border-amber-200" align="end" side="bottom">
                <div className="bg-gradient-to-r from-amber-50 to-orange-50 p-4 border-b border-amber-100">
                    <h3 className="text-sm font-bold text-amber-900 flex items-center gap-2">
                        <Download className="w-4 h-4" />
                        Install i-Shamp Bridge
                    </h3>
                    <p className="text-xs text-amber-700 mt-1.5 leading-relaxed">
                        To sync Team Assignments, Serial Numbers, and Materials directly from SLT Portal, install the updated extension.
                    </p>
                </div>

                <div className="p-4 space-y-4">
                    <div className="space-y-3">
                        <div className="flex items-start gap-3">
                            <div className="w-5 h-5 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">1</div>
                            <span className="text-xs text-slate-600">Download the updated ZIP</span>
                        </div>
                        <div className="flex items-start gap-3">
                            <div className="w-5 h-5 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">2</div>
                            <span className="text-xs text-slate-600">Extract and Load in Extensions</span>
                        </div>
                        <div className="flex items-start gap-3">
                            <div className="w-5 h-5 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">3</div>
                            <span className="text-xs text-slate-600">Refresh this page to connect</span>
                        </div>
                    </div>

                    <div className="pt-2 space-y-2">
                        <Button
                            className="w-full bg-amber-600 hover:bg-amber-700 text-white shadow-sm"
                            size="sm"
                            onClick={() => window.open('/slt-bridge.zip', '_blank')}
                        >
                            <Download className="w-4 h-4 mr-2" />
                            Download Extension v4.4.3
                        </Button>

                        <button
                            onClick={handleRecheck}
                            className="w-full text-[11px] text-slate-500 hover:text-slate-700 flex items-center justify-center gap-1.5 py-2"
                        >
                            <RefreshCw className="w-3.5 h-3.5" />
                            I&apos;ve installed it, check again
                        </button>

                    </div>
                </div>
            </PopoverContent>
        </Popover>
    );
}
