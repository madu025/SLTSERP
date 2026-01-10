"use client";

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, Info, Bell, Loader2 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface AlertItem {
    type: 'LOW_STOCK' | 'PENDING_RETURN' | 'OTHER';
    message: string;
    severity: 'HIGH' | 'MEDIUM' | 'LOW';
    storeId?: string;
    itemId?: string;
    returnId?: string;
}

export default function InventoryAlerts() {
    const { data: data, isLoading } = useQuery<{ alerts: AlertItem[] }>({
        queryKey: ['dashboard-alerts'],
        queryFn: async () => {
            const res = await fetch('/api/dashboard/alerts');
            if (!res.ok) throw new Error("Failed");
            return res.json();
        },
        refetchInterval: 30000 // Refresh every 30s
    });

    if (isLoading) {
        return (
            <Card className="h-full">
                <CardHeader>
                    <CardTitle className="text-lg font-medium flex items-center gap-2">
                        <Bell className="w-5 h-5" />
                        Inventory Alerts
                    </CardTitle>
                </CardHeader>
                <CardContent className="flex justify-center py-8">
                    <Loader2 className="animate-spin w-6 h-6 text-slate-400" />
                </CardContent>
            </Card>
        );
    }

    const alerts = data?.alerts || [];

    return (
        <Card className="h-full">
            <CardHeader>
                <CardTitle className="text-lg font-medium flex items-center gap-2">
                    <Bell className="w-5 h-5" />
                    Inventory Alerts ({alerts.length})
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 max-h-[300px] overflow-y-auto">
                {alerts.length === 0 ? (
                    <div className="text-center py-8 text-slate-400 text-sm">
                        No alerts at the moment.
                    </div>
                ) : (
                    alerts.map((alert, idx) => (
                        <Alert key={idx} variant={alert.severity === 'HIGH' ? 'destructive' : 'default'} className={alert.severity === 'MEDIUM' ? 'border-amber-500 bg-amber-50' : ''}>
                            {alert.severity === 'HIGH' ? <AlertTriangle className="h-4 w-4" /> : <Info className="h-4 w-4" />}
                            <AlertTitle className="text-sm font-semibold mb-1">
                                {alert.type === 'LOW_STOCK' ? 'Low Stock Warning' : 'Action Required'}
                            </AlertTitle>
                            <AlertDescription className="text-xs">
                                {alert.message}
                            </AlertDescription>
                        </Alert>
                    ))
                )}
            </CardContent>
        </Card>
    );
}
