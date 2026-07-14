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
    const [expandedSubMenus, setExpandedSubMenus] = useState<string[]>([]);
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
        SIDEBAR_MENU.forEach(item => {
            const hasActiveChild = item.submenu?.some(sub => {
                const isActiveSub = pathname === sub.path || pathname.startsWith(sub.path + '/');
                const isActiveNested = sub.submenu?.some(child => pathname === child.path || pathname.startsWith(child.path + '/'));
                
                if (isActiveNested) {
                    setExpandedSubMenus(prev => {
                        if (!prev.includes(sub.title)) return [...prev, sub.title];
                        return prev;
                    });
                }
                
                return isActiveSub || isActiveNested;
            });
            
            if (hasActiveChild) {
                setExpandedMenus(prev => {
                    if (!prev.includes(item.title)) return [...prev, item.title];
                    return prev;
                });
            }
        });
    }, [pathname]);

    const userRole = user?.role || '';
    const userInitials = user?.name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '??';

    // Extract all paths in the navigation tree to resolve route specificity collisions
    const allPaths = SIDEBAR_MENU.flatMap(item => [
        item.path,
        ...(item.submenu?.flatMap(sub => [
            sub.path,
            ...(sub.submenu?.map(child => child.path) || [])
        ]) || [])
    ]).filter(p => p !== '#');

    // Helper to determine if a route is active relative to pathname and all other specific routes
    const checkActive = (itemPath: string) => {
        if (!itemPath || itemPath === '#') return false;
        if (pathname === itemPath) return true;
        
        // Match sub-routes (e.g. /helpdesk/tickets/123 matches /helpdesk)
        // only if there isn't a more specific registered path in allPaths that matches
        return pathname.startsWith(itemPath + '/') && !allPaths.some(otherPath => 
            otherPath !== itemPath && 
            otherPath.startsWith(itemPath + '/') && 
            pathname.startsWith(otherPath)
        );
    };
    const roleLabel = ROLE_LABELS[userRole] || userRole?.replace(/_/g, ' ') || 'User';

    const handleLogout = () => {
        localStorage.removeItem('user');
        window.location.href = '/login';
    };

    return (
        <>
            <aside
                className={`${isCollapsed ? 'w-[56px]' : 'w-[220px]'} flex-shrink-0 hidden md:flex flex-col h-screen sticky top-0 z-40 transition-all duration-300 ease-in-out`}
                style={{
                    background: '#0D1B2A',
                    borderRight: '1px solid rgba(0, 114, 187, 0.12)',
                }}
            >
                {/* TOP HEADER */}
                <div
                    className={`flex items-center ${isCollapsed ? 'justify-center px-0 py-3' : 'justify-between px-3 py-2.5'} flex-shrink-0`}
                    style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}
                >
                    {!isCollapsed && (
                        <div className="flex items-center gap-2 overflow-hidden">
                            <div className="relative flex-shrink-0">
                                <div
                                    className="w-7 h-7 rounded-lg flex items-center justify-center"
                                    style={{
                                        background: 'linear-gradient(135deg, #004A80, #0072BB)',
                                    }}
                                >
                                    <Image
                                        src="/logo.png"
                                        alt="SLTS"
                                        width={18}
                                        height={18}
                                        className="object-contain"
                                        style={{ filter: 'brightness(0) invert(1)' }}
                                    />
                                </div>
                            </div>
                            <div className="flex flex-col min-w-0">
                                <span className="text-[13px] font-bold text-white leading-tight tracking-wide">SLTS Nexus</span>
                                <span className="text-[7px] font-semibold uppercase tracking-[0.16em]" style={{ color: '#00AEEF' }}>
                                    Workflow Management
                                </span>
                            </div>
                        </div>
                    )}

                    {isCollapsed && (
                        <div
                            className="w-7 h-7 rounded-lg flex items-center justify-center"
                            style={{
                                background: 'linear-gradient(135deg, #004A80, #0072BB)',
                            }}
                        >
                            <Image
                                src="/logo.png"
                                alt="SLTS"
                                width={18}
                                height={18}
                                className="object-contain"
                                style={{ filter: 'brightness(0) invert(1)' }}
                            />
                        </div>
                    )}

                    <button
                        onClick={() => setIsCollapsed(!isCollapsed)}
                        className="flex-shrink-0 flex items-center justify-center w-6 h-6 rounded transition-all duration-200"
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

                {/* NAVIGATION */}
                <nav className="flex-1 overflow-y-auto overflow-x-hidden py-1.5" style={{ scrollbarWidth: 'none' }}>
                    {!isCollapsed && (
                        <div className="px-3 pb-1.5 pt-1">
                            <span
                                className="text-[8px] font-bold uppercase tracking-[0.18em]"
                                style={{ color: 'rgba(0,174,239,0.4)' }}
                            >
                                Navigation
                            </span>
                        </div>
                    )}

                    <div className="px-1.5 space-y-0">
                        {mounted ? SIDEBAR_MENU.filter(item => hasAccess(userRole, item.allowedRoles)).map((item) => {
                            const Icon = item.icon;
                            const hasSubmenu = item.submenu && item.submenu.length > 0;
                            const isChildActive = hasSubmenu && item.submenu?.some(sub => 
                                checkActive(sub.path) || sub.submenu?.some(child => checkActive(child.path))
                            );
                            const isActive = checkActive(item.path) || isChildActive;
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
                                    <div className="relative group">
                                        <Link
                                            href={hasSubmenu ? '#' : item.path}
                                            onClick={handleMenuClick}
                                            onMouseEnter={() => setHoveredItem(item.title)}
                                            onMouseLeave={() => setHoveredItem(null)}
                                            className="flex items-center justify-between rounded-lg transition-all duration-150 cursor-pointer"
                                            style={{
                                                padding: isCollapsed ? '0.5rem' : '0.35rem 0.55rem',
                                                justifyContent: isCollapsed ? 'center' : 'space-between',
                                                background: isActive
                                                    ? 'rgba(0,114,187,0.2)'
                                                    : isHovered
                                                        ? 'rgba(255,255,255,0.04)'
                                                        : 'transparent',
                                                border: isActive
                                                    ? '1px solid rgba(0,114,187,0.25)'
                                                    : '1px solid transparent',
                                            }}
                                            title={isCollapsed ? item.title : ''}
                                        >
                                            {isActive && !isCollapsed && (
                                                <div
                                                    className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] rounded-r-full"
                                                    style={{
                                                        height: '56%',
                                                        background: 'linear-gradient(180deg, #00AEEF, #0072BB)',
                                                    }}
                                                />
                                            )}

                                            <div className="flex items-center gap-2 min-w-0">
                                                <div
                                                    className="flex-shrink-0 flex items-center justify-center rounded transition-all duration-150"
                                                    style={{
                                                        width: '28px',
                                                        height: '28px',
                                                        background: isActive
                                                            ? 'rgba(0,114,187,0.3)'
                                                            : 'rgba(255,255,255,0.03)',
                                                        border: isActive
                                                            ? '1px solid rgba(0,174,239,0.25)'
                                                            : '1px solid rgba(255,255,255,0.04)',
                                                        color: isActive ? '#00AEEF' : isHovered ? '#fff' : 'rgba(255,255,255,0.45)',
                                                    }}
                                                >
                                                    <Icon className="w-3.5 h-3.5 transition-colors" />
                                                </div>

                                                {!isCollapsed && (
                                                    <span
                                                        className="text-[11px] font-medium truncate transition-colors"
                                                        style={{ color: isActive ? '#fff' : isHovered ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.55)' }}
                                                    >
                                                        {item.title}
                                                    </span>
                                                )}
                                            </div>

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

                                    {/* SUBMENU */}
                                    {!isCollapsed && hasSubmenu && isExpanded && (
                                        <div
                                            className="mt-0 ml-3 pl-2 space-y-0"
                                            style={{ borderLeft: '1px solid rgba(0,114,187,0.15)' }}
                                        >
                                            {item.submenu!.filter(sub => hasAccess(userRole, sub.allowedRoles)).map(sub => {
                                                const siblingPaths = item.submenu!.map(s => s.path);
                                                
                                                const hasSubSubmenu = sub.submenu && sub.submenu.length > 0;
                                                const isSubSubExpanded = expandedSubMenus.includes(sub.title);
                                                
                                                const isChildActive = hasSubSubmenu && sub.submenu?.some(child => checkActive(child.path));
                                                const isSubActive = checkActive(sub.path) || isChildActive;

                                                const handleSubMenuClick = (e: React.MouseEvent) => {
                                                    if (hasSubSubmenu) {
                                                        e.preventDefault();
                                                        setExpandedSubMenus(prev =>
                                                            prev.includes(sub.title) ? prev.filter(t => t !== sub.title) : [...prev, sub.title]
                                                        );
                                                    }
                                                };

                                                return (
                                                    <div key={`sub-${sub.title}-${sub.path}`}>
                                                        <Link
                                                            href={hasSubSubmenu ? '#' : sub.path}
                                                            onClick={handleSubMenuClick}
                                                            className="flex items-center justify-between px-2 py-[4px] rounded text-[11px] font-medium transition-all duration-150 group/sub"
                                                            style={{
                                                                color: isSubActive ? '#00AEEF' : 'rgba(255,255,255,0.4)',
                                                                background: isSubActive ? 'rgba(0,114,187,0.1)' : 'transparent',
                                                            }}
                                                            onMouseEnter={e => {
                                                                if (!isSubActive) {
                                                                    (e.currentTarget as HTMLAnchorElement).style.color = 'rgba(255,255,255,0.8)';
                                                                    (e.currentTarget as HTMLAnchorElement).style.background = 'rgba(255,255,255,0.03)';
                                                                }
                                                            }}
                                                            onMouseLeave={e => {
                                                                if (!isSubActive) {
                                                                    (e.currentTarget as HTMLAnchorElement).style.color = 'rgba(255,255,255,0.4)';
                                                                    (e.currentTarget as HTMLAnchorElement).style.background = 'transparent';
                                                                }
                                                            }}
                                                        >
                                                            <div className="flex items-center gap-1.5 min-w-0">
                                                                <div
                                                                    className="w-1.5 h-1.5 rounded-full flex-shrink-0 transition-all"
                                                                    style={{
                                                                        background: isSubActive ? '#00AEEF' : 'rgba(255,255,255,0.2)',
                                                                        boxShadow: isSubActive ? '0 0 6px rgba(0,174,239,0.6)' : 'none',
                                                                    }}
                                                                />
                                                                <span className="truncate">{sub.title}</span>
                                                            </div>
                                                            {hasSubSubmenu && (
                                                                <ChevronDown
                                                                    className="w-3 h-3 flex-shrink-0 transition-transform duration-200"
                                                                    style={{
                                                                        color: isSubActive ? '#00AEEF' : 'rgba(255,255,255,0.3)',
                                                                        transform: isSubSubExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                                                                    }}
                                                                />
                                                            )}
                                                        </Link>

                                                        {/* NESTED 3RD LEVEL SUBMENU */}
                                                        {hasSubSubmenu && isSubSubExpanded && (
                                                            <div
                                                                className="mt-0 ml-3.5 pl-2.5 space-y-0.5"
                                                                style={{ borderLeft: '1px solid rgba(0,114,187,0.1)' }}
                                                            >
                                                                {sub.submenu!.filter(child => hasAccess(userRole, child.allowedRoles)).map(child => {
                                                                    const isChildItemActive = pathname === child.path;
                                                                    return (
                                                                        <Link
                                                                            key={child.path}
                                                                            href={child.path}
                                                                            className="flex items-center gap-1.5 px-2 py-[3px] rounded text-[10px] font-medium transition-all duration-150 group/child"
                                                                            style={{
                                                                                color: isChildItemActive ? '#00AEEF' : 'rgba(255,255,255,0.35)',
                                                                                background: isChildItemActive ? 'rgba(0,114,187,0.1)' : 'transparent',
                                                                            }}
                                                                            onMouseEnter={e => {
                                                                                if (!isChildItemActive) {
                                                                                    (e.currentTarget as HTMLAnchorElement).style.color = 'rgba(255,255,255,0.7)';
                                                                                    (e.currentTarget as HTMLAnchorElement).style.background = 'rgba(255,255,255,0.02)';
                                                                                }
                                                                            }}
                                                                            onMouseLeave={e => {
                                                                                if (!isChildItemActive) {
                                                                                    (e.currentTarget as HTMLAnchorElement).style.color = 'rgba(255,255,255,0.35)';
                                                                                    (e.currentTarget as HTMLAnchorElement).style.background = 'transparent';
                                                                                }
                                                                            }}
                                                                        >
                                                                            <span className="truncate">{child.title}</span>
                                                                        </Link>
                                                                    );
                                                                })}
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            );
                        }) : (
                            <div className="space-y-1.5 px-1 py-1.5">
                                {[80, 65, 75, 55, 70].map((w, i) => (
                                    <div key={i} className="flex items-center gap-2 p-1.5 rounded-lg" style={{ animation: 'pulse 1.5s ease-in-out infinite', animationDelay: `${i * 0.1}s` }}>
                                        <div className="w-7 h-7 rounded flex-shrink-0" style={{ background: 'rgba(255,255,255,0.05)' }} />
                                        {!isCollapsed && <div className="h-3 rounded-full flex-1" style={{ background: 'rgba(255,255,255,0.05)', maxWidth: `${w}%` }} />}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </nav>

                {mounted && hasAccess(userRole, ['SUPER_ADMIN', 'ADMIN']) && (
                    <SyncStatus isCollapsed={isCollapsed} />
                )}

                {/* USER PROFILE SECTION */}
                <div
                    className="flex-shrink-0"
                    style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}
                >
                    <Link
                        href="/profile"
                        className="flex items-center transition-all duration-200 group/profile"
                        style={{
                            padding: isCollapsed ? '0.65rem' : '0.6rem 0.75rem',
                            justifyContent: isCollapsed ? 'center' : 'flex-start',
                            gap: '0.5rem',
                        }}
                        onMouseEnter={e => {
                            (e.currentTarget as HTMLAnchorElement).style.background = 'rgba(0,114,187,0.08)';
                        }}
                        onMouseLeave={e => {
                            (e.currentTarget as HTMLAnchorElement).style.background = 'transparent';
                        }}
                    >
                        <div
                            className="flex-shrink-0 relative"
                            style={{ width: '28px', height: '28px' }}
                        >
                            <div
                                className="w-full h-full rounded-full flex items-center justify-center text-[11px] font-bold text-white"
                                style={{
                                    background: 'linear-gradient(135deg, #004A80, #0072BB)',
                                }}
                            >
                                {userInitials}
                            </div>
                            <div
                                className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full"
                                style={{
                                    background: '#10b981',
                                    border: '1.5px solid #0D1B2A',
                                }}
                            />
                        </div>

                        {!isCollapsed && (
                            <div className="flex-1 min-w-0">
                                <p className="text-[11px] font-semibold text-white truncate leading-tight">
                                    {user?.name || 'Loading...'}
                                </p>
                                <p className="text-[9px] truncate leading-tight mt-0" style={{ color: 'rgba(0,174,239,0.6)' }}>
                                    {roleLabel}
                                </p>
                            </div>
                        )}

                        {!isCollapsed && (
                            <button
                                onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleLogout(); }}
                                className="flex-shrink-0 p-1 rounded opacity-0 group-hover/profile:opacity-100 transition-all duration-150"
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
                                <LogOut className="w-3 h-3" />
                            </button>
                        )}
                    </Link>
                </div>
            </aside>
        </>
    );
}