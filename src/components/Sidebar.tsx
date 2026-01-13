"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { SIDEBAR_MENU, hasAccess } from '@/config/sidebar-menu';
import { useQuery, useQueryClient } from '@tanstack/react-query';

interface User {
    name: string;
    role: string;
    username: string;
}

export default function Sidebar() {
    const [user, setUser] = useState<User | null>(null);
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [expandedMenus, setExpandedMenus] = useState<string[]>([]);
    const pathname = usePathname();

    useEffect(() => {
        const storedUser = localStorage.getItem('user');
        if (storedUser) {
            setUser(JSON.parse(storedUser));
        }
    }, []);

    useEffect(() => {
        // Auto-expand menu if a child is active
        SIDEBAR_MENU.forEach(item => {
            if (item.submenu?.some(sub => pathname === sub.path)) {
                setExpandedMenus(prev => {
                    // Only add if not already present
                    if (!prev.includes(item.title)) return [...prev, item.title];
                    return prev;
                });
            }
        });
    }, [pathname]);

    const userRole = user?.role || '';

    // Fetch pending restore requests count
    const { data: restoreCount = 0 } = useQuery({
        queryKey: ['restore-requests-count'],
        queryFn: async () => {
            // Mocking fetch or hitting a real endpoint if exists. 
            // Ideally: const res = await fetch('/api/restore-requests/count'); return res.json().count;
            // For now, I'll fetch list and count length (not efficient but works for now).
            const res = await fetch('/api/restore-requests?status=PENDING');
            if (!res.ok) return 0;
            const data = await res.json();
            return Array.isArray(data) ? data.length : 0;
        },
        enabled: !!userRole && hasAccess(userRole, ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'OSP_MANAGER', 'AREA_MANAGER', 'ENGINEER', 'ASSISTANT_ENGINEER', 'AREA_COORDINATOR']), // Only fetch if allowed
        staleTime: 5 * 60 * 1000, // Data stays fresh for 5 mins
        refetchOnWindowFocus: false
    });

    const queryClient = useQueryClient();

    // SSE Integration: Listen for notifications and invalidate count
    useEffect(() => {
        const handleNewNotification = (e: any) => {
            const notification = e.detail;
            // If it's a restore request notification, refetch the count
            if (notification.link === '/restore-requests' || notification.type === 'SYSTEM') {
                console.log("SSE Trigger: Updating restore requests count in sidebar");
                queryClient.invalidateQueries({ queryKey: ['restore-requests-count'] });
            }
        };

        window.addEventListener('slts-notification', handleNewNotification);
        return () => window.removeEventListener('slts-notification', handleNewNotification);
    }, [queryClient]);

    return (
        <aside
            className={`${isCollapsed ? 'w-20' : 'w-64'} flex-shrink-0 hidden md:flex flex-col h-screen sticky top-0 transition-all duration-300 text-sidebar-foreground`}
            style={{ backgroundColor: 'rgb(var(--color-sidebar))' }}
        >
            {/* Header with Toggle */}
            <div className="p-6 flex items-center justify-between border-b border-white/5">
                {!isCollapsed && (
                    <div className="flex items-center gap-3">
                        <div className="relative w-10 h-10 flex-shrink-0 animate-in zoom-in duration-500">
                            <img src="/logo.png" alt="Logo" className="w-full h-full object-contain filter drop-shadow-[0_0_8px_rgba(255,255,255,0.2)]" />
                        </div>
                        <div className="animate-in fade-in slide-in-from-left duration-500">
                            <h2 className="text-xl font-bold text-white tracking-wider leading-none">SLTSERP</h2>
                            <p className="text-[10px] text-sky-400/80 mt-1 uppercase tracking-[0.2em] font-medium leading-none">Construction</p>
                        </div>
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
                    const hasSubmenu = item.submenu && item.submenu.length > 0;
                    // Check if current path matches item or any submenu
                    const isChildActive = hasSubmenu && item.submenu?.some(sub => pathname === sub.path);
                    const isActive = pathname === item.path || isChildActive;
                    const isExpanded = expandedMenus.includes(item.title); // Decoupled from isChildActive logic for rendering

                    const handleMenuClick = (e: React.MouseEvent) => {
                        if (hasSubmenu) {
                            e.preventDefault();
                            setExpandedMenus(prev =>
                                prev.includes(item.title) ? prev.filter(t => t !== item.title) : [...prev, item.title]
                            );
                        }
                    };

                    return (
                        <div key={`menu-${item.title}-${item.path}`} className="space-y-1">
                            <Link
                                href={hasSubmenu ? '#' : item.path}
                                onClick={handleMenuClick}
                                className={`flex items-center justify-between px-3 py-2 text-sm font-medium rounded-lg transition-colors ${isActive && !hasSubmenu ? 'bg-primary text-white' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                                    }`}
                                title={isCollapsed ? item.title : ''}
                            >
                                <div className="flex items-center relative">
                                    <Icon className={`w-5 h-5 ${isCollapsed ? '' : 'mr-3'}`} />
                                    {!isCollapsed && <span>{item.title}</span>}

                                    {/* Badge for Restore Requests */}
                                    {item.path === '/restore-requests' && restoreCount > 0 && (
                                        <span className={`bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full ${isCollapsed ? 'absolute -top-1 -right-1' : 'ml-2'}`}>
                                            {restoreCount}
                                        </span>
                                    )}
                                </div>
                                {!isCollapsed && hasSubmenu && (
                                    <svg className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                                )}
                            </Link>

                            {/* Submenu */}
                            {!isCollapsed && hasSubmenu && isExpanded && (
                                <div className="pl-10 space-y-1">
                                    {item.submenu!.filter(sub => hasAccess(userRole, sub.allowedRoles)).map(sub => (
                                        <Link
                                            key={sub.path}
                                            href={sub.path}
                                            className={`flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors ${pathname === sub.path ? 'text-white bg-slate-800' : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                                                }`}
                                        >
                                            {sub.title}
                                        </Link>
                                    ))}
                                </div>
                            )}
                        </div>
                    );
                })}
            </nav>

            <Link href="/profile" className="p-4 border-t border-slate-800 block hover:bg-slate-800/50 transition-colors">
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
            </Link>
        </aside>
    );
}
