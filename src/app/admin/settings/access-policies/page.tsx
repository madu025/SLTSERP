"use client";

import { useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import RoleGuard from '@/components/RoleGuard';
import { RBAC_PERMISSIONS, RBAC_PERMISSION_DEFINITIONS } from '@/config/rbac-permissions';
import { ShieldCheck, LockKeyhole } from 'lucide-react';

type PermissionDefinition = (typeof RBAC_PERMISSION_DEFINITIONS)[number];

interface PermissionModule {
    module: string;
    permissions: PermissionDefinition[];
}

function groupPermissionsByModule(): PermissionModule[] {
    const grouped = new Map<string, PermissionDefinition[]>();

    for (const definition of RBAC_PERMISSION_DEFINITIONS) {
        const modulePermissions = grouped.get(definition.module) ?? [];
        modulePermissions.push(definition);
        grouped.set(definition.module, modulePermissions);
    }

    return Array.from(grouped, ([module, permissions]) => ({ module, permissions }));
}

export default function AccessPoliciesPage() {
    const modules = useMemo(() => groupPermissionsByModule(), []);

    return (
        <RoleGuard permissionId={RBAC_PERMISSIONS.ADMIN_RBAC}>
            <div className="min-h-full bg-slate-50 p-6">
                <div className="mx-auto max-w-7xl space-y-6">
                    <header className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                            <div>
                                <div className="mb-2 flex items-center gap-2">
                                    <ShieldCheck className="h-6 w-6 text-blue-700" aria-hidden="true" />
                                    <Badge className="bg-blue-50 text-blue-800 hover:bg-blue-50">
                                        Canonical authorization
                                    </Badge>
                                </div>
                                <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                                    Capability Registry
                                </h1>
                                <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-700">
                                    These are the stable capability IDs used by API guards, server actions,
                                    and page access checks. A capability describes what a user may do; data
                                    scope is enforced separately by the server.
                                </p>
                            </div>
                            <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800">
                                <LockKeyhole className="h-4 w-4" aria-hidden="true" />
                                Read-only registry
                            </div>
                        </div>
                    </header>

                    <section
                        aria-labelledby="permission-model-heading"
                        className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950"
                    >
                        <h2 id="permission-model-heading" className="font-bold text-amber-950">
                            How grants work
                        </h2>
                        <p className="mt-1 leading-6">
                            Access is granted through the database relationship{' '}
                            <code className="rounded bg-amber-100 px-1 font-mono text-xs text-amber-950">
                                SystemRole -&gt; RolePermission -&gt; PermissionDefinition
                            </code>
                            . This page intentionally does not edit role-name arrays or legacy page-policy
                            settings. Use the canonical role-permission administration flow for audited grants.
                        </p>
                    </section>

                    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                        {modules.map(({ module, permissions }) => (
                            <Card key={module} className="overflow-hidden border-slate-200 shadow-sm">
                                <CardHeader className="border-b border-slate-200 bg-slate-100">
                                    <div className="flex items-start justify-between gap-4">
                                        <div>
                                            <CardTitle className="text-base text-slate-900">{module}</CardTitle>
                                            <CardDescription className="mt-1 text-slate-700">
                                                {permissions.length} canonical {permissions.length === 1 ? 'capability' : 'capabilities'}
                                            </CardDescription>
                                        </div>
                                        <Badge variant="outline" className="border-slate-300 bg-white font-mono text-xs text-slate-800">
                                            {module}
                                        </Badge>
                                    </div>
                                </CardHeader>
                                <CardContent className="space-y-3 p-4">
                                    {permissions.map((permission) => (
                                        <div
                                            key={permission.code}
                                            className="rounded-lg border border-slate-200 bg-white p-3"
                                        >
                                            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                                <code className="break-all font-mono text-sm font-semibold text-blue-800">
                                                    {permission.code}
                                                </code>
                                                <div className="flex shrink-0 flex-wrap gap-2">
                                                    <Badge variant="outline" className="border-slate-300 text-slate-800">
                                                        {permission.action}
                                                    </Badge>
                                                    <Badge variant="outline" className="border-slate-300 text-slate-800">
                                                        {permission.scope}
                                                    </Badge>
                                                </div>
                                            </div>
                                            <p className="mt-2 text-sm leading-5 text-slate-700">
                                                {permission.description}
                                            </p>
                                        </div>
                                    ))}
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </div>
            </div>
        </RoleGuard>
    );
}
