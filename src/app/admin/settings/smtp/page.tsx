'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import RoleGuard from '@/components/RoleGuard';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import { ROLE_GROUPS } from '@/config/roles';
import { Save, Mail, Server, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';

const smtpSchema = z.object({
  host: z.string().min(1, 'Host is required'),
  port: z.string().min(1, 'Port is required').or(z.number()),
  user: z.string().min(1, 'Username is required'),
  pass: z.string().min(1, 'Password is required'),
  from: z.string().email('Valid from email address is required')
});

type SmtpFormValues = z.infer<typeof smtpSchema>;

export default function SmtpSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<SmtpFormValues>({
    resolver: zodResolver(smtpSchema),
    defaultValues: {
      host: '',
      port: 587,
      user: '',
      pass: '',
      from: ''
    }
  });

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const res = await fetch('/api/admin/system/smtp');
        if (!res.ok) throw new Error('Failed to fetch settings');
        const json = await res.json();
        const data = json.data;
        if (data) {
          setValue('host', data.host || '');
          setValue('port', data.port || 587);
          setValue('user', data.user || '');
          setValue('pass', data.pass || '');
          setValue('from', data.from || '');
        }
      } catch (err) {
        toast.error('Could not load SMTP settings.');
      } finally {
        setLoading(false);
      }
    };
    fetchConfig();
  }, [setValue]);

  const onSubmit = async (data: SmtpFormValues) => {
    setSaving(true);
    try {
      const res = await fetch('/api/admin/system/smtp', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to save settings');
      }
      toast.success('SMTP settings updated successfully!');
      
      const json = await res.json();
      setValue('pass', json.data?.pass || '********');
      
    } catch (err: any) {
      toast.error(err.message || 'Failed to update SMTP settings');
    } finally {
      setSaving(false);
    }
  };

  return (
    <RoleGuard allowedRoles={ROLE_GROUPS.ADMINS as unknown as string[]}>
      <div className="flex h-screen bg-slate-50 overflow-hidden">
        <Sidebar />
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <Header />
          <main className="flex-1 overflow-y-auto p-6">
            <div className="max-w-3xl mx-auto space-y-6">
              
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-xl border shadow-sm">
                <div>
                  <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                    <Mail className="w-6 h-6 text-indigo-600" />
                    SMTP Email Configuration
                  </h1>
                  <p className="text-slate-500 text-sm mt-1">
                    Configure the outbound email server for Actionable Emails and system notifications.
                  </p>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm border p-6">
                {loading ? (
                  <div className="text-slate-500">Loading configuration...</div>
                ) : (
                  <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-1">
                        <label className="text-sm font-medium text-slate-700 flex items-center gap-1">
                          <Server className="w-4 h-4 text-slate-400" /> SMTP Host
                        </label>
                        <input
                          type="text"
                          {...register('host')}
                          className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                          placeholder="smtp.office365.com"
                        />
                        {errors.host && <p className="text-xs text-red-500">{errors.host.message}</p>}
                      </div>

                      <div className="space-y-1">
                        <label className="text-sm font-medium text-slate-700">Port</label>
                        <input
                          type="text"
                          {...register('port')}
                          className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                          placeholder="587"
                        />
                        {errors.port && <p className="text-xs text-red-500">{errors.port.message}</p>}
                      </div>

                      <div className="space-y-1">
                        <label className="text-sm font-medium text-slate-700">From Address</label>
                        <input
                          type="text"
                          {...register('from')}
                          className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                          placeholder="approvals@slt.lk"
                        />
                        {errors.from && <p className="text-xs text-red-500">{errors.from.message}</p>}
                      </div>
                    </div>

                    <div className="border-t pt-6">
                      <h3 className="text-sm font-semibold text-slate-800 mb-4 flex items-center gap-2">
                        <ShieldCheck className="w-4 h-4 text-emerald-600" /> Authentication
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-1">
                          <label className="text-sm font-medium text-slate-700">Username</label>
                          <input
                            type="text"
                            {...register('user')}
                            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                          />
                          {errors.user && <p className="text-xs text-red-500">{errors.user.message}</p>}
                        </div>

                        <div className="space-y-1">
                          <label className="text-sm font-medium text-slate-700">Password</label>
                          <input
                            type="password"
                            {...register('pass')}
                            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                          />
                          {errors.pass && <p className="text-xs text-red-500">{errors.pass.message}</p>}
                          <p className="text-xs text-slate-400">Leave as ******** to keep current password.</p>
                        </div>
                      </div>
                    </div>

                    <div className="pt-4 border-t flex justify-end">
                      <button
                        type="submit"
                        disabled={saving}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-lg font-medium flex items-center gap-2 transition-colors disabled:opacity-50"
                      >
                        <Save className="w-4 h-4" />
                        {saving ? 'Saving...' : 'Save Configuration'}
                      </button>
                    </div>

                  </form>
                )}
              </div>

            </div>
          </main>
        </div>
      </div>
    </RoleGuard>
  );
}
