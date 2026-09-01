"use client";

import { useState, useEffect, useCallback } from 'react';
import { Download, CheckCircle2, Monitor, RefreshCw, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

type BrowserType = 'chrome' | 'edge' | 'firefox' | 'other' | 'detecting';
type InstallStatus = 'checking' | 'installed' | 'not-installed';

interface BrowserInfo {
    type: BrowserType;
    name: string;
    icon: string;
    supported: boolean;
}

const EXTENSION_VERSION = '4.5.3';

/** Published install links. A button renders only once its URL is filled in, so an
 *  unpublished store never shows a dead link. Chrome and Edge get their URLs pasted
 *  in after store review (docs/EXTENSION_STORE_PUBLISHING.md); Firefox uses the
 *  AMO-signed .xpi committed to public/downloads by  npm run ext:amo. */
const STORE_LINKS: { browser: string; label: string; url: string }[] = [
    { browser: 'chrome', label: 'Install from Chrome Web Store', url: '' },
    { browser: 'edge', label: 'Install from Edge Add-ons', url: '' },
    { browser: 'firefox', label: 'Install for Firefox - signed .xpi, no Developer mode', url: '/downloads/SLT-Bridge-Firefox.xpi' },
];

const BROWSER_INFO: Record<string, BrowserInfo> = {
    chrome: { type: 'chrome', name: 'Google Chrome', icon: 'chrome', supported: true },
    edge: { type: 'edge', name: 'Microsoft Edge', icon: 'edge', supported: true },
    firefox: { type: 'firefox', name: 'Mozilla Firefox', icon: 'firefox', supported: true },
    other: { type: 'other', name: 'Unknown Browser', icon: 'other', supported: false },
};

function detectBrowser(): BrowserInfo {
    if (typeof navigator === 'undefined') return BROWSER_INFO.other;
    const ua = navigator.userAgent.toLowerCase();
    if (ua.includes('edg/')) return BROWSER_INFO.edge;
    if (ua.includes('firefox/')) return BROWSER_INFO.firefox;
    if (ua.includes('chrome/') || ua.includes('chromium/')) return BROWSER_INFO.chrome;
    return BROWSER_INFO.other;
}

function detectExtension(): { installed: boolean; version: string } {
    if (typeof document === 'undefined') return { installed: false, version: '' };
    const root = document.documentElement;

    if (root.hasAttribute('data-slt-bridge')) {
        return { installed: true, version: root.getAttribute('data-slt-bridge-version') || EXTENSION_VERSION };
    }
    if (root.hasAttribute('data-phoenix-bridge')) {
        return { installed: true, version: root.getAttribute('data-phoenix-version') || EXTENSION_VERSION };
    }
    if (root.hasAttribute('data-ishamp-bridge')) {
        return { installed: true, version: root.getAttribute('data-ishamp-version') || EXTENSION_VERSION };
    }
    const win = window as unknown as { SLT_BRIDGE?: { version: string } };
    if (win.SLT_BRIDGE) {
        return { installed: true, version: win.SLT_BRIDGE.version || EXTENSION_VERSION };
    }
    return { installed: false, version: '' };
}

export default function ExtensionDownloadPage() {
    const [browser, setBrowser] = useState<BrowserInfo>(BROWSER_INFO.other);
    const [installStatus, setInstallStatus] = useState<InstallStatus>('checking');
    const [extVersion, setExtVersion] = useState('');

    useEffect(() => {
        setBrowser(detectBrowser());
        const result = detectExtension();
        setInstallStatus(result.installed ? 'installed' : 'not-installed');
        setExtVersion(result.version);
    }, []);

    const handleRecheck = useCallback(() => {
        setInstallStatus('checking');
        setTimeout(() => {
            const result = detectExtension();
            setInstallStatus(result.installed ? 'installed' : 'not-installed');
            setExtVersion(result.version);
        }, 1000);
    }, []);

    const handleDownload = () => {
        window.open('/slt-bridge.zip', '_blank');
    };

    // The detected browser's link leads the list, so a Firefox user sees the
    // signed .xpi first while Chrome/Edge users still see what is live.
    const storeLinks = STORE_LINKS.filter((s) => s.url)
        .sort((a, b) => Number(b.browser === browser.type) - Number(a.browser === browser.type));

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 p-4 md:p-8">
            <div className="max-w-3xl mx-auto space-y-6">
                {/* Header */}
                <div className="text-center space-y-2">
                    <h1 className="text-3xl font-bold text-slate-900">SLT Bridge Extension</h1>
                    <p className="text-slate-500">
                        Sync Service Orders, Team Assignments, and Materials directly from SLT Portal
                    </p>
                    <Badge variant="outline" className="text-xs">v{EXTENSION_VERSION}</Badge>
                </div>

                {/* Status Card */}
                {installStatus === 'installed' && (
                    <Card className="border-emerald-200 bg-emerald-50">
                        <CardContent className="flex items-center gap-4 p-6">
                            <CheckCircle2 className="w-10 h-10 text-emerald-500 shrink-0" />
                            <div className="flex-1">
                                <h3 className="font-bold text-emerald-900">Extension Installed</h3>
                                <p className="text-sm text-emerald-700">
                                    SLT Bridge v{extVersion} is active. Data sync is operational.
                                </p>
                            </div>
                            <Button variant="outline" size="sm" onClick={handleRecheck}>
                                <RefreshCw className="w-4 h-4 mr-2" />
                                Recheck
                            </Button>
                        </CardContent>
                    </Card>
                )}

                {/* Browser Detection */}
                <Card>
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle className="flex items-center gap-2">
                                    <Monitor className="w-5 h-5" />
                                    Detected Browser
                                </CardTitle>
                                <CardDescription>
                                    {browser.name} {browser.supported ? '(Supported)' : '(Not officially supported)'}
                                </CardDescription>
                            </div>
                            <Badge variant={browser.supported ? 'default' : 'destructive'}>
                                {browser.supported ? 'Compatible' : 'Limited'}
                            </Badge>
                        </div>
                    </CardHeader>
                </Card>

                {/* Download Section */}
                {installStatus !== 'installed' && (
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Download className="w-5 h-5" />
                                Download Extension
                            </CardTitle>
                            <CardDescription>
                                Download the SLT Bridge extension for your browser
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {storeLinks.length > 0 ? (
                                <div className="space-y-2">
                                    <p className="text-sm font-semibold text-slate-700">
                                        One-click install - no Developer mode
                                    </p>
                                    {storeLinks.map((s) => (
                                        <Button
                                            key={s.browser}
                                            variant="outline"
                                            className="w-full justify-start"
                                            onClick={() => window.open(s.url, '_blank')}
                                        >
                                            <Download className="w-4 h-4 mr-2" />
                                            {s.label}
                                        </Button>
                                    ))}
                                    {storeLinks.length < STORE_LINKS.length && (
                                        <p className="text-xs text-slate-500">
                                            Chrome and Edge are still in store review - the manual install
                                            below works meanwhile. The Firefox file is signed by Mozilla
                                            (AMO unlisted) and installs permanently.
                                        </p>
                                    )}
                                </div>
                            ) : (
                                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                                    <p className="text-sm font-medium text-amber-900">Store publication in progress</p>
                                    <p className="text-xs text-amber-700 mt-1">
                                        The bridge is being published to the Chrome Web Store, Edge Add-ons and
                                        Firefox Add-ons. Until those reviews pass, use the manual install below -
                                        it takes about two minutes.
                                    </p>
                                </div>
                            )}

                            <Button onClick={handleDownload} variant="outline" className="w-full">
                                <Download className="w-4 h-4 mr-2" />
                                Download SLT Bridge v{EXTENSION_VERSION} (.zip) - manual install
                            </Button>

                            {!browser.supported && (
                                <div className="flex items-start gap-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                                    <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                                    <div className="text-sm text-amber-800">
                                        <p className="font-medium">Browser not officially supported</p>
                                        <p className="text-amber-600 mt-1">
                                            This extension is designed for Chrome, Edge, and Firefox.
                                            It may work on Chromium-based browsers like Brave or Opera.
                                        </p>
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                )}

                {/* Installation Instructions */}
                {installStatus !== 'installed' && (
                    <Card>
                        <CardHeader>
                            <CardTitle>Installation Steps</CardTitle>
                            <CardDescription>
                                Follow these steps for {browser.name}
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            {browser.type === 'chrome' && <ChromeInstructions />}
                            {browser.type === 'edge' && <EdgeInstructions />}
                            {browser.type === 'firefox' && <FirefoxInstructions />}
                            {browser.type === 'other' && <GenericInstructions />}

                            <div className="mt-6 pt-4 border-t">
                                <Button variant="outline" onClick={handleRecheck} className="w-full">
                                    <RefreshCw className="w-4 h-4 mr-2" />
                                    I&apos;ve installed it - Check Again
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* What it does */}
                <Card>
                    <CardHeader>
                        <CardTitle>What does SLT Bridge do?</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid gap-3">
                            {[
                                { title: 'Auto-Sync Service Orders', desc: 'Automatically captures SOD data from SLT Portal and syncs to ERP' },
                                { title: 'Team Assignment Capture', desc: 'Captures team member assignments directly from portal pages' },
                                { title: 'Material & Serial Sync', desc: 'Syncs material details and serial numbers without manual entry' },
                                { title: 'Real-time Status Updates', desc: 'Pushes status updates from portal back to ERP in real-time' },
                            ].map((item, i) => (
                                <div key={i} className="flex items-start gap-3">
                                    <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                                    <div>
                                        <p className="font-medium text-sm text-slate-900">{item.title}</p>
                                        <p className="text-xs text-slate-500">{item.desc}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>

                {/* Footer */}
                <div className="text-center text-xs text-slate-400 pb-4">
                    SLT Bridge Extension v{EXTENSION_VERSION} | SLTSERP
                </div>
            </div>
        </div>
    );
}

function ChromeInstructions() {
    return (
        <div className="space-y-4">
            <Step number={1} title="Extract the ZIP file">
                <p>Right-click the downloaded ZIP file and select &quot;Extract All&quot; (Windows) or &quot;Double-click to open&quot; (Mac). Extract it to a folder you can find easily later.</p>
            </Step>
            <Step number={2} title="Open Chrome Extensions">
                <p>Open a new Chrome tab and navigate to:</p>
                <code className="block mt-2 p-2 bg-slate-100 rounded text-sm font-mono">chrome://extensions/</code>
                <p className="mt-2 text-xs text-slate-500">Or: Menu (three dots) &rarr; Extensions &rarr; Manage Extensions</p>
            </Step>
            <Step number={3} title="Enable Developer Mode">
                <p>Toggle the &quot;Developer mode&quot; switch in the top-right corner of the Extensions page.</p>
            </Step>
            <Step number={4} title="Load the Extension">
                <p>Click &quot;Load unpacked&quot; button and select the <strong>extracted folder</strong> (the one containing <code className="bg-slate-100 px-1 rounded">manifest.json</code>).</p>
            </Step>
            <Step number={5} title="Verify & Refresh">
                <p>The extension should appear in the list with a green icon. Then refresh this page to connect.</p>
            </Step>
        </div>
    );
}

function EdgeInstructions() {
    return (
        <div className="space-y-4">
            <Step number={1} title="Extract the ZIP file">
                <p>Right-click the downloaded ZIP file and select &quot;Extract All&quot;. Extract it to a folder you can find easily later.</p>
            </Step>
            <Step number={2} title="Open Edge Extensions">
                <p>Open a new Edge tab and navigate to:</p>
                <code className="block mt-2 p-2 bg-slate-100 rounded text-sm font-mono">edge://extensions/</code>
                <p className="mt-2 text-xs text-slate-500">Or: Menu (three dots) &rarr; Extensions</p>
            </Step>
            <Step number={3} title="Enable Developer Mode">
                <p>Toggle the &quot;Developer mode&quot; switch in the bottom-left corner of the Extensions page.</p>
            </Step>
            <Step number={4} title="Load the Extension">
                <p>Click &quot;Load unpacked&quot; button and select the <strong>extracted folder</strong> (the one containing <code className="bg-slate-100 px-1 rounded">manifest.json</code>).</p>
            </Step>
            <Step number={5} title="Verify & Refresh">
                <p>The extension should appear in the list. Then refresh this page to connect.</p>
            </Step>
        </div>
    );
}

function FirefoxInstructions() {
    return (
        <div className="space-y-4">
            <Step number={1} title="Download the signed add-on">
                <p>
                    Click the Firefox button above. Firefox downloads
                    <code className="mx-1 px-1 bg-slate-100 rounded">SLT-Bridge-Firefox.xpi</code>
                    - already signed by Mozilla (AMO unlisted), so nothing is flagged as unsafe.
                </p>
            </Step>
            <Step number={2} title="Install it">
                <p>
                    Open the downloaded file (Ctrl+J shows downloads). Firefox asks for confirmation -
                    click <strong>Add</strong>. The bridge installs permanently: no Developer mode,
                    and it survives restarts.
                </p>
            </Step>
            <Step number={3} title="Verify & Refresh">
                <p>
                    Check <code className="block mt-2 p-2 bg-slate-100 rounded text-sm font-mono">about:addons</code>
                    for SLT-ERP Bridge, then refresh this page to connect.
                </p>
            </Step>
        </div>
    );
}

function GenericInstructions() {
    return (
        <div className="space-y-4">
            <Step number={1} title="Extract the ZIP file">
                <p>Extract the downloaded ZIP file to a folder.</p>
            </Step>
            <Step number={2} title="Open your browser's Extensions page">
                <p>Navigate to your browser&apos;s extension/add-on management page. Look for &quot;Extensions&quot; or &quot;Add-ons&quot; in the browser settings.</p>
            </Step>
            <Step number={3} title="Enable Developer Mode (if available)">
                <p>Some browsers require &quot;Developer mode&quot; to be enabled before loading unpacked extensions.</p>
            </Step>
            <Step number={4} title="Load the Extension">
                <p>Look for &quot;Load unpacked&quot; or &quot;Load from file&quot; option and select the extracted folder containing <code className="bg-slate-100 px-1 rounded">manifest.json</code>.</p>
            </Step>
        </div>
    );
}

function Step({ number, title, children }: { number: number; title: string; children: React.ReactNode }) {
    return (
        <div className="flex gap-3">
            <div className="w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold shrink-0">
                {number}
            </div>
            <div className="flex-1 text-sm text-slate-600">
                <p className="font-medium text-slate-900 mb-1">{title}</p>
                {children}
            </div>
        </div>
    );
}
