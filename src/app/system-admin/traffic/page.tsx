'use client';

import { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Activity, ShieldAlert, ShieldCheck, RefreshCw } from 'lucide-react';
import { toast } from "sonner";

export default function TrafficInspectorPage() {
    const [traffic, setTraffic] = useState<{ identifier: string; hits: number; ttl: number }[]>([]);
    const [blocked, setBlocked] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchData = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/system/traffic?_t=${Date.now()}`, { cache: 'no-store' });
            const data = await res.json();
            if (data.success) {
                setTraffic(data.traffic || []);
                setBlocked(data.blocked || []);
            }
        } catch (error) {
            console.error('Failed to load traffic data', error);
            toast.error('Failed to load traffic data');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, 10000); // Auto-refresh every 10s
        return () => clearInterval(interval);
    }, []);

    const handleAction = async (identifier: string, action: 'BLOCK' | 'UNBLOCK') => {
        try {
            const res = await fetch('/api/system/traffic/block', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ identifier, action })
            });
            const data = await res.json();
            if (data.success) {
                toast.success(data.message);
                fetchData(); // Reload
            } else {
                toast.error(data.error?.message || 'Action failed');
            }
        } catch (error) {
            console.error('Failed action', error);
            toast.error('Failed to perform action');
        }
    };

    return (
        <div className="p-6 space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold flex items-center gap-2">
                    <Activity className="w-6 h-6 text-blue-600" />
                    Traffic Inspector & Rate Limiting
                </h1>
                <Button onClick={fetchData} variant="outline" disabled={loading}>
                    <RefreshCw className={`w-4 h-4 mr-2 \${loading ? 'animate-spin' : ''}`} />
                    Refresh
                </Button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card className="lg:col-span-2 shadow-sm border-blue-100">
                    <CardHeader className="bg-blue-50/50 border-b pb-4">
                        <CardTitle className="text-lg flex items-center gap-2">
                            Live API Traffic (ratelimit:*)
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Identifier (IP / User ID)</TableHead>
                                    <TableHead className="text-right">Hits</TableHead>
                                    <TableHead className="text-right">Reset In (s)</TableHead>
                                    <TableHead className="text-right">Action</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {traffic.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={4} className="text-center text-slate-500 py-6">
                                            No active traffic tracked in Redis.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    traffic.map((t) => (
                                        <TableRow key={t.identifier}>
                                            <TableCell className="font-medium font-mono text-xs">
                                                {t.identifier}
                                                {blocked.includes(t.identifier) && (
                                                    <Badge variant="destructive" className="ml-2">BLOCKED</Badge>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-right font-bold text-slate-700">
                                                {t.hits}
                                            </TableCell>
                                            <TableCell className="text-right text-slate-500">
                                                {t.ttl > 0 ? `\${t.ttl}s` : 'Expired'}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                {!blocked.includes(t.identifier) && (
                                                    <Button 
                                                        variant="destructive" 
                                                        size="sm"
                                                        onClick={() => handleAction(t.identifier, 'BLOCK')}
                                                    >
                                                        <ShieldAlert className="w-4 h-4 mr-1" /> Block
                                                    </Button>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>

                <Card className="shadow-sm border-red-100">
                    <CardHeader className="bg-red-50/50 border-b pb-4">
                        <CardTitle className="text-lg text-red-700 flex items-center gap-2">
                            <ShieldAlert className="w-5 h-5" />
                            Blacklisted Entities
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Identifier</TableHead>
                                    <TableHead className="text-right">Action</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {blocked.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={2} className="text-center text-slate-500 py-6">
                                            Blacklist is empty.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    blocked.map((id) => (
                                        <TableRow key={id}>
                                            <TableCell className="font-mono text-xs text-red-600 font-medium">
                                                {id}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <Button 
                                                    variant="outline" 
                                                    size="sm"
                                                    className="border-green-200 text-green-700 hover:bg-green-50"
                                                    onClick={() => handleAction(id, 'UNBLOCK')}
                                                >
                                                    <ShieldCheck className="w-4 h-4 mr-1" /> Unblock
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
