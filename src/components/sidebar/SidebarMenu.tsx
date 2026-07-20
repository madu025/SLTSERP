import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronDown } from 'lucide-react';
import { SIDEBAR_MENU, hasAccess } from '@/config/sidebar-menu';

interface SidebarMenuProps {
    userRole: string;
    user: { permissions?: string[] } | null;
    isCollapsed: boolean;
    mounted: boolean;
    menuCounts: Record<string, number>;
}

export function SidebarMenu({ userRole, user, isCollapsed, mounted, menuCounts }: SidebarMenuProps) {
    const pathname = usePathname();
    const [expandedMenus, setExpandedMenus] = useState<string[]>([]);
    const [expandedSubMenus, setExpandedSubMenus] = useState<string[]>([]);
    const [hoveredItem, setHoveredItem] = useState<string | null>(null);

    const getMenuCount = (title: string) => {
        switch (title) {
            case 'Service Orders': return menuCounts.serviceOrders || 0;
            case 'Inventory / Stores': return (menuCounts.materialRequests || 0) + (menuCounts.materialApprovals || 0);
            case 'Approvals': return (menuCounts.procurementApprovals || 0) + (menuCounts.contractorApprovals || 0);
            case 'Projects': return menuCounts.approvals || 0;
            case 'IT Help Desk': return menuCounts.helpdesk || 0;
            default: return 0;
        }
    };

    const getSubMenuCount = (title: string) => {
        switch (title) {
            case 'Pending SOD': return menuCounts.serviceOrders || 0;
            case 'Material Requests': return menuCounts.materialRequests || 0;
            case 'Material Approvals': return menuCounts.materialApprovals || 0;
            case 'Procurement Approvals': return menuCounts.procurementApprovals || 0;
            case 'Contractor Registration Approvals': return menuCounts.contractorApprovals || 0;
            case 'IT Dashboard (Staff)': return menuCounts.helpdesk || 0;
            case 'Project Approvals': return menuCounts.approvals || 0;
            default: return 0;
        }
    };

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

    const allPaths = SIDEBAR_MENU.flatMap(item => [
        item.path,
        ...(item.submenu?.flatMap(sub => [
            sub.path,
            ...(sub.submenu?.map(child => child.path) || [])
        ]) || [])
    ]).filter(p => p !== '#');

    const checkActive = (itemPath: string) => {
        if (!itemPath || itemPath === '#') return false;
        if (pathname === itemPath) return true;
        
        return pathname.startsWith(itemPath + '/') && !allPaths.some(otherPath => 
            otherPath !== itemPath && 
            otherPath.startsWith(itemPath + '/') && 
            pathname.startsWith(otherPath)
        );
    };

    if (!mounted) {
        return (
            <div className="space-y-1.5 px-1 py-1.5">
                {[80, 65, 75, 55, 70].map((w, i) => (
                    <div key={i} className="flex items-center gap-2 p-1.5 rounded-lg" style={{ animation: 'pulse 1.5s ease-in-out infinite', animationDelay: `${i * 0.1}s` }}>
                        <div className="w-7 h-7 rounded flex-shrink-0" style={{ background: 'rgba(255,255,255,0.05)' }} />
                        {!isCollapsed && <div className="h-3 rounded-full flex-1" style={{ background: 'rgba(255,255,255,0.05)', maxWidth: `${w}%` }} />}
                    </div>
                ))}
            </div>
        );
    }

    return (
        <div className="px-1.5 space-y-0">
            {SIDEBAR_MENU.filter(item => hasAccess(userRole, item.allowedRoles, !!user, item.title, item.permissionId, user?.permissions)).map((item) => {
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

                                <div className="flex items-center justify-between flex-grow min-w-0">
                                    <div className="flex items-center gap-2 min-w-0">
                                        <div
                                            className="flex-shrink-0 flex items-center justify-center rounded transition-all duration-150 relative"
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
                                            
                                            {isCollapsed && getMenuCount(item.title) > 0 && (
                                                <div
                                                    className="absolute -top-1 -right-1 h-3.5 min-w-[14px] px-0.5 rounded-full flex items-center justify-center text-[7.5px] font-black text-white shadow-sm border border-slate-900"
                                                    style={{
                                                        background: 'linear-gradient(135deg, #EF4444, #DC2626)',
                                                        boxShadow: '0 2px 4px rgba(239,68,68,0.4)',
                                                    }}
                                                >
                                                    {getMenuCount(item.title) > 99 ? '99+' : getMenuCount(item.title)}
                                                </div>
                                            )}
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

                                    {!isCollapsed && getMenuCount(item.title) > 0 && (
                                        <div
                                            className="ml-2 flex items-center justify-center h-4 min-w-[16px] rounded-full text-[8.5px] font-black text-white px-1.5 shadow-sm flex-shrink-0 mr-1 border border-[#ffffff10]"
                                            style={{
                                                background: 'linear-gradient(135deg, #EF4444, #DC2626)',
                                                boxShadow: '0 2px 6px rgba(239,68,68,0.4)',
                                            }}
                                        >
                                            {getMenuCount(item.title)}
                                        </div>
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

                        {!isCollapsed && hasSubmenu && isExpanded && (
                            <div
                                className="mt-0 ml-3 pl-2 space-y-0"
                                style={{ borderLeft: '1px solid rgba(0,114,187,0.15)' }}
                            >
                                {item.submenu!.filter(sub => hasAccess(userRole, sub.allowedRoles, !!user, sub.title, sub.permissionId || item.permissionId, user?.permissions)).map(sub => {
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
                                                <div className="flex items-center justify-between flex-grow min-w-0">
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
                                                    
                                                    {getSubMenuCount(sub.title) > 0 && (
                                                        <div
                                                            className="ml-2 flex items-center justify-center h-3.5 min-w-[14px] rounded-full text-[7.5px] font-black text-white px-1.5 shadow-sm flex-shrink-0 mr-1 border border-[#ffffff10]"
                                                            style={{
                                                                background: 'linear-gradient(135deg, #EF4444, #DC2626)',
                                                                boxShadow: '0 2px 4px rgba(239,68,68,0.4)',
                                                            }}
                                                        >
                                                            {getSubMenuCount(sub.title)}
                                                        </div>
                                                    )}
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

                                            {hasSubSubmenu && isSubSubExpanded && (
                                                <div
                                                    className="mt-0 ml-3.5 pl-2.5 space-y-0.5"
                                                    style={{ borderLeft: '1px solid rgba(0,114,187,0.1)' }}
                                                >
                                                    {sub.submenu!.filter(child => hasAccess(userRole, child.allowedRoles, !!user, child.title, child.permissionId || sub.permissionId || item.permissionId, user?.permissions)).map(child => {
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
            })}
        </div>
    );
}
