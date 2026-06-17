import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Cpu, Plus, ShieldCheck, Tag, Info } from 'lucide-react';
import { format } from 'date-fns';

interface Project {
    id: string;
}

interface Asset {
    id: string;
    name: string;
    serialNumber: string;
    status: string;
    warrantyMonths: number;
    date: string;
}

interface ProjectCommissioningProps {
    project: Project;
}

export default function ProjectCommissioning({ project }: ProjectCommissioningProps) {
    const [assets, setAssets] = useState<Asset[]>([]);
    const [loading, setLoading] = useState(true);
    const [isOpen, setIsOpen] = useState(false);

    // Form State
    const [name, setName] = useState('');
    const [serialNumber, setSerialNumber] = useState('');
    const [warrantyMonths, setWarrantyMonths] = useState('12');
    const [status, setStatus] = useState('COMMISSIONED');

    useEffect(() => {
        fetchAssets();
    }, [project.id]);

    const fetchAssets = async () => {
        try {
            setLoading(true);
            const res = await fetch(`/api/projects/${project.id}/commissioning`);
            if (res.ok) {
                const data = await res.json();
                setAssets(data);
            }
        } catch (error) {
            console.error('Error fetching commissioned assets:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleCommission = async () => {
        if (!name || !serialNumber) {
            alert('Asset Name and Serial Number are required');
            return;
        }

        try {
            const res = await fetch(`/api/projects/${project.id}/commissioning`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name,
                    serialNumber,
                    warrantyMonths: Number(warrantyMonths),
                    status
                })
            });

            if (res.ok) {
                setIsOpen(false);
                setName('');
                setSerialNumber('');
                fetchAssets();
            } else {
                alert('Failed to commission asset');
            }
        } catch (error) {
            console.error('Error commissioning asset:', error);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h3 className="text-lg font-semibold text-slate-900">Asset Commissioning & Handover</h3>
                    <p className="text-sm text-slate-500">Log serial numbers and warranties of telecom hardware deployed during construction.</p>
                </div>
                <Button onClick={() => setIsOpen(true)} className="gap-2">
                    <Plus className="w-4 h-4" /> Commission Asset
                </Button>
            </div>

            {loading ? (
                <div className="text-center py-12 text-slate-500">Loading commissioned assets...</div>
            ) : assets.length === 0 ? (
                <Card className="border-dashed border-2">
                    <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                        <Cpu className="w-12 h-12 text-slate-350 mb-3" />
                        <h4 className="font-semibold text-slate-700">No Assets Commissioned</h4>
                        <p className="text-xs text-slate-500 max-w-sm mt-1">Register serial keys and warranties for splitter nodes and client ONT gear before project sign-off.</p>
                    </CardContent>
                </Card>
            ) : (
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    <table className="min-w-full divide-y divide-slate-200">
                        <thead className="bg-slate-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Asset Deployed</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Serial Number</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Warranty Period</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Status</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Commissioned Date</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-slate-100">
                            {assets.map((asset) => (
                                <tr key={asset.id} className="hover:bg-slate-50/50">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2">
                                            <Cpu className="w-4.5 h-4.5 text-blue-500" />
                                            <span className="text-sm font-semibold text-slate-900">{asset.name}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 font-mono text-xs text-slate-700">
                                        {asset.serialNumber}
                                    </td>
                                    <td className="px-6 py-4 text-sm text-slate-650">
                                        {asset.warrantyMonths} Months
                                    </td>
                                    <td className="px-6 py-4">
                                        <Badge className={asset.status === 'VERIFIED' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}>
                                            {asset.status}
                                        </Badge>
                                    </td>
                                    <td className="px-6 py-4 text-sm text-slate-505">
                                        {format(new Date(asset.date), 'MMM dd, yyyy')}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Commission Asset Dialog */}
            <Dialog open={isOpen} onOpenChange={setIsOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Commission Asset</DialogTitle>
                        <DialogDescription>Register serial numbers and warranty intervals to create database assets.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-3">
                        <div className="space-y-2">
                            <Label>Asset Name / Model *</Label>
                            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. ONT GPON Client Unit" />
                        </div>
                        <div className="space-y-2">
                            <Label>Serial Key / Barcode *</Label>
                            <Input value={serialNumber} onChange={(e) => setSerialNumber(e.target.value)} placeholder="e.g. ONT-5534-112" />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Warranty Period (Months)</Label>
                                <Input type="number" value={warrantyMonths} onChange={(e) => setWarrantyMonths(e.target.value)} />
                            </div>
                            <div className="space-y-2">
                                <Label>Commissioning State</Label>
                                <Select value={status} onValueChange={setStatus}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="COMMISSIONED">Commissioned (Pending verify)</SelectItem>
                                        <SelectItem value="VERIFIED">Verified (Ready for Handover)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <DialogFooter className="pt-4">
                            <Button variant="outline" onClick={() => setIsOpen(false)}>Cancel</Button>
                            <Button onClick={handleCommission}>Register Asset</Button>
                        </DialogFooter>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
