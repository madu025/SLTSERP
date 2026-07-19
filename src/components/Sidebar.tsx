"use client";

import React, { useEffect, useState, useCallback, Suspense } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { SIDEBAR_MENU, hasAccess } from '@/config/sidebar-menu';
import SyncStatus from './SyncStatus';
import Image from 'next/image';
import { ChevronLeft, ChevronRight, ChevronDown, LogOut, Bell, X, CheckCheck, BellRing, BellOff } from 'lucide-react';
import { toast } from 'sonner';
import { usePushNotifications } from '@/hooks/usePushNotifications';

interface User {
    id: string;
    name: string;
    role: string;
    username: string;
    permissions?: string[];
}

interface SidebarNotification {
    id: string;
    type: string;
    title: string;
    message: string;
    priority: string;
    link?: string;
    isRead: boolean;
    createdAt: string;
}

const playNotificationSound = () => {
    try {
        const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioContext) return;
        const audioCtx = new AudioContext();
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(880, audioCtx.currentTime); // A5
        oscillator.frequency.exponentialRampToValueAtTime(1760, audioCtx.currentTime + 0.1); // up to A6
        
        gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
        gainNode.gain.linearRampToValueAtTime(0.1, audioCtx.currentTime + 0.05);
        gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.3);
        
        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        
        oscillator.start(audioCtx.currentTime);
        oscillator.stop(audioCtx.currentTime + 0.3);
    } catch (e) {
        // Ignore audio playback errors (e.g. strict autoplay policies before user interaction)
    }
};

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

function SidebarContent() {
    const [user, setUser] = useState<User | null>(null);
    const [mounted, setMounted] = useState(false);
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [expandedMenus, setExpandedMenus] = useState<string[]>([]);
    const [expandedSubMenus, setExpandedSubMenus] = useState<string[]>([]);
    const [hoveredItem, setHoveredItem] = useState<string | null>(null);
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const currentRtom = searchParams.get('rtom');

    const [unreadCount, setUnreadCount] = useState(0);
    const [notifications, setNotifications] = useState<SidebarNotification[]>([]);
    const [showDrawer, setShowDrawer] = useState(false);
    const [loadingNotifications, setLoadingNotifications] = useState(false);
    
    const { isSupported, isSubscribed, permission, subscribe, unsubscribe } = usePushNotifications();

    const [menuCounts, setMenuCounts] = useState<Record<string, number>>({
        approvals: 0,
        serviceOrders: 0,
        helpdesk: 0,
        procurementApprovals: 0,
        contractorApprovals: 0,
        materialRequests: 0,
        materialApprovals: 0
    });

    const fetchMenuCounts = useCallback(async () => {
        if (!user?.id) return;
        try {
            const res = await fetch(`/api/notifications/sidebar-counts?_t=${Date.now()}`);
            if (res.ok) {
                const data = await res.json();
                if (data.success && data.data) {
                    setMenuCounts(data.data);
                }
            }
        } catch (err) {
            console.error("Failed to fetch sidebar menu counts:", err);
        }
    }, [user?.id]);

    const getMenuCount = (title: string) => {
        switch (title) {
            case 'Service Orders': return menuCounts.serviceOrders;
            case 'Inventory / Stores': return menuCounts.materialRequests + menuCounts.materialApprovals;
            case 'Approvals': return menuCounts.procurementApprovals + menuCounts.contractorApprovals;
            case 'Projects': return menuCounts.approvals; // project approval steps pending
            case 'IT Help Desk': return menuCounts.helpdesk;
            default: return 0;
        }
    };

    const getSubMenuCount = (title: string) => {
        switch (title) {
            case 'Pending SOD': return menuCounts.serviceOrders;
            case 'Material Requests': return menuCounts.materialRequests;
            case 'Material Approvals': return menuCounts.materialApprovals;
            case 'Procurement Approvals': return menuCounts.procurementApprovals;
            case 'Contractor Registration Approvals': return menuCounts.contractorApprovals;
            case 'IT Dashboard (Staff)': return menuCounts.helpdesk;
            case 'Project Approvals': return menuCounts.approvals;
            default: return 0;
        }
    };

    const fetchNotifications = useCallback(async () => {
        if (!user?.id) return;
        setLoadingNotifications(true);
        try {
            const res = await fetch(`/api/notifications?_t=${Date.now()}`);
            if (res.ok) {
                const json = await res.json();
                const list = Array.isArray(json.data) ? json.data : [];
                setNotifications(list.slice(0, 8)); // latest 8 notifications in sidebar drawer
                setUnreadCount(list.filter((n: SidebarNotification) => !n.isRead).length);
            }
        } catch (err) {
            console.error("Failed to fetch notifications in sidebar:", err);
        } finally {
            setLoadingNotifications(false);
        }
    }, [user?.id]);

    const handleMarkAllRead = async (silent = false) => {
        try {
            const res = await fetch('/api/notifications', { method: 'PATCH' });
            if (res.ok) {
                setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
                setUnreadCount(0);
                if (!silent) toast.success("All notifications marked as read");
            }
        } catch (err) {
            console.error("Failed to mark all notifications read:", err);
        }
    };

    const handleNotificationClick = async (n: SidebarNotification) => {
        if (!n.isRead) {
            try {
                await fetch(`/api/notifications/${n.id}`, { method: 'PATCH' });
                setNotifications(prev => prev.map(item => item.id === n.id ? { ...item, isRead: true } : item));
                setUnreadCount(prev => Math.max(0, prev - 1));
            } catch (err) {
                console.error("Failed to mark notification as read:", err);
            }
        }
        setShowDrawer(false);
        if (n.link) {
            window.location.href = n.link;
        }
    };

    const formatTime = (dateString: string) => {
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMins / 60);
        const diffDays = Math.floor(diffHours / 24);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;
        return date.toLocaleDateString();
    };

    // Auto-clear notifications when navigating to their respective pages
    useEffect(() => {
        if (!mounted || !user?.id) return;


        // Auto-clear notifications when visiting a page with a badge
        const currentLink = pathname;
        if (currentLink && currentLink !== '/') {
            const getClearablePrefix = (path: string) => {
                if (path.startsWith('/helpdesk')) return '/helpdesk';
                if (path.startsWith('/projects')) return '/projects';
                if (path.startsWith('/service-orders')) return '/service-orders';
                if (path.startsWith('/admin/inventory')) return '/admin/inventory';
                if (path.startsWith('/admin/contractors')) return '/admin/contractors';
                if (path.startsWith('/inventory/requests')) return '/inventory/requests';
                if (path.startsWith('/inventory/approvals')) return '/inventory/approvals';
                return path;
            };

            const prefix = getClearablePrefix(currentLink);

            fetch(`/api/notifications?linkPrefix=${encodeURIComponent(prefix)}`, {
                method: 'PATCH',
            })
                .then(res => {
                    if (res.ok) {
                        fetchNotifications();
                        fetchMenuCounts();
                    }
                })
                .catch(err => console.error("Failed to auto-clear notifications for link:", err));
        }
    }, [pathname, currentRtom, user?.id, mounted, fetchNotifications, fetchMenuCounts]);

    useEffect(() => {
        if (!mounted || !user?.id) return;
        
        fetchNotifications();
        fetchMenuCounts();

        // SSE Connection for real-time sidebar notifications & counts
        let eventSource: EventSource | null = null;
        let reconnectTimeout: NodeJS.Timeout;

        const connectSSE = () => {
            eventSource = new EventSource(`/api/notifications/stream?userId=${user.id}`);

            eventSource.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    
                    if (data._isSystem) {
                        // Refresh counts on global system events (like SOD_UPDATE)
                        fetchMenuCounts();
                    } else {
                        // It's a user notification, refresh drawer & counts
                        fetchNotifications();
                        fetchMenuCounts();
                        
                        if (data.priority === 'CRITICAL' || data.priority === 'HIGH') {
                            playNotificationSound();
                        }
                        
                        window.dispatchEvent(new CustomEvent('slts-notification', { detail: data }));
                    }
                } catch (e) {
                    console.warn("Failed to parse SSE notification:", e);
                }
            };

            eventSource.onerror = () => {
                if (eventSource) eventSource.close();
                reconnectTimeout = setTimeout(connectSSE, 5000);
            };
        };

        connectSSE();

        // Also listen to window event just in case NotificationBell dispatches it first
        const handleNewNotification = () => {
            fetchNotifications();
            fetchMenuCounts();
        };
        window.addEventListener('slts-notification', handleNewNotification);

        return () => {
            window.removeEventListener('slts-notification', handleNewNotification);
            if (eventSource) eventSource.close();
            clearTimeout(reconnectTimeout);
        };
    }, [mounted, user, fetchMenuCounts, fetchNotifications]);

    useEffect(() => {
        if (mounted && user?.id) {
            fetchNotifications();
            fetchMenuCounts();
        }
    }, [pathname, mounted, user?.id, fetchMenuCounts, fetchNotifications]);

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
                        {mounted ? SIDEBAR_MENU.filter(item => hasAccess(userRole, item.allowedRoles, !!user, item.title, item.permissionId, user?.permissions)).map((item) => {
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

                                    {/* SUBMENU */}
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
                                                                 
                                                                 {/* Submenu item count badge */}
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

                                                        {/* NESTED 3RD LEVEL SUBMENU */}
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

                {/* NOTIFICATIONS TRIGGER BUTTON */}
                {mounted && user && (
                    <div className="px-3 py-1 flex-shrink-0">
                        <button
                            onClick={() => {
                                const willShow = !showDrawer;
                                setShowDrawer(willShow);
                                if (willShow && unreadCount > 0) {
                                    handleMarkAllRead(true);
                                }
                            }}
                            className="w-full flex items-center justify-between p-2 rounded-xl transition-all duration-200 group/notif cursor-pointer relative"
                            style={{
                                background: showDrawer ? 'rgba(0, 114, 187, 0.2)' : 'transparent',
                                border: showDrawer ? '1px solid rgba(0, 114, 187, 0.3)' : '1px solid transparent',
                                color: showDrawer ? '#00AEEF' : 'rgba(255, 255, 255, 0.55)',
                                justifyContent: isCollapsed ? 'center' : 'space-between',
                            }}
                            onMouseEnter={e => {
                                if (!showDrawer) {
                                    (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255, 255, 255, 0.03)';
                                    (e.currentTarget as HTMLButtonElement).style.color = '#fff';
                                }
                            }}
                            onMouseLeave={e => {
                                if (!showDrawer) {
                                    (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
                                    (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255, 255, 255, 0.55)';
                                }
                            }}
                        >
                            <div className="flex items-center gap-2 min-w-0">
                                <div
                                    className="flex-shrink-0 flex items-center justify-center rounded transition-all duration-150"
                                    style={{
                                        width: '28px',
                                        height: '28px',
                                        background: showDrawer ? 'rgba(0, 114, 187, 0.3)' : 'rgba(255, 255, 255, 0.03)',
                                        border: showDrawer ? '1px solid rgba(0, 174, 239, 0.25)' : '1px solid rgba(255, 255, 255, 0.04)',
                                        color: showDrawer ? '#00AEEF' : 'rgba(255, 255, 255, 0.45)',
                                    }}
                                >
                                    <Bell className="w-3.5 h-3.5" />
                                </div>
                                {!isCollapsed && (
                                    <span className="text-[11px] font-semibold truncate">Notifications</span>
                                )}
                            </div>
                            
                            {unreadCount > 0 && (
                                <div
                                    className={`${isCollapsed ? 'absolute -top-1 -right-1' : 'relative'} flex items-center justify-center h-4.5 min-w-[18px] rounded-full text-[9px] font-extrabold text-white px-1 shadow-md`}
                                    style={{ background: '#EF4444' }}
                                >
                                    {unreadCount}
                                </div>
                            )}
                        </button>
                    </div>
                )}

                {mounted && hasAccess(userRole, ['SUPER_ADMIN', 'ADMIN'], !!user, 'SyncStatus', undefined, user?.permissions) && (
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

            {/* NOTIFICATIONS SLIDE-OUT DRAWER */}
            {mounted && user && (
                <div
                    style={{
                        position: 'fixed',
                        top: 0,
                        left: isCollapsed ? '56px' : '220px',
                        width: '320px',
                        height: '100vh',
                        background: '#0D1B2A',
                        borderRight: '1px solid rgba(0, 114, 187, 0.15)',
                        boxShadow: '8px 0 24px rgba(0, 0, 0, 0.4)',
                        zIndex: 30,
                        transform: showDrawer ? 'translateX(0)' : 'translateX(-105%)',
                        transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), left 0.3s ease-in-out',
                        display: 'flex',
                        flexDirection: 'column',
                    }}
                >
                    {/* Drawer Header */}
                    <div
                        className="p-3.5 flex items-center justify-between flex-shrink-0"
                        style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}
                    >
                        <div>
                            <h3 className="text-xs font-black text-white">Notifications</h3>
                            <p className="text-[9px] text-primary/70 uppercase font-bold tracking-wider mt-0.5">{unreadCount} Unread Activities</p>
                        </div>
                        <div className="flex gap-1 items-center">
                            {isSupported && (
                                <button
                                    onClick={async () => {
                                        if (isSubscribed) {
                                            await unsubscribe();
                                            toast.success("Desktop alerts disabled");
                                        } else {
                                            if (permission === 'denied') {
                                                toast.error("Please enable notifications in browser settings");
                                            } else {
                                                const success = await subscribe();
                                                if (success) toast.success("Desktop alerts enabled!");
                                            }
                                        }
                                    }}
                                    className="p-1 rounded hover:bg-white/5 text-primary transition-colors cursor-pointer mr-1"
                                    title={isSubscribed ? "Disable Desktop Alerts" : "Enable Desktop Alerts"}
                                >
                                    {isSubscribed ? <BellRing className="w-3.5 h-3.5" /> : <BellOff className="w-3.5 h-3.5 text-white/40" />}
                                </button>
                            )}
                            {unreadCount > 0 && (
                                <button
                                    onClick={() => handleMarkAllRead(false)}
                                    className="p-1 rounded hover:bg-white/5 text-primary transition-colors cursor-pointer"
                                    title="Mark all read"
                                >
                                    <CheckCheck className="w-3.5 h-3.5" />
                                </button>
                            )}
                            <button
                                onClick={() => setShowDrawer(false)}
                                className="p-1 rounded hover:bg-white/5 text-white/40 hover:text-white transition-colors cursor-pointer"
                            >
                                <X className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    </div>

                    {/* Drawer Content */}
                    <div className="flex-1 overflow-y-auto p-2 space-y-2 custom-scrollbar">
                        {loadingNotifications ? (
                            <div className="flex items-center justify-center py-10 text-[10px] text-white/40">
                                Loading notifications...
                            </div>
                        ) : notifications.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-12 text-center text-[10px] text-white/40 space-y-2">
                                <span>🔔</span>
                                <span>No notifications found</span>
                            </div>
                        ) : (
                            notifications.map((n: SidebarNotification) => (
                                <div
                                    key={n.id}
                                    onClick={() => handleNotificationClick(n)}
                                    className="p-2.5 rounded-lg border cursor-pointer transition-all duration-200 text-left relative overflow-hidden flex gap-2.5"
                                    style={{
                                        background: n.isRead ? 'rgba(255, 255, 255, 0.01)' : 'rgba(0, 114, 187, 0.06)',
                                        borderColor: n.isRead ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 114, 187, 0.15)',
                                    }}
                                    onMouseEnter={e => {
                                        (e.currentTarget as HTMLDivElement).style.background = n.isRead ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 114, 187, 0.1)';
                                        (e.currentTarget as HTMLDivElement).style.borderColor = n.isRead ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 114, 187, 0.25)';
                                    }}
                                    onMouseLeave={e => {
                                        (e.currentTarget as HTMLDivElement).style.background = n.isRead ? 'rgba(255, 255, 255, 0.01)' : 'rgba(0, 114, 187, 0.06)';
                                        (e.currentTarget as HTMLDivElement).style.borderColor = n.isRead ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 114, 187, 0.15)';
                                    }}
                                >
                                    <div
                                        className="w-7 h-7 rounded-lg flex items-center justify-center text-xs flex-shrink-0"
                                        style={{
                                            background: 'rgba(255, 255, 255, 0.03)',
                                            border: '1px solid rgba(255, 255, 255, 0.05)',
                                        }}
                                    >
                                        {n.type === 'INVENTORY' ? '📦' : n.type === 'CONTRACTOR' ? '🛡️' : n.type === 'PROJECT' ? '🏗️' : n.type === 'FINANCE' ? '💰' : n.type === 'HELPDESK' ? '🎫' : '⚙️'}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex justify-between items-start gap-1">
                                            <p className="text-[10px] font-black text-white truncate leading-tight">{n.title}</p>
                                            {n.priority === 'CRITICAL' && (
                                                <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse flex-shrink-0 mt-0.5" />
                                            )}
                                        </div>
                                        <p className="text-[9px] text-white/60 mt-0.5 line-clamp-2 leading-relaxed">{n.message}</p>
                                        <span className="text-[8px] text-white/30 block mt-1">{formatTime(n.createdAt)}</span>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                    {/* Drawer Footer */}
                    <div
                        className="p-2 bg-muted/5 flex-shrink-0 text-center"
                        style={{ borderTop: '1px solid rgba(255, 255, 255, 0.05)' }}
                    >
                        <Link
                            href="/notifications"
                            onClick={() => setShowDrawer(false)}
                            className="block py-1.5 text-[10px] font-black text-[#00AEEF] hover:text-[#00AEEF]/80 hover:bg-white/5 rounded-lg transition-all"
                        >
                            Open Notification Manager
                        </Link>
                    </div>
                </div>
            )}
        </>
    );
}

export default function Sidebar() {
    return (
        <Suspense fallback={<div className="w-64 bg-[#0a0f1d] border-r border-[#1e293b]" />}>
            <SidebarContent />
        </Suspense>
    );
}