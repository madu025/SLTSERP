"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

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

    const isAdmin = user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN';

    const adminLinks = [
        { name: 'User Management', href: '/admin/users', icon: '👥' },
        { name: 'Staff Hierarchy', href: '/admin/staff', icon: '🏢' },
        { name: 'OPMC Registration', href: '/admin/opmcs', icon: '📍' },
        { name: 'Contractor Management', href: '/admin/contractors', icon: '👷' },
    ];

    const ospLinks = [
        {
            name: 'Service Orders', href: '/service-orders', icon: (
                <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                </svg>
            )
        },
    ];

    const menuItems = [
        {
            name: 'Dashboard', href: '/dashboard', icon: (
                <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
            )
        },
        {
            name: 'Projects & BOQ', href: '/projects', icon: (
                <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
            )
        },
        {
            name: 'Inventory', href: '/inventory', icon: (
                <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
            )
        },
    ];

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
                {!isCollapsed && <div className="px-3 py-2 text-xs font-semibold text-slate-500 uppercase tracking-widest">Main</div>}
                {menuItems.map((item) => (
                    <Link
                        key={item.href}
                        href={item.href}
                        className={`flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors ${pathname === item.href ? 'bg-primary text-white' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                            }`}
                        title={isCollapsed ? item.name : ''}
                    >
                        {item.icon}
                        {!isCollapsed && <span>{item.name}</span>}
                    </Link>
                ))}

                {/* OSP Section - Accessible to all users */}
                {!isCollapsed && <div className="px-3 py-2 mt-6 text-xs font-semibold text-slate-500 uppercase tracking-widest">OSP</div>}
                {ospLinks.map((item) => (
                    <Link
                        key={item.href}
                        href={item.href}
                        className={`flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors ${pathname === item.href ? 'bg-primary text-white' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                            }`}
                        title={isCollapsed ? item.name : ''}
                    >
                        {item.icon}
                        {!isCollapsed && <span>{item.name}</span>}
                    </Link>
                ))}

                {/* Admin Section */}
                {isAdmin && (
                    <>
                        {!isCollapsed && <div className="px-3 py-2 mt-6 text-xs font-semibold text-slate-500 uppercase tracking-widest">Admin</div>}
                        {adminLinks.map((link) => (
                            <Link
                                key={link.href}
                                href={link.href}
                                className={`flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors ${pathname === link.href ? 'bg-primary text-white' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                                    }`}
                                title={isCollapsed ? link.name : ''}
                            >
                                <span className="text-lg mr-3">{link.icon}</span>
                                {!isCollapsed && <span>{link.name}</span>}
                            </Link>
                        ))}
                    </>
                )}
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
