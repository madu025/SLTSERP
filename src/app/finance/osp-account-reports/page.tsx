import { ROLE_GROUPS } from '@/config/roles';
'use client';

import React, { useState, useEffect } from 'react';
import RoleGuard from '@/components/RoleGuard';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import {
  FileSpreadsheet,
  UploadCloud,
  RefreshCw,
  Search,
  DollarSign,
  Truck,
  Building,
  CheckCircle2,
  AlertCircle,
  Layers,
  CreditCard
} from 'lucide-react';

interface ReportData {
  pettyCash: {
    stats: {
      totalVouchers: number;
      approvedCount: number;
      rejectedCount: number;
      totalApprovedAmount: number;
      categoryBreakdown: {
        SUBSISTENCE: number;
        STAFF_WELFARE: number;
        TRAVEL_TRANSPORT: number;
        MISCELLANEOUS: number;
      };
    };
    vouchers: Array<{
      id: string;
      voucherNumber: string;
      title: string;
      amount: number;
      category: string;
      status: string;
      rejectionReason?: string;
      createdAt: string;
    }>;
  };
  fixedAssets: {
    stats: {
      totalAssets: number;
      locationCount: number;
      categoryCounts: Record<string, number>;
    };
    assets: Array<{
      id: string;
      assetNumber: string;
      name: string;
      category: string;
      subCategory?: string;
      purchasedYear?: string;
      locationCode?: string;
      locationName?: string;
      details?: string;
      status: string;
    }>;
  };
  vehicles: {
    stats: {
      totalVehicles: number;
      totalMonthlyHireRate: number;
      totalPaymentsLogged: number;
      totalFuelDeposits: number;
    };
    vehicles: Array<{
      id: string;
      registration_number: string;
      vehicle_type: string;
      model: string;
      status: string;
    }>;

    payments: Array<{
      id: string;
      accountName: string;
      amount: number;
      slipNo: string;
      slipDate?: string;
      paidDate?: string;
    }>;
    fuelDeposits: Array<{
      id: string;
      officeLocation: string;
      stationName: string;
      actualDeposit: number;
    }>;
  };
  advancesAndIOUs: {
    stats: {
      totalAdvances: number;
      totalAdvanceAmount: number;
      totalVatClaimable: number;
      totalIOUs: number;
      totalIOUAmount: number;
      agingOver30DaysCount: number;
    };
    advances: Array<{
      id: string;
      refNumber: string;
      type: string;
      supplierName?: string;
      description: string;
      amount: number;
      vatAmount: number;
      totalAmount: number;
      status: string;
    }>;
    ious: Array<{
      id: string;
      iouNumber: string;
      staffName: string;
      type: string;
      amount: number;
      issuedDate?: string;
      reason?: string;
      noOfDays?: number;
      status: string;
      remarks?: string;
    }>;
  };
  propertyRent: {
    stats: {
      totalRentRecords: number;
      totalRentPaid: number;
    };
    propertyRents: Array<{
      id: string;
      accountNo?: string;
      supplierName: string;
      amount: number;
      category: string;
      slipNo: string;
      slipDate?: string;
    }>;
  };
}

export default function OSPAccountReportsPage() {
  const [activeTab, setActiveTab] = useState<'petty' | 'assets' | 'fleet' | 'advances' | 'rent'>('petty');
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [ingesting, setIngesting] = useState(false);
  const [ingestMessage, setIngestMessage] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const fetchReports = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/finance/osp-account/reports?_t=${Date.now()}`, {
        cache: 'no-store',
        headers: { 'Pragma': 'no-cache', 'Cache-Control': 'no-cache' }
      });
      if (res.ok) {
        const json = await res.json();
        setData(json.data || json);
      }
    } catch (err) {
      console.error('Failed to load OSP account reports:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRunIngestion = async () => {
    setIngesting(true);
    setIngestMessage('Running bulk ingestion on 12 OSP Account Excel files...');
    try {
      const res = await fetch('/api/finance/osp-account/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const json = await res.json();
      if (res.ok && json.success) {
        const stats = json.data;
        setIngestMessage(
          `Ingestion Success! Inserted/Updated: ${stats.pettyCashCount} Petty Cash Vouchers, ${stats.fixedAssetCount} Fixed Assets, ${stats.vehicleCount} Vehicles, ${stats.projectAdvanceCount} Advances, ${stats.iouCount} IOUs, ${stats.propertyRentCount} Rents.`
        );
        fetchReports();
      } else {
        setIngestMessage(`Ingestion Warning: ${json.error?.message || 'Check logs'}`);
      }
    } catch (err) {
      setIngestMessage(`Ingestion Failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIngesting(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, []);

  const formatLKR = (val: number) => {
    return new Intl.NumberFormat('en-LK', { style: 'currency', currency: 'LKR', maximumFractionDigits: 0 }).format(val);
  };

  return (
    <RoleGuard allowedRoles={ROLE_GROUPS.PROJECT_MANAGERS}>
      <div className="flex h-screen bg-slate-50 overflow-hidden">
        <Sidebar />
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <Header />
          <main className="flex-1 overflow-y-auto p-6">
            {/* Header Banner */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-6 rounded-2xl shadow-xl">
              <div>
                <div className="flex items-center space-x-3 mb-2">
                  <span className="p-2 bg-indigo-500/20 text-indigo-400 rounded-lg border border-indigo-500/30">
                    <FileSpreadsheet className="w-6 h-6" />
                  </span>
                  <h1 className="text-2xl font-bold tracking-tight">OSP Account Reports & Ingestion Engine</h1>
                </div>
                <p className="text-slate-400 text-sm max-w-2xl">
                  Automated spreadsheet ingestion, GL code auto-mapping, deduplicated ledgers, and accounts verification reports for SLTS OSP Divisions.
                </p>
              </div>

              <div className="mt-4 md:mt-0 flex items-center space-x-3">
                <button
                  onClick={fetchReports}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-sm font-medium transition flex items-center space-x-2 border border-slate-700"
                >
                  <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                  <span>Refresh</span>
                </button>

                <button
                  onClick={handleRunIngestion}
                  disabled={ingesting}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl text-sm font-semibold shadow-lg shadow-indigo-600/30 transition flex items-center space-x-2"
                >
                  <UploadCloud className={`w-4 h-4 ${ingesting ? 'animate-bounce' : ''}`} />
                  <span>{ingesting ? 'Ingesting...' : 'Run Bulk Excel Import'}</span>
                </button>
              </div>
            </div>

            {/* Ingestion Status Alert */}
            {ingestMessage && (
              <div className="mb-6 p-4 bg-indigo-50 border border-indigo-200 text-indigo-900 rounded-xl flex items-start space-x-3 text-sm shadow-sm">
                <AlertCircle className="w-5 h-5 text-indigo-600 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <span className="font-semibold">Ingestion Engine Notice:</span> {ingestMessage}
                </div>
                <button onClick={() => setIngestMessage(null)} className="text-indigo-400 hover:text-indigo-600 font-bold">×</button>
              </div>
            )}

            {/* Stats Overview */}
            {data && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Petty Cash Approved</p>
                    <p className="text-2xl font-extrabold text-slate-900 mt-1">
                      {formatLKR(data.pettyCash.stats.totalApprovedAmount)}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">{data.pettyCash.stats.approvedCount} Vouchers Approved</p>
                  </div>
                  <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
                    <DollarSign className="w-6 h-6" />
                  </div>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Fixed Assets Verified</p>
                    <p className="text-2xl font-extrabold text-slate-900 mt-1">{data.fixedAssets.stats.totalAssets}</p>
                    <p className="text-xs text-slate-500 mt-1">{data.fixedAssets.stats.locationCount} OPMC Locations</p>
                  </div>
                  <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
                    <Layers className="w-6 h-6" />
                  </div>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Fleet & Fuel Deposits</p>
                    <p className="text-2xl font-extrabold text-slate-900 mt-1">
                      {formatLKR(data.vehicles.stats.totalFuelDeposits)}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">{data.vehicles.stats.totalVehicles} Registered Vehicles</p>
                  </div>
                  <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
                    <Truck className="w-6 h-6" />
                  </div>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">IOUs & Advances</p>
                    <p className="text-2xl font-extrabold text-slate-900 mt-1">
                      {formatLKR(data.advancesAndIOUs.stats.totalIOUAmount)}
                    </p>
                    <p className="text-xs text-amber-600 font-medium mt-1">
                      {data.advancesAndIOUs.stats.agingOver30DaysCount} IOUs Overdue (&gt;30d)
                    </p>
                  </div>
                  <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
                    <CreditCard className="w-6 h-6" />
                  </div>
                </div>
              </div>
            )}

            {/* Navigation Tabs */}
            <div className="flex border-b border-slate-200 mb-6 bg-white rounded-t-2xl px-4 pt-2 shadow-sm">
              <button
                onClick={() => setActiveTab('petty')}
                className={`py-3 px-5 font-semibold text-sm transition border-b-2 flex items-center space-x-2 ${
                  activeTab === 'petty' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                <DollarSign className="w-4 h-4" />
                <span>1. Petty Cash & Reimbursements</span>
              </button>

              <button
                onClick={() => setActiveTab('assets')}
                className={`py-3 px-5 font-semibold text-sm transition border-b-2 flex items-center space-x-2 ${
                  activeTab === 'assets' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                <Layers className="w-4 h-4" />
                <span>2. Fixed Asset Register</span>
              </button>

              <button
                onClick={() => setActiveTab('fleet')}
                className={`py-3 px-5 font-semibold text-sm transition border-b-2 flex items-center space-x-2 ${
                  activeTab === 'fleet' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                <Truck className="w-4 h-4" />
                <span>3. Fleet & Fuel Deposits</span>
              </button>

              <button
                onClick={() => setActiveTab('advances')}
                className={`py-3 px-5 font-semibold text-sm transition border-b-2 flex items-center space-x-2 ${
                  activeTab === 'advances' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                <CreditCard className="w-4 h-4" />
                <span>4. Advances & IOUs</span>
              </button>

              <button
                onClick={() => setActiveTab('rent')}
                className={`py-3 px-5 font-semibold text-sm transition border-b-2 flex items-center space-x-2 ${
                  activeTab === 'rent' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                <Building className="w-4 h-4" />
                <span>5. Property Rent Ledger</span>
              </button>
            </div>

            {/* Search Input */}
            <div className="mb-4 relative max-w-md">
              <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
              <input
                type="text"
                placeholder="Search report items..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm w-full focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition shadow-sm"
              />
            </div>

            {/* Tab 1: Petty Cash */}
            {activeTab === 'petty' && data && (
              <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
                <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                  <h3 className="font-bold text-slate-800 text-sm">Petty Cash Vouchers Ledger & Reimbursement Breakdown</h3>
                  <div className="flex space-x-4 text-xs font-medium text-slate-600">
                    <span>GL 524102 Subsistence: <strong className="text-slate-900">{formatLKR(data.pettyCash.stats.categoryBreakdown.SUBSISTENCE)}</strong></span>
                    <span>GL 525722 Welfare: <strong className="text-slate-900">{formatLKR(data.pettyCash.stats.categoryBreakdown.STAFF_WELFARE)}</strong></span>
                    <span>GL 524101 Transport: <strong className="text-slate-900">{formatLKR(data.pettyCash.stats.categoryBreakdown.TRAVEL_TRANSPORT)}</strong></span>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-sm">
                    <thead>
                      <tr className="bg-slate-100/70 text-slate-600 text-xs font-semibold uppercase tracking-wider">
                        <th className="p-3">Voucher No</th>
                        <th className="p-3">Description</th>
                        <th className="p-3">Category / GL</th>
                        <th className="p-3">Amount</th>
                        <th className="p-3">Status</th>
                        <th className="p-3">Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {data.pettyCash.vouchers
                        .filter(v => v.voucherNumber.toLowerCase().includes(searchTerm.toLowerCase()) || v.title.toLowerCase().includes(searchTerm.toLowerCase()))
                        .map(v => (
                          <tr key={v.id} className="hover:bg-slate-50/80 transition">
                            <td className="p-3 font-semibold text-slate-900">{v.voucherNumber}</td>
                            <td className="p-3 text-slate-700 max-w-md truncate">{v.title}</td>
                            <td className="p-3">
                              <span className="px-2.5 py-1 bg-slate-100 text-slate-700 text-xs font-medium rounded-md border border-slate-200">
                                {v.category}
                              </span>
                            </td>
                            <td className="p-3 font-semibold text-slate-900">{formatLKR(v.amount)}</td>
                            <td className="p-3">
                              {v.status === 'APPROVED' ? (
                                <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 text-xs font-semibold rounded-full border border-emerald-200 flex items-center w-fit space-x-1">
                                  <CheckCircle2 className="w-3 h-3" />
                                  <span>Approved</span>
                                </span>
                              ) : (
                                <span className="px-2.5 py-1 bg-rose-50 text-rose-700 text-xs font-semibold rounded-full border border-rose-200 flex items-center w-fit space-x-1" title={v.rejectionReason}>
                                  <AlertCircle className="w-3 h-3" />
                                  <span>Cancelled</span>
                                </span>
                              )}
                            </td>
                            <td className="p-3 text-slate-500 text-xs">{new Date(v.createdAt).toLocaleDateString()}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Tab 2: Fixed Assets */}
            {activeTab === 'assets' && data && (
              <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
                <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                  <h3 className="font-bold text-slate-800 text-sm">Fixed Asset Register & ATN Verification Summary</h3>
                  <div className="text-xs text-slate-500">Total Asset Codes Verified: {data.fixedAssets.stats.totalAssets}</div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-sm">
                    <thead>
                      <tr className="bg-slate-100/70 text-slate-600 text-xs font-semibold uppercase tracking-wider">
                        <th className="p-3">Tracking No (ATN)</th>
                        <th className="p-3">Asset Name / Details</th>
                        <th className="p-3">Location</th>
                        <th className="p-3">Group</th>
                        <th className="p-3">Purchase Year</th>
                        <th className="p-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {data.fixedAssets.assets
                        .filter(a => a.assetNumber.toLowerCase().includes(searchTerm.toLowerCase()) || a.name.toLowerCase().includes(searchTerm.toLowerCase()) || (a.locationName || '').toLowerCase().includes(searchTerm.toLowerCase()))
                        .map(a => (
                          <tr key={a.id} className="hover:bg-slate-50/80 transition">
                            <td className="p-3 font-mono font-semibold text-indigo-600">{a.assetNumber}</td>
                            <td className="p-3 text-slate-900 font-medium">{a.name}</td>
                            <td className="p-3 text-slate-600">{a.locationName || a.locationCode}</td>
                            <td className="p-3">
                              <span className="px-2 py-0.5 bg-blue-50 text-blue-700 text-xs font-medium rounded">
                                {a.category}
                              </span>
                            </td>
                            <td className="p-3 text-slate-500">{a.purchasedYear || 'N/A'}</td>
                            <td className="p-3">
                              <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 text-xs font-semibold rounded-full">
                                {a.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Tab 3: Fleet & Fuel Deposits */}
            {activeTab === 'fleet' && data && (
              <div className="space-y-6">
                {/* Vehicles Table */}
                <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
                  <div className="p-4 border-b border-slate-100 bg-slate-50/50">
                    <h3 className="font-bold text-slate-800 text-sm">OSP Fleet Vehicles & Agreement Hire Rates</h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-sm">
                      <thead>
                        <tr className="bg-slate-100/70 text-slate-600 text-xs font-semibold uppercase tracking-wider">
                          <th className="p-3">Vehicle No</th>
                          <th className="p-3">Vehicle Type</th>
                          <th className="p-3">Model</th>
                          <th className="p-3">Monthly Hire Rate</th>
                          <th className="p-3">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {data.vehicles.vehicles.map(v => (
                          <tr key={v.id} className="hover:bg-slate-50/80 transition">
                            <td className="p-3 font-semibold text-slate-900">{v.registration_number}</td>
                            <td className="p-3 text-slate-700">{v.vehicle_type}</td>
                            <td className="p-3 text-slate-500">{v.model}</td>
                            <td className="p-3">
                              <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 text-xs font-semibold rounded-full">
                                {v.status}
                              </span>
                            </td>
                          </tr>
                        ))}

                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Fuel Deposits Table */}
                <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
                  <div className="p-4 border-b border-slate-100 bg-slate-50/50">
                    <h3 className="font-bold text-slate-800 text-sm">Fuel Station Deposits Ledger</h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-sm">
                      <thead>
                        <tr className="bg-slate-100/70 text-slate-600 text-xs font-semibold uppercase tracking-wider">
                          <th className="p-3">Office Location</th>
                          <th className="p-3">Fuel Station Name</th>
                          <th className="p-3">Actual Deposit Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {data.vehicles.fuelDeposits.map(f => (
                          <tr key={f.id} className="hover:bg-slate-50/80 transition">
                            <td className="p-3 font-medium text-slate-900">{f.officeLocation}</td>
                            <td className="p-3 text-slate-700">{f.stationName}</td>
                            <td className="p-3 font-semibold text-emerald-700">{formatLKR(f.actualDeposit)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* Tab 4: Advances & IOUs */}
            {activeTab === 'advances' && data && (
              <div className="space-y-6">
                {/* IOUs Table */}
                <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
                  <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                    <h3 className="font-bold text-slate-800 text-sm">Staff IOU Balances & Aging Log</h3>
                    <span className="text-xs text-amber-600 font-semibold">{data.advancesAndIOUs.stats.agingOver30DaysCount} IOUs Overdue (&gt;30 Days)</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-sm">
                      <thead>
                        <tr className="bg-slate-100/70 text-slate-600 text-xs font-semibold uppercase tracking-wider">
                          <th className="p-3">IOU #</th>
                          <th className="p-3">Staff Name</th>
                          <th className="p-3">Reason</th>
                          <th className="p-3">Amount</th>
                          <th className="p-3">Days Outstanding</th>
                          <th className="p-3">Remarks</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {data.advancesAndIOUs.ious.map(i => (
                          <tr key={i.id} className="hover:bg-slate-50/80 transition">
                            <td className="p-3 font-semibold text-slate-900">{i.iouNumber}</td>
                            <td className="p-3 text-slate-900 font-medium">{i.staffName}</td>
                            <td className="p-3 text-slate-600 max-w-xs truncate">{i.reason || 'Floating Advance'}</td>
                            <td className="p-3 font-semibold text-slate-900">{formatLKR(i.amount)}</td>
                            <td className="p-3">
                              {(i.noOfDays || 0) > 30 ? (
                                <span className="px-2.5 py-1 bg-amber-50 text-amber-700 font-bold text-xs rounded-full border border-amber-200">
                                  {i.noOfDays} Days (Overdue)
                                </span>
                              ) : (
                                <span className="text-slate-600 text-xs">{i.noOfDays || 0} Days</span>
                              )}
                            </td>
                            <td className="p-3 text-xs text-slate-500">{i.remarks || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Project Advances Table */}
                <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
                  <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                    <h3 className="font-bold text-slate-800 text-sm">Project Advances & Input VAT (18%) Claims</h3>
                    <span className="text-xs text-indigo-600 font-semibold">Total VAT Recoverable: {formatLKR(data.advancesAndIOUs.stats.totalVatClaimable)}</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-sm">
                      <thead>
                        <tr className="bg-slate-100/70 text-slate-600 text-xs font-semibold uppercase tracking-wider">
                          <th className="p-3">Ref No</th>
                          <th className="p-3">Supplier</th>
                          <th className="p-3">Description</th>
                          <th className="p-3">Base Amount</th>
                          <th className="p-3">VAT 18%</th>
                          <th className="p-3">Total Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {data.advancesAndIOUs.advances.map(a => (
                          <tr key={a.id} className="hover:bg-slate-50/80 transition">
                            <td className="p-3 font-mono font-semibold text-slate-900">{a.refNumber}</td>
                            <td className="p-3 text-slate-700">{a.supplierName || 'Internal'}</td>
                            <td className="p-3 text-slate-600 max-w-sm truncate">{a.description}</td>
                            <td className="p-3 font-semibold text-slate-900">{formatLKR(a.amount)}</td>
                            <td className="p-3 text-emerald-600 font-medium">{formatLKR(a.vatAmount)}</td>
                            <td className="p-3 font-bold text-slate-900">{formatLKR(a.totalAmount)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* Tab 5: Property Rent */}
            {activeTab === 'rent' && data && (
              <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
                <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                  <h3 className="font-bold text-slate-800 text-sm">Office & Land Property Rental Payments</h3>
                  <span className="text-xs text-slate-600 font-semibold">Total Rent Paid: {formatLKR(data.propertyRent.stats.totalRentPaid)}</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-sm">
                    <thead>
                      <tr className="bg-slate-100/70 text-slate-600 text-xs font-semibold uppercase tracking-wider">
                        <th className="p-3">Landlord / Supplier</th>
                        <th className="p-3">Category</th>
                        <th className="p-3">Bank Account</th>
                        <th className="p-3">Slip No</th>
                        <th className="p-3">Amount</th>
                        <th className="p-3">Slip Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {data.propertyRent.propertyRents.map(r => (
                        <tr key={r.id} className="hover:bg-slate-50/80 transition">
                          <td className="p-3 font-semibold text-slate-900">{r.supplierName}</td>
                          <td className="p-3">
                            <span className="px-2 py-0.5 bg-slate-100 text-slate-700 text-xs font-medium rounded">
                              {r.category}
                            </span>
                          </td>
                          <td className="p-3 font-mono text-slate-600 text-xs">{r.accountNo || 'N/A'}</td>
                          <td className="p-3 text-slate-700 font-medium">{r.slipNo}</td>
                          <td className="p-3 font-semibold text-slate-900">{formatLKR(r.amount)}</td>
                          <td className="p-3 text-xs text-slate-500">{r.slipDate ? new Date(r.slipDate).toLocaleDateString() : 'N/A'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </main>
        </div>
      </div>
    </RoleGuard>
  );
}
