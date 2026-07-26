'use client';

import React, { useState, useEffect } from 'react';
import RoleGuard from '@/components/RoleGuard';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { toast } from 'sonner';

// Schemas
const hiringSchema = z.object({
  accountName: z.string().min(1, 'Account Name is required'),
  vehicleNo: z.string().optional(),
  accountNo: z.string().optional(),
  slipNo: z.string().min(1, 'Slip No is required'),
  amount: z.coerce.number().positive('Amount must be positive'),
});

const fuelSchema = z.object({
  officeLocation: z.string().min(1, 'Office Location is required'),
  stationName: z.string().min(1, 'Station Name is required'),
  actualDeposit: z.coerce.number().positive('Deposit must be positive'),
});

type HiringFormValues = z.infer<typeof hiringSchema>;
type FuelFormValues = z.infer<typeof fuelSchema>;

export default function FleetPage() {
  const [activeTab, setActiveTab] = useState<'hiring' | 'fuel'>('hiring');
  const [payments, setPayments] = useState<any[]>([]);
  const [deposits, setDeposits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isHiringModalOpen, setIsHiringModalOpen] = useState(false);
  const [isFuelModalOpen, setIsFuelModalOpen] = useState(false);

  const { register: regHiring, handleSubmit: handleHiringSubmit, reset: resetHiring, formState: { errors: errHiring, isSubmitting: subHiring } } = useForm({ resolver: zodResolver(hiringSchema) });
  const { register: regFuel, handleSubmit: handleFuelSubmit, reset: resetFuel, formState: { errors: errFuel, isSubmitting: subFuel } } = useForm({ resolver: zodResolver(fuelSchema) });

  const fetchData = async () => {
    try {
      setLoading(true);
      const [pRes, dRes] = await Promise.all([
        fetch(`/api/finance/osp-account/fleet/hiring-payments?_t=${Date.now()}`),
        fetch(`/api/finance/osp-account/fleet/fuel-deposits?_t=${Date.now()}`)
      ]);
      if (pRes.ok) setPayments((await pRes.json()).data);
      if (dRes.ok) setDeposits((await dRes.json()).data);
    } catch (error) {
      console.error('Error fetching fleet data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const onHiringSubmit = async (data: any) => {
    try {
      const res = await fetch('/api/finance/osp-account/fleet/hiring-payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Failed');
      toast.success('Hiring Payment Created (Status: PENDING)');
      setIsHiringModalOpen(false);
      resetHiring();
      fetchData();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const onFuelSubmit = async (data: any) => {
    try {
      const res = await fetch('/api/finance/osp-account/fleet/fuel-deposits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Failed');
      toast.success('Fuel Deposit Created (Status: PENDING)');
      setIsFuelModalOpen(false);
      resetFuel();
      fetchData();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleApproveHiring = async (id: string) => {
    try {
      const res = await fetch(`/api/finance/osp-account/fleet/hiring-payments/${id}/approve`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'APPROVE' })
      });
      if (!res.ok) throw new Error('Approval failed');
      toast.success('Payment Approved');
      fetchData();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleApproveFuel = async (id: string) => {
    try {
      const res = await fetch(`/api/finance/osp-account/fleet/fuel-deposits/${id}/approve`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'APPROVE' })
      });
      if (!res.ok) throw new Error('Approval failed');
      toast.success('Deposit Approved');
      fetchData();
    } catch (error: any) {
      toast.error(error.message);
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
                  <h1 className="text-2xl font-bold text-slate-900">Fleet Finance Operations</h1>
                  <p className="text-sm text-slate-500">Manage vehicle hiring payments and fuel station deposits.</p>
                </div>
                <div className="space-x-3">
                  <button
                    onClick={() => setIsHiringModalOpen(true)}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium transition"
                  >
                    + New Hiring Payment
                  </button>
                  <button
                    onClick={() => setIsFuelModalOpen(true)}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg font-medium transition"
                  >
                    + New Fuel Deposit
                  </button>
                </div>
              </div>

              {/* Tabs */}
              <div className="flex space-x-4 mb-6 border-b border-slate-200">
                <button
                  onClick={() => setActiveTab('hiring')}
                  className={`pb-3 font-medium text-sm transition-colors ${activeTab === 'hiring' ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  Vehicle Hiring Payments
                </button>
                <button
                  onClick={() => setActiveTab('fuel')}
                  className={`pb-3 font-medium text-sm transition-colors ${activeTab === 'fuel' ? 'border-b-2 border-emerald-600 text-emerald-600' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  Fuel Station Deposits
                </button>
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto">
                  {activeTab === 'hiring' && (
                    <table className="w-full text-left text-sm whitespace-nowrap">
                      <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                          <th className="p-4 font-medium text-slate-600">Account Name</th>
                          <th className="p-4 font-medium text-slate-600">Vehicle No</th>
                          <th className="p-4 font-medium text-slate-600">Slip No</th>
                          <th className="p-4 font-medium text-slate-600">Amount (LKR)</th>
                          <th className="p-4 font-medium text-slate-600">Status</th>
                          <th className="p-4 font-medium text-slate-600">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {loading ? (
                          <tr><td colSpan={6} className="p-4 text-center">Loading...</td></tr>
                        ) : payments.length === 0 ? (
                          <tr><td colSpan={6} className="p-4 text-center text-slate-500">No Hiring Payments found</td></tr>
                        ) : (
                          payments.map((p) => (
                            <tr key={p.id} className="hover:bg-slate-50">
                              <td className="p-4 font-medium text-slate-900">{p.accountName}</td>
                              <td className="p-4 text-slate-600">{p.vehicleNo || '-'}</td>
                              <td className="p-4 text-slate-600 font-mono text-xs">{p.slipNo}</td>
                              <td className="p-4 text-slate-900 font-semibold">{p.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                              <td className="p-4">
                                <span className={`px-2.5 py-1 text-xs font-semibold rounded-full ${
                                  p.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-700' :
                                  p.status === 'REJECTED' ? 'bg-red-100 text-red-700' :
                                  'bg-amber-100 text-amber-700'
                                }`}>
                                  {p.status}
                                </span>
                              </td>
                              <td className="p-4">
                                {p.status === 'PENDING' && (
                                  <button
                                    onClick={() => handleApproveHiring(p.id)}
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
                  )}

                  {activeTab === 'fuel' && (
                    <table className="w-full text-left text-sm whitespace-nowrap">
                      <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                          <th className="p-4 font-medium text-slate-600">Office Location</th>
                          <th className="p-4 font-medium text-slate-600">Fuel Station</th>
                          <th className="p-4 font-medium text-slate-600">Actual Deposit (LKR)</th>
                          <th className="p-4 font-medium text-slate-600">Status</th>
                          <th className="p-4 font-medium text-slate-600">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {loading ? (
                          <tr><td colSpan={5} className="p-4 text-center">Loading...</td></tr>
                        ) : deposits.length === 0 ? (
                          <tr><td colSpan={5} className="p-4 text-center text-slate-500">No Fuel Deposits found</td></tr>
                        ) : (
                          deposits.map((d) => (
                            <tr key={d.id} className="hover:bg-slate-50">
                              <td className="p-4 font-medium text-slate-900">{d.officeLocation}</td>
                              <td className="p-4 text-slate-600">{d.stationName}</td>
                              <td className="p-4 text-slate-900 font-semibold">{d.actualDeposit.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                              <td className="p-4">
                                <span className={`px-2.5 py-1 text-xs font-semibold rounded-full ${
                                  d.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-700' :
                                  d.status === 'REJECTED' ? 'bg-red-100 text-red-700' :
                                  'bg-amber-100 text-amber-700'
                                }`}>
                                  {d.status}
                                </span>
                              </td>
                              <td className="p-4">
                                {d.status === 'PENDING' && (
                                  <button
                                    onClick={() => handleApproveFuel(d.id)}
                                    className="text-xs font-medium text-emerald-600 hover:text-emerald-900 bg-emerald-50 hover:bg-emerald-100 px-3 py-1 rounded"
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
                  )}
                </div>
              </div>
            </div>
          </main>
        </div>
      </div>

      {/* Hiring Modal */}
      {isHiringModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-xl font-bold text-slate-900 mb-4">Record Hiring Payment</h2>
            <form onSubmit={handleHiringSubmit(onHiringSubmit)} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Account Name (Owner)</label>
                <input {...regHiring('accountName')} className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500" />
                {errHiring.accountName && <p className="text-red-500 text-xs mt-1">{errHiring.accountName.message}</p>}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Vehicle No</label>
                  <input {...regHiring('vehicleNo')} className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Slip No</label>
                  <input {...regHiring('slipNo')} className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500" />
                  {errHiring.slipNo && <p className="text-red-500 text-xs mt-1">{errHiring.slipNo.message}</p>}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Amount (LKR)</label>
                <input type="number" step="0.01" {...regHiring('amount')} className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500" />
                {errHiring.amount && <p className="text-red-500 text-xs mt-1">{errHiring.amount.message}</p>}
              </div>
              <div className="flex justify-end space-x-3 pt-4">
                <button type="button" onClick={() => setIsHiringModalOpen(false)} className="px-4 py-2 text-slate-700 hover:bg-slate-100 rounded-lg font-medium">Cancel</button>
                <button type="submit" disabled={subHiring} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium">Submit Payment</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Fuel Modal */}
      {isFuelModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-xl font-bold text-slate-900 mb-4">Record Fuel Deposit</h2>
            <form onSubmit={handleFuelSubmit(onFuelSubmit)} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Office Location</label>
                <input {...regFuel('officeLocation')} className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500" />
                {errFuel.officeLocation && <p className="text-red-500 text-xs mt-1">{errFuel.officeLocation.message}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Station Name</label>
                <input {...regFuel('stationName')} className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500" />
                {errFuel.stationName && <p className="text-red-500 text-xs mt-1">{errFuel.stationName.message}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Actual Deposit (LKR)</label>
                <input type="number" step="0.01" {...regFuel('actualDeposit')} className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500" />
                {errFuel.actualDeposit && <p className="text-red-500 text-xs mt-1">{errFuel.actualDeposit.message}</p>}
              </div>
              <div className="flex justify-end space-x-3 pt-4">
                <button type="button" onClick={() => setIsFuelModalOpen(false)} className="px-4 py-2 text-slate-700 hover:bg-slate-100 rounded-lg font-medium">Cancel</button>
                <button type="submit" disabled={subFuel} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium">Submit Deposit</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </RoleGuard>
  );
}
