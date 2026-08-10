'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

interface ApprovalItem {
    name: string;
    qty: number;
    unit: string;
}

interface ApprovalDetails {
    id: string;
    entityType: string;
    entityId: string;
    status: string;
    requiredRole: string;
    level: number;
    createdAt: string;
    assignedUser: { name: string; email: string; role: string } | null;
    requestNr?: string;
    priority?: string;
    purpose?: string;
    fromStore?: string;
    toStore?: string;
    items?: ApprovalItem[];
}

interface ViewData {
    details: ApprovalDetails;
    approveToken: string;
    rejectToken: string;
}

function ApprovalActionContent() {
    const searchParams = useSearchParams();
    const token = searchParams.get('token');

    const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
    const [error, setError] = useState('');
    const [data, setData] = useState<ViewData | null>(null);

    useEffect(() => {
        if (!token) {
            setError('Missing action token.');
            setState('error');
            return;
        }
        fetch(`/api/approvals/view?token=${encodeURIComponent(token)}`)
            .then(async (res) => {
                const json = await res.json();
                if (!res.ok || !json.success) {
                    throw new Error(json?.error?.message || 'Failed to load approval details.');
                }
                setData(json.data as ViewData);
                setState('ready');
            })
            .catch((e: Error) => {
                setError(e.message);
                setState('error');
            });
    }, [token]);

    const base = typeof window !== 'undefined' ? window.location.origin : '';

    return (
        <div style={{ minHeight: '100vh', background: '#f1f5f9', fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif", padding: '24px 16px' }}>
            <div style={{ maxWidth: 560, margin: '0 auto' }}>
                {/* Header */}
                <div style={{ background: 'linear-gradient(135deg,#1e40af,#3b82f6)', backgroundColor: '#1e40af', borderRadius: '12px 12px 0 0', padding: '24px 28px' }}>
                    <h1 style={{ color: '#fff', margin: 0, fontSize: 20 }}>Approval Request</h1>
                    <p style={{ color: 'rgba(255,255,255,0.85)', margin: '6px 0 0', fontSize: 14 }}>Review the details below, then take action.</p>
                </div>

                <div style={{ background: '#fff', borderRadius: '0 0 12px 12px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
                    {state === 'loading' && (
                        <div style={{ padding: '48px 28px', textAlign: 'center', color: '#64748b', fontSize: 15 }}>Loading approval details...</div>
                    )}

                    {state === 'error' && (
                        <div style={{ padding: '48px 28px', textAlign: 'center' }}>
                            <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#ef444415', color: '#ef4444', fontSize: 32, lineHeight: '64px', margin: '0 auto 20px', fontWeight: 700 }}>&#10007;</div>
                            <h2 style={{ margin: '0 0 10px', color: '#0f172a', fontSize: 20 }}>Unable to Load</h2>
                            <p style={{ margin: 0, color: '#64748b', fontSize: 15 }}>{error}</p>
                        </div>
                    )}

                    {state === 'ready' && data && (
                        <div style={{ padding: '28px' }}>
                            {/* Status badge */}
                            <div style={{ display: 'inline-block', padding: '4px 12px', borderRadius: 999, background: data.details.status === 'PENDING' ? '#f59e0b1a' : '#22c55e1a', color: data.details.status === 'PENDING' ? '#b45309' : '#15803d', fontSize: 12, fontWeight: 700, marginBottom: 16 }}>
                                {data.details.status}
                            </div>

                            {/* Key facts */}
                            <table role="presentation" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                                <tbody>
                                    <Row label="Type" value={data.details.entityType.replace(/_/g, ' ')} />
                                    <Row label="Reference" value={data.details.requestNr || data.details.entityId} />
                                    {data.details.priority && <Row label="Priority" value={data.details.priority} />}
                                    {data.details.purpose && <Row label="Purpose" value={data.details.purpose} />}
                                    {data.details.fromStore && <Row label="From Store" value={data.details.fromStore} />}
                                    {data.details.toStore && <Row label="To Store" value={data.details.toStore} />}
                                    <Row label="Approver Role" value={data.details.requiredRole.replace(/_/g, ' ')} />
                                    {data.details.assignedUser && <Row label="Assigned To" value={data.details.assignedUser.name} />}
                                    <Row label="Requested On" value={new Date(data.details.createdAt).toLocaleString()} />
                                </tbody>
                            </table>

                            {/* Items */}
                            {data.details.items && data.details.items.length > 0 && (
                                <div style={{ marginTop: 20 }}>
                                    <h3 style={{ margin: '0 0 10px', fontSize: 14, color: '#0f172a' }}>Material Items</h3>
                                    <div style={{ background: '#f8fafc', borderRadius: 8, padding: '12px 16px' }}>
                                        {data.details.items.map((it, idx) => (
                                            <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: idx < (data.details.items!.length - 1) ? '1px solid #e2e8f0' : 'none', fontSize: 13 }}>
                                                <span style={{ color: '#334155' }}>{it.name}</span>
                                                <span style={{ color: '#64748b', fontWeight: 600, whiteSpace: 'nowrap', marginLeft: 12 }}>{it.qty} {it.unit}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Action buttons */}
                            {data.details.status === 'PENDING' ? (
                                <div style={{ display: 'flex', gap: 12, marginTop: 28 }}>
                                    <a href={`${base}/api/approvals/webhook?token=${encodeURIComponent(data.approveToken)}`} style={{ flex: 1, textAlign: 'center', background: '#22c55e', color: '#fff', padding: '14px 0', borderRadius: 8, textDecoration: 'none', fontWeight: 700, fontSize: 15 }}>Approve</a>
                                    <a href={`${base}/api/approvals/webhook?token=${encodeURIComponent(data.rejectToken)}`} style={{ flex: 1, textAlign: 'center', background: '#ef4444', color: '#fff', padding: '14px 0', borderRadius: 8, textDecoration: 'none', fontWeight: 700, fontSize: 15 }}>Reject</a>
                                </div>
                            ) : (
                                <p style={{ marginTop: 24, color: '#64748b', fontSize: 14, textAlign: 'center' }}>This request has already been actioned.</p>
                            )}
                        </div>
                    )}
                </div>

                <p style={{ textAlign: 'center', color: '#94a3b8', fontSize: 12, marginTop: 16 }}>SLTS ERP | Secure approval link</p>
            </div>
        </div>
    );
}

function Row({ label, value }: { label: string; value: string }) {
    return (
        <tr>
            <td style={{ padding: '8px 0', color: '#64748b', width: '40%', verticalAlign: 'top' }}>{label}</td>
            <td style={{ padding: '8px 0', color: '#0f172a', fontWeight: 600 }}>{value}</td>
        </tr>
    );
}

export default function ApprovalActionPage() {
    return (
        <Suspense fallback={<div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>Loading...</div>}>
            <ApprovalActionContent />
        </Suspense>
    );
}
