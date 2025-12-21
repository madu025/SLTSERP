"use client";

import React, { useState, useEffect } from 'react';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';

interface RestoreRequest {
    id: string;
    reason: string;
    status: string;
    createdAt: string;
    approvalComment: string | null;
    serviceOrder: {
        id: string;
        soNum: string;
        customerName: string | null;
        voiceNumber: string | null;
        sltsStatus: string;
        opmc: {
            id: string;
            rtom: string;
            name: string;
        };
    };
    requestedBy: {
        id: string;
        name: string | null;
        username: string;
    };
    approvedBy: {
        id: string;
        name: string | null;
        username: string;
    } | null;
}

interface OPMC {
    id: string;
    rtom: string;
    name: string;
}

export default function RestoreRequestsPage() {
    const [requests, setRequests] = useState<RestoreRequest[]>([]);
    const [opmcs, setOpmcs] = useState<OPMC[]>([]);
    const [selectedOpmcId, setSelectedOpmcId] = useState<string>('ALL');
    const [loading, setLoading] = useState(true);
    const [showApprovalModal, setShowApprovalModal] = useState(false);
    const [selectedRequest, setSelectedRequest] = useState<RestoreRequest | null>(null);
    const [approvalComment, setApprovalComment] = useState('');
    const [currentUserId, setCurrentUserId] = useState<string>('');

    useEffect(() => {
        // Get current user
        const storedUser = localStorage.getItem('user');
        if (storedUser) {
            const user = JSON.parse(storedUser);
            setCurrentUserId(user.id || '');
        }

        fetchOpmcs();
        fetchRequests();
    }, []);

    useEffect(() => {
        if (selectedOpmcId) {
            fetchRequests();
        }
    }, [selectedOpmcId]);

    const fetchOpmcs = async () => {
        try {
            const resp = await fetch('/api/opmcs');
            const data = await resp.json();
            if (Array.isArray(data)) {
                setOpmcs(data);
            }
        } catch (err) {
            console.error('Failed to fetch OPMCs');
        }
    };

    const fetchRequests = async () => {
        try {
            const params = new URLSearchParams({ status: 'PENDING' });
            if (selectedOpmcId && selectedOpmcId !== 'ALL') {
                params.append('opmcId', selectedOpmcId);
            }

            const resp = await fetch(`/api/restore-requests?${params}`);
            const data = await resp.json();
            if (Array.isArray(data)) {
                setRequests(data);
            }
        } catch (err) {
            console.error('Failed to fetch restore requests');
        } finally {
            setLoading(false);
        }
    };

    const handleApprove = (request: RestoreRequest) => {
        setSelectedRequest(request);
        setApprovalComment('');
        setShowApprovalModal(true);
    };

    const handleReject = (request: RestoreRequest) => {
        setSelectedRequest(request);
        setApprovalComment('');
        setShowApprovalModal(true);
    };

    const submitApproval = async (action: 'APPROVE' | 'REJECT') => {
        if (!selectedRequest || !currentUserId) return;

        try {
            const resp = await fetch('/api/restore-requests', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: selectedRequest.id,
                    action,
                    approvedById: currentUserId,
                    comment: approvalComment || null
                })
            });

            if (resp.ok) {
                alert(`Request ${action.toLowerCase()}d successfully!`);
                setShowApprovalModal(false);
                fetchRequests(); // Refresh list
            } else {
                const data = await resp.json();
                alert(data.message || 'Failed to process request');
            }
        } catch (err) {
            alert('Failed to process request');
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
                        <div className="mb-8">
                            <h1 className="text-3xl font-bold text-slate-900">Restore Requests</h1>
                            <p className="text-slate-500 mt-1">Review and approve/reject restore requests from users</p>
                        </div>

                        {/* Filter */}
                        <div className="bg-white rounded-2xl p-6 mb-6 shadow-sm border border-slate-100">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-2">Filter by OPMC</label>
                                    <select
                                        value={selectedOpmcId}
                                        onChange={(e) => setSelectedOpmcId(e.target.value)}
                                        className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/20"
                                    >
                                        <option value="ALL">All OPMCs</option>
                                        {opmcs.map(opmc => (
                                            <option key={opmc.id} value={opmc.id}>
                                                {opmc.rtom} {opmc.name && `- ${opmc.name}`}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div className="flex items-end">
                                    <div className="text-sm text-slate-600">
                                        <span className="font-semibold">{requests.length}</span> pending requests
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Requests Table */}
                        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead className="bg-slate-50 border-b border-slate-100">
                                        <tr>
                                            <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700">SO Number</th>
                                            <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700">Customer</th>
                                            <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700">Voice Number</th>
                                            <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700">OPMC</th>
                                            <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700">Current Status</th>
                                            <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700">Requested By</th>
                                            <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700">Reason</th>
                                            <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700">Date</th>
                                            <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50">
                                        {requests.length === 0 ? (
                                            <tr>
                                                <td colSpan={8} className="px-4 py-8 text-center text-slate-400">
                                                    No pending restore requests
                                                </td>
                                            </tr>
                                        ) : (
                                            requests.map(request => (
                                                <tr key={request.id} className="hover:bg-slate-50/50">
                                                    <td className="px-4 py-3 text-sm font-mono text-slate-900">
                                                        {request.serviceOrder.soNum}
                                                    </td>
                                                    <td className="px-4 py-3 text-sm text-slate-700">
                                                        {request.serviceOrder.customerName || '-'}
                                                    </td>
                                                    <td className="px-4 py-3 text-sm text-slate-700">
                                                        {request.serviceOrder.voiceNumber || '-'}
                                                    </td>
                                                    <td className="px-4 py-3 text-sm text-slate-700">
                                                        {request.serviceOrder.opmc.rtom}
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${request.serviceOrder.sltsStatus === 'COMPLETED'
                                                            ? 'bg-green-100 text-green-700'
                                                            : 'bg-orange-100 text-orange-700'
                                                            }`}>
                                                            {request.serviceOrder.sltsStatus}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3 text-sm text-slate-700">
                                                        {request.requestedBy.name || request.requestedBy.username}
                                                    </td>
                                                    <td className="px-4 py-3 text-sm text-slate-600 max-w-xs truncate">
                                                        {request.reason}
                                                    </td>
                                                    <td className="px-4 py-3 text-sm text-slate-600">
                                                        {new Date(request.createdAt).toLocaleDateString()}
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <div className="flex gap-2">
                                                            <button
                                                                onClick={() => handleApprove(request)}
                                                                className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white text-xs rounded-lg"
                                                            >
                                                                Approve
                                                            </button>
                                                            <button
                                                                onClick={() => handleReject(request)}
                                                                className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-xs rounded-lg"
                                                            >
                                                                Reject
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            </main>

            {/* Approval/Rejection Modal */}
            {showApprovalModal && selectedRequest && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden">
                        <div className="p-6 border-b border-slate-100">
                            <h3 className="text-xl font-bold text-slate-900">Review Restore Request</h3>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <p className="text-sm text-slate-600 mb-2">SO Number: <span className="font-mono font-semibold">{selectedRequest.serviceOrder.soNum}</span></p>
                                <p className="text-sm text-slate-600 mb-2">Customer: <span className="font-semibold">{selectedRequest.serviceOrder.customerName}</span></p>
                                <p className="text-sm text-slate-600 mb-4">Requested by: <span className="font-semibold">{selectedRequest.requestedBy.name || selectedRequest.requestedBy.username}</span></p>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">Reason for Request</label>
                                <p className="text-sm text-slate-900 bg-slate-50 p-3 rounded-lg">{selectedRequest.reason}</p>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">Your Comment (Optional)</label>
                                <textarea
                                    value={approvalComment}
                                    onChange={e => setApprovalComment(e.target.value)}
                                    rows={3}
                                    placeholder="Add a comment..."
                                    className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/20"
                                />
                            </div>
                            <div className="flex gap-3 pt-4">
                                <button
                                    onClick={() => setShowApprovalModal(false)}
                                    className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={() => submitApproval('REJECT')}
                                    className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl"
                                >
                                    Reject
                                </button>
                                <button
                                    onClick={() => submitApproval('APPROVE')}
                                    className="flex-1 py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl"
                                >
                                    Approve
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
