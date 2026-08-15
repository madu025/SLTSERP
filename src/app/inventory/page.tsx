"use client";

import {  useState, useEffect  } from 'react';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import RoleGuard from '@/components/RoleGuard';
import { useQuery } from '@tanstack/react-query';
import { hasRole } from '@/config/roles';
import StoreManagerCommandCenter from './components/StoreManagerCommandCenter';
import StoreAssistantDashboard from './components/StoreAssistantDashboard';
import { User, StoreType, KpiData } from '@/types/inventory/dashboard.types';

export default function StoresManagerDashboardPage() {
    const [user] = useState<User | null>(() => {
        if (typeof window !== 'undefined') {
            const stored = localStorage.getItem('user');
            return stored ? JSON.parse(stored) : null;
        }
        return null;
    });

    const [selectedStoreId, setSelectedStoreId] = useState<string>('all');

    const { data: stores = [] } = useQuery<StoreType[]>({
        queryKey: ['stores'],
        queryFn: async () => (await fetch('/api/inventory/stores')).json()
    });

    const [mounted, setMounted] = useState(false);
    useEffect(() => {
        setTimeout(() => setMounted(true), 0);
    }, []);

    // Dynamic Role-based Store Scope Detection
    const isGlobalManager = hasRole(user?.role, [
        'SUPER_ADMIN', 'ADMIN', 'STORES_MANAGER', 'OSP_MANAGER', 'AREA_MANAGER', 'MANAGER'
    ]);

    useEffect(() => {
        if (user && stores.length > 0 && !isGlobalManager) {
            // Store Assistant / Site Staff: Dynamically lock to their assigned store
            const assignedStore = stores.find(s => s.id === (user.assignedStoreId || user.storeId) || s.managerId === user.id);
            if (assignedStore) {
                setTimeout(() => setSelectedStoreId(assignedStore.id), 0);
            } else if (stores[0]) {
                setTimeout(() => setSelectedStoreId(stores[0].id), 0);
            }
        }
    }, [user, stores, isGlobalManager]);

    const { data: kpiData, isLoading, refetch } = useQuery<KpiData>({
        queryKey: ['stores-dashboard-kpis', selectedStoreId],
        queryFn: async () => {
            const res = await fetch(`/api/inventory/dashboard-kpis?storeId=${selectedStoreId}&_t=${Date.now()}`);
            if (!res.ok) throw new Error('Failed to fetch Stores KPI data');
            return res.json();
        },
        enabled: !!user,
        refetchInterval: 30000,
    });

    return (
        <RoleGuard allowedRoles={['SUPER_ADMIN', 'ADMIN', 'STORES_MANAGER', 'STORES_ASSISTANT', 'SITE_OFFICE_STAFF', 'OSP_MANAGER', 'AREA_MANAGER']}>
            <div className="erp-page-wrapper flex-row overflow-hidden bg-slate-50 dark:bg-slate-950">
                <Sidebar />
                <main className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
                    <Header />
                    
                    <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
                        <div className="max-w-7xl mx-auto space-y-6">
                            {mounted && (
                                isGlobalManager ? (
                                    <StoreManagerCommandCenter
                                        user={user}
                                        stores={stores}
                                        kpiData={kpiData}
                                        isLoading={isLoading}
                                        refetch={refetch}
                                        selectedStoreId={selectedStoreId}
                                        setSelectedStoreId={setSelectedStoreId}
                                    />
                                ) : (
                                    <StoreAssistantDashboard
                                        user={user}
                                        stores={stores}
                                        kpiData={kpiData}
                                        isLoading={isLoading}
                                        refetch={refetch}
                                        selectedStoreId={selectedStoreId}
                                    />
                                )
                            )}
                        </div>
                    </div>
                </main>
            </div>
        </RoleGuard>
    );
}
