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
    const pathname = usePathname();

    useEffect(() => {
        const storedUser = localStorage.getItem('user');
        if (storedUser) {
            setUser(JSON.parse(storedUser));
        }
    }, []);

    // Close menu when route changes
    useEffect(() => {
        setIsOpen(false);
    }, [pathname]);

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
                {/* Header */}
                <div className="p-6 border-b border-slate-800">
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="text-xl font-bold text-white tracking-wider">SLTSERP</h2>
                            <p className="text-xs text-slate-400 mt-1 uppercase tracking-widest">Construction</p>
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
                        const isActive = pathname === item.path;

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
