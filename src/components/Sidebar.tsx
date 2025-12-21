"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { SIDEBAR_MENU, hasAccess } from '@/config/sidebar-menu';

interface User {
    name: string;
    role: string;
    username: string;
}

export default function Sidebar() {
    const [user, setUser] = useState<User | null>(null);
    const [isCollapsed, setIsCollapsed] = useState(false);
    const pathname = usePathname();

    useEffect(() => {
        const storedUser = localStorage.getItem('user');
        if (storedUser) {
            setUser(JSON.parse(storedUser));
        }
    }, []);

    const userRole = user?.role || '';

    return (
        <aside
            className={`${isCollapsed ? 'w-20' : 'w-64'} flex-shrink-0 hidden md:flex flex-col h-screen sticky top-0 transition-all duration-300 text-sidebar-foreground`}
            style={{ backgroundColor: 'rgb(var(--color-sidebar))' }}
        >
            {/* Header with Toggle */}
            <div className="p-6 flex items-center justify-between">
                {!isCollapsed && (
                    <div>
                        <h2 className="text-xl font-bold text-white tracking-wider">nexusErp</h2>
                        <p className="text-xs text-slate-400 mt-1 uppercase tracking-widest">Construction</p>
                    </div>
                )}
                <button
                    onClick={() => setIsCollapsed(!isCollapsed)}
                    className="p-2 rounded-lg hover:bg-slate-800 transition-colors text-slate-400 hover:text-white"
                    title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
                >
                    <svg className={`w-5 h-5 transition-transform ${isCollapsed ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
                    </svg>
                </button>
            </div>

            <nav className="flex-1 px-4 py-4 space-y-1 overflow-y-auto">
                {!isCollapsed && <div className="px-3 py-2 text-xs font-semibold text-slate-500 uppercase tracking-widest">Menu</div>}
                {SIDEBAR_MENU.filter(item => hasAccess(userRole, item.allowedRoles)).map((item) => {
                    const Icon = item.icon;
                    return (
                        <Link
                            key={item.path}
                            href={item.path}
                            className={`flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors ${pathname === item.path ? 'bg-primary text-white' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                                }`}
                            title={isCollapsed ? item.title : ''}
                        >
                            <Icon className={`w-5 h-5 ${isCollapsed ? '' : 'mr-3'}`} />
                            {!isCollapsed && <span>{item.title}</span>}
                        </Link>
                    );
                })}
            </nav>

            <div className="p-4 border-t border-slate-800">
                <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'space-x-3'}`}>
                    <div className="h-8 w-8 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
                        {user?.name?.substring(0, 2).toUpperCase() || '??'}
                    </div>
                    {!isCollapsed && (
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-white truncate">{user?.name || 'Loading...'}</p>
                            <p className="text-xs text-slate-400 truncate">{user?.role || 'Role'}</p>
                        </div>
                    )}
                </div>
            </div>
        </aside>
    );
}
