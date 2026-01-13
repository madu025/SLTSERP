"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { X, Menu } from 'lucide-react';
import { SIDEBAR_MENU, hasAccess } from '@/config/sidebar-menu';

interface User {
    name: string;
    role: string;
    username: string;
}

export default function MobileNav() {
    const [isOpen, setIsOpen] = useState(false);
    const [user, setUser] = useState<User | null>(null);
    const [expandedMenus, setExpandedMenus] = useState<string[]>([]);
    const pathname = usePathname();

    useEffect(() => {
        const storedUser = localStorage.getItem('user');
        if (storedUser) {
            setUser(JSON.parse(storedUser));
        }
    }, []);

    // Close menu on route change
    useEffect(() => {
        setIsOpen(false);
    }, [pathname]);

    // Auto-expand menu if a child is active or parent matches
    useEffect(() => {
        SIDEBAR_MENU.forEach(item => {
            if (item.submenu?.some(sub => pathname === sub.path)) {
                setExpandedMenus(prev => {
                    if (!prev.includes(item.title)) return [...prev, item.title];
                    return prev;
                });
            }
        });
    }, [pathname]);

    const toggleMenu = (title: string) => {
        setExpandedMenus(prev =>
            prev.includes(title)
                ? prev.filter(t => t !== title)
                : [...prev, title]
        );
    };

    // Prevent body scroll when menu is open
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }
        return () => {
            document.body.style.overflow = 'unset';
        };
    }, [isOpen]);

    const userRole = user?.role || '';

    return (
        <>
            {/* Mobile Menu Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="md:hidden p-2 rounded-lg hover:bg-slate-100 transition-colors"
                aria-label="Toggle menu"
            >
                {isOpen ? (
                    <X className="w-6 h-6 text-slate-700" />
                ) : (
                    <Menu className="w-6 h-6 text-slate-700" />
                )}
            </button>

            {/* Mobile Menu Overlay */}
            {isOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-40 md:hidden"
                    onClick={() => setIsOpen(false)}
                />
            )}

            {/* Mobile Menu Drawer */}
            <div
                className={`fixed top-0 left-0 h-full w-72 bg-sidebar text-sidebar-foreground z-50 transform transition-transform duration-300 ease-in-out md:hidden ${isOpen ? 'translate-x-0' : '-translate-x-full'
                    }`}
            >
                <div className="p-6 border-b border-white/5 bg-sidebar-dark">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="bg-white/10 p-1.5 rounded-lg border border-white/10">
                                <img src="/logo.png" alt="Logo" className="w-8 h-8 object-contain" />
                            </div>
                            <div>
                                <h2 className="text-lg font-bold text-white tracking-wider leading-none">SLTSERP</h2>
                                <p className="text-[10px] text-sky-400 mt-1 uppercase tracking-widest font-medium">Construction</p>
                            </div>
                        </div>
                        <button
                            onClick={() => setIsOpen(false)}
                            className="p-2 rounded-lg hover:bg-slate-800 transition-colors"
                        >
                            <X className="w-5 h-5 text-slate-400" />
                        </button>
                    </div>
                </div>

                {/* Navigation */}
                <nav className="flex-1 px-4 py-4 space-y-1 overflow-y-auto h-[calc(100vh-180px)]">
                    <div className="px-3 py-2 text-xs font-semibold text-slate-500 uppercase tracking-widest">
                        Menu
                    </div>

                    {SIDEBAR_MENU.filter(item => hasAccess(userRole, item.allowedRoles)).map((item) => {
                        const Icon = item.icon;
                        const hasSubmenu = item.submenu && item.submenu.length > 0;
                        const isExpanded = expandedMenus.includes(item.title);
                        const isParentActive = pathname === item.path || item.submenu?.some(sub => sub.path === pathname);
                        const isActive = pathname === item.path;

                        if (hasSubmenu) {
                            return (
                                <div key={`mobile-menu-${item.title}`} className="space-y-1">
                                    <button
                                        onClick={() => toggleMenu(item.title)}
                                        className={`w-full flex items-center justify-between px-3 py-3 text-sm font-medium rounded-lg transition-colors ${isParentActive
                                            ? 'bg-slate-800 text-white'
                                            : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                                            }`}
                                    >
                                        <div className="flex items-center">
                                            <Icon className="w-5 h-5 mr-3" />
                                            <span>{item.title}</span>
                                        </div>
                                        {/* Dynamic Chevron Import would be better, but assuming component context allows additional icons */}
                                        {/* Using simple text arrow if import missing, or I must ensure imports. 
                                            I'll edit imports in separate tool call if needed or assume user has them. 
                                            Wait, I am replacing whole function, I need to check imports.
                                            I will use a second tool call for imports or update the replace to include imports if I could.
                                            I can't edit top of file with this call targeting lines 15+.
                                            I'll rely on lucide-react being standard. I'll add ChevronDown/Up via separate replace if needed.
                                            Let's blindly use ChevronDown/ChevronRight and fix imports later.
                                         */}
                                        <svg className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                                        </svg>
                                    </button>

                                    {isExpanded && (
                                        <div className="pl-4 space-y-1">
                                            {item.submenu!.filter(sub => hasAccess(userRole, sub.allowedRoles)).map((sub) => {
                                                const isSubActive = pathname === sub.path;
                                                return (
                                                    <Link
                                                        key={`mobile-sub-${sub.path}`}
                                                        href={sub.path}
                                                        className={`flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors ${isSubActive
                                                            ? 'bg-primary text-white'
                                                            : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                                                            }`}
                                                    >
                                                        <span className="w-5 mr-3 flex justify-center text-[10px]">•</span>
                                                        <span>{sub.title}</span>
                                                    </Link>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            );
                        }

                        return (
                            <Link
                                key={`mobile-menu-${item.title}-${item.path}`}
                                href={item.path}
                                className={`flex items-center px-3 py-3 text-sm font-medium rounded-lg transition-colors ${isActive
                                    ? 'bg-primary text-white'
                                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                                    }`}
                            >
                                <Icon className="w-5 h-5 mr-3" />
                                <span>{item.title}</span>
                            </Link>
                        );
                    })}
                </nav>

                {/* User Profile */}
                <Link
                    href="/profile"
                    className="p-4 border-t border-slate-800 block hover:bg-slate-800/50 transition-colors"
                >
                    <div className="flex items-center space-x-3">
                        <div className="h-10 w-10 rounded-full bg-slate-700 flex items-center justify-center text-sm font-bold text-white">
                            {user?.name?.substring(0, 2).toUpperCase() || '??'}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-white truncate">{user?.name || 'Loading...'}</p>
                            <p className="text-xs text-slate-400 truncate">{user?.role || 'Role'}</p>
                        </div>
                    </div>
                </Link>
            </div>
        </>
    );
}
