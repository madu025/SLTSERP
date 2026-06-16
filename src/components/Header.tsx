"use client";

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ThemeCustomizer } from "@/components/ThemeCustomizer";
import NotificationBell from "@/components/NotificationBell";
import MobileNav from "@/components/MobileNav";
import ExtensionStatus from "@/components/ExtensionStatus";

interface User {
    name: string;
    role: string;
}

export default function Header() {
    const [user, setUser] = useState<User | null>(null);
    const [mounted, setMounted] = useState(false);
    const [showProfileMenu, setShowProfileMenu] = useState(false);
    const router = useRouter();

    useEffect(() => {
        const timer = setTimeout(() => {
            setMounted(true);
            const storedUser = localStorage.getItem('user');
            if (storedUser) {
                try {
                    const parsedUser = JSON.parse(storedUser) as User;
                    setUser(parsedUser);
                } catch (error) {
                    console.error('Failed to parse user from localStorage', error);
                }
            }
        }, 0);
        return () => clearTimeout(timer);
    }, []);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as HTMLElement;
            if (!target.closest('.profile-dropdown')) {
                setShowProfileMenu(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleLogout = () => {
        localStorage.removeItem('user');
        router.push('/login');
    };

    if (!mounted) {
        return <header className="h-14 md:h-16 border-b border-white/5 flex items-center justify-between px-4 md:px-8 z-10 sticky top-0 bg-background/50 backdrop-blur-md" />;
    }

    return (
        <header className="h-14 md:h-16 border-b border-white/5 flex items-center justify-between px-4 md:px-8 z-10 sticky top-0 bg-background/50 backdrop-blur-md">
            <div className="flex items-center gap-3 flex-1">
                {/* Mobile Navigation */}
                <MobileNav />

                {/* Search Bar - Hidden on small mobile, visible on larger screens */}
                <div className="relative max-w-md w-full hidden sm:block">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <svg className="h-5 w-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                    </span>
                    <input
                        className="block w-full pl-10 pr-3 py-2 border border-white/5 rounded-lg leading-5 bg-white/5 placeholder-slate-400 focus:outline-none focus:bg-white/10 focus:ring-1 focus:ring-primary focus:border-primary text-sm transition-all"
                        placeholder="Search..."
                        type="search"
                    />
                </div>
            </div>

            <div className="flex items-center space-x-2 md:space-x-4">
                <ExtensionStatus />
                <NotificationBell />

                <div className="relative profile-dropdown">
                    <button
                        onClick={() => setShowProfileMenu(!showProfileMenu)}
                        className="flex items-center space-x-2 md:space-x-3 focus:outline-none cursor-pointer"
                    >
                        <div className="text-right hidden lg:block">
                            <p className="text-sm font-semibold text-slate-200">{user?.name || 'User'}</p>
                            <p className="text-xs text-slate-400 capitalize">{user?.role?.toLowerCase().replace('_', ' ') || 'Guest'}</p>
                        </div>
                        <div className="h-9 w-9 md:h-10 md:w-10 rounded-full bg-primary flex items-center justify-center text-white font-bold shadow-md text-sm">
                            {user?.name?.substring(0, 2).toUpperCase() || '??'}
                        </div>
                        <svg className={`w-4 h-4 text-slate-400 transition-transform hidden md:block ${showProfileMenu ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                        </svg>
                    </button>

                    {showProfileMenu && (
                        <div className="absolute right-0 mt-2 w-48 bg-slate-900/95 backdrop-blur-md rounded-xl shadow-lg border border-white/5 py-1 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                            <Link
                                href="/profile"
                                className="block px-4 py-2 text-sm text-slate-200 hover:bg-white/5 transition-colors"
                                onClick={() => setShowProfileMenu(false)}
                            >
                                Your Profile
                            </Link>
                            <Link
                                href="/admin/settings"
                                className="block px-4 py-2 text-sm text-slate-200 hover:bg-white/5 transition-colors"
                                onClick={() => setShowProfileMenu(false)}
                            >
                                Settings
                            </Link>
                            <hr className="my-1 border-white/5" />
                            <button
                                onClick={handleLogout}
                                className="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                            >
                                Sign Out
                            </button>
                        </div>
                    )}
                </div>

                <div className="hidden md:block">
                    <ThemeCustomizer />
                </div>
            </div>
        </header>
    );
}
