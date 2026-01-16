"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash, Building2, MapPin, User } from "lucide-react";
import { toast } from "sonner";
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';

interface Store {
    id: string;
    name: string;
    type: string;
    location?: string;
    manager?: { id: string; name: string; email: string };
    opmcs: Array<{ id: string; name: string; rtom: string }>;
}

interface OPMC {
    id: string;
    name: string;
    rtom: string;
}

export default function StoresPage() {
    const queryClient = useQueryClient();
    const [showModal, setShowModal] = useState(false);
    const [selectedStore, setSelectedStore] = useState<Store | null>(null);
    const [searchTerm, setSearchTerm] = useState("");

    // Form state
    const [formData, setFormData] = useState({
        name: "",
        type: "SUB",
        location: "",
        managerId: "NONE",
        opmcIds: [] as string[]
    });

    // Fetch stores
    const { data: stores = [], isLoading } = useQuery<Store[]>({
        queryKey: ["stores"],
        queryFn: async () => {
            const res = await fetch("/api/stores");
            if (!res.ok) throw new Error("Failed to fetch stores");
            return res.json();
        }
    });

    // Fetch OPMCs
    const { data: opmcs = [] } = useQuery<OPMC[]>({
        queryKey: ["opmcs"],
        queryFn: async () => {
            const res = await fetch("/api/opmcs");
            if (!res.ok) throw new Error("Failed to fetch opmcs");
            const data = await res.json();
            return Array.isArray(data) ? data : [];
        }
    });

    // Fetch users for manager selection
    const { data: users = [] } = useQuery({
        queryKey: ["users"],
        queryFn: async () => {
            const res = await fetch("/api/users?page=1&limit=1000");
            const data = await res.json();
            return data.users || [];
        }
    });

    // Create/Update mutation
    const saveMutation = useMutation({
        mutationFn: async (data: any) => {
            const url = selectedStore ? `/api/stores/${selectedStore.id}` : "/api/stores";
            const method = selectedStore ? "PUT" : "POST";
            const res = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data)
            });
            if (!res.ok) throw new Error("Failed to save store");
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["stores"] });
            toast.success(selectedStore ? "Store updated" : "Store created");
            setShowModal(false);
            resetForm();
        },
        onError: () => {
            toast.error("Failed to save store");
        }
    });

    // Delete mutation
    const deleteMutation = useMutation({
        mutationFn: async (id: string) => {
            const res = await fetch(`/api/stores/${id}`, { method: "DELETE" });
            if (!res.ok) throw new Error("Failed to delete");
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["stores"] });
            toast.success("Store deleted");
        },
        onError: () => {
            toast.error("Failed to delete store");
        }
    });

    const resetForm = () => {
        setFormData({ name: "", type: "SUB", location: "", managerId: "NONE", opmcIds: [] });
        setSelectedStore(null);
    };

    const handleEdit = (store: Store) => {
        setSelectedStore(store);
        setFormData({
            name: store.name,
            type: store.type,
            location: store.location || "",
            managerId: store.manager?.id || "NONE",
            opmcIds: store.opmcs?.map(o => o.id) || []
        });
        setShowModal(true);
    };

    const handleSubmit = () => {
        if (!formData.name) {
            toast.error("Store name is required");
            return;
        }

        const payload = {
            ...formData,
            managerId: formData.managerId === "NONE" || formData.managerId === "" ? null : formData.managerId
        };

        saveMutation.mutate(payload);
    };

    const toggleOPMC = (opmcId: string) => {
        setFormData(prev => ({
            ...prev,
            opmcIds: prev.opmcIds.includes(opmcId)
                ? prev.opmcIds.filter(id => id !== opmcId)
                : [...prev.opmcIds, opmcId]
        }));
    };

    const filteredStores = stores.filter(store =>
        store.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        store.location?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="flex h-screen bg-slate-50 overflow-hidden">
            <Sidebar />
            <main className="flex-1 flex flex-col min-w-0 h-full">
                <Header />
                <div className="flex-1 overflow-y-auto p-4 md:p-8">
                    <div className="max-w-7xl mx-auto">
                        {/* Header */}
                        <div className="flex justify-between items-center mb-6">
                            <div>
                                <h1 className="text-3xl font-bold text-slate-800">Stores Management</h1>
                                <p className="text-slate-500 mt-1">Manage inventory stores and RTOM assignments</p>
                            </div>
                            <Button onClick={() => { resetForm(); setShowModal(true); }}>
                                <Plus className="w-4 h-4 mr-2" />
                                Create Store
                            </Button>
                        </div>

                        {/* Search */}
                        <div className="mb-6">
                            <Input
                                placeholder="Search stores..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="max-w-md"
                            />
                        </div>

                        {/* Stores Grid */}
                        {isLoading ? (
                            <div className="text-center py-12">Loading...</div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {filteredStores.map((store) => (
                                    <Card key={store.id} className="hover:shadow-lg transition-shadow">
                                        <CardContent className="p-6">
                                            <div className="flex justify-between items-start mb-4">
                                                <div>
                                                    <h3 className="text-lg font-bold text-slate-800">{store.name}</h3>
                                                    <Badge variant="outline" className="mt-1">{store.type}</Badge>
                                                </div>
                                                <div className="flex gap-2">
                                                    <Button variant="ghost" size="sm" onClick={() => handleEdit(store)}>
                                                        <Pencil className="w-4 h-4" />
                                                    </Button>
                                                    <Button variant="ghost" size="sm" onClick={() => deleteMutation.mutate(store.id)}>
                                                        <Trash className="w-4 h-4 text-red-500" />
                                                    </Button>
                                                </div>
                                            </div>

                                            <div className="space-y-2 text-sm">
                                                {store.location && (
                                                    <div className="flex items-center gap-2 text-slate-600">
                                                        <MapPin className="w-4 h-4" />
                                                        {store.location}
                                                    </div>
                                                )}
                                                {store.manager && (
                                                    <div className="flex items-center gap-2 text-slate-600">
                                                        <User className="w-4 h-4" />
                                                        {store.manager.name}
                                                    </div>
                                                )}
                                                <div className="flex items-start gap-2 text-slate-600">
                                                    <Building2 className="w-4 h-4 mt-0.5" />
                                                    <div>
                                                        <div className="font-medium">RTOMs ({store.opmcs?.length || 0})</div>
                                                        <div className="text-xs mt-1">
                                                            {store.opmcs?.map(o => o.name).join(", ") || "No RTOMs assigned"}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        )}

                        {/* Modal */}
                        <Dialog open={showModal} onOpenChange={setShowModal}>
                            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                                <DialogHeader>
                                    <DialogTitle>{selectedStore ? "Edit Store" : "Create New Store"}</DialogTitle>
                                    <DialogDescription>Manage store details and RTOM assignments</DialogDescription>
                                </DialogHeader>

                                <div className="space-y-4 mt-4">
                                    {/* Store Name */}
                                    <div>
                                        <Label>Store Name *</Label>
                                        <Input
                                            value={formData.name}
                                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                            placeholder="e.g., Kaduwela Store"
                                        />
                                    </div>

                                    {/* Type */}
                                    <div>
                                        <Label>Type</Label>
                                        <Select value={formData.type} onValueChange={(v) => setFormData({ ...formData, type: v })}>
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="MAIN">MAIN</SelectItem>
                                                <SelectItem value="SUB">SUB</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    {/* Location */}
                                    <div>
                                        <Label>Location</Label>
                                        <Input
                                            value={formData.location}
                                            onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                                            placeholder="e.g., Kaduwela, Colombo"
                                        />
                                    </div>

                                    {/* Manager */}
                                    <div>
                                        <Label>Manager</Label>
                                        <Select value={formData.managerId} onValueChange={(v) => setFormData({ ...formData, managerId: v })}>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select manager..." />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="NONE">None</SelectItem>
                                                {users.map((user: any) => (
                                                    <SelectItem key={user.id} value={user.id}>
                                                        {user.name} ({user.email})
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    {/* RTOMs */}
                                    <div>
                                        <Label>Assigned RTOMs</Label>
                                        <div className="border rounded-lg p-4 max-h-60 overflow-y-auto mt-2">
                                            {opmcs.map((opmc) => (
                                                <div key={opmc.id} className="flex items-center gap-2 py-2">
                                                    <input
                                                        type="checkbox"
                                                        checked={formData.opmcIds.includes(opmc.id)}
                                                        onChange={() => toggleOPMC(opmc.id)}
                                                        className="w-4 h-4"
                                                    />
                                                    <label className="text-sm cursor-pointer" onClick={() => toggleOPMC(opmc.id)}>
                                                        {opmc.name} ({opmc.rtom})
                                                    </label>
                                                </div>
                                            ))}
                                        </div>
                                        <p className="text-xs text-slate-500 mt-1">
                                            Selected: {formData.opmcIds.length} RTOMs
                                        </p>
                                    </div>

                                    {/* Actions */}
                                    <div className="flex justify-end gap-2 pt-4">
                                        <Button variant="outline" onClick={() => setShowModal(false)}>
                                            Cancel
                                        </Button>
                                        <Button onClick={handleSubmit} disabled={saveMutation.isPending}>
                                            {saveMutation.isPending ? "Saving..." : "Save Store"}
                                        </Button>
                                    </div>
                                </div>
                            </DialogContent>
                        </Dialog>
                    </div>
                </div>
            </main>
        </div>
    );
}
