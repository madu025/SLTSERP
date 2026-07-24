"use client";

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ThemeCustomizer } from "@/components/ThemeCustomizer";
import NotificationBell from "@/components/NotificationBell";
import MobileNav from "@/components/MobileNav";
import ExtensionStatus from "@/components/ExtensionStatus";
import { Search } from 'lucide-react';

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
        localStorage.removeItem('token');
        if (user?.role?.startsWith('CONTRACTOR_')) {
            router.push('/contractor/login');
        } else {
            router.push('/login');
        }
    };

    if (!mounted) {
        return <header className="h-10 border-b border-border flex items-center justify-between px-4 z-10 sticky top-0 bg-card text-foreground" />;
    }

    return (
        <header className="h-10 border-b border-border flex items-center justify-between px-3 md:px-6 z-10 sticky top-0 bg-card text-foreground">
            {/* Mobile Navigation */}
            <MobileNav />

            {/* Compact Search Bar */}
            <div className="relative max-w-[280px] w-full hidden sm:block ml-4">
                <span className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none">
                    <Search className="h-3.5 w-3.5 text-muted-foreground" />
                </span>
                <input
                    className="block w-full pl-8 pr-2.5 h-6.5 text-[11px] border border-border rounded bg-muted/30 placeholder-muted-foreground focus:outline-none focus:bg-muted/50 focus:ring-1 focus:ring-primary focus:border-primary transition-all text-foreground"
                    placeholder="Search..."
                    type="search"
                />
            </div>

            <div className="flex-1" />

            <div className="flex items-center gap-1 md:gap-3">
                <ExtensionStatus />
                <NotificationBell />

                <div className="relative profile-dropdown">
                    <button
                        onClick={() => setShowProfileMenu(!showProfileMenu)}
                        className="flex items-center gap-1.5 md:gap-2 focus:outline-none cursor-pointer"
                    >
                        <div className="text-right hidden lg:block">
                            <p className="text-xs font-semibold text-foreground leading-tight">{user?.name || 'User'}</p>
                            <p className="text-[10px] text-muted-foreground capitalize leading-tight">{user?.role?.toLowerCase().replace('_', ' ') || 'Guest'}</p>
                        </div>
                        <div className="h-7 w-7 rounded-full bg-primary flex items-center justify-center text-white font-bold text-[10px]">
                            {user?.name?.substring(0, 2).toUpperCase() || '??'}
                        </div>
                        <svg className={`w-3.5 h-3.5 text-slate-400 transition-transform hidden md:block ${showProfileMenu ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                        </svg>
                    </button>

                    {showProfileMenu && (
                        <div className="absolute right-0 mt-1 w-40 bg-card border border-border rounded-lg shadow-sm py-1 z-50">
                            <Link
                                href="/profile"
                                className="block px-3 py-1.5 text-xs text-foreground hover:bg-muted transition-colors"
                                onClick={() => setShowProfileMenu(false)}
                            >
                                Your Profile
                            </Link>
                            <Link
                                href="/admin/settings"
                                className="block px-3 py-1.5 text-xs text-foreground hover:bg-muted transition-colors"
                                onClick={() => setShowProfileMenu(false)}
                            >
                                Settings
                            </Link>
                            <hr className="my-1 border-border" />
                            <button
                                onClick={handleLogout}
                                className="w-full text-left px-3 py-1.5 text-xs text-red-600 hover:bg-red-500/10 transition-colors cursor-pointer"
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