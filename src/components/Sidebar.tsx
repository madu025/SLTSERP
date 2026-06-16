"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { SIDEBAR_MENU, hasAccess } from '@/config/sidebar-menu';
import SyncStatus from './SyncStatus';
import Image from 'next/image';
import { ChevronLeft, ChevronRight, ChevronDown, LogOut } from 'lucide-react';

interface User {
    name: string;
    role: string;
    username: string;
}

// Role display label map
const ROLE_LABELS: Record<string, string> = {
    SUPER_ADMIN: 'Super Administrator',
    ADMIN: 'Administrator',
    OSP_MANAGER: 'OSP Manager',
    AREA_MANAGER: 'Area Manager',
    ENGINEER: 'Engineer',
    STORES_MANAGER: 'Stores Manager',
    STORES_ASSISTANT: 'Stores Assistant',
    PROCUREMENT_OFFICER: 'Procurement Officer',
    QC_OFFICER: 'QC Officer',
    AREA_COORDINATOR: 'Area Coordinator',
    MANAGER: 'Manager',
};

export default function Sidebar() {
    const [user, setUser] = useState<User | null>(null);
    const [mounted, setMounted] = useState(false);
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [expandedMenus, setExpandedMenus] = useState<string[]>([]);
    const [hoveredItem, setHoveredItem] = useState<string | null>(null);
    const pathname = usePathname();

    useEffect(() => {
        const handleStorageChange = () => {
            const storedUser = localStorage.getItem('user');
            if (storedUser) setUser(JSON.parse(storedUser));
        };
        window.addEventListener('storage', handleStorageChange);

        const timer = setTimeout(() => {
            const storedUser = localStorage.getItem('user');
            if (storedUser) setUser(JSON.parse(storedUser));
            setMounted(true);
        }, 0);

        return () => {
            window.removeEventListener('storage', handleStorageChange);
            clearTimeout(timer);
        };
    }, []);

    useEffect(() => {
        // Auto-expand menu if a child is active
        SIDEBAR_MENU.forEach(item => {
            if (item.submenu?.some(sub => pathname === sub.path || pathname.startsWith(sub.path + '/'))) {
                setExpandedMenus(prev => {
                    if (!prev.includes(item.title)) return [...prev, item.title];
                    return prev;
                });
            }
        });
    }, [pathname]);

    const userRole = user?.role || '';
    const userInitials = user?.name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '??';
    const roleLabel = ROLE_LABELS[userRole] || userRole?.replace(/_/g, ' ') || 'User';

    const handleLogout = () => {
        localStorage.removeItem('user');
        window.location.href = '/login';
    };

    return (
        <>
            {/* Sidebar */}
            <aside
                className={`${isCollapsed ? 'w-[72px]' : 'w-[260px]'} flex-shrink-0 hidden md:flex flex-col h-screen sticky top-0 z-40 transition-all duration-300 ease-in-out`}
                style={{
                    background: 'linear-gradient(180deg, #0A1628 0%, #0D1F3C 40%, #0A1A30 100%)',
                    borderRight: '1px solid rgba(0, 114, 187, 0.15)',
                    boxShadow: '4px 0 24px rgba(0,0,0,0.35)',
                }}
            >
                {/* ── TOP HEADER ── */}
                <div
                    className={`flex items-center ${isCollapsed ? 'justify-center px-0 py-5' : 'justify-between px-5 py-4'} flex-shrink-0`}
                    style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
                >
                    {!isCollapsed && (
                        <div className="flex items-center gap-3 overflow-hidden">
                            <div className="relative flex-shrink-0">
                                <div
                                    className="w-9 h-9 rounded-xl flex items-center justify-center"
                                    style={{
                                        background: 'linear-gradient(135deg, #004A80, #0072BB)',
                                        boxShadow: '0 4px 12px rgba(0,114,187,0.4)',
                                    }}
                                >
                                    <Image
                                        src="/logo.png"
                                        alt="SLTS"
                                        width={22}
                                        height={22}
                                        className="object-contain"
                                        style={{ filter: 'brightness(0) invert(1)' }}
                                    />
                                </div>
                            </div>
                            <div className="flex flex-col min-w-0">
                                <span className="text-[15px] font-bold text-white leading-tight tracking-wide">SLTS Nexus</span>
                                <span className="text-[9px] font-semibold uppercase tracking-[0.18em]" style={{ color: '#00AEEF' }}>
                                    Workflow Management
                                </span>
                            </div>
                        </div>
                    )}

                    {isCollapsed && (
                        <div
                            className="w-9 h-9 rounded-xl flex items-center justify-center"
                            style={{
                                background: 'linear-gradient(135deg, #004A80, #0072BB)',
                                boxShadow: '0 4px 12px rgba(0,114,187,0.4)',
                            }}
                        >
                            <Image
                                src="/logo.png"
                                alt="SLTS"
                                width={22}
                                height={22}
                                className="object-contain"
                                style={{ filter: 'brightness(0) invert(1)' }}
                            />
                        </div>
                    )}

                    {/* Collapse Toggle */}
                    <button
                        onClick={() => setIsCollapsed(!isCollapsed)}
                        className="flex-shrink-0 flex items-center justify-center w-7 h-7 rounded-lg transition-all duration-200"
                        style={{
                            background: 'rgba(255,255,255,0.04)',
                            border: '1px solid rgba(255,255,255,0.08)',
                            color: 'rgba(255,255,255,0.45)',
                            marginLeft: isCollapsed ? 0 : '0.25rem',
                        }}
                        onMouseEnter={e => {
                            (e.currentTarget as HTMLButtonElement).style.background = 'rgba(0,114,187,0.15)';
                            (e.currentTarget as HTMLButtonElement).style.color = '#00AEEF';
                            (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(0,114,187,0.3)';
                        }}
                        onMouseLeave={e => {
                            (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.04)';
                            (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.45)';
                            (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,0.08)';
                        }}
                        title={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
                    >
                        {isCollapsed
                            ? <ChevronRight className="w-3.5 h-3.5" />
                            : <ChevronLeft className="w-3.5 h-3.5" />
                        }
                    </button>
                </div>

                {/* ── NAVIGATION ── */}
                <nav className="flex-1 overflow-y-auto overflow-x-hidden py-3" style={{ scrollbarWidth: 'none' }}>
                    {!isCollapsed && (
                        <div className="px-5 pb-2 pt-1">
                            <span
                                className="text-[9px] font-bold uppercase tracking-[0.2em]"
                                style={{ color: 'rgba(0,174,239,0.5)' }}
                            >
                                Navigation
                            </span>
                        </div>
                    )}

                    <div className="px-2 space-y-0.5">
                        {mounted ? SIDEBAR_MENU.filter(item => hasAccess(userRole, item.allowedRoles)).map((item) => {
                            const Icon = item.icon;
                            const hasSubmenu = item.submenu && item.submenu.length > 0;
                            const isChildActive = hasSubmenu && item.submenu?.some(
                                sub => pathname === sub.path || pathname.startsWith(sub.path + '/')
                            );
                            const isActive = pathname === item.path || isChildActive;
                            const isExpanded = expandedMenus.includes(item.title);
                            const isHovered = hoveredItem === item.title;

                            const handleMenuClick = (e: React.MouseEvent) => {
                                if (hasSubmenu) {
                                    e.preventDefault();
                                    setExpandedMenus(prev =>
                                        prev.includes(item.title) ? prev.filter(t => t !== item.title) : [...prev, item.title]
                                    );
                                }
                            };

                            return (
                                <div key={`menu-${item.title}-${item.path}`}>
                                    {/* Menu Item */}
                                    <div className="relative group">
                                        <Link
                                            href={hasSubmenu ? '#' : item.path}
                                            onClick={handleMenuClick}
                                            onMouseEnter={() => setHoveredItem(item.title)}
                                            onMouseLeave={() => setHoveredItem(null)}
                                            className="flex items-center justify-between rounded-xl transition-all duration-200 cursor-pointer"
                                            style={{
                                                padding: isCollapsed ? '0.625rem' : '0.55rem 0.75rem',
                                                justifyContent: isCollapsed ? 'center' : 'space-between',
                                                background: isActive
                                                    ? 'linear-gradient(135deg, rgba(0,114,187,0.25) 0%, rgba(0,174,239,0.1) 100%)'
                                                    : isHovered
                                                        ? 'rgba(255,255,255,0.05)'
                                                        : 'transparent',
                                                border: isActive
                                                    ? '1px solid rgba(0,114,187,0.3)'
                                                    : '1px solid transparent',
                                                boxShadow: isActive ? '0 2px 12px rgba(0,114,187,0.15)' : 'none',
                                            }}
                                            title={isCollapsed ? item.title : ''}
                                        >
                                            {/* Active bar indicator */}
                                            {isActive && !isCollapsed && (
                                                <div
                                                    className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] rounded-r-full"
                                                    style={{
                                                        height: '60%',
                                                        background: 'linear-gradient(180deg, #00AEEF, #0072BB)',
                                                        boxShadow: '0 0 8px rgba(0,174,239,0.6)',
                                                    }}
                                                />
                                            )}

                                            <div className="flex items-center gap-3 min-w-0">
                                                {/* Icon */}
                                                <div
                                                    className="flex-shrink-0 flex items-center justify-center rounded-lg transition-all duration-200"
                                                    style={{
                                                        width: '32px',
                                                        height: '32px',
                                                        background: isActive
                                                            ? 'linear-gradient(135deg, rgba(0,114,187,0.35), rgba(0,174,239,0.2))'
                                                            : 'rgba(255,255,255,0.04)',
                                                        border: isActive
                                                            ? '1px solid rgba(0,174,239,0.3)'
                                                            : '1px solid rgba(255,255,255,0.06)',
                                                        color: isActive ? '#00AEEF' : isHovered ? '#fff' : 'rgba(255,255,255,0.5)',
                                                    }}
                                                >
                                                    <Icon
                                                        className="w-4 h-4 transition-colors"
                                                    />
                                                </div>

                                                {/* Label */}
                                                {!isCollapsed && (
                                                    <span
                                                        className="text-[13px] font-medium truncate transition-colors"
                                                        style={{ color: isActive ? '#fff' : isHovered ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.6)' }}
                                                    >
                                                        {item.title}
                                                    </span>
                                                )}
                                            </div>

                                            {/* Chevron for submenu */}
                                            {!isCollapsed && hasSubmenu && (
                                                <ChevronDown
                                                    className="w-3.5 h-3.5 flex-shrink-0 transition-transform duration-200"
                                                    style={{
                                                        color: isActive ? '#00AEEF' : 'rgba(255,255,255,0.3)',
                                                        transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                                                    }}
                                                />
                                            )}
                                        </Link>

                                        {/* Tooltip for collapsed mode */}
                                        {isCollapsed && (
                                            <div
                                                className="absolute left-full top-1/2 -translate-y-1/2 ml-3 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-white whitespace-nowrap pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-50"
                                                style={{
                                                    background: 'rgba(10,22,40,0.98)',
                                                    border: '1px solid rgba(0,114,187,0.3)',
                                                    boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                                                }}
                                            >
                                                {item.title}
                                                <div
                                                    className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent"
                                                    style={{ borderRightColor: 'rgba(0,114,187,0.3)' }}
                                                />
                                            </div>
                                        )}
                                    </div>

                                    {/* ── SUBMENU ── */}
                                    {!isCollapsed && hasSubmenu && isExpanded && (
                                        <div
                                            className="mt-0.5 ml-4 pl-3 space-y-0.5"
                                            style={{ borderLeft: '1px solid rgba(0,114,187,0.2)' }}
                                        >
                                            {item.submenu!.filter(sub => hasAccess(userRole, sub.allowedRoles)).map(sub => {
                                                const isSubActive = pathname === sub.path || pathname.startsWith(sub.path + '/');
                                                return (
                                                    <Link
                                                        key={sub.path}
                                                        href={sub.path}
                                                        className="flex items-center gap-2.5 px-2.5 py-[7px] rounded-lg text-[12px] font-medium transition-all duration-150 group/sub"
                                                        style={{
                                                            color: isSubActive ? '#00AEEF' : 'rgba(255,255,255,0.45)',
                                                            background: isSubActive ? 'rgba(0,114,187,0.12)' : 'transparent',
                                                        }}
                                                        onMouseEnter={e => {
                                                            if (!isSubActive) {
                                                                (e.currentTarget as HTMLAnchorElement).style.color = 'rgba(255,255,255,0.85)';
                                                                (e.currentTarget as HTMLAnchorElement).style.background = 'rgba(255,255,255,0.04)';
                                                            }
                                                        }}
                                                        onMouseLeave={e => {
                                                            if (!isSubActive) {
                                                                (e.currentTarget as HTMLAnchorElement).style.color = 'rgba(255,255,255,0.45)';
                                                                (e.currentTarget as HTMLAnchorElement).style.background = 'transparent';
                                                            }
                                                        }}
                                                    >
                                                        {/* Sub dot indicator */}
                                                        <div
                                                            className="w-1.5 h-1.5 rounded-full flex-shrink-0 transition-all"
                                                            style={{
                                                                background: isSubActive ? '#00AEEF' : 'rgba(255,255,255,0.2)',
                                                                boxShadow: isSubActive ? '0 0 6px rgba(0,174,239,0.6)' : 'none',
                                                            }}
                                                        />
                                                        <span className="truncate">{sub.title}</span>
                                                    </Link>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            );
                        }) : (
                            /* Loading skeleton */
                            <div className="space-y-2 px-1 py-2">
                                {[80, 65, 75, 55, 70].map((w, i) => (
                                    <div key={i} className="flex items-center gap-3 p-2 rounded-xl" style={{ animation: 'pulse 1.5s ease-in-out infinite', animationDelay: `${i * 0.1}s` }}>
                                        <div className="w-8 h-8 rounded-lg flex-shrink-0" style={{ background: 'rgba(255,255,255,0.05)' }} />
                                        {!isCollapsed && <div className="h-3 rounded-full flex-1" style={{ background: 'rgba(255,255,255,0.05)', maxWidth: `${w}%` }} />}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </nav>

                {/* ── SYNC STATUS (Admins only) ── */}
                {mounted && hasAccess(userRole, ['SUPER_ADMIN', 'ADMIN']) && (
                    <SyncStatus isCollapsed={isCollapsed} />
                )}

                {/* ── USER PROFILE SECTION ── */}
                <div
                    className="flex-shrink-0"
                    style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}
                >
                    <Link
                        href="/profile"
                        className="flex items-center transition-all duration-200 group/profile"
                        style={{
                            padding: isCollapsed ? '0.875rem' : '0.875rem 1rem',
                            justifyContent: isCollapsed ? 'center' : 'flex-start',
                            gap: '0.75rem',
                        }}
                        onMouseEnter={e => {
                            (e.currentTarget as HTMLAnchorElement).style.background = 'rgba(0,114,187,0.08)';
                        }}
                        onMouseLeave={e => {
                            (e.currentTarget as HTMLAnchorElement).style.background = 'transparent';
                        }}
                    >
                        {/* Avatar */}
                        <div
                            className="flex-shrink-0 relative"
                            style={{ width: '36px', height: '36px' }}
                        >
                            <div
                                className="w-full h-full rounded-full flex items-center justify-center text-xs font-bold text-white"
                                style={{
                                    background: 'linear-gradient(135deg, #004A80, #0072BB)',
                                    boxShadow: '0 0 0 2px rgba(0,114,187,0.3)',
                                    fontSize: '13px',
                                    letterSpacing: '0.04em',
                                }}
                            >
                                {userInitials}
                            </div>
                            {/* Online dot */}
                            <div
                                className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full"
                                style={{
                                    background: '#10b981',
                                    border: '2px solid #0A1628',
                                    boxShadow: '0 0 6px rgba(16,185,129,0.6)',
                                }}
                            />
                        </div>

                        {/* User info */}
                        {!isCollapsed && (
                            <div className="flex-1 min-w-0">
                                <p className="text-[13px] font-semibold text-white truncate leading-tight">
                                    {user?.name || 'Loading...'}
                                </p>
                                <p className="text-[10px] truncate leading-tight mt-0.5" style={{ color: 'rgba(0,174,239,0.7)' }}>
                                    {roleLabel}
                                </p>
                            </div>
                        )}

                        {/* Logout button */}
                        {!isCollapsed && (
                            <button
                                onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleLogout(); }}
                                className="flex-shrink-0 p-1.5 rounded-lg opacity-0 group-hover/profile:opacity-100 transition-all duration-200"
                                style={{
                                    color: 'rgba(239,68,68,0.7)',
                                    background: 'rgba(239,68,68,0.08)',
                                    border: '1px solid rgba(239,68,68,0.15)',
                                }}
                                onMouseEnter={e => {
                                    (e.currentTarget as HTMLButtonElement).style.color = '#f87171';
                                    (e.currentTarget as HTMLButtonElement).style.background = 'rgba(239,68,68,0.15)';
                                }}
                                onMouseLeave={e => {
                                    (e.currentTarget as HTMLButtonElement).style.color = 'rgba(239,68,68,0.7)';
                                    (e.currentTarget as HTMLButtonElement).style.background = 'rgba(239,68,68,0.08)';
                                }}
                                title="Sign Out"
                            >
                                <LogOut className="w-3.5 h-3.5" />
                            </button>
                        )}
                    </Link>
                </div>
            </aside>
        </>
    );
}
