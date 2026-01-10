"use client";

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ThemeCustomizer } from "@/components/ThemeCustomizer";

interface User {
    name: string;
    role: string;
}

export default function Header() {
    const [user, setUser] = useState<User | null>(null);
    const [showProfileMenu, setShowProfileMenu] = useState(false);
    const router = useRouter();

    useEffect(() => {
        const storedUser = localStorage.getItem('user');
        if (storedUser) {
            setUser(JSON.parse(storedUser));
        }
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

    return (
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 z-10 sticky top-0">
            <div className="flex items-center flex-1">
                <div className="relative max-w-md w-full">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <svg className="h-5 w-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                    </span>
                    <input
                        className="block w-full pl-10 pr-3 py-2 border border-slate-200 rounded-lg leading-5 bg-slate-50 placeholder-slate-400 focus:outline-none focus:bg-white focus:ring-1 focus:ring-primary focus:border-primary sm:text-sm transition-all"
                        placeholder="Search projects, staff, or materials..."
                        type="search"
                    />
                </div>
            </div>

            <div className="flex items-center space-x-6">
                <button className="p-2 text-slate-400 hover:text-slate-600 focus:outline-none relative">
                    <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                    </svg>
                    <span className="absolute top-2 right-2 block h-2 w-2 rounded-full bg-red-500 ring-2 ring-white"></span>
                </button>

                <div className="relative profile-dropdown">
                    <button
                        onClick={() => setShowProfileMenu(!showProfileMenu)}
                        className="flex items-center space-x-3 focus:outline-none"
                    >
                        <div className="text-right hidden sm:block">
                            <p className="text-sm font-semibold text-slate-900">{user?.name || 'User'}</p>
                            <p className="text-xs text-slate-500 capitalize">{user?.role?.toLowerCase().replace('_', ' ') || 'Guest'}</p>
                        </div>
                        <div className="h-10 w-10 rounded-full bg-primary flex items-center justify-center text-white font-bold shadow-md">
                            {user?.name?.substring(0, 2).toUpperCase() || '??'}
                        </div>
                        <svg className={`w-4 h-4 text-slate-400 transition-transform ${showProfileMenu ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                        </svg>
                    </button>

                    {showProfileMenu && (
                        <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-lg border border-slate-100 py-1 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                            <a href="#" className="block px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors">Your Profile</a>
                            <a href="#" className="block px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors">Settings</a>
                            <hr className="my-1 border-slate-100" />
                            <button
                                onClick={handleLogout}
                                className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                            >
                                Sign Out
                            </button>
                        </div>
                    )}
                </div>

                <ThemeCustomizer />
            </div>
        </header>
    );
}
