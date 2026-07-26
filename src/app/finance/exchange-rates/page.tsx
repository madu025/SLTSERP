'use client';

import React, { useState, useEffect } from 'react';
import RoleGuard from '@/components/RoleGuard';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Globe, ArrowRightLeft, Loader2, Save } from 'lucide-react';
import { format } from 'date-fns';

interface CurrencyRate {
  id: string;
  currencyCode: string;
  exchangeRate: number;
  effectiveDate: string;
}

export default function ExchangeRatesPage() {
  const [rates, setRates] = useState<CurrencyRate[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [newCurrency, setNewCurrency] = useState('USD');
  const [newRate, setNewRate] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchRates();
  }, []);

  const fetchRates = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/finance/exchange-rates?_t=${Date.now()}`, {
        cache: 'no-store',
        headers: { 'Pragma': 'no-cache' }
      });
      if (res.ok) {
        const data = await res.json();
        setRates(data.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveRate = async () => {
    if (!newCurrency || !newRate) return;
    
    setSaving(true);
    try {
      const res = await fetch('/api/finance/exchange-rates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currencyCode: newCurrency,
          exchangeRate: parseFloat(newRate),
          effectiveDate: new Date().toISOString()
        })
      });
      
      if (res.ok) {
        setNewRate('');
        await fetchRates();
      }
    } catch (err) {
      console.error('Failed to save rate', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <RoleGuard allowedRoles={['SUPER_ADMIN', 'ADMIN', 'FINANCE_MANAGER']}>
      <div className="flex h-screen bg-slate-50 overflow-hidden">
        <Sidebar />
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <Header />
          <main className="flex-1 overflow-y-auto p-6">
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Exchange Rates (FX)</h1>
              <p className="text-slate-500 mt-1">Manage multi-currency exchange rates to LKR for FX Gain/Loss calculation.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              <div className="col-span-1">
                <Card className="shadow-sm border-slate-200 sticky top-6">
                  <CardHeader className="bg-slate-50 border-b border-slate-100">
                    <CardTitle className="text-base flex items-center">
                      <ArrowRightLeft className="w-5 h-5 mr-2 text-slate-500" />
                      Set New Daily Rate
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-6 space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Currency Code</label>
                      <Input 
                        value={newCurrency} 
                        onChange={(e) => setNewCurrency(e.target.value.toUpperCase())} 
                        placeholder="e.g. USD" 
                        maxLength={3}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Exchange Rate to LKR</label>
                      <Input 
                        type="number" 
                        step="0.01"
                        value={newRate} 
                        onChange={(e) => setNewRate(e.target.value)} 
                        placeholder="e.g. 305.50" 
                      />
                    </div>
                    <Button 
                      className="w-full bg-blue-600 hover:bg-blue-700" 
                      onClick={handleSaveRate}
                      disabled={saving || !newCurrency || !newRate}
                    >
                      {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                      Save Rate
                    </Button>
                  </CardContent>
                </Card>
              </div>

              <div className="col-span-2">
                <Card className="shadow-sm border-slate-200">
                  <CardHeader className="bg-slate-50 border-b border-slate-100 flex flex-row items-center justify-between">
                    <CardTitle className="text-base">Current Active Rates</CardTitle>
                    <Globe className="w-5 h-5 text-slate-400" />
                  </CardHeader>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left text-slate-600">
                      <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-200">
                        <tr>
                          <th className="px-6 py-3 font-medium">Currency</th>
                          <th className="px-6 py-3 font-medium text-right">Rate (LKR)</th>
                          <th className="px-6 py-3 font-medium text-right">Effective Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {loading ? (
                          <tr>
                            <td colSpan={3} className="px-6 py-12 text-center text-slate-500">
                              <Loader2 className="h-6 w-6 animate-spin mx-auto text-blue-600 mb-2" />
                              Loading rates...
                            </td>
                          </tr>
                        ) : rates.length === 0 ? (
                          <tr>
                            <td colSpan={3} className="px-6 py-8 text-center text-slate-500">No exchange rates found.</td>
                          </tr>
                        ) : (
                          rates.map((rate) => (
                            <tr key={rate.id} className="border-b border-slate-100 hover:bg-slate-50">
                              <td className="px-6 py-4 font-semibold text-slate-900">
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium bg-blue-100 text-blue-800">
                                  {rate.currencyCode}
                                </span>
                              </td>
                              <td className="px-6 py-4 text-right font-medium">
                                Rs {rate.exchangeRate.toFixed(2)}
                              </td>
                              <td className="px-6 py-4 text-right text-slate-500">
                                {format(new Date(rate.effectiveDate), 'PPP')}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </Card>
              </div>

            </div>
          </main>
        </div>
      </div>
    </RoleGuard>
  );
}
