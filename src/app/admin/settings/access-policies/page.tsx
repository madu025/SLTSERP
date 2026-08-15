"use client";

import {  useState, useMemo  } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ShieldCheck, Save, Loader2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { SIDEBAR_MENU, MenuItem } from '@/config/sidebar-menu';
import { ROLE_GROUPS } from '@/config/roles';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Checkbox } from '@/components/ui/checkbox';

const allRolesSet = new Set<string>();
Object.values(ROLE_GROUPS).forEach(roles => roles.forEach(r => allRolesSet.add(r)));
['CONTRACTOR_SUPERVISOR', 'CONTRACTOR_TECHNICIAN', 'CONTRACTOR_FINANCE', 'CONTRACTOR'].forEach(r => allRolesSet.add(r));
const ALL_ROLES_ARRAY = Array.from(allRolesSet).sort();

// Flattens the sidebar menu to extract all items with a permissionId
function extractPermissionItems(items: MenuItem[]): { id: string; title: string; defaultRoles: string[] }[] {
    const list: { id: string; title: string; defaultRoles: string[] }[] = [];
    items.forEach(item => {
        if (item.permissionId && !list.some(l => l.id === item.permissionId)) {
            list.push({ id: item.permissionId, title: item.title, defaultRoles: item.allowedRoles });
        }
        if (item.submenu) {
            item.submenu.forEach(sub => {
                const subId = sub.permissionId || item.permissionId;
                if (subId && !list.some(l => l.id === subId)) {
                    list.push({ id: subId, title: sub.title, defaultRoles: sub.allowedRoles });
                }
            });
        }
    });
    return list;
}

export default function AccessPoliciesPage() {
    const queryClient = useQueryClient();
    const [policies, setPolicies] = useState<Record<string, string[]>>({});

    const permissionItems = useMemo(() => extractPermissionItems(SIDEBAR_MENU), []);
    const availableRoles = ALL_ROLES_ARRAY;

    const { data: serverPolicies, isLoading } = useQuery<Record<string, string[]>>({
        queryKey: ['PAGE_ACCESS_POLICIES'],
        queryFn: async () => {
            const res = await fetch('/api/admin/access-policies');
            if (!res.ok) throw new Error('Failed to fetch policies');
            return res.json();
        }
    });

    const [prevServerPolicies, setPrevServerPolicies] = useState<Record<string, string[]> | undefined>(undefined);
    if (serverPolicies !== prevServerPolicies) {
        setPrevServerPolicies(serverPolicies);
        if (serverPolicies) {
            setPolicies(serverPolicies);
        } else {
            const defaults: Record<string, string[]> = {};
            permissionItems.forEach(item => {
                defaults[item.id] = item.defaultRoles;
            });
            setPolicies(defaults);
        }
    }

    const mutation = useMutation({
        mutationFn: async (updatedPolicies: Record<string, string[]>) => {
            const res = await fetch('/api/admin/access-policies', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ policies: updatedPolicies })
            });
            if (!res.ok) throw new Error('Failed to save policies');
            return res.json();
        },
        onSuccess: () => {
            toast.success("Access policies updated successfully");
            queryClient.invalidateQueries({ queryKey: ['PAGE_ACCESS_POLICIES'] });
        },
        onError: () => {
            toast.error("Failed to update access policies");
        }
    });

    const handleToggleRole = (permissionId: string, role: string, checked: boolean) => {
        setPolicies(prev => {
            const currentRoles = prev[permissionId] || [];
            if (checked && !currentRoles.includes(role)) {
                return { ...prev, [permissionId]: [...currentRoles, role] };
            } else if (!checked && currentRoles.includes(role)) {
                return { ...prev, [permissionId]: currentRoles.filter(r => r !== role) };
            }
            return prev;
        });
    };

    const handleSave = () => {
        mutation.mutate(policies);
    };

    if (isLoading) {
        return <div className="p-8 flex justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
    }

    return (
        <div className="p-6 space-y-6 max-w-7xl mx-auto">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
                        <ShieldCheck className="h-6 w-6 text-primary" />
                        Dynamic Page Access Policies
                    </h1>
                    <p className="text-muted-foreground mt-1 text-sm">
                        Configure which roles have access to specific modules and pages across the system. 
                        These dynamic settings override the hardcoded defaults in real-time without requiring code changes.
                    </p>
                </div>
                <Button onClick={handleSave} disabled={mutation.isPending} className="gap-2 shadow-sm font-semibold">
                    {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    Save Policies
                </Button>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex gap-3 text-amber-800 text-sm">
                <AlertTriangle className="h-5 w-5 shrink-0" />
                <p>
                    <strong>Warning:</strong> Removing critical roles (like SUPER_ADMIN or ADMIN) from core modules may result in irreversible lockouts. 
                    Changes are applied immediately globally across all active user sessions.
                </p>
            </div>

            <div className="grid grid-cols-1 gap-6">
                {permissionItems.map((item) => (
                    <Card key={item.id} className="shadow-sm border-slate-200/60 overflow-hidden">
                        <CardHeader className="bg-slate-50/50 border-b border-slate-100 py-3">
                            <CardTitle className="text-base flex items-center justify-between">
                                <span>{item.title} Module</span>
                                <span className="text-xs font-normal text-muted-foreground bg-slate-100 px-2 py-1 rounded-md border border-slate-200 font-mono">
                                    ID: {item.id}
                                </span>
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-4">
                            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-y-3 gap-x-4">
                                {availableRoles.map(role => {
                                    const isSelected = (policies[item.id] || []).includes(role) || (policies[item.id] || []).includes('ALL');
                                    
                                    // Make Super Admin always checked and disabled to prevent lockout
                                    const isSuperAdmin = role === 'SUPER_ADMIN';
                                    const isAll = role === 'ALL';

                                    return (
                                        <div key={role} className="flex items-center space-x-2">
                                            <Checkbox 
                                                id={`${item.id}-${role}`} 
                                                checked={isSuperAdmin ? true : isSelected}
                                                disabled={isSuperAdmin}
                                                onCheckedChange={(checked) => handleToggleRole(item.id, role, !!checked)}
                                                className="data-[state=checked]:bg-primary"
                                            />
                                            <label 
                                                htmlFor={`${item.id}-${role}`} 
                                                className={`text-xs font-medium leading-none cursor-pointer hover:text-primary transition-colors ${isSuperAdmin ? 'opacity-50 cursor-not-allowed' : ''}`}
                                            >
                                                {isAll ? 'Allow ALL Roles' : role.replace(/_/g, ' ')}
                                            </label>
                                        </div>
                                    );
                                })}
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
    );
}
