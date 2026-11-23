"use client";

import { useEffect, useMemo, useState } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import RoleGuard from '@/components/RoleGuard';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import {
  Search,
  Plus,
  Trash2,
  Pencil,
  Shield,
  Users,
  UserCheck,
  UserX,
  HardHat,
  KeyRound,
  ChevronLeft,
  ChevronRight,
  Sparkles } from "lucide-react";
import { UserFormDrawer } from './components/UserFormDrawer';
import { UserFormValues } from './components/UserFormDrawer';
import { useUserOperations } from './hooks/useUserOperations';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { resetUserPassword } from '@/actions/user-actions';
import { USER_DEPARTMENTS, USER_STATUS_LABELS, generateTemporaryPassword, isActiveStatus, passwordProblem, PASSWORD_RULE_TEXT } from '@/config/user-admin';

const PAGE_SIZE = 50;

// Types
interface UserData {
  id: string;
  username: string;
  email: string;
  name: string | null;
  role: string;
  status: string;
  employeeId?: string | null;
  createdAt: string;
  assignedStoreId?: string | null;
  contractorId?: string | null;
  mustChangePassword?: boolean;
  hasCustomGrants?: boolean;
  systemRole?: { id: string; code: string; name: string } | null;
  accessibleOpmcs: { id: string; rtom: string }[];
  supervisor?: { id: string; name: string | null; username: string };
  sectionAssignments?: Array<{
    id: string;
    section: { id: string; name: string };
    role: { id: string; name: string };
    isPrimary: boolean;
  }>;
}

interface UserListResponse {
  users: UserData[];
  meta: { total: number; page: number; limit: number; totalPages: number };
  stats: { all: number; active: number; inactive: number; resigned: number; departments: Record<string, number> };
}

interface OPMC {
  id: string;
  name: string;
  rtom: string;
  storeId?: string | null;
}

interface Store {
  id: string;
  name: string;
  location: string | null;
}

export default function UserRegistrationPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("all");
  const [includeContractors, setIncludeContractors] = useState(false);
  const [page, setPage] = useState(1);
  const [showDrawer, setShowDrawer] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserData | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<UserData | null>(null);

  // Quick Password Reset State
  const [resetTarget, setResetTarget] = useState<UserData | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [isResetting, setIsResetting] = useState(false);
  const [showResetPassword, setShowResetPassword] = useState(false);

  const router = useRouter();
  const { upsertMutation, removeMutation } = useUserOperations();

  // search runs on the server (the list is paged), so wait for the typing to pause
  useEffect(() => {
    const t = setTimeout(() => { setSearch(searchTerm.trim()); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [searchTerm]);

  // --- QUERIES ---
  const { data, isLoading: usersLoading, isError, refetch } = useQuery<UserListResponse>({
    queryKey: ["users", page, search, deptFilter, statusFilter, includeContractors],
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const qs = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
      if (search) qs.set('search', search);
      if (deptFilter !== 'ALL') qs.set('dept', deptFilter);
      if (statusFilter !== 'all') qs.set('status', statusFilter);
      if (includeContractors) qs.set('includeContractors', '1');
      const res = await fetch(`/api/users?${qs.toString()}`, { cache: 'no-store' });
      if (!res.ok) throw new Error('Could not load the users');
      return res.json();
    }
  });
  const users = useMemo(() => data?.users ?? [], [data]);
  const meta = data?.meta;
  const stats = data?.stats;

  const { data: opmcs = [] } = useQuery<OPMC[]>({
    queryKey: ["opmcs"],
    queryFn: async () => {
      const res = await fetch("/api/opmcs");
      if (!res.ok) return [];
      return res.json();
    }
  });

  const { data: stores = [] } = useQuery<Store[]>({
    queryKey: ["stores"],
    queryFn: async () => {
      const res = await fetch("/api/inventory/stores");
      if (!res.ok) return [];
      return res.json();
    }
  });

  const handleOpenDrawer = (user?: UserData) => {
    setSelectedUser(user ?? null);
    setShowDrawer(true);
  };

  // The service saves the user and the module designations in one step, so a failure leaves nothing half done.
  const handleFormSubmit = async (values: UserFormValues & {
    designations?: Array<{ sectionId: string; roleId: string; isPrimary: boolean }>
  }) => {
    const result = await upsertMutation.mutateAsync({
      ...values,
      id: selectedUser?.id
    }) as { success: boolean; error?: string };
    if (result?.success) {
      setShowDrawer(false);
      setSelectedUser(null);
    }
  };

  const handleQuickPasswordReset = async () => {
    if (!resetTarget) return;
    const problem = passwordProblem(newPassword);
    if (problem) {
      toast.error(problem);
      return;
    }
    setIsResetting(true);
    try {
      const result = await resetUserPassword(resetTarget.id, newPassword);
      if (result.success) {
        toast.success(`Password updated for ${resetTarget.username}. They must choose a new one at the next sign-in.`);
        setResetTarget(null);
        setNewPassword("");
        setShowResetPassword(false);
      } else {
        toast.error(result.error || "Failed to reset password");
      }
    } catch {
      toast.error("Failed to reset password");
    } finally {
      setIsResetting(false);
    }
  };

  const statusCards = [
    { label: 'Total Accounts', value: stats?.all, icon: Users, tone: 'bg-indigo-50 text-indigo-700' },
    { label: 'Active', value: stats?.active, icon: UserCheck, tone: 'bg-emerald-50 text-emerald-700' },
    { label: 'Inactive / Resigned', value: stats ? stats.inactive + stats.resigned : undefined, icon: UserX, tone: 'bg-amber-50 text-amber-800' },
    { label: 'OSP & Field Staff', value: stats?.departments.OSP, icon: HardHat, tone: 'bg-sky-50 text-sky-700' },
  ];

  // Role Color Customization
  const getRoleBadgeStyle = (role: string) => {
    if (role.includes('ADMIN')) return 'bg-indigo-50 text-indigo-800 border-indigo-200';
    if (role.includes('STORE')) return 'bg-amber-50 text-amber-900 border-amber-200';
    if (role.includes('FINANCE') || role.includes('INVOICE')) return 'bg-emerald-50 text-emerald-800 border-emerald-200';
    if (role.includes('OSP') || role.includes('ENGINEER') || role.includes('AREA')) return 'bg-sky-50 text-sky-800 border-sky-200';
    return 'bg-slate-100 text-slate-800 border-slate-200';
  };

  const total = meta?.total ?? 0;
  const from = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(page * PAGE_SIZE, total);

  const drawerInitial = useMemo(() => selectedUser ? {
    ...selectedUser,
    name: selectedUser.name || '',
    employeeId: selectedUser.employeeId || '',
    supervisorId: selectedUser.supervisor?.id || '',
    assignedStoreId: selectedUser.assignedStoreId || 'none',
    opmcIds: selectedUser.accessibleOpmcs.map(o => o.id),
    status: selectedUser.status || 'active',
    sectionAssignments: selectedUser.sectionAssignments,
    hasCustomGrants: selectedUser.hasCustomGrants,
  } : undefined, [selectedUser]);

  return (
    <RoleGuard>
      <div className="flex h-screen bg-slate-50 overflow-hidden">
        <Sidebar />
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <Header />
          <main className="flex-1 overflow-y-auto p-6 space-y-6">

            {/* Page Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-blue-600/10 text-blue-700">
                    <Users className="w-6 h-6" />
                  </div>
                  System Users & Permissions
                </h1>
                <p className="text-xs text-slate-600 mt-1">
                  Manage organization accounts, RBAC roles, module designations, inventory store assignments & RTOM access scopes.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => router.push('/admin/users/import')}
                  className="h-10 text-xs font-bold border-slate-300 bg-white text-slate-800 hover:bg-slate-50"
                >
                  <Plus className="w-4 h-4 mr-1.5" /> Bulk Import Users
                </Button>
                <Button
                  size="sm"
                  onClick={() => handleOpenDrawer()}
                  className="h-10 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-200"
                >
                  <Plus className="w-4 h-4 mr-1.5" /> New User
                </Button>
              </div>
            </div>

            {/* Top KPI Analytics Cards: counted by the server over every account, not over the page on screen */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {statusCards.map((c) => (
                <div key={c.label} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold ${c.tone}`}>
                    <c.icon className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-2xl font-black text-slate-900">{c.value ?? '-'}</span>
                    <span className="text-[11px] font-bold text-slate-600 block uppercase tracking-wider">{c.label}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Filtering & Table Section */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden flex flex-col">

              {/* Filter Bar */}
              <div className="p-4 border-b border-slate-200 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-slate-50">
                {/* Department Tabs */}
                <div className="flex items-center gap-1 overflow-x-auto max-w-full pb-1 lg:pb-0">
                  {[{ id: 'ALL', label: 'All Users', roles: [] as string[] }, ...USER_DEPARTMENTS].map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => { setDeptFilter(tab.id); setPage(1); }}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                        deptFilter === tab.id
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      {tab.label}
                      <span className={`ml-1.5 text-[10px] ${deptFilter === tab.id ? 'text-blue-100' : 'text-slate-500'}`}>
                        {tab.id === 'ALL' ? stats?.all ?? '' : stats?.departments[tab.id] ?? ''}
                      </span>
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-2 w-full lg:w-auto">
                  <label className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-700 whitespace-nowrap" title="Contractor logins are created from the contractor registration">
                    <input type="checkbox" checked={includeContractors} onChange={e => { setIncludeContractors(e.target.checked); setPage(1); }} />
                    Show contractor logins
                  </label>
                  <select
                    aria-label="Filter by status"
                    value={statusFilter}
                    onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
                    className="h-9 rounded-xl border border-slate-300 bg-white px-2 text-xs font-semibold text-slate-800"
                  >
                    <option value="all">All statuses</option>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="resigned">Resigned</option>
                  </select>
                  {/* Search Box (searches every account) */}
                  <div className="relative w-full lg:w-72">
                    <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <Input
                      placeholder="Search name, username, email, employee ID..."
                      value={searchTerm}
                      onChange={e => setSearchTerm(e.target.value)}
                      className="h-9 pl-9 text-xs bg-white border-slate-300 rounded-xl text-slate-900 placeholder:text-slate-500"
                    />
                  </div>
                </div>
              </div>

              {/* Data Table */}
              <div className="overflow-x-auto">
                {usersLoading ? (
                  <div className="p-12 text-center text-slate-600 text-sm">
                    <Sparkles className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-600" />
                    Loading user directory...
                  </div>
                ) : isError ? (
                  <div className="p-12 text-center text-sm text-rose-700">
                    The users could not be loaded.{' '}
                    <button className="underline font-bold" onClick={() => refetch()}>Try again</button>
                  </div>
                ) : users.length === 0 ? (
                  <div className="p-12 text-center text-slate-600 text-sm">
                    No users matching search filters found.
                  </div>
                ) : (
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200 uppercase tracking-wider text-[10px]">
                      <tr>
                        <th className="px-4 py-3">User Staff Identity</th>
                        <th className="px-4 py-3">Role & Designations</th>
                        <th className="px-4 py-3">Warehouse / Store</th>
                        <th className="px-4 py-3">RTOM Scope</th>
                        <th className="px-4 py-3">Supervisor</th>
                        <th className="px-4 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium">
                      {users.map((u) => {
                        const assignedStore = stores.find(s => s.id === u.assignedStoreId);
                        const active = isActiveStatus(u.status);
                        return (
                          <tr key={u.id} className="hover:bg-slate-50 transition-colors">

                            {/* User Identity */}
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-3">
                                <div className="relative">
                                  <div className="h-9 w-9 rounded-2xl bg-blue-600/10 text-blue-800 font-black text-xs flex items-center justify-center border border-blue-200">
                                    {(u.name?.[0] || u.username[0]).toUpperCase()}
                                  </div>
                                  <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${active ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                                </div>
                                <div>
                                  <div className="font-bold text-slate-900 text-xs flex flex-wrap items-center gap-1.5">
                                    {u.name || u.username}
                                    {u.employeeId && (
                                      <span className="bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded text-[9px] font-mono">
                                        #{u.employeeId}
                                      </span>
                                    )}
                                    {!active && (
                                      <span className="bg-slate-200 text-slate-800 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase">
                                        {USER_STATUS_LABELS[u.status]?.split(' ')[0] ?? u.status}
                                      </span>
                                    )}
                                    {u.mustChangePassword && (
                                      <span className="bg-amber-100 text-amber-900 px-1.5 py-0.5 rounded text-[9px] font-bold" title="Has not yet chosen their own password">
                                        Password change pending
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-[11px] text-slate-600 font-normal">
                                    {u.username} • {u.email}
                                  </div>
                                </div>
                              </div>
                            </td>

                            {/* Role Badge + designations */}
                            <td className="px-4 py-3">
                              <span className={`px-2.5 py-1 rounded-full text-[10px] border font-bold uppercase tracking-wider inline-block ${getRoleBadgeStyle(u.role)}`}>
                                {u.role.replace(/_/g, ' ')}
                              </span>
                              {(u.sectionAssignments?.length ?? 0) > 0 && (
                                <div className="mt-1 flex flex-wrap gap-1">
                                  {u.sectionAssignments!.map((a) => (
                                    <span key={a.id} className="px-1.5 py-0.5 rounded text-[9px] bg-white text-slate-700 font-semibold border border-slate-300" title={`${a.section.name}: ${a.role.name}`}>
                                      {a.section.name}
                                    </span>
                                  ))}
                                </div>
                              )}
                              {u.hasCustomGrants && (
                                <div className="mt-1 text-[9px] font-bold text-purple-800 bg-purple-50 border border-purple-200 rounded px-1.5 py-0.5 inline-block" title="A manual permission list replaces this person's role grants">
                                  Custom permission list
                                </div>
                              )}
                            </td>

                            {/* Store */}
                            <td className="px-4 py-3 text-slate-700">
                              {assignedStore ? (
                                <span className="inline-flex items-center gap-1 px-2 py-1 bg-amber-50 text-amber-900 border border-amber-200 rounded-lg text-[10px] font-bold">
                                  {assignedStore.name}
                                </span>
                              ) : (
                                <span className="text-slate-600 text-[11px] italic">No Store Assigned</span>
                              )}
                            </td>

                            {/* OPMC Scopes */}
                            <td className="px-4 py-3 text-slate-700">
                              {u.accessibleOpmcs?.length > 0 ? (
                                <div className="flex flex-wrap gap-1">
                                  {u.accessibleOpmcs.slice(0, 3).map(opmc => (
                                    <span key={opmc.id} className="px-1.5 py-0.5 rounded text-[9px] bg-slate-100 text-slate-800 font-bold border border-slate-300">
                                      {opmc.rtom}
                                    </span>
                                  ))}
                                  {u.accessibleOpmcs.length > 3 && (
                                    <span className="px-1.5 py-0.5 rounded text-[9px] bg-blue-50 text-blue-800 font-bold border border-blue-200">
                                      +{u.accessibleOpmcs.length - 3}
                                    </span>
                                  )}
                                </div>
                              ) : u.contractorId ? (
                                <span className="text-slate-600 text-[11px] italic">Contractor portal</span>
                              ) : (
                                <span className="text-[11px] font-semibold text-amber-800" title="Without an OPMC / RTOM a regional user sees no orders">No region assigned</span>
                              )}
                            </td>

                            {/* Supervisor */}
                            <td className="px-4 py-3">
                              {u.supervisor ? (
                                <div className="flex items-center gap-1.5 text-slate-800 font-medium text-[11px]">
                                  <Shield className="w-3.5 h-3.5 text-slate-500" />
                                  {u.supervisor.name || u.supervisor.username}
                                </div>
                              ) : (
                                <span className="text-slate-600 text-[11px] italic">Direct Report</span>
                              )}
                            </td>

                            {/* Actions */}
                            <td className="px-4 py-3 text-right">
                              <div className="flex justify-end items-center gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  title="Reset Password"
                                  aria-label="Reset Password"
                                  onClick={() => { setResetTarget(u); setNewPassword(''); setShowResetPassword(false); }}
                                  className="h-8 w-8 text-amber-700 hover:bg-amber-50 hover:text-amber-800 rounded-lg"
                                >
                                  <KeyRound className="w-3.5 h-3.5" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  title="Edit User"
                                  aria-label="Edit User"
                                  onClick={() => handleOpenDrawer(u)}
                                  className="h-8 w-8 text-blue-700 hover:bg-blue-50 hover:text-blue-800 rounded-lg"
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </Button>
                                {u.role !== 'SUPER_ADMIN' && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    title="Delete User"
                                    aria-label="Delete User"
                                    onClick={() => setDeleteTarget(u)}
                                    className="h-8 w-8 text-rose-700 hover:bg-rose-50 hover:text-rose-800 rounded-lg"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </Button>
                                )}
                              </div>
                            </td>

                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Pager */}
              {total > 0 && (
                <div className="flex items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-700">
                  <span>Showing {from}-{to} of {total}</span>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))} className="h-8 text-xs font-bold border-slate-300 text-slate-800">
                      <ChevronLeft className="w-4 h-4" /> Previous
                    </Button>
                    <span className="font-semibold">Page {page} of {meta?.totalPages ?? 1}</span>
                    <Button variant="outline" size="sm" disabled={page >= (meta?.totalPages ?? 1)} onClick={() => setPage(p => p + 1)} className="h-8 text-xs font-bold border-slate-300 text-slate-800">
                      Next <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}
            </div>

          </main>
        </div>
      </div>

      {/* Slide-Over Drawer for Adding/Editing User */}
      <UserFormDrawer
        open={showDrawer}
        onOpenChange={setShowDrawer}
        onSubmit={handleFormSubmit}
        initialData={drawerInitial}
        isSubmitting={upsertMutation.isPending}
        opmcs={opmcs}
        stores={stores}
      />

      {/* Quick Password Reset Dialog */}
      <Dialog open={Boolean(resetTarget)} onOpenChange={() => setResetTarget(null)}>
        <DialogContent className="max-w-md bg-white p-6 rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
              <KeyRound className="w-5 h-5 text-amber-600" />
              Reset Password for {resetTarget?.name || resetTarget?.username}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-600">
              Set a temporary password for <strong>{resetTarget?.username}</strong>. They must choose their own at the next sign-in, and any open session ends.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 py-2">
            <label htmlFor="reset-password" className="text-xs font-bold text-slate-800">Temporary password</label>
            <div className="flex gap-2">
              <Input
                id="reset-password"
                type={showResetPassword ? 'text' : 'password'}
                autoComplete="new-password"
                placeholder="Enter a temporary password"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                className="h-10 text-sm text-slate-900 placeholder:text-slate-500"
              />
              <Button type="button" variant="outline" size="sm" className="h-10 text-xs font-bold border-slate-300 text-slate-800"
                onClick={() => { setNewPassword(generateTemporaryPassword()); setShowResetPassword(true); }}>
                Generate
              </Button>
            </div>
            <p className="text-[11px] text-slate-600">{PASSWORD_RULE_TEXT} Give it to the person yourself; it is not emailed.</p>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setResetTarget(null)} className="border-slate-300 text-slate-800">Cancel</Button>
            <Button
              size="sm"
              disabled={isResetting || !!passwordProblem(newPassword)}
              onClick={handleQuickPasswordReset}
              className="bg-amber-600 hover:bg-amber-700 text-white font-bold"
            >
              {isResetting ? 'Saving...' : 'Update Password'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Alert */}
      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent className="bg-white rounded-2xl p-6">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-bold text-slate-900">Are you sure you want to delete this user?</AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-slate-600">
              <strong>{deleteTarget?.name || deleteTarget?.username}</strong> will no longer be able to sign in and disappears from this list. The account record stays for the audit trail, so the username cannot be reused.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="text-xs font-bold">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (deleteTarget) {
                  await removeMutation.mutateAsync(deleteTarget.id);
                  setDeleteTarget(null);
                }
              }}
              className="bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold"
            >
              Delete User
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </RoleGuard>
  );
}
