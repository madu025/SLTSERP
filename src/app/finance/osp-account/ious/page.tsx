'use client';

import React, { useState, useEffect } from 'react';
import RoleGuard from '@/components/RoleGuard';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { toast } from 'sonner';

const iouSchema = z.object({
  iouNumber: z.string().min(1, 'IOU Number is required'),
  staffName: z.string().min(1, 'Staff Name is required'),
  amount: z.coerce.number().positive('Amount must be positive'),
  reason: z.string().optional(),
});

type IOUFormValues = z.infer<typeof iouSchema>;

interface IOU {
  id: string;
  iouNumber: string;
  staffName: string;
  amount: number;
  reason?: string;
  status: string;
  createdAt: string;
}

export default function IOUPage() {
  const [ious, setIous] = useState<IOU[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(iouSchema)
  });

  const fetchIOUs = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/finance/osp-account/ious?_t=${Date.now()}`);
      if (res.ok) {
        const data = await res.json();
        setIous(data.data);
      }
    } catch (error) {
      console.error('Error fetching IOUs:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIOUs();
  }, []);

  const onSubmit = async (data: IOUFormValues) => {
    try {
      const res = await fetch('/api/finance/osp-account/ious', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to create IOU');
      }
      toast.success('IOU Created successfully (Status: PENDING)');
      setIsModalOpen(false);
      reset();
      fetchIOUs();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Failed');
    }
  };

  const handleApprove = async (id: string) => {
    try {
      const res = await fetch(`/api/finance/osp-account/ious/${id}/approve`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'APPROVE' })
      });
      if (!res.ok) throw new Error('Approval failed');
      toast.success('IOU Approved');
      fetchIOUs();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Approval failed');
    }
  };

  return (
    <RoleGuard allowedRoles={['SUPER_ADMIN', 'ADMIN', 'FINANCE_MANAGER', 'OSP_MANAGER']}>
      <div className="flex h-screen bg-slate-50 overflow-hidden">
        <Sidebar />
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <Header />
          <main className="flex-1 overflow-y-auto p-6">
            <div className="max-w-7xl mx-auto">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h1 className="text-2xl font-bold text-slate-900">Petty Cash IOUs</h1>
                  <p className="text-sm text-slate-500">Manage staff floating advances and IOUs.</p>
                </div>
                <button
                  onClick={() => setIsModalOpen(true)}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium transition"
                >
                  + Add New IOU
                </button>
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm whitespace-nowrap">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="p-4 font-medium text-slate-600">IOU Number</th>
                        <th className="p-4 font-medium text-slate-600">Staff Name</th>
                        <th className="p-4 font-medium text-slate-600">Amount (LKR)</th>
                        <th className="p-4 font-medium text-slate-600">Reason</th>
                        <th className="p-4 font-medium text-slate-600">Status</th>
                        <th className="p-4 font-medium text-slate-600">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {loading ? (
                        <tr><td colSpan={6} className="p-4 text-center">Loading...</td></tr>
                      ) : ious.length === 0 ? (
                        <tr><td colSpan={6} className="p-4 text-center text-slate-500">No IOUs found</td></tr>
                      ) : (
                        ious.map((iou) => (
                          <tr key={iou.id} className="hover:bg-slate-50">
                            <td className="p-4 font-medium text-slate-900">{iou.iouNumber}</td>
                            <td className="p-4 text-slate-600">{iou.staffName}</td>
                            <td className="p-4 text-slate-900 font-semibold">{iou.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                            <td className="p-4 text-slate-500 truncate max-w-xs">{iou.reason || '-'}</td>
                            <td className="p-4">
                              <span className={`px-2.5 py-1 text-xs font-semibold rounded-full ${
                                iou.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-700' :
                                iou.status === 'REJECTED' ? 'bg-red-100 text-red-700' :
                                'bg-amber-100 text-amber-700'
                              }`}>
                                {iou.status}
                              </span>
                            </td>
                            <td className="p-4">
                              {iou.status === 'PENDING' && (
                                <button
                                  onClick={() => handleApprove(iou.id)}
                                  className="text-xs font-medium text-indigo-600 hover:text-indigo-900 bg-indigo-50 hover:bg-indigo-100 px-3 py-1 rounded"
                                >
                                  Approve
                                </button>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </main>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-xl font-bold text-slate-900 mb-4">Create New IOU</h2>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">IOU Number</label>
                <input
                  {...register('iouNumber')}
                  className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  placeholder="e.g. IOU-2026-001"
                />
                {errors.iouNumber && <p className="text-red-500 text-xs mt-1">{errors.iouNumber.message}</p>}
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Staff Name</label>
                <input
                  {...register('staffName')}
                  className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  placeholder="e.g. Kamal Perera"
                />
                {errors.staffName && <p className="text-red-500 text-xs mt-1">{errors.staffName.message}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Amount (LKR)</label>
                <input
                  type="number"
                  step="0.01"
                  {...register('amount')}
                  className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  placeholder="0.00"
                />
                {errors.amount && <p className="text-red-500 text-xs mt-1">{errors.amount.message}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Reason (Optional)</label>
                <textarea
                  {...register('reason')}
                  className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  rows={2}
                  placeholder="Purpose of the advance..."
                />
              </div>

              <div className="flex justify-end space-x-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-slate-700 hover:bg-slate-100 rounded-lg font-medium transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition disabled:opacity-50"
                >
                  {isSubmitting ? 'Creating...' : 'Submit IOU'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </RoleGuard>
  );
}
