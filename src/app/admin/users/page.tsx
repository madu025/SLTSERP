"use client";

import {  useState, useMemo  } from 'react';
import { useQuery } from '@tanstack/react-query';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import RoleGuard from '@/components/RoleGuard';
import { ROLE_GROUPS } from '@/config/roles';
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
  Store,
  HardHat,
  KeyRound,
  Sparkles } from "lucide-react";
import { UserFormDrawer } from './components/UserFormDrawer';
import { UserFormValues } from './components/UserFormDrawer';
import { useUserOperations } from './hooks/useUserOperations';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

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
  accessibleOpmcs: { id: string; rtom: string }[];
  supervisor?: { id: string; name: string | null; username: string };
  sectionAssignments?: Array<{
    id: string;
    section: { id: string; name: string };
    role: { id: string; name: string };
    isPrimary: boolean;
  }>;
  permissions?: string[];
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
  const [deptFilter, setDeptFilter] = useState("ALL");
  const [showDrawer, setShowDrawer] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserData | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<UserData | null>(null);
  
  // Quick Password Reset State
  const [resetTarget, setResetTarget] = useState<UserData | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [isResetting, setIsResetting] = useState(false);

  const router = useRouter();
  const { upsertMutation, removeMutation } = useUserOperations();

  // --- QUERIES ---
  const { data: users = [], isLoading: usersLoading } = useQuery<UserData[]>({
    queryKey: ["users"],
    queryFn: async () => {
      const res = await fetch(`/api/users?page=1&limit=1000&_t=${Date.now()}`, { cache: 'no-store' });
      if (!res.ok) return [];
      const data = await res.json();
      return data.users || (Array.isArray(data) ? data : []);
    }
  });

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
    if (user) {
      setSelectedUser(user);
    } else {
      setSelectedUser(null);
    }
    setShowDrawer(true);
  };

  const handleFormSubmit = async (values: UserFormValues & { 
    sectionAssignments?: Array<{ sectionId: string; roleId: string; isPrimary: boolean }>
    permissions?: string[]
  }) => {
    const { sectionAssignments, permissions, ...userValues } = values;
    
    // Create or update user (this also creates the primary section assignment based on role)
    const result = await upsertMutation.mutateAsync({
      ...userValues,
      permissions: permissions && permissions.length > 0 ? permissions : undefined,
      id: selectedUser?.id
    }) as { success: boolean; data?: { id: string }; error?: string };
    
    // Handle additional section assignments if provided
    if (sectionAssignments && result.success && result.data?.id) {
      const userId = result.data.id;
      
      // Get existing assignments to compare
      const existingRes = await fetch(`/api/admin/users/${userId}/sections`);
      const existingAssignments = existingRes.ok ? await existingRes.json() : [];
      const existingIds = new Set(existingAssignments.map((a: { section: { id: string } }) => a.section.id));
      
      // Add new assignments that don't exist yet
      for (const assignment of sectionAssignments) {
        if (!existingIds.has(assignment.sectionId)) {
          await fetch(`/api/admin/users/${userId}/sections`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(assignment)
          });
        }
      }
      
      // Remove assignments that are no longer in the list
      for (const existing of existingAssignments) {
        const stillExists = sectionAssignments.some(a => a.sectionId === existing.section.id);
        if (!stillExists && !existing.isPrimary) {
          await fetch(`/api/admin/users/${userId}/sections/${existing.id}`, {
            method: 'DELETE'
          });
        }
      }
    }
    
    setShowDrawer(false);
    setSelectedUser(null);
  };

  const handleQuickPasswordReset = async () => {
    if (!resetTarget || !newPassword || newPassword.length < 4) {
      toast.error("Password must be at least 4 characters");
      return;
    }

    setIsResetting(true);
    try {
      const res = await fetch(`/api/users/${resetTarget.id}/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: newPassword })
      });

      if (!res.ok) {
        // Fallback to upsert logic if specific reset API doesn't exist
        await upsertMutation.mutateAsync({
          username: resetTarget.username,
          email: resetTarget.email,
          name: resetTarget.name || resetTarget.username,
          role: resetTarget.role,
          password: newPassword,
          employeeId: resetTarget.employeeId || undefined,
          opmcIds: resetTarget.accessibleOpmcs.map(o => o.id),
          assignedStoreId: resetTarget.assignedStoreId || undefined,
          id: resetTarget.id
        });
      } else {
        toast.success(`Password updated for ${resetTarget.username}`);
      }

      setResetTarget(null);
      setNewPassword("");
    } catch {
      toast.error("Failed to reset password");
    } finally {
      setIsResetting(false);
    }
  };

  // KPI Analytics
  const stats = useMemo(() => {
    const total = users.length;
    const active = users.filter(u => u.status === 'active' || !u.status).length;
    const storesTeam = users.filter(u => u.role.includes('STORE') || u.assignedStoreId).length;
    const ospTeam = users.filter(u => u.role.includes('OSP') || u.role.includes('ENGINEER') || u.role.includes('AREA')).length;
    return { total, active, storesTeam, ospTeam };
  }, [users]);

  // Department Filters
  const filteredUsers = useMemo(() => {
    return users.filter(u => {
      const searchLower = searchTerm.toLowerCase();
      const matchSearch =
        (u.name && u.name.toLowerCase().includes(searchLower)) ||
        u.username.toLowerCase().includes(searchLower) ||
        u.email.toLowerCase().includes(searchLower) ||
        u.role.toLowerCase().includes(searchLower) ||
        (u.employeeId && u.employeeId.toLowerCase().includes(searchLower));

      let matchDept = true;
      if (deptFilter === 'OSP') {
        matchDept = u.role.includes('OSP') || u.role.includes('ENGINEER') || u.role.includes('AREA') || u.role.includes('COORDINATOR');
      } else if (deptFilter === 'STORES') {
        matchDept = u.role.includes('STORE') || Boolean(u.assignedStoreId);
      } else if (deptFilter === 'FINANCE') {
        matchDept = u.role.includes('FINANCE') || u.role.includes('INVOICE') || u.role.includes('PROCUREMENT');
      } else if (deptFilter === 'ADMIN') {
        matchDept = u.role.includes('ADMIN');
      }

      return matchSearch && matchDept;
    });
  }, [users, searchTerm, deptFilter]);

  // Role Color Customization
  const getRoleBadgeStyle = (role: string) => {
    if (role.includes('ADMIN')) return 'bg-indigo-50 text-indigo-700 border-indigo-200';
    if (role.includes('STORE')) return 'bg-amber-50 text-amber-700 border-amber-200';
    if (role.includes('FINANCE') || role.includes('INVOICE')) return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    if (role.includes('OSP') || role.includes('ENGINEER') || role.includes('AREA')) return 'bg-sky-50 text-sky-700 border-sky-200';
    return 'bg-slate-100 text-slate-700 border-slate-200';
  };

  return (
    <RoleGuard allowedRoles={[...ROLE_GROUPS.CORE_ADMINS, 'OSP_MANAGER']}>
      <div className="flex h-screen bg-slate-50 overflow-hidden">
        <Sidebar />
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <Header />
          <main className="flex-1 overflow-y-auto p-6 space-y-6">

            {/* Page Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-blue-600/10 text-blue-600">
                    <Users className="w-6 h-6" />
                  </div>
                  System Users & Permissions
                </h1>
                <p className="text-xs text-slate-500 mt-1">
                  Manage organization accounts, RBAC roles, inventory store assignments & RTOM access scopes.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => router.push('/admin/users/import')}
                  className="h-10 text-xs font-bold border-slate-200 bg-white hover:bg-slate-50"
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

            {/* Top KPI Analytics Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-2xl font-black text-slate-900">{stats.total}</span>
                  <span className="text-[11px] font-bold text-slate-400 block uppercase tracking-wider">Total Accounts</span>
                </div>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                  <UserCheck className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-2xl font-black text-slate-900">{stats.active}</span>
                  <span className="text-[11px] font-bold text-slate-400 block uppercase tracking-wider">Active Staff</span>
                </div>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
                  <Store className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-2xl font-black text-slate-900">{stats.storesTeam}</span>
                  <span className="text-[11px] font-bold text-slate-400 block uppercase tracking-wider">Stores Officers</span>
                </div>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center font-bold">
                  <HardHat className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-2xl font-black text-slate-900">{stats.ospTeam}</span>
                  <span className="text-[11px] font-bold text-slate-400 block uppercase tracking-wider">OSP & Field Staff</span>
                </div>
              </div>
            </div>

            {/* Filtering & Table Section */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden flex flex-col">
              
              {/* Filter Bar */}
              <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-slate-50/50">
                {/* Department Tabs */}
                <div className="flex items-center gap-1 overflow-x-auto max-w-full pb-1 md:pb-0">
                  {[
                    { id: 'ALL', label: 'All Users' },
                    { id: 'OSP', label: 'OSP & Operations' },
                    { id: 'STORES', label: 'Stores & Inventory' },
                    { id: 'FINANCE', label: 'Finance & Invoicing' },
                    { id: 'ADMIN', label: 'System Admins' }
                  ].map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => setDeptFilter(tab.id)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                        deptFilter === tab.id
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'text-slate-600 hover:bg-slate-200/60'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* Search Box */}
                <div className="relative w-full md:w-72">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <Input
                    placeholder="Search name, username, email..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="h-9 pl-9 text-xs bg-white border-slate-200 rounded-xl"
                  />
                </div>
              </div>

              {/* Data Table */}
              <div className="overflow-x-auto">
                {usersLoading ? (
                  <div className="p-12 text-center text-slate-400 text-sm">
                    <Sparkles className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-500" />
                    Loading user directory...
                  </div>
                ) : filteredUsers.length === 0 ? (
                  <div className="p-12 text-center text-slate-400 text-sm">
                    No users matching search filters found.
                  </div>
                ) : (
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-100 uppercase tracking-wider text-[10px]">
                      <tr>
                        <th className="px-4 py-3">User Staff Identity</th>
                        <th className="px-4 py-3">Role & Department</th>
                        <th className="px-4 py-3">Warehouse / Store</th>
                        <th className="px-4 py-3">RTOM Scope</th>
                        <th className="px-4 py-3">Supervisor</th>
                        <th className="px-4 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium">
                      {filteredUsers.map((u) => {
                        const assignedStore = stores.find(s => s.id === u.assignedStoreId);
                        return (
                          <tr key={u.id} className="hover:bg-slate-50/80 transition-colors">
                            
                            {/* User Identity */}
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-3">
                                <div className="relative">
                                  <div className="h-9 w-9 rounded-2xl bg-blue-600/10 text-blue-700 font-black text-xs flex items-center justify-center border border-blue-200">
                                    {(u.name?.[0] || u.username[0]).toUpperCase()}
                                  </div>
                                  <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${
                                    u.status === 'active' || !u.status ? 'bg-emerald-500' : 'bg-slate-300'
                                  }`} />
                                </div>
                                <div>
                                  <div className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                                    {u.name || u.username}
                                    {u.employeeId && (
                                      <span className="bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded text-[9px] font-mono">
                                        #{u.employeeId}
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-[11px] text-slate-400 font-normal">
                                    {u.username} • {u.email}
                                  </div>
                                </div>
                              </div>
                            </td>

                            {/* Role Badge */}
                            <td className="px-4 py-3">
                              <span className={`px-2.5 py-1 rounded-full text-[10px] border font-bold uppercase tracking-wider inline-block ${getRoleBadgeStyle(u.role)}`}>
                                {u.role.replace(/_/g, ' ')}
                              </span>
                            </td>

                            {/* Store */}
                            <td className="px-4 py-3 text-slate-600">
                              {assignedStore ? (
                                <span className="inline-flex items-center gap-1 px-2 py-1 bg-amber-50 text-amber-800 border border-amber-200 rounded-lg text-[10px] font-bold">
                                  <Store className="w-3 h-3 text-amber-600" />
                                  {assignedStore.name}
                                </span>
                              ) : (
                                <span className="text-slate-400 text-[11px] italic">No Store Assigned</span>
                              )}
                            </td>

                            {/* OPMC Scopes */}
                            <td className="px-4 py-3 text-slate-600">
                              {u.accessibleOpmcs?.length > 0 ? (
                                <div className="flex flex-wrap gap-1">
                                  {u.accessibleOpmcs.slice(0, 3).map(opmc => (
                                    <span key={opmc.id} className="px-1.5 py-0.5 rounded text-[9px] bg-slate-100 text-slate-700 font-bold border border-slate-200">
                                      {opmc.rtom}
                                    </span>
                                  ))}
                                  {u.accessibleOpmcs.length > 3 && (
                                    <span className="px-1.5 py-0.5 rounded text-[9px] bg-blue-50 text-blue-700 font-bold border border-blue-200">
                                      +{u.accessibleOpmcs.length - 3}
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <span className="text-slate-400 text-[11px] italic">All Access / None</span>
                              )}
                            </td>

                            {/* Supervisor */}
                            <td className="px-4 py-3">
                              {u.supervisor ? (
                                <div className="flex items-center gap-1.5 text-slate-700 font-medium text-[11px]">
                                  <Shield className="w-3.5 h-3.5 text-slate-400" />
                                  {u.supervisor.name || u.supervisor.username}
                                </div>
                              ) : (
                                <span className="text-slate-400 text-[11px] italic">Direct Report</span>
                              )}
                            </td>

                            {/* Actions */}
                            <td className="px-4 py-3 text-right">
                              <div className="flex justify-end items-center gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  title="Quick Reset Password"
                                  onClick={() => setResetTarget(u)}
                                  className="h-8 w-8 text-amber-600 hover:bg-amber-50 hover:text-amber-700 rounded-lg"
                                >
                                  <KeyRound className="w-3.5 h-3.5" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  title="Edit User"
                                  onClick={() => handleOpenDrawer(u)}
                                  className="h-8 w-8 text-blue-600 hover:bg-blue-50 hover:text-blue-700 rounded-lg"
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </Button>
                                {u.role !== 'SUPER_ADMIN' && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    title="Delete User"
                                    onClick={() => setDeleteTarget(u)}
                                    className="h-8 w-8 text-rose-600 hover:bg-rose-50 hover:text-rose-700 rounded-lg"
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
            </div>

          </main>
        </div>
      </div>

      {/* Slide-Over Drawer for Adding/Editing User */}
      <UserFormDrawer
        open={showDrawer}
        onOpenChange={setShowDrawer}
        onSubmit={handleFormSubmit}
        initialData={useMemo(() => selectedUser ? {
          ...selectedUser,
          name: selectedUser.name || '',
          employeeId: selectedUser.employeeId || '',
          supervisorId: selectedUser.supervisor?.id || '',
          assignedStoreId: selectedUser.assignedStoreId || 'none',
          opmcIds: selectedUser.accessibleOpmcs.map(o => o.id),
          status: selectedUser.status || 'active',
          sectionAssignments: selectedUser.sectionAssignments,
          permissions: typeof selectedUser.permissions === 'string'
            ? JSON.parse(selectedUser.permissions)
            : (selectedUser.permissions || [])
        } : undefined, [selectedUser])}
        isSubmitting={upsertMutation.isPending}
        users={users}
        opmcs={opmcs}
        stores={stores}
      />

      {/* Quick Password Reset Dialog */}
      <Dialog open={Boolean(resetTarget)} onOpenChange={() => setResetTarget(null)}>
        <DialogContent className="max-w-md bg-white p-6 rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
              <KeyRound className="w-5 h-5 text-amber-500" />
              Reset Password for {resetTarget?.name || resetTarget?.username}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Enter a new password for username <strong>{resetTarget?.username}</strong>.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <label className="text-xs font-bold text-slate-700">New Password:</label>
            <Input
              type="password"
              placeholder="Enter new password (min 4 chars)"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              className="h-10 text-sm"
            />
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setResetTarget(null)}>Cancel</Button>
            <Button
              size="sm"
              disabled={isResetting || newPassword.length < 4}
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
            <AlertDialogDescription className="text-xs text-slate-500">
              This action will permanently delete user <strong>{deleteTarget?.name || deleteTarget?.username}</strong>. This cannot be undone.
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
