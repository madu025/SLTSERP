"use client";

import React, { useEffect, useState, useCallback, Suspense } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { hasAccess } from '@/config/sidebar-menu';
import SyncStatus from './SyncStatus';
import Image from 'next/image';
import { ChevronLeft, ChevronRight, LogOut, Bell } from 'lucide-react';
import { toast } from 'sonner';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { useSidebarNotifications } from '@/hooks/useSidebarNotifications';
import { SidebarMenu } from './sidebar/SidebarMenu';
import { NotificationDrawer } from './sidebar/NotificationDrawer';

interface User {
    id: string;
    name: string;
    role: string;
    username: string;
    permissions?: string[];
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

function SidebarSearchParamsWatcher({ onRtomChange }: { onRtomChange: (rtom: string | null) => void }) {
    const searchParams = useSearchParams();
    const currentRtom = searchParams ? searchParams.get('rtom') : null;

    useEffect(() => {
        onRtomChange(currentRtom);
    }, [currentRtom, onRtomChange]);

    return null;
}

function SidebarContent() {
    const [user, setUser] = useState<User | null>(null);
    const [mounted, setMounted] = useState(false);
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [showDrawer, setShowDrawer] = useState(false);
    const [currentRtom, setCurrentRtom] = useState<string | null>(null);
    const pathname = usePathname();

    const handleRtomChange = useCallback((rtom: string | null) => {
        setCurrentRtom(rtom);
    }, []);

    const { isSupported, isSubscribed, permission, subscribe, unsubscribe } = usePushNotifications();

    const {
        unreadCount,
        notifications,
        loadingNotifications,
        menuCounts,
        handleMarkAllRead,
        handleNotificationClick
    } = useSidebarNotifications(user?.id, mounted, pathname, currentRtom);

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

    const userRole = user?.role || '';
    const userInitials = typeof user?.name === 'string' && user.name.trim().length > 0 
        ? user.name.trim().split(/\s+/).filter(Boolean).map(n => n[0]).join('').toUpperCase().slice(0, 2) 
        : '??';
    const roleLabel = ROLE_LABELS[userRole] || userRole?.replace(/_/g, ' ') || 'User';

    const handleLogout = () => {
        localStorage.removeItem('user');
        window.location.href = '/login';
    };

    if (!mounted) {
        return (
            <aside 
                className="w-[220px] flex-shrink-0 hidden md:flex flex-col h-screen sticky top-0 z-40 transition-all duration-300 ease-in-out" 
                style={{ background: '#0D1B2A', borderRight: '1px solid rgba(0, 114, 187, 0.12)' }}
            />
        );
    }

    return (
        <>
            <Suspense fallback={null}>
                <SidebarSearchParamsWatcher onRtomChange={handleRtomChange} />
            </Suspense>
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

                    <SidebarMenu 
                        userRole={userRole} 
                        user={user} 
                        isCollapsed={isCollapsed} 
                        mounted={mounted} 
                        menuCounts={menuCounts} 
                    />
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
                        zIndex: 30,
                        transform: showDrawer ? 'translateX(0)' : 'translateX(-105%)',
                        transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), left 0.3s ease-in-out',
                        pointerEvents: showDrawer ? 'auto' : 'none',
                    }}
                >
                    <NotificationDrawer 
                        show={showDrawer}
                        notifications={notifications}
                        loading={loadingNotifications}
                        unreadCount={unreadCount}
                        isSubscribed={isSubscribed}
                        isSupported={isSupported}
                        permission={permission}
                        onClose={() => setShowDrawer(false)}
                        onMarkAllRead={handleMarkAllRead}
                        onNotificationClick={handleNotificationClick}
                        onSubscribe={subscribe}
                        onUnsubscribe={unsubscribe}
                        toast={toast}
                    />
                </div>
            )}
        </>
    );
}

export default function Sidebar() {
    return <SidebarContent />;
}