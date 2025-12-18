"use client";

import React, { useState, useEffect, useCallback } from 'react';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';

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
    const [selectedOrder, setSelectedOrder] = useState<ServiceOrder | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('ALL');

    const [scheduleData, setScheduleData] = useState({
        date: '',
        time: ''
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

    const fetchServiceOrders = async () => {
        if (!selectedOpmcId) return;

        try {
            const resp = await fetch(`/api/service-orders?opmcId=${selectedOpmcId}`);
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
        // If changing to RETURN, prompt for comment
        if (newStatus === 'RETURN') {
            const order = serviceOrders.find(o => o.id === orderId);
            if (order) {
                setSelectedOrder(order);
                setCommentText(order.comments || '');
                setShowCommentModal(true);
                return; // Don't change status yet, wait for comment
            }
        }

        const confirmed = window.confirm(`Are you sure you want to change SLTS Status to "${newStatus}" for SO ${soNum}?`);

        if (!confirmed) return;

        try {
            const resp = await fetch('/api/service-orders', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: orderId, sltsStatus: newStatus })
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

    const openScheduleModal = (order: ServiceOrder) => {
        setSelectedOrder(order);
        setScheduleData({
            date: order.scheduledDate ? order.scheduledDate.split('T')[0] : '',
            time: order.scheduledTime || ''
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
                    scheduledTime: scheduleData.time
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

    const filteredOrders = serviceOrders.filter(order => {
        const matchesSearch =
            order.soNum.toLowerCase().includes(searchTerm.toLowerCase()) ||
            order.customerName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            order.voiceNumber?.toLowerCase().includes(searchTerm.toLowerCase());

        const matchesStatus = statusFilter === 'ALL' || order.status === statusFilter;

        return matchesSearch && matchesStatus;
    });

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

                <div className="flex-1 overflow-y-auto p-8">
                    <div className="max-w-7xl mx-auto">
                        {/* Header */}
                        <div className="flex justify-between items-center mb-8">
                            <div>
                                <h1 className="text-3xl font-bold text-slate-900">Service Orders</h1>
                                <p className="text-slate-500 mt-1">Manage FTTH service orders from SLT</p>
                            </div>
                            <div className="flex gap-3">
                                <button
                                    onClick={syncServiceOrders}
                                    disabled={!selectedOpmcId || syncing}
                                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl disabled:opacity-50 flex items-center gap-2"
                                >
                                    {syncing ? (
                                        <>
                                            <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                            </svg>
                                            Syncing...
                                        </>
                                    ) : (
                                        <>
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                            </svg>
                                            Sync Now
                                        </>
                                    )}
                                </button>
                                <button
                                    onClick={() => setShowModal(true)}
                                    disabled={!selectedOpmcId}
                                    className="bg-primary hover:bg-primary/90 text-white px-4 py-2 rounded-xl disabled:opacity-50 flex items-center gap-2"
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                                    </svg>
                                    Add Manual Entry
                                </button>
                            </div>
                        </div>

                        {/* OPMC Selector & Filters */}
                        <div className="bg-white rounded-2xl p-6 mb-6 shadow-sm border border-slate-100">
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-2">Select OPMC</label>
                                    <select
                                        value={selectedOpmcId}
                                        onChange={(e) => handleOpmcChange(e.target.value)}
                                        className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/20"
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
                                    <label className="block text-sm font-medium text-slate-700 mb-2">Search</label>
                                    <input
                                        type="text"
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        placeholder="SO Number, Customer, Phone..."
                                        className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/20"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-2">Status Filter</label>
                                    <select
                                        value={statusFilter}
                                        onChange={(e) => setStatusFilter(e.target.value)}
                                        className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/20"
                                    >
                                        <option value="ALL">All Status</option>
                                        <option value="INPROGRESS">In Progress</option>
                                        <option value="INSTALL_CLOSED">Install Closed</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-2">Last Sync</label>
                                    <div className="text-sm text-slate-600 py-2">
                                        {lastSync ? lastSync.toLocaleTimeString() : 'Never'}
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
                                                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700">SO Number</th>
                                                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700">Customer</th>
                                                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700">Service Type</th>
                                                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700">DP</th>
                                                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700">Status</th>
                                                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700">SLTS Status</th>
                                                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700">Appointment</th>
                                                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-50">
                                            {filteredOrders.length === 0 ? (
                                                <tr>
                                                    <td colSpan={8} className="px-4 py-8 text-center text-slate-400">
                                                        No service orders found. Click "Sync Now" to fetch data.
                                                    </td>
                                                </tr>
                                            ) : (
                                                filteredOrders.map(order => (
                                                    <tr key={order.id} className="hover:bg-slate-50/50">
                                                        <td className="px-4 py-3 text-sm font-mono text-slate-900">{order.soNum}</td>
                                                        <td className="px-4 py-3 text-sm text-slate-700">{order.customerName || '-'}</td>
                                                        <td className="px-4 py-3 text-sm text-slate-700">{order.serviceType || '-'}</td>
                                                        <td className="px-4 py-3 text-sm text-slate-700">{order.dp || '-'}</td>
                                                        <td className="px-4 py-3">
                                                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(order.status)}`}>
                                                                {order.status}
                                                            </span>
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            <select
                                                                value={order.sltsStatus}
                                                                onChange={(e) => handleStatusChange(order.id, e.target.value, order.soNum)}
                                                                className="px-3 py-1 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
                                                            >
                                                                <option value="INPROGRESS">In Progress</option>
                                                                <option value="COMPLETED">Completed</option>
                                                                <option value="RETURN">Return</option>
                                                            </select>
                                                        </td>
                                                        <td className="px-4 py-3 text-sm text-slate-700">
                                                            {order.scheduledDate ? (
                                                                <div className="text-xs">
                                                                    <div>{new Date(order.scheduledDate).toLocaleDateString()}</div>
                                                                    <div className="text-slate-500">{order.scheduledTime || ''}</div>
                                                                </div>
                                                            ) : '-'}
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            <div className="flex gap-2">
                                                                <button
                                                                    onClick={() => openScheduleModal(order)}
                                                                    className="text-blue-600 hover:text-blue-800 text-xs"
                                                                    title="Schedule Appointment"
                                                                >
                                                                    📅
                                                                </button>
                                                                <button
                                                                    onClick={() => openCommentModal(order)}
                                                                    className="text-green-600 hover:text-green-800 text-xs"
                                                                    title="Add Comment"
                                                                >
                                                                    💬
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                                <div className="px-4 py-3 bg-slate-50 border-t border-slate-100 text-sm text-slate-600">
                                    Showing {filteredOrders.length} of {serviceOrders.length} service orders
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
                </div>
            </main>

            {/* Manual Entry Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden">
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                            <h3 className="text-xl font-bold text-slate-900">Add Service Order</h3>
                            <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">SO Number *</label>
                                    <input
                                        type="text"
                                        required
                                        value={formData.soNum}
                                        onChange={e => setFormData({ ...formData, soNum: e.target.value })}
                                        className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/20"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Voice Number</label>
                                    <input
                                        type="text"
                                        value={formData.voiceNumber}
                                        onChange={e => setFormData({ ...formData, voiceNumber: e.target.value })}
                                        className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/20"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Customer Name</label>
                                    <input
                                        type="text"
                                        value={formData.customerName}
                                        onChange={e => setFormData({ ...formData, customerName: e.target.value })}
                                        className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/20"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Tech Contact</label>
                                    <input
                                        type="text"
                                        value={formData.techContact}
                                        onChange={e => setFormData({ ...formData, techContact: e.target.value })}
                                        className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/20"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Status *</label>
                                    <select
                                        required
                                        value={formData.status}
                                        onChange={e => setFormData({ ...formData, status: e.target.value })}
                                        className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/20"
                                    >
                                        <option value="INPROGRESS">In Progress</option>
                                        <option value="INSTALL_CLOSED">Install Closed</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Order Type</label>
                                    <input
                                        type="text"
                                        value={formData.orderType}
                                        onChange={e => setFormData({ ...formData, orderType: e.target.value })}
                                        className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/20"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Service Type</label>
                                    <input
                                        type="text"
                                        value={formData.serviceType}
                                        onChange={e => setFormData({ ...formData, serviceType: e.target.value })}
                                        className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/20"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Package</label>
                                    <input
                                        type="text"
                                        value={formData.package}
                                        onChange={e => setFormData({ ...formData, package: e.target.value })}
                                        className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/20"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">DP</label>
                                    <input
                                        type="text"
                                        value={formData.dp}
                                        onChange={e => setFormData({ ...formData, dp: e.target.value })}
                                        className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/20"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Sales Person</label>
                                    <input
                                        type="text"
                                        value={formData.sales}
                                        onChange={e => setFormData({ ...formData, sales: e.target.value })}
                                        className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/20"
                                    />
                                </div>
                                <div className="col-span-2">
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Address</label>
                                    <textarea
                                        value={formData.address}
                                        onChange={e => setFormData({ ...formData, address: e.target.value })}
                                        rows={2}
                                        className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/20"
                                    />
                                </div>
                            </div>
                            <div className="flex gap-3 pt-4">
                                <button
                                    type="button"
                                    onClick={() => setShowModal(false)}
                                    className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 py-2 bg-primary hover:bg-primary/90 text-white rounded-xl"
                                >
                                    Add Service Order
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
