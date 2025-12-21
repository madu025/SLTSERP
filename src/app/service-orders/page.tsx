"use client";

import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import { useTableColumnSettings } from '@/hooks/useTableColumnSettings';

// Dynamic Imports for Modals (Code Splitting)
const ManualEntryModal = dynamic(() => import('@/components/modals/ManualEntryModal'), { ssr: false });
const ScheduleModal = dynamic(() => import('@/components/modals/ScheduleModal'), { ssr: false });
const CommentModal = dynamic(() => import('@/components/modals/CommentModal'), { ssr: false });
const DetailModal = dynamic(() => import('@/components/modals/DetailModal'), { ssr: false });
const DatePickerModal = dynamic(() => import('@/components/modals/DatePickerModal'), { ssr: false });

interface ServiceOrder {
    id: string;
    rtom: string;
    lea: string | null;
    soNum: string;
    voiceNumber: string | null;
    orderType: string | null;
    serviceType: string | null;
    customerName: string | null;
    techContact: string | null;
    status: string;
    statusDate: string | null;
    address: string | null;
    dp: string | null;
    package: string | null;
    ospPhoneClass: string | null;
    phonePurchase: string | null;
    sales: string | null;
    woroTaskName: string | null;
    iptv: string | null;
    woroSeit: string | null;
    ftthInstSeit: string | null;
    ftthWifi: string | null;
    sltsStatus: string;
    scheduledDate: string | null;
    scheduledTime: string | null;
    comments: string | null;
    createdAt: string;
    updatedAt: string;
}

interface OPMC {
    id: string;
    rtom: string;
    name: string;
}

interface Contractor {
    id: string;
    name: string;
}

export default function ServiceOrdersPage() {
    const [opmcs, setOpmcs] = useState<OPMC[]>([]);
    const [selectedOpmcId, setSelectedOpmcId] = useState<string>('');
    const [selectedRtom, setSelectedRtom] = useState<string>('');
    const [serviceOrders, setServiceOrders] = useState<ServiceOrder[]>([]);
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);
    const [lastSync, setLastSync] = useState<Date | null>(null);
    const [showModal, setShowModal] = useState(false);
    const [showScheduleModal, setShowScheduleModal] = useState(false);
    const [showCommentModal, setShowCommentModal] = useState(false);
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [showDateModal, setShowDateModal] = useState(false);
    const [pendingStatusChange, setPendingStatusChange] = useState<{ orderId: string, newStatus: string, soNum: string } | null>(null);
    const [completedDateInput, setCompletedDateInput] = useState('');
    const [selectedOrder, setSelectedOrder] = useState<ServiceOrder | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('ALL');

    const [sortConfig, setSortConfig] = useState<{ key: keyof ServiceOrder; direction: 'asc' | 'desc' } | null>({ key: 'createdAt', direction: 'desc' });
    const [contractors, setContractors] = useState<Contractor[]>([]);
    const [assigningLoading, setAssigningLoading] = useState<string | null>(null);

    // Column visibility settings
    const { isColumnVisible } = useTableColumnSettings('pending_sod');

    const [scheduleData, setScheduleData] = useState({
        date: '',
        time: '',
        contactNumber: ''
    });

    const [commentText, setCommentText] = useState('');

    const [formData, setFormData] = useState({
        soNum: '',
        voiceNumber: '',
        orderType: '',
        serviceType: '',
        customerName: '',
        techContact: '',
        status: 'INPROGRESS',
        address: '',
        dp: '',
        package: '',
        sales: ''
    });

    // Fetch user's accessible OPMCs
    useEffect(() => {
        fetchOpmcs();
        fetchContractors();
    }, []);

    // Fetch service orders when OPMC selected
    useEffect(() => {
        if (selectedOpmcId) {
            fetchServiceOrders();
        }
    }, [selectedOpmcId]);

    // Auto-sync every 10 minutes
    useEffect(() => {
        if (!selectedOpmcId || !selectedRtom) return;

        const interval = setInterval(() => {
            // Only sync if page is visible
            if (document.visibilityState === 'visible') {
                syncServiceOrders();
            }
        }, 10 * 60 * 1000); // 10 minutes

        return () => clearInterval(interval);
    }, [selectedOpmcId, selectedRtom]);

    const fetchOpmcs = async () => {
        try {
            // Get current user from localStorage
            const storedUser = localStorage.getItem('user');
            if (!storedUser) {
                setLoading(false);
                return;
            }

            const user = JSON.parse(storedUser);
            const isAdmin = user.role === 'ADMIN' || user.role === 'SUPER_ADMIN';

            if (isAdmin) {
                // Admins see all OPMCs
                const resp = await fetch('/api/opmcs');
                const data = await resp.json();
                if (Array.isArray(data) && data.length > 0) {
                    setOpmcs(data);
                    if (data.length === 1) {
                        setSelectedOpmcId(data[0].id);
                        setSelectedRtom(data[0].rtom);
                    }
                }
            } else {
                // Regular users see only their accessible OPMCs
                const resp = await fetch('/api/users');
                const users = await resp.json();
                const currentUser = Array.isArray(users) ? users.find((u: any) => u.username === user.username) : null;

                if (currentUser && currentUser.accessibleOpmcs) {
                    const userOpmcs = currentUser.accessibleOpmcs.map((opmc: any) => ({
                        id: opmc.id,
                        rtom: opmc.rtom,
                        name: opmc.name || ''
                    }));
                    setOpmcs(userOpmcs);
                    if (userOpmcs.length === 1) {
                        setSelectedOpmcId(userOpmcs[0].id);
                        setSelectedRtom(userOpmcs[0].rtom);
                    }
                }
            }
        } catch (err) {
            console.error('Failed to fetch OPMCs');
        } finally {
            setLoading(false);
        }
    };

    const fetchContractors = async () => {
        try {
            const resp = await fetch('/api/contractors');
            const data = await resp.json();
            if (Array.isArray(data)) {
                setContractors(data);
            }
        } catch (err) {
            console.error('Failed to fetch contractors');
        }
    };

    const fetchServiceOrders = async () => {
        if (!selectedOpmcId) return;

        try {
            // Fetch only pending orders (sltsStatus is null, empty, or INPROGRESS)
            const resp = await fetch(`/api/service-orders?opmcId=${selectedOpmcId}&filter=pending`);
            const data = await resp.json();
            if (Array.isArray(data)) {
                setServiceOrders(data);
            }
        } catch (err) {
            console.error('Failed to fetch service orders');
        }
    };

    const syncServiceOrders = async () => {
        if (!selectedOpmcId || !selectedRtom || syncing) return;

        setSyncing(true);
        try {
            const resp = await fetch('/api/service-orders/sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ opmcId: selectedOpmcId, rtom: selectedRtom })
            });

            const result = await resp.json();

            if (resp.ok) {
                setLastSync(new Date());
                await fetchServiceOrders(); // Refresh data
                alert(`Sync completed: ${result.created} created, ${result.updated} updated`);
            } else {
                alert(result.message || 'Sync failed');
            }
        } catch (err) {
            console.error('Sync error:', err);
            alert('Sync failed');
        } finally {
            setSyncing(false);
        }
    };

    const handleOpmcChange = (opmcId: string) => {
        const opmc = opmcs.find(o => o.id === opmcId);
        if (opmc) {
            setSelectedOpmcId(opmcId);
            setSelectedRtom(opmc.rtom);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        try {
            const resp = await fetch('/api/service-orders', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...formData,
                    opmcId: selectedOpmcId,
                    rtom: selectedRtom,
                    lea: selectedRtom
                })
            });

            const data = await resp.json();

            if (resp.ok) {
                alert('Service order added successfully!');
                setShowModal(false);
                resetForm();
                fetchServiceOrders();
            } else {
                alert(data.message || 'Failed to add service order');
            }
        } catch (err) {
            alert('Failed to add service order');
        }
    };

    const resetForm = () => {
        setFormData({
            soNum: '',
            voiceNumber: '',
            orderType: '',
            serviceType: '',
            customerName: '',
            techContact: '',
            status: 'INPROGRESS',
            address: '',
            dp: '',
            package: '',
            sales: ''
        });
    };

    const handleStatusChange = async (orderId: string, newStatus: string, soNum: string) => {
        // Show date picker modal for COMPLETED or RETURN
        if (newStatus === 'COMPLETED' || newStatus === 'RETURN') {
            setPendingStatusChange({ orderId, newStatus, soNum });
            setCompletedDateInput(new Date().toISOString().split('T')[0]); // Default to today
            setShowDateModal(true);
            return;
        }

        // For other status changes, proceed directly
        await executeStatusChange(orderId, newStatus, null);
    };

    const executeStatusChange = async (orderId: string, newStatus: string, completedDate: string | null) => {
        try {
            const resp = await fetch('/api/service-orders', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: orderId, sltsStatus: newStatus, completedDate })
            });

            if (resp.ok) {
                await fetchServiceOrders(); // Refresh data
                alert('SLTS Status updated successfully!');
            } else {
                const data = await resp.json();
                alert(data.message || 'Failed to update status');
            }
        } catch (err) {
            alert('Failed to update status');
        }
    };

    const confirmDateAndStatus = async () => {
        if (!pendingStatusChange || !completedDateInput) {
            alert('Please select a date');
            return;
        }

        setShowDateModal(false);
        await executeStatusChange(pendingStatusChange.orderId, pendingStatusChange.newStatus, completedDateInput);
        setPendingStatusChange(null);
        setCompletedDateInput('');
    };

    const openScheduleModal = (order: ServiceOrder) => {
        setSelectedOrder(order);
        setScheduleData({
            date: order.scheduledDate ? order.scheduledDate.split('T')[0] : '',
            time: order.scheduledTime || '',
            contactNumber: order.techContact || order.voiceNumber || ''
        });
        setShowScheduleModal(true);
    };

    const handleScheduleSubmit = async () => {
        if (!selectedOrder || !scheduleData.date || !scheduleData.time) {
            alert('Please fill in both date and time');
            return;
        }

        try {
            const resp = await fetch('/api/service-orders', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: selectedOrder.id,
                    scheduledDate: new Date(scheduleData.date).toISOString(),
                    scheduledTime: scheduleData.time,
                    techContact: scheduleData.contactNumber
                })
            });

            if (resp.ok) {
                await fetchServiceOrders();
                setShowScheduleModal(false);
                alert('Appointment scheduled successfully!');
            } else {
                alert('Failed to schedule appointment');
            }
        } catch (err) {
            alert('Failed to schedule appointment');
        }
    };

    const openCommentModal = (order: ServiceOrder) => {
        setSelectedOrder(order);
        setCommentText(order.comments || '');
        setShowCommentModal(true);
    };

    const handleCommentSubmit = async () => {
        if (!selectedOrder) return;

        try {
            const resp = await fetch('/api/service-orders', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: selectedOrder.id,
                    comments: commentText
                })
            });

            if (resp.ok) {
                await fetchServiceOrders();
                setShowCommentModal(false);
                alert('Comment saved successfully!');
            } else {
                alert('Failed to save comment');
            }
        } catch (err) {
            alert('Failed to save comment');
        }
    };

    const handleContractorAssign = async (orderId: string, contractorId: string) => {
        setAssigningLoading(orderId);
        try {
            const resp = await fetch('/api/service-orders', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: orderId,
                    contractorId: contractorId || null,
                    sltsStatus: 'INPROGRESS' // Don't change status, just assign
                })
            });

            if (resp.ok) {
                await fetchServiceOrders();
            } else {
                alert('Failed to assign contractor');
            }
        } catch (err) {
            alert('Failed to assign contractor');
        } finally {
            setAssigningLoading(null);
        }
    };

    const filteredOrders = serviceOrders.filter(order => {
        // API already filters for pending orders only (sltsStatus is null, empty, or INPROGRESS)
        // Here we just filter by search term and status filter
        const matchesSearch =
            order.soNum.toLowerCase().includes(searchTerm.toLowerCase()) ||
            order.customerName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            order.voiceNumber?.toLowerCase().includes(searchTerm.toLowerCase());

        const matchesStatus = statusFilter === 'ALL' || order.status === statusFilter;

        return matchesSearch && matchesStatus;
    });

    const sortedOrders = [...filteredOrders].sort((a, b) => {
        if (!sortConfig) return 0;
        const { key, direction } = sortConfig;

        let aValue = a[key];
        let bValue = b[key];

        // Handle null values
        if (aValue === null) aValue = '';
        if (bValue === null) bValue = '';

        // Handle dates specifically if needed, or string comparison works for ISO strings
        if (aValue < bValue) {
            return direction === 'asc' ? -1 : 1;
        }
        if (aValue > bValue) {
            return direction === 'asc' ? 1 : -1;
        }
        return 0;
    });

    const requestSort = (key: keyof ServiceOrder) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const SortIcon = ({ columnKey }: { columnKey: keyof ServiceOrder }) => {
        if (!sortConfig || sortConfig.key !== columnKey) {
            return <span className="ml-1 text-slate-300">↕</span>;
        }
        return sortConfig.direction === 'asc' ?
            <span className="ml-1 text-primary">↑</span> :
            <span className="ml-1 text-primary">↓</span>;
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'INSTALL_CLOSED': return 'bg-green-100 text-green-700';
            case 'INPROGRESS': return 'bg-yellow-100 text-yellow-700';
            default: return 'bg-gray-100 text-gray-700';
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex bg-slate-50">
                <Sidebar />
                <main className="flex-1 flex items-center justify-center">
                    <div className="text-slate-500">Loading...</div>
                </main>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex bg-slate-50">
            <Sidebar />
            <main className="flex-1 flex flex-col min-w-0">
                <Header />

                <div className="flex-1 overflow-y-auto p-4 md:p-6">
                    <div className="max-w-7xl mx-auto">
                        {/* Header */}
                        <div className="flex justify-between items-center mb-4">
                            <div>
                                <h1 className="text-xl font-bold text-slate-900">Service Orders</h1>
                                <p className="text-xs text-slate-500">Manage FTTH service orders from SLT</p>
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={syncServiceOrders}
                                    disabled={!selectedOpmcId || syncing}
                                    className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-sm disabled:opacity-50 flex items-center gap-1.5"
                                >
                                    {syncing ? (
                                        <>
                                            <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                            </svg>
                                            <span className="hidden sm:inline">Syncing...</span>
                                        </>
                                    ) : (
                                        <>
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                            </svg>
                                            <span className="hidden sm:inline">Sync Now</span>
                                        </>
                                    )}
                                </button>
                                <button
                                    onClick={() => setShowModal(true)}
                                    disabled={!selectedOpmcId}
                                    className="bg-primary hover:bg-primary/90 text-white px-3 py-1.5 rounded-lg text-sm disabled:opacity-50 flex items-center gap-1.5"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                                    </svg>
                                    <span className="hidden sm:inline">Add Manual Entry</span>
                                </button>
                            </div>
                        </div>

                        {/* OPMC Selector & Filters */}
                        <div className="bg-white rounded-xl p-4 mb-4 shadow-sm border border-slate-100">
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                                <div>
                                    <label className="block text-xs font-medium text-slate-500 mb-1">Select OPMC</label>
                                    <select
                                        value={selectedOpmcId}
                                        onChange={(e) => handleOpmcChange(e.target.value)}
                                        className="w-full px-3 py-1.5 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/20"
                                    >
                                        <option value="">Select OPMC...</option>
                                        {opmcs.map(opmc => (
                                            <option key={opmc.id} value={opmc.id}>
                                                {opmc.rtom} {opmc.name && `- ${opmc.name}`}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-slate-500 mb-1">Search</label>
                                    <input
                                        type="text"
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        placeholder="SO Number, Customer, Phone..."
                                        className="w-full px-3 py-1.5 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/20"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-slate-500 mb-1">Status Filter</label>
                                    <select
                                        value={statusFilter}
                                        onChange={(e) => setStatusFilter(e.target.value)}
                                        className="w-full px-3 py-1.5 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/20"
                                    >
                                        <option value="ALL">All Status</option>
                                        <option value="INPROGRESS">In Progress</option>
                                        <option value="INSTALL_CLOSED">Install Closed</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-slate-500 mb-1">Last Sync</label>
                                    <div className="text-xs text-slate-600 py-1.5">
                                        {lastSync ? lastSync.toLocaleTimeString() : 'Never'}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Service Orders Table */}
                    {selectedOpmcId ? (
                        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead className="bg-slate-50 border-b border-slate-100">
                                        <tr>
                                            {isColumnVisible('soNum') && (
                                                <th
                                                    className="px-3 py-2 text-left text-[11px] font-semibold text-slate-700 cursor-pointer hover:bg-slate-100"
                                                    onClick={() => requestSort('soNum')}
                                                >
                                                    SO Number <SortIcon columnKey="soNum" />
                                                </th>
                                            )}
                                            {isColumnVisible('statusDate') && (
                                                <th
                                                    className="px-3 py-2 text-left text-[11px] font-semibold text-slate-700 cursor-pointer hover:bg-slate-100"
                                                    onClick={() => requestSort('statusDate')}
                                                >
                                                    Status Date <SortIcon columnKey="statusDate" />
                                                </th>
                                            )}
                                            {isColumnVisible('lea') && (
                                                <th
                                                    className="px-3 py-2 text-left text-[11px] font-semibold text-slate-700 cursor-pointer hover:bg-slate-100"
                                                    onClick={() => requestSort('lea')}
                                                >
                                                    LEA <SortIcon columnKey="lea" />
                                                </th>
                                            )}
                                            {isColumnVisible('customerName') && (
                                                <th
                                                    className="px-3 py-2 text-left text-[11px] font-semibold text-slate-700 cursor-pointer hover:bg-slate-100"
                                                    onClick={() => requestSort('customerName')}
                                                >
                                                    Customer <SortIcon columnKey="customerName" />
                                                </th>
                                            )}
                                            {isColumnVisible('voiceNumber') && (
                                                <th className="px-3 py-2 text-left text-[11px] font-semibold text-slate-700">Voice Number</th>
                                            )}
                                            {isColumnVisible('iptv') && (
                                                <th className="px-3 py-2 text-left text-[11px] font-semibold text-slate-700">IPTV</th>
                                            )}
                                            {isColumnVisible('woroTaskName') && (
                                                <th className="px-3 py-2 text-left text-[11px] font-semibold text-slate-700">WORO Task Name</th>
                                            )}
                                            {isColumnVisible('dp') && (
                                                <th className="px-3 py-2 text-left text-[11px] font-semibold text-slate-700">DP</th>
                                            )}
                                            {isColumnVisible('status') && (
                                                <th
                                                    className="px-3 py-2 text-left text-[11px] font-semibold text-slate-700 cursor-pointer hover:bg-slate-100"
                                                    onClick={() => requestSort('status')}
                                                >
                                                    Status <SortIcon columnKey="status" />
                                                </th>
                                            )}
                                            {isColumnVisible('contractorAssign') && (
                                                <th className="px-3 py-2 text-left text-[11px] font-semibold text-slate-700">Assign Contractor</th>
                                            )}
                                            {isColumnVisible('sltsStatus') && (
                                                <th className="px-3 py-2 text-left text-[11px] font-semibold text-slate-700">SLTS Status</th>
                                            )}
                                            {isColumnVisible('scheduledDate') && (
                                                <th
                                                    className="px-3 py-2 text-left text-[11px] font-semibold text-slate-700 cursor-pointer hover:bg-slate-100"
                                                    onClick={() => requestSort('scheduledDate')}
                                                >
                                                    Appointment <SortIcon columnKey="scheduledDate" />
                                                </th>
                                            )}
                                            {isColumnVisible('actions') && (
                                                <th className="px-3 py-2 text-left text-[11px] font-semibold text-slate-700">Actions</th>
                                            )}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50">
                                        {sortedOrders.length === 0 ? (
                                            <tr>
                                                <td colSpan={13} className="px-3 py-6 text-center text-xs text-slate-400">
                                                    No service orders found. Click "Sync Now" to fetch data.
                                                </td>
                                            </tr>
                                        ) : (
                                            sortedOrders.map(order => (
                                                <tr key={order.id} className="hover:bg-slate-50/50">
                                                    {isColumnVisible('soNum') && (
                                                        <td className="px-3 py-2 text-[11px] font-mono text-slate-900">
                                                            <button
                                                                onClick={() => {
                                                                    setSelectedOrder(order);
                                                                    setShowDetailModal(true);
                                                                }}
                                                                className="text-blue-600 hover:text-blue-800 hover:underline"
                                                            >
                                                                {order.soNum}
                                                            </button>
                                                        </td>
                                                    )}
                                                    {isColumnVisible('statusDate') && (
                                                        <td className="px-3 py-2 text-[11px] text-slate-700">
                                                            {order.statusDate ? new Date(order.statusDate).toLocaleDateString() : '-'}
                                                        </td>
                                                    )}
                                                    {isColumnVisible('lea') && (
                                                        <td className="px-3 py-2 text-[11px] text-slate-700">{order.lea || '-'}</td>
                                                    )}
                                                    {isColumnVisible('customerName') && (
                                                        <td className="px-3 py-2 text-[11px] text-slate-700 max-w-[150px] truncate">{order.customerName || '-'}</td>
                                                    )}
                                                    {isColumnVisible('voiceNumber') && (
                                                        <td className="px-3 py-2 text-[11px] text-slate-700">{order.voiceNumber || '-'}</td>
                                                    )}
                                                    {isColumnVisible('iptv') && (
                                                        <td className="px-3 py-2 text-[11px] text-slate-700">{order.iptv || '-'}</td>
                                                    )}
                                                    {isColumnVisible('woroTaskName') && (
                                                        <td className="px-3 py-2 text-[11px] text-slate-700">{order.woroTaskName || '-'}</td>
                                                    )}
                                                    {isColumnVisible('dp') && (
                                                        <td className="px-3 py-2 text-[11px] text-slate-700">{order.dp || '-'}</td>
                                                    )}
                                                    {isColumnVisible('status') && (
                                                        <td className="px-3 py-2">
                                                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${getStatusColor(order.status)}`}>
                                                                {order.status}
                                                            </span>
                                                        </td>
                                                    )}
                                                    {isColumnVisible('contractorAssign') && (
                                                        <td className="px-3 py-2">
                                                            <div className="relative">
                                                                <select
                                                                    value={(order as any).contractorId || ''}
                                                                    onChange={(e) => handleContractorAssign(order.id, e.target.value)}
                                                                    disabled={assigningLoading === order.id}
                                                                    className="w-32 px-1.5 py-0.5 text-[10px] border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-primary/20 disabled:opacity-50"
                                                                >
                                                                    <option value="">Select Contractor</option>
                                                                    {contractors.map(c => (
                                                                        <option key={c.id} value={c.id}>{c.name}</option>
                                                                    ))}
                                                                </select>
                                                                {assigningLoading === order.id && (
                                                                    <div className="absolute right-1 top-1/2 -translate-y-1/2">
                                                                        <svg className="animate-spin w-2 h-2 text-primary" fill="none" viewBox="0 0 24 24">
                                                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                                        </svg>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </td>
                                                    )}
                                                    {isColumnVisible('sltsStatus') && (
                                                        <td className="px-3 py-2">
                                                            <select
                                                                value={order.sltsStatus}
                                                                onChange={(e) => handleStatusChange(order.id, e.target.value, order.soNum)}
                                                                className="px-2 py-0.5 text-[10px] border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-primary/20"
                                                            >
                                                                <option value="INPROGRESS">In Progress</option>
                                                                <option value="COMPLETED">Completed</option>
                                                                <option value="RETURN">Return</option>
                                                            </select>
                                                        </td>
                                                    )}
                                                    {isColumnVisible('scheduledDate') && (
                                                        <td className="px-3 py-2 text-[11px] text-slate-700">
                                                            {order.scheduledDate ? (
                                                                <div className="text-[10px]">
                                                                    <div>{new Date(order.scheduledDate).toLocaleDateString()}</div>
                                                                    <div className="text-slate-500">{order.scheduledTime || ''}</div>
                                                                </div>
                                                            ) : '-'}
                                                        </td>
                                                    )}
                                                    {isColumnVisible('actions') && (
                                                        <td className="px-3 py-2">
                                                            <div className="flex gap-2">
                                                                <button
                                                                    onClick={() => openScheduleModal(order)}
                                                                    className="text-blue-600 hover:text-blue-800 text-[10px]"
                                                                    title="Schedule Appointment"
                                                                >
                                                                    📅
                                                                </button>
                                                                <button
                                                                    onClick={() => openCommentModal(order)}
                                                                    className="text-green-600 hover:text-green-800 text-[10px]"
                                                                    title="Add Comment"
                                                                >
                                                                    💬
                                                                </button>
                                                            </div>
                                                        </td>
                                                    )}
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                            <div className="px-4 py-3 bg-slate-50 border-t border-slate-100 text-sm text-slate-600">
                                Showing {sortedOrders.length} of {serviceOrders.length} service orders
                            </div>
                        </div>
                    ) : (
                        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-12 text-center">
                            <svg className="w-16 h-16 mx-auto text-slate-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            <p className="text-slate-500">Please select an OPMC to view service orders</p>
                        </div>
                    )}
                </div>
            </main>

            {/* Dynamic Modals */}
            <ManualEntryModal
                isOpen={showModal}
                onClose={() => setShowModal(false)}
                onSubmit={handleSubmit}
                formData={formData}
                setFormData={setFormData}
            />

            <ScheduleModal
                isOpen={showScheduleModal}
                onClose={() => setShowScheduleModal(false)}
                onSubmit={handleScheduleSubmit}
                selectedOrder={selectedOrder}
                scheduleData={scheduleData}
                setScheduleData={setScheduleData}
            />

            <CommentModal
                isOpen={showCommentModal}
                onClose={() => setShowCommentModal(false)}
                onSubmit={handleCommentSubmit}
                selectedOrder={selectedOrder}
                commentText={commentText}
                setCommentText={setCommentText}
            />

            <DetailModal
                isOpen={showDetailModal}
                onClose={() => setShowDetailModal(false)}
                selectedOrder={selectedOrder}
            />

            <DatePickerModal
                isOpen={showDateModal}
                onClose={() => {
                    setShowDateModal(false);
                    setPendingStatusChange(null);
                    setCompletedDateInput('');
                }}
                onConfirm={confirmDateAndStatus}
                pendingStatusChange={pendingStatusChange!}
                completedDateInput={completedDateInput}
                setCompletedDateInput={setCompletedDateInput}
                voiceNumber={selectedOrder?.voiceNumber || null}
            />
        </div>
    );
}
