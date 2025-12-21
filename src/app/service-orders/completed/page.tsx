"use client";

import React, { useState, useEffect } from 'react';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import Link from 'next/link';

interface ServiceOrder {
    id: string;
    soNum: string;
    customerName: string | null;
    serviceType: string | null;
    dp: string | null;
    status: string;
    sltsStatus: string;
    scheduledDate: string | null;
    scheduledTime: string | null;
    comments: string | null;
    voiceNumber: string | null;
    orderType: string | null;
    techContact: string | null;
    address: string | null;
    package: string | null;
    sales: string | null;
    rtom: string;
    lea: string | null;
    completedDate: string | null;
}

interface OPMC {
    id: string;
    rtom: string;
    name: string;
}

export default function CompletedSODPage() {
    const [opmcs, setOpmcs] = useState<OPMC[]>([]);
    const [selectedOpmcId, setSelectedOpmcId] = useState<string>('');
    const [serviceOrders, setServiceOrders] = useState<ServiceOrder[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('ALL');
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [selectedOrder, setSelectedOrder] = useState<ServiceOrder | null>(null);

    useEffect(() => {
        fetchOpmcs();
    }, []);

    useEffect(() => {
        if (selectedOpmcId) {
            fetchServiceOrders();
        }
    }, [selectedOpmcId]);

    const fetchOpmcs = async () => {
        try {
            const storedUser = localStorage.getItem('user');
            if (!storedUser) {
                setLoading(false);
                return;
            }

            const user = JSON.parse(storedUser);
            const isAdmin = user.role === 'ADMIN' || user.role === 'SUPER_ADMIN';

            if (isAdmin) {
                const resp = await fetch('/api/opmcs');
                const data = await resp.json();
                if (Array.isArray(data) && data.length > 0) {
                    setOpmcs(data);
                    if (data.length === 1) {
                        setSelectedOpmcId(data[0].id);
                    }
                }
            } else {
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
            // Fetch only completed orders from API
            const resp = await fetch(`/api/service-orders?opmcId=${selectedOpmcId}&filter=completed`);
            const data = await resp.json();
            if (Array.isArray(data)) {
                setServiceOrders(data);
            }
        } catch (err) {
            console.error('Failed to fetch service orders');
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
                        <div className="flex justify-between items-center mb-4">
                            <div>
                                <h1 className="text-xl font-bold text-slate-900">Completed Service Orders</h1>
                                <p className="text-xs text-slate-500">View all completed FTTH service orders</p>
                            </div>
                            <Link
                                href="/service-orders"
                                className="bg-slate-600 hover:bg-slate-700 text-white px-3 py-1.5 rounded-lg text-sm flex items-center gap-1.5"
                            >
                                ← Back to SODs
                            </Link>
                        </div>

                        <div className="bg-white rounded-xl p-4 mb-4 shadow-sm border border-slate-100">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                <div>
                                    <label className="block text-xs font-medium text-slate-500 mb-1">Select OPMC</label>
                                    <select
                                        value={selectedOpmcId}
                                        onChange={(e) => setSelectedOpmcId(e.target.value)}
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
                            </div>
                        </div>

                        {selectedOpmcId ? (
                            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                                <div className="overflow-x-auto">
                                    <table className="w-full">
                                        <thead className="bg-slate-50 border-b border-slate-100">
                                            <tr>
                                                <th className="px-3 py-2 text-left text-[11px] font-semibold text-slate-700">SO Number</th>
                                                <th className="px-3 py-2 text-left text-[11px] font-semibold text-slate-700">LEA</th>
                                                <th className="px-3 py-2 text-left text-[11px] font-semibold text-slate-700">Customer</th>
                                                <th className="px-3 py-2 text-left text-[11px] font-semibold text-slate-700">Voice Number</th>
                                                <th className="px-3 py-2 text-left text-[11px] font-semibold text-slate-700">Service Type</th>
                                                <th className="px-3 py-2 text-left text-[11px] font-semibold text-slate-700">DP</th>
                                                <th className="px-3 py-2 text-left text-[11px] font-semibold text-slate-700">Status</th>
                                                <th className="px-3 py-2 text-left text-[11px] font-semibold text-slate-700">Completed Date</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-50">
                                            {filteredOrders.length === 0 ? (
                                                <tr>
                                                    <td colSpan={8} className="px-3 py-6 text-center text-xs text-slate-400">
                                                        No completed service orders found.
                                                    </td>
                                                </tr>
                                            ) : (
                                                filteredOrders.map(order => (
                                                    <tr key={order.id} className="hover:bg-slate-50/50">
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
                                                        <td className="px-3 py-2 text-[11px] text-slate-700">{order.lea || '-'}</td>
                                                        <td className="px-3 py-2 text-[11px] text-slate-700 max-w-[150px] truncate">{order.customerName || '-'}</td>
                                                        <td className="px-3 py-2 text-[11px] text-slate-700">{order.voiceNumber || '-'}</td>
                                                        <td className="px-3 py-2 text-[11px] text-slate-700">{order.serviceType || '-'}</td>
                                                        <td className="px-3 py-2 text-[11px] text-slate-700">{order.dp || '-'}</td>
                                                        <td className="px-3 py-2">
                                                            <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-green-100 text-green-700">
                                                                {order.status}
                                                            </span>
                                                        </td>
                                                        <td className="px-3 py-2 text-[11px] text-slate-600">
                                                            {order.completedDate ? new Date(order.completedDate).toLocaleDateString() : '-'}
                                                        </td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                                <div className="px-4 py-3 bg-slate-50 border-t border-slate-100 text-sm text-slate-600">
                                    Showing {filteredOrders.length} completed service orders
                                </div>
                            </div>
                        ) : (
                            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-12 text-center">
                                <p className="text-slate-500">Please select an OPMC to view completed service orders</p>
                            </div>
                        )}
                    </div>
                </div>
            </main>

            {/* Detail Modal - Same as main page */}
            {showDetailModal && selectedOrder && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl w-full max-w-3xl shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto">
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center sticky top-0 bg-white">
                            <h3 className="text-xl font-bold text-slate-900">Service Order Details</h3>
                            <button onClick={() => setShowDetailModal(false)} className="text-slate-400 hover:text-slate-600">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                        <div className="p-6 space-y-6">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-semibold text-slate-500 uppercase">SO Number</label>
                                    <p className="text-sm font-mono font-semibold text-slate-900">{selectedOrder.soNum}</p>
                                </div>
                                <div>
                                    <label className="text-xs font-semibold text-slate-500 uppercase">SLTS Status</label>
                                    <p className="text-sm font-semibold text-green-700">{selectedOrder.sltsStatus}</p>
                                </div>
                                <div>
                                    <label className="text-xs font-semibold text-slate-500 uppercase">Customer Name</label>
                                    <p className="text-sm text-slate-900">{selectedOrder.customerName || '-'}</p>
                                </div>
                                <div>
                                    <label className="text-xs font-semibold text-slate-500 uppercase">Voice Number</label>
                                    <p className="text-sm text-slate-900">{selectedOrder.voiceNumber || '-'}</p>
                                </div>
                                <div>
                                    <label className="text-xs font-semibold text-slate-500 uppercase">Service Type</label>
                                    <p className="text-sm text-slate-900">{selectedOrder.serviceType || '-'}</p>
                                </div>
                                <div>
                                    <label className="text-xs font-semibold text-slate-500 uppercase">DP</label>
                                    <p className="text-sm text-slate-900">{selectedOrder.dp || '-'}</p>
                                </div>
                                <div>
                                    <label className="text-xs font-semibold text-slate-500 uppercase">Status</label>
                                    <p className="text-sm text-slate-900">{selectedOrder.status}</p>
                                </div>
                                <div>
                                    <label className="text-xs font-semibold text-slate-500 uppercase">Order Type</label>
                                    <p className="text-sm text-slate-900">{selectedOrder.orderType || '-'}</p>
                                </div>
                                <div>
                                    <label className="text-xs font-semibold text-slate-500 uppercase">Package</label>
                                    <p className="text-sm text-slate-900">{selectedOrder.package || '-'}</p>
                                </div>
                                <div>
                                    <label className="text-xs font-semibold text-slate-500 uppercase">Tech Contact</label>
                                    <p className="text-sm text-slate-900">{selectedOrder.techContact || '-'}</p>
                                </div>
                                <div>
                                    <label className="text-xs font-semibold text-slate-500 uppercase">Sales Person</label>
                                    <p className="text-sm text-slate-900">{selectedOrder.sales || '-'}</p>
                                </div>
                                <div>
                                    <label className="text-xs font-semibold text-slate-500 uppercase">RTOM</label>
                                    <p className="text-sm text-slate-900">{selectedOrder.rtom}</p>
                                </div>
                                <div className="col-span-2">
                                    <label className="text-xs font-semibold text-slate-500 uppercase">Address</label>
                                    <p className="text-sm text-slate-900">{selectedOrder.address || '-'}</p>
                                </div>
                                {selectedOrder.scheduledDate && (
                                    <div className="col-span-2">
                                        <label className="text-xs font-semibold text-slate-500 uppercase">Scheduled Appointment</label>
                                        <p className="text-sm text-slate-900">
                                            {new Date(selectedOrder.scheduledDate).toLocaleDateString()} at {selectedOrder.scheduledTime}
                                        </p>
                                    </div>
                                )}
                                {selectedOrder.comments && (
                                    <div className="col-span-2">
                                        <label className="text-xs font-semibold text-slate-500 uppercase">Comments</label>
                                        <p className="text-sm text-slate-900 whitespace-pre-wrap">{selectedOrder.comments}</p>
                                    </div>
                                )}
                            </div>
                            <div className="pt-4">
                                <button
                                    onClick={() => setShowDetailModal(false)}
                                    className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl"
                                >
                                    Close
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
