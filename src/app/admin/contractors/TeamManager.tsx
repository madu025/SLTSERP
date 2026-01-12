'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Users, Plus, Trash, CheckCircle, ShieldAlert, FileText, MapPin, ExternalLink, Shirt, Footprints, LayoutGrid } from "lucide-react";
import { toast } from 'sonner';
import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";

interface TeamManagerProps {
    isOpen: boolean;
    onClose: () => void;
    contractorId: string;
    contractorName: string;
}

export default function TeamManager({ isOpen, onClose, contractorId, contractorName }: TeamManagerProps) {
    const [teams, setTeams] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [stores, setStores] = useState<any[]>([]);
    const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});

    // Selection State for Master-Detail View
    const [selectedTeamIndex, setSelectedTeamIndex] = useState<number | null>(null);

    const [contractorDetails, setContractorDetails] = useState<any>(null);
    const [useContractorDetails, setUseContractorDetails] = useState(false);

    // Initial Load
    useEffect(() => {
        if (isOpen && contractorId) {
            loadData();
        }
    }, [isOpen, contractorId]);

    const loadData = async () => {
        setLoading(true);
        try {
            const [data, storesData] = await Promise.all([
                fetch(`/api/contractors/${contractorId}/teams`).then(res => res.json()),
                fetch('/api/inventory/stores').then(res => res.json())
            ]);

            // Handle new response structure { teams, contractor }
            const loadedTeams = data.teams && Array.isArray(data.teams) ? data.teams : (Array.isArray(data) ? data : []);
            setTeams(loadedTeams);
            if (data.contractor) {
                setContractorDetails(data.contractor);
            }

            setStores(Array.isArray(storesData) ? storesData : []);

            // Auto-select first team if available
            if (loadedTeams.length > 0) setSelectedTeamIndex(0);
            else setSelectedTeamIndex(null);

        } catch (err) {
            console.error(err);
            toast.error("Failed to load data");
        } finally {
            setLoading(false);
        }
    };

    // --- ACTIONS ---

    const handleSave = async () => {
        try {
            setLoading(true);
            const res = await fetch(`/api/contractors/${contractorId}/teams`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ teams })
            });

            if (!res.ok) {
                const errData = await res.json();
                console.error("Save Error Details:", errData);
                throw new Error(errData.error || "Failed to save");
            }

            toast.success("All changes saved.");
            onClose();
        } catch (err: any) {
            console.error(err);
            toast.error(err.message || "Failed to save changes");
        } finally {
            setLoading(false);
        }
    };

    const addTeam = () => {
        const newTeam = {
            id: `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            name: `Team ${teams.length + 1}`,
            status: 'ACTIVE',
            members: [],
            storeAssignments: []
        };
        const updatedTeams = [...teams, newTeam];
        setTeams(updatedTeams);
        setSelectedTeamIndex(updatedTeams.length - 1); // Select the new team
    };

    const removeTeam = (idx: number) => {
        const newTeams = [...teams];
        newTeams.splice(idx, 1);
        setTeams(newTeams);
        // Adjust selection
        if (newTeams.length === 0) setSelectedTeamIndex(null);
        else if (idx === selectedTeamIndex) setSelectedTeamIndex(0);
        else if (selectedTeamIndex && idx < selectedTeamIndex) setSelectedTeamIndex(selectedTeamIndex - 1);
    };

    const updateCurrentTeam = (field: string, value: any) => {
        if (selectedTeamIndex === null) return;
        const newTeams = [...teams];
        newTeams[selectedTeamIndex] = { ...newTeams[selectedTeamIndex], [field]: value };
        setTeams(newTeams);
    };

    // --- STORE ASSIGNMENT ---

    const toggleStore = (storeId: string) => {
        if (selectedTeamIndex === null) return;
        const team = teams[selectedTeamIndex];
        const currentAssignments = team.storeAssignments || [];
        const exists = currentAssignments.find((a: any) => a.storeId === storeId);

        let newAssignments;
        if (exists) {
            newAssignments = currentAssignments.filter((a: any) => a.storeId !== storeId);
        } else {
            newAssignments = [...currentAssignments, { storeId, isPrimary: currentAssignments.length === 0 }];
        }
        updateCurrentTeam('storeAssignments', newAssignments);
    };

    const setPrimaryStore = (storeId: string) => {
        if (selectedTeamIndex === null) return;
        const team = teams[selectedTeamIndex];
        const newAssignments = (team.storeAssignments || []).map((a: any) => ({
            ...a,
            isPrimary: a.storeId === storeId
        }));
        updateCurrentTeam('storeAssignments', newAssignments);
    };

    // --- MEMBERS ---

    const addMember = () => {
        if (selectedTeamIndex === null) return;
        const newTeams = [...teams];
        if (!newTeams[selectedTeamIndex].members) newTeams[selectedTeamIndex].members = [];

        let newMember = {
            id: `mem-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            name: '',
            nic: '',
            idCopyNumber: '',
            contactNumber: '',
            address: '',
            shoeSize: '',
            tshirtSize: '',
            photoUrl: '',
            nicUrl: '',
            policeReportUrl: '',
            gramaCertUrl: '',
            passportPhotoUrl: ''
        };

        if (useContractorDetails && contractorDetails) {
            newMember = {
                ...newMember,
                name: contractorDetails.name || '',
                nic: contractorDetails.nic || '',
                idCopyNumber: contractorDetails.nic || '',
                contactNumber: contractorDetails.contactNumber || '',
                address: contractorDetails.address || '',
                photoUrl: contractorDetails.photoUrl || '',
                nicUrl: contractorDetails.nicFrontUrl || '', // Using front URL as primary NIC
                policeReportUrl: contractorDetails.policeReportUrl || '',
                gramaCertUrl: contractorDetails.gramaCertUrl || ''
            };
            toast.success("Added Member with Contractor Details");
        }

        newTeams[selectedTeamIndex].members.push(newMember);
        setTeams(newTeams);
    };

    const updateMember = (memberIdx: number, field: string, value: any) => {
        if (selectedTeamIndex === null) return;
        const newTeams = [...teams];
        newTeams[selectedTeamIndex].members[memberIdx][field] = value;
        setTeams(newTeams);
    };

    const removeMember = (memberIdx: number) => {
        if (selectedTeamIndex === null) return;
        const newTeams = [...teams];
        newTeams[selectedTeamIndex].members.splice(memberIdx, 1);
        setTeams(newTeams);
    };

    const uploadFile = async (e: React.ChangeEvent<HTMLInputElement>, fieldName: string) => {
        if (!e.target.files?.[0]) return null;
        const file = e.target.files[0];
        const formData = new FormData();
        formData.append('file', file);

        return new Promise<string | null>((resolve) => {
            const xhr = new XMLHttpRequest();
            xhr.open('POST', '/api/upload', true);

            xhr.upload.onprogress = (event) => {
                if (event.lengthComputable) {
                    const percentComplete = Math.round((event.loaded / event.total) * 100);
                    setUploadProgress(prev => ({ ...prev, [fieldName]: percentComplete }));
                }
            };

            xhr.onload = () => {
                if (xhr.status === 200) {
                    const response = JSON.parse(xhr.responseText);
                    setUploadProgress(prev => {
                        const next = { ...prev };
                        delete next[fieldName];
                        return next;
                    });
                    resolve(response.url);
                } else {
                    toast.error("Upload failed");
                    setUploadProgress(prev => {
                        const next = { ...prev };
                        delete next[fieldName];
                        return next;
                    });
                    resolve(null);
                }
            };

            xhr.onerror = () => {
                toast.error("Network error");
                setUploadProgress(prev => {
                    const next = { ...prev };
                    delete next[fieldName];
                    return next;
                });
                resolve(null);
            };

            xhr.send(formData);
        });
    };

    const generateMemberLink = async (memberId: string) => {
        if (!memberId || memberId.startsWith('mem-')) {
            toast.error("Please save changes first to generate a link.");
            return;
        }
        try {
            const res = await fetch('/api/team-members/generate-link', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ memberId })
            });
            if (!res.ok) throw new Error("Failed");
            const data = await res.json();
            await navigator.clipboard.writeText(data.link);
            toast.success("Link copied!");
        } catch (err) {
            toast.error("Failed to generate link");
        }
    };

    // --- RENDER ---

    const currentTeam = selectedTeamIndex !== null ? teams[selectedTeamIndex] : null;

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            {/* FORCE WIDTH: max-w-none removes default limit, w-[95vw] sets intended width */}
            <DialogContent className="max-w-none w-[98vw] sm:w-[95vw] h-[98vh] sm:h-[95vh] flex flex-col p-0 gap-0 overflow-hidden bg-slate-50 sm:max-w-none">
                {/* Compact Header */}
                <div className="px-4 py-3 border-b bg-white flex justify-between items-center shrink-0 h-14">
                    <div className="flex items-center gap-3">
                        <DialogTitle className="text-lg font-bold text-slate-800">Team Management</DialogTitle>
                        <Separator orientation="vertical" className="h-4" />
                        <DialogDescription className="text-xs text-slate-500 m-0">{contractorName}</DialogDescription>
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={onClose} className="h-8">Cancel</Button>
                        <Button onClick={handleSave} size="sm" className="bg-blue-600 hover:bg-blue-700 h-8 text-xs">
                            {loading ? 'Saving...' : 'Save Changes'}
                        </Button>
                    </div>
                </div>

                <div className="flex flex-1 overflow-hidden">

                    {/* LEFT SIDEBAR: TEAM LIST (More compact row height) */}
                    <div className="w-64 bg-white border-r flex flex-col shrink-0">
                        <div className="px-3 py-2 border-b flex justify-between items-center bg-slate-50/50">
                            <h3 className="font-semibold text-xs uppercase text-slate-500 tracking-wider">Teams</h3>
                            <Button size="sm" variant="ghost" className="h-6 w-6 p-0 hover:bg-blue-50" onClick={addTeam}>
                                <Plus className="w-4 h-4 text-blue-600" />
                            </Button>
                        </div>
                        <ScrollArea className="flex-1">
                            <div className="p-2 space-y-0.5">
                                {teams.map((team, idx) => (
                                    <button
                                        key={team.id || idx}
                                        onClick={() => setSelectedTeamIndex(idx)}
                                        className={cn(
                                            "w-full text-left px-3 py-2 rounded-md text-sm font-medium transition-all flex items-center justify-between group",
                                            selectedTeamIndex === idx
                                                ? "bg-blue-50 text-blue-700 border border-blue-200"
                                                : "text-slate-600 hover:bg-slate-50 border border-transparent"
                                        )}
                                    >
                                        <div className="flex items-center gap-2 overflow-hidden">
                                            <div className={cn("w-2 h-2 rounded-full shrink-0", team.status === 'ACTIVE' ? "bg-green-500" : "bg-slate-300")} />
                                            <span className="truncate text-xs font-semibold">{team.name}</span>
                                        </div>
                                        {selectedTeamIndex === idx && <Users className="w-3 h-3 opacity-50" />}
                                    </button>
                                ))}
                            </div>
                        </ScrollArea>
                    </div>

                    {/* RIGHT CONTENT: DETAILS */}
                    <div className="flex-1 flex flex-col bg-slate-50 min-w-0 overflow-hidden">
                        {currentTeam ? (
                            <ScrollArea className="flex-1">
                                <div className="p-4 max-w-7xl mx-auto space-y-4">

                                    {/* SECTION 1: TEAM SETTINGS (Compact) */}
                                    <div className="bg-white px-4 py-3 rounded-lg border shadow-sm space-y-3">
                                        <div className="flex justify-between items-center border-b pb-2">
                                            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                                                <LayoutGrid className="w-4 h-4 text-slate-400" /> Team Details
                                            </h3>
                                            <Button variant="ghost" size="sm" className="h-6 text-red-500 hover:text-red-700 text-xs px-2" onClick={() => removeTeam(selectedTeamIndex!)}>
                                                Remove Team
                                            </Button>
                                        </div>

                                        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                                            <div className="w-full sm:w-64">
                                                <Label className="text-xs text-slate-500">Team Name</Label>
                                                <Input value={currentTeam.name} onChange={(e) => updateCurrentTeam('name', e.target.value)} className="h-8 text-sm font-medium" />
                                            </div>
                                            <div className="w-full sm:w-48">
                                                <Label className="text-xs text-slate-500 font-bold text-blue-600">SLT Code</Label>
                                                <Input
                                                    value={currentTeam.sltCode || ''}
                                                    onChange={(e) => updateCurrentTeam('sltCode', e.target.value)}
                                                    className="h-8 text-sm font-bold border-blue-200 focus:border-blue-500"
                                                    placeholder="e.g. OSP-TEAM-01"
                                                />
                                            </div>
                                            <div className="w-full sm:w-32">
                                                <Label className="text-xs text-slate-500">Status</Label>
                                                <Select value={currentTeam.status} onValueChange={(v) => updateCurrentTeam('status', v)}>
                                                    <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="ACTIVE">Active</SelectItem>
                                                        <SelectItem value="INACTIVE">Inactive</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </div>

                                        <div className="space-y-2 pt-1">
                                            <Label className="text-[10px] uppercase font-bold text-slate-400">Assigned Stores</Label>
                                            <div className="flex flex-wrap gap-2">
                                                {stores.map(store => {
                                                    const assignment = (currentTeam.storeAssignments || []).find((a: any) => a.storeId === store.id);
                                                    const isSelected = !!assignment;
                                                    const isPrimary = assignment?.isPrimary;
                                                    return (
                                                        <div key={store.id}
                                                            className={cn(
                                                                "flex items-center gap-2 px-2 py-1.5 rounded border transition-all cursor-pointer bg-white",
                                                                isSelected ? "border-blue-300 ring-1 ring-blue-100" : "border-slate-200 hover:border-slate-300"
                                                            )}
                                                            onClick={() => toggleStore(store.id)}
                                                        >
                                                            <Checkbox checked={isSelected} className="w-3.5 h-3.5 pointer-events-none" />
                                                            <span className="text-xs font-medium text-slate-700">{store.name}</span>
                                                            {isSelected && (
                                                                <button
                                                                    onClick={(e) => { e.stopPropagation(); setPrimaryStore(store.id); }}
                                                                    className={cn(
                                                                        "ml-1 text-[9px] px-1 rounded flex items-center border",
                                                                        isPrimary ? "bg-blue-600 text-white border-blue-600" : "bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200"
                                                                    )}
                                                                >
                                                                    {isPrimary ? "Pri" : "Set Pri"}
                                                                </button>
                                                            )}
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                        </div>
                                    </div>

                                    {/* SECTION 2: MEMBERS (Compact Grid) */}
                                    <div className="space-y-3">
                                        <div className="flex justify-between items-center px-1">
                                            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                                                <Users className="w-4 h-4 text-slate-400" /> Team Members
                                                <Badge variant="secondary" className="ml-2 text-[10px] h-5">{currentTeam.members?.length || 0}</Badge>
                                            </h3>
                                            <div className="flex items-center gap-3">
                                                <div className="flex items-center space-x-2 bg-white px-3 py-1.5 rounded-md border border-slate-200">
                                                    <Checkbox
                                                        id="use-contractor"
                                                        checked={useContractorDetails}
                                                        onCheckedChange={(c) => setUseContractorDetails(!!c)}
                                                    />
                                                    <Label htmlFor="use-contractor" className="text-xs font-medium cursor-pointer text-slate-600">
                                                        Add as Contractor
                                                    </Label>
                                                </div>
                                                <Button onClick={addMember} size="sm" className="h-8 text-xs bg-slate-900 text-white hover:bg-slate-800">
                                                    <Plus className="w-3 h-3 mr-1" /> Add Member
                                                </Button>
                                            </div>
                                        </div>

                                        {(!currentTeam.members || currentTeam.members.length === 0) ? (
                                            <div className="bg-white border text-center py-8 rounded-lg border-dashed">
                                                <p className="text-xs text-slate-400 mb-2">No members in this team.</p>
                                                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={addMember}>Add First Member</Button>
                                            </div>
                                        ) : (
                                            <div className="grid grid-cols-1 gap-3">
                                                {currentTeam.members.map((member: any, mIdx: number) => (
                                                    <div key={mIdx} className="bg-white rounded-lg border border-slate-200 shadow-sm p-3 relative group hover:border-blue-300">
                                                        <div className="flex justify-between items-start mb-3">
                                                            <div className="flex items-center gap-2">
                                                                <Badge variant="outline" className="bg-slate-50 text-[10px] px-1.5 h-5 text-slate-500">#{mIdx + 1}</Badge>
                                                                <span className="text-sm font-semibold text-slate-800">{member.name || "New Member"}</span>
                                                            </div>
                                                            <div className="flex gap-1">
                                                                <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-400 hover:text-blue-600" onClick={() => generateMemberLink(member.id)} title="Share">
                                                                    <ExternalLink className="w-3.5 h-3.5" />
                                                                </Button>
                                                                <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-400 hover:text-red-600" onClick={() => removeMember(mIdx)} title="Remove">
                                                                    <Trash className="w-3.5 h-3.5" />
                                                                </Button>
                                                            </div>
                                                        </div>

                                                        {/* Compact Fields Grid */}
                                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 mb-3">
                                                            <div className="sm:col-span-2 space-y-0.5"><Label className="text-[10px] text-slate-400">Name</Label><Input value={member.name} onChange={(e) => updateMember(mIdx, 'name', e.target.value)} className="h-7 text-xs" /></div>
                                                            <div className="space-y-0.5"><Label className="text-[10px] text-slate-400">NIC / ID Card</Label><Input value={member.nic || member.idCopyNumber || ''} onChange={(e) => { updateMember(mIdx, 'nic', e.target.value); updateMember(mIdx, 'idCopyNumber', e.target.value); }} className="h-7 text-xs" /></div>
                                                            <div className="space-y-0.5"><Label className="text-[10px] text-slate-400">Contact</Label><Input value={member.contactNumber} onChange={(e) => updateMember(mIdx, 'contactNumber', e.target.value)} className="h-7 text-xs" /></div>
                                                            <div className="space-y-0.5"><Label className="text-[10px] text-slate-400">Shoe</Label><Input value={member.shoeSize} onChange={(e) => updateMember(mIdx, 'shoeSize', e.target.value)} className="h-7 text-xs" placeholder="Size" /></div>
                                                            <div className="space-y-0.5"><Label className="text-[10px] text-slate-400">Shirt</Label>
                                                                <Select value={member.tshirtSize} onValueChange={(v) => updateMember(mIdx, 'tshirtSize', v)}>
                                                                    <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="-" /></SelectTrigger>
                                                                    <SelectContent>
                                                                        {['XS', 'S', 'M', 'L', 'XL', 'XXL'].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                                                                    </SelectContent>
                                                                </Select>
                                                            </div>
                                                            <div className="col-span-1 sm:col-span-2 lg:col-span-6 space-y-0.5">
                                                                <Label className="text-[10px] text-slate-400">Address</Label>
                                                                <Input value={member.address} onChange={(e) => updateMember(mIdx, 'address', e.target.value)} className="h-7 text-xs" />
                                                            </div>
                                                        </div>

                                                        {/* Compact Documents - Horizontal Row */}
                                                        <div className="bg-slate-50 rounded p-2 flex gap-2 overflow-x-auto">
                                                            {[
                                                                { label: 'Photo', field: 'photoUrl', icon: Users },
                                                                { label: 'Passport Photo', field: 'passportPhotoUrl', icon: Users },
                                                                { label: 'NIC', field: 'nicUrl', icon: ShieldAlert },
                                                                { label: 'Police Rep', field: 'policeReportUrl', icon: FileText },
                                                                { label: 'Grama Cert', field: 'gramaCertUrl', icon: MapPin },
                                                            ].map((doc, dIdx) => (
                                                                <div key={dIdx} className="shrink-0 relative group/file">
                                                                    <Input type="file" id={`f-${selectedTeamIndex}-${mIdx}-${doc.field}`} className="hidden" accept="image/*,.pdf" onChange={async (e) => {
                                                                        const fieldName = `member-${selectedTeamIndex}-${mIdx}-${doc.field}`;
                                                                        const url = await uploadFile(e, fieldName);
                                                                        if (url) updateMember(mIdx, doc.field, url);
                                                                    }} />
                                                                    <Label
                                                                        htmlFor={`f-${selectedTeamIndex}-${mIdx}-${doc.field}`}
                                                                        className={cn(
                                                                            "flex items-center gap-1.5 px-2 py-1.5 rounded border cursor-pointer transition-all bg-white min-w-[120px] relative overflow-hidden",
                                                                            member[doc.field]
                                                                                ? "bg-green-50/50 border-green-300 text-green-700"
                                                                                : (doc.field === 'passportPhotoUrl'
                                                                                    ? "border-blue-200 bg-blue-50/30 text-blue-600 hover:border-blue-400"
                                                                                    : "border-slate-200 text-slate-500 hover:border-blue-400 hover:text-blue-600")
                                                                        )}
                                                                    >
                                                                        {member[doc.field] ? <CheckCircle className="w-3 h-3 text-green-600" /> : <doc.icon className="w-3 h-3 opacity-70" />}
                                                                        <span className="text-[10px] font-medium truncate max-w-[100px]">
                                                                            {doc.label} {doc.field === 'passportPhotoUrl' && "(ID Card)"}
                                                                        </span>
                                                                        {uploadProgress[`member-${selectedTeamIndex}-${mIdx}-${doc.field}`] !== undefined && (
                                                                            <div className="absolute bottom-0 left-0 right-0 h-1 bg-slate-100">
                                                                                <Progress
                                                                                    value={uploadProgress[`member-${selectedTeamIndex}-${mIdx}-${doc.field}`]}
                                                                                    className="h-1 rounded-none border-none"
                                                                                />
                                                                            </div>
                                                                        )}
                                                                    </Label>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                    <div className="h-4"></div>
                                </div>
                            </ScrollArea>
                        ) : (
                            <div className="flex-1 flex flex-col items-center justify-center text-slate-400 p-8">
                                <LayoutGrid className="w-10 h-10 opacity-20 mb-3" />
                                <p className="text-xs">Select or create a team</p>
                            </div>
                        )}
                    </div>
                </div>
            </DialogContent>
        </Dialog >
    );
}
