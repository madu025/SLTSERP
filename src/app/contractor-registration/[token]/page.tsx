"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Loader2, Trash2, CheckCircle2, Building2, Users, Banknote, UserPlus, Image as ImageIcon, FileText, Upload, CheckCircle, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function PublicContractorRegistrationPage() {
    const { token } = useParams();
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [contractor, setContractor] = useState<any>(null);
    const [step, setStep] = useState(1);
    const [banks, setBanks] = useState<any[]>([]);
    const [branches, setBranches] = useState<any[]>([]);
    const [loadingBranches, setLoadingBranches] = useState(false);
    const [manualBank, setManualBank] = useState(false);
    const [manualBranch, setManualBranch] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [branchSearch, setBranchSearch] = useState("");
    const [showBranchList, setShowBranchList] = useState(false);

    // Form State
    const [formData, setFormData] = useState({
        nic: "",
        address: "",
        contactNumber: "",
        brNumber: "",
        bankName: "",
        bankBranch: "",
        bankAccountNumber: "",
        teams: [{ name: "Default Team", primaryStoreId: "", members: [] }] as any[],
        photoUrl: "",
        nicFrontUrl: "",
        nicBackUrl: "",
        policeReportUrl: "",
        gramaCertUrl: "",
        brCertUrl: ""
    });
    const [stores, setStores] = useState<any[]>([]);

    useEffect(() => {
        const fetchInitialData = async () => {
            try {
                const res = await fetch(`/api/contractors/public-register/${token}`);
                if (!res.ok) {
                    const errData = await res.json();
                    if (errData.error === 'TOKEN_EXPIRED') throw new Error("Registration link has expired (3-day limit exceeded).");
                    throw new Error("Invalid or expired link");
                }
                const data = await res.json();
                setContractor(data);

                // Restore from draft
                if (data.registrationDraft) {
                    setFormData(data.registrationDraft);
                    // Use small timeout to ensure UI updates after loading state clears
                    setTimeout(() => toast.info("Your previous progress has been restored."), 500);
                } else {
                    setFormData(prev => ({ ...prev, contactNumber: data.contactNumber || "" }));
                }
            } catch (error: any) {
                toast.error(error.message);
            } finally {
                setLoading(false);
            }
        };

        const fetchBanks = async () => {
            try {
                const res = await fetch('/api/banks');
                if (res.ok) {
                    const data = await res.json();
                    setBanks(data);
                }
            } catch (err) { console.error("Bank fetch error:", err); }
        };

        const fetchAllBranches = async () => {
            setLoadingBranches(true);
            try {
                const res = await fetch('/api/branches');
                if (res.ok) {
                    const data = await res.json();
                    setBranches(data);
                }
            } catch (err) { console.error("Branch fetch error:", err); }
            finally { setLoadingBranches(false); }
        };

        const fetchStores = async () => {
            try {
                const res = await fetch('/api/inventory/stores');
                if (res.ok) {
                    const data = await res.json();
                    setStores(data);
                }
            } catch (err) { console.error("Store fetch error:", err); }
        };

        if (token) {
            fetchInitialData();
            fetchBanks();
            fetchAllBranches();
            fetchStores();
        }
    }, [token]);

    const uploadFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || e.target.files.length === 0) return null;
        const file = e.target.files[0];
        const formDataUpload = new FormData();
        formDataUpload.append('file', file);

        const toastId = toast.loading("Uploading file...");
        try {
            const res = await fetch('/api/upload', { method: 'POST', body: formDataUpload });
            if (!res.ok) throw new Error("Upload failed");
            const data = await res.json();
            toast.success("File uploaded", { id: toastId });
            return data.url;
        } catch (err) {
            toast.error("File upload failed", { id: toastId });
            return null;
        }
    };

    const handleAddTeam = () => {
        setFormData({
            ...formData,
            teams: [...formData.teams, { name: "", primaryStoreId: "", members: [] }]
        });
    };

    const handleRemoveTeam = (tIdx: number) => {
        setFormData({
            ...formData,
            teams: formData.teams.filter((_, i) => i !== tIdx)
        });
    };

    const handleTeamChange = (tIdx: number, field: string, value: any) => {
        const updated = [...formData.teams];
        updated[tIdx][field] = value;
        setFormData({ ...formData, teams: updated });
    };

    const saveDraft = async () => {
        try {
            await fetch(`/api/contractors/public-register/${token}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(formData)
            });
        } catch (error) {
            console.error("Draft save failed:", error);
        }
    };

    const handleAddMember = (tIdx: number) => {
        const updated = [...formData.teams];
        updated[tIdx].members = [
            ...updated[tIdx].members,
            { name: "", nic: "", contactNumber: "", designation: "", passportPhotoUrl: "" }
        ];
        setFormData({ ...formData, teams: updated });
    };

    const handleRemoveMember = (tIdx: number, mIdx: number) => {
        const updated = [...formData.teams];
        updated[tIdx].members = updated[tIdx].members.filter((_: any, i: number) => i !== mIdx);
        setFormData({ ...formData, teams: updated });
    };

    const handleMemberChange = (tIdx: number, mIdx: number, field: string, value: string) => {
        const updated = [...formData.teams];
        updated[tIdx].members[mIdx][field] = value;
        setFormData({ ...formData, teams: updated });
    };

    const handleSubmit = async () => {
        setSubmitting(true);
        try {
            const res = await fetch(`/api/contractors/public-register/${token}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(formData)
            });

            if (!res.ok) throw new Error("Failed to submit registration");

            toast.success("Registration submitted successfully!");
            setSubmitted(true);
        } catch (error: any) {
            toast.error(error.message);
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
        );
    }

    if (!contractor) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
                <Card className="max-w-md w-full text-center p-8">
                    <CheckCircle2 className="w-12 h-12 text-red-500 mx-auto mb-4" />
                    <CardTitle className="text-xl font-bold mb-2">Invalid Link</CardTitle>
                    <CardDescription>
                        This registration link is invalid or has already been used. Please contact the site office for a new link.
                    </CardDescription>
                </Card>
            </div>
        );
    }

    const isSOD = contractor.type === "SOD";

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 py-12 px-4 sm:px-6">
            <div className="max-w-4xl mx-auto">
                {/* Header Section */}
                {!submitted && (
                    <div className="text-center mb-8">
                        <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Contractor Registration</h1>
                        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                            <span className={cn(
                                "px-3 py-1 rounded-full text-[10px] sm:text-xs font-bold uppercase tracking-wider",
                                isSOD ? "bg-purple-100 text-purple-700 border border-purple-200" : "bg-blue-100 text-blue-700 border border-blue-200"
                            )}>
                                Type: {contractor.type}
                            </span>
                            <span className="hidden sm:inline text-slate-400">•</span>
                            <span className="text-sm font-medium text-slate-600 truncate max-w-[200px] sm:max-w-none">{contractor.name}</span>
                        </div>
                        {contractor.registrationTokenExpiry && (
                            <div className="mt-2 text-[10px] text-amber-600 font-bold bg-amber-50 py-1 px-3 rounded-full w-fit mx-auto">
                                ⏳ Link Expiry: {new Date(contractor.registrationTokenExpiry).toLocaleDateString()} {new Date(contractor.registrationTokenExpiry).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </div>
                        )}
                    </div>
                )}

                {/* Progress Steps */}
                {!submitted && (
                    <div className="flex items-center justify-start sm:justify-center mb-10 overflow-x-auto pb-4 px-4 sm:px-0 gap-2 sm:gap-4 no-scrollbar min-w-0">
                        {[
                            { id: 1, label: "Info", icon: Building2 },
                            { id: 2, label: "Finc", icon: Banknote },
                            { id: 3, label: "Docs", icon: FileText },
                            ...(isSOD ? [{ id: 4, label: "Team", icon: Users }] : []),
                            { id: 5, label: "Done", icon: CheckCircle2 }
                        ].map((s, idx, arr) => (
                            <React.Fragment key={s.id}>
                                <div className="flex flex-col items-center gap-2">
                                    <div className={cn(
                                        "w-10 h-10 rounded-full flex items-center justify-center transition-all shadow-sm",
                                        step === s.id ? "bg-blue-600 text-white ring-4 ring-blue-100" :
                                            step > s.id ? "bg-green-500 text-white" : "bg-white text-slate-400 border border-slate-200"
                                    )}>
                                        <s.icon className="w-5 h-5" />
                                    </div>
                                    <span className={cn(
                                        "text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-center",
                                        step >= s.id ? "text-slate-900" : "text-slate-400"
                                    )}>{s.label}</span>
                                </div>
                                {idx < arr.length - 1 && (
                                    <div className={cn("h-[2px] min-w-[1rem] flex-1 sm:flex-none sm:w-16 transition-colors", step > s.id ? "bg-green-500" : "bg-slate-200")} />
                                )}
                            </React.Fragment>
                        ))}
                    </div>
                )}

                <Card className="border-none shadow-xl sm:shadow-2xl bg-white/90 backdrop-blur-md">
                    <CardContent className="p-4 sm:p-8">
                        {/* STEP SUCCESS */}
                        {submitted && (
                            <div className="text-center py-12 animate-in zoom-in-95 duration-500">
                                <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                                    <CheckCircle2 className="w-10 h-10 text-green-600" />
                                </div>
                                <h3 className="text-2xl font-bold text-slate-900 mb-2">Registration Submitted!</h3>
                                <p className="text-slate-500 max-w-sm mx-auto mb-8">
                                    Your registration has been sent for review. You will be notified via email/{formData.contactNumber} once processed by the ARM and OSP Manager.
                                </p>
                                <Button className="px-12 py-6 h-auto text-lg bg-slate-900 hover:bg-slate-800" onClick={() => window.close()}>Done</Button>
                            </div>
                        )}

                        {!submitted && step === 1 && (
                            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <Label>Company Name / Name</Label>
                                        <Input value={contractor.name} disabled className="bg-slate-50" />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Email</Label>
                                        <Input value={contractor.email || ""} disabled className="bg-slate-50" />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>NIC Number</Label>
                                        <Input value={formData.nic} onChange={e => setFormData({ ...formData, nic: e.target.value })} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>BR Number</Label>
                                        <Input value={formData.brNumber} onChange={e => setFormData({ ...formData, brNumber: e.target.value })} />
                                    </div>
                                    <div className="space-y-2 sm:col-span-2">
                                        <Label>Contact Number</Label>
                                        <Input value={formData.contactNumber} onChange={e => setFormData({ ...formData, contactNumber: e.target.value })} />
                                    </div>
                                    <div className="space-y-2 sm:col-span-2">
                                        <Label>Business Address</Label>
                                        <Textarea rows={3} value={formData.address} onChange={e => setFormData({ ...formData, address: e.target.value })} />
                                    </div>
                                </div>
                                <div className="flex justify-end pt-4"><Button onClick={() => { setStep(2); saveDraft(); }} className="bg-blue-600 px-8" disabled={!formData.contactNumber || !formData.address}>Continue</Button></div>
                            </div>
                        )}

                        {!submitted && step === 2 && (
                            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                    <div className="space-y-2 sm:col-span-2">
                                        <Label>Bank Name</Label>
                                        {!manualBank ? (
                                            <Select onValueChange={(val) => {
                                                if (val === "OTHER") { setManualBank(true); setFormData({ ...formData, bankName: "" }); }
                                                else { const bank = banks.find(b => b.id === val); setFormData({ ...formData, bankName: bank?.name || "" }); }
                                            }}>
                                                <SelectTrigger><SelectValue placeholder={banks.length > 0 ? "Select a bank" : "Loading..."} /></SelectTrigger>
                                                <SelectContent>{banks.map(b => (<SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>))}<SelectItem value="OTHER">+ Other (Type manually)</SelectItem></SelectContent>
                                            </Select>
                                        ) : (<div className="flex gap-2"><Input value={formData.bankName} onChange={e => setFormData({ ...formData, bankName: e.target.value })} /><Button variant="ghost" onClick={() => setManualBank(false)}>List</Button></div>)}
                                    </div>
                                    <div className="space-y-2 sm:col-span-2">
                                        <Label>Branch</Label>
                                        {!manualBranch ? (
                                            <div className="relative">
                                                <Input
                                                    placeholder="Type to search branch..."
                                                    value={formData.bankBranch || branchSearch}
                                                    onFocus={() => setShowBranchList(true)}
                                                    onChange={(e) => {
                                                        setBranchSearch(e.target.value);
                                                        setShowBranchList(true);
                                                    }}
                                                />
                                                {showBranchList && (
                                                    <div className="absolute z-50 w-full mt-1 bg-white border rounded-lg shadow-xl max-h-60 overflow-y-auto no-scrollbar">
                                                        {branches
                                                            .filter(b => b.name.toLowerCase().includes(branchSearch.toLowerCase()))
                                                            .slice(0, 100)
                                                            .map((br, i) => (
                                                                <div
                                                                    key={i}
                                                                    className="px-4 py-2.5 hover:bg-blue-50 cursor-pointer text-sm transition-colors border-b border-slate-50 last:border-0"
                                                                    onClick={() => {
                                                                        setFormData({ ...formData, bankBranch: br.name });
                                                                        setBranchSearch(br.name);
                                                                        setShowBranchList(false);
                                                                    }}
                                                                >
                                                                    {br.name}
                                                                </div>
                                                            ))
                                                        }
                                                        {branches.filter(b => b.name.toLowerCase().includes(branchSearch.toLowerCase())).length === 0 && (
                                                            <div className="px-4 py-3 text-xs text-slate-500 italic">No matching branches found</div>
                                                        )}
                                                        <div
                                                            className="px-4 py-3 hover:bg-blue-50 cursor-pointer text-sm font-bold text-blue-600 border-t sticky bottom-0 bg-white"
                                                            onClick={() => {
                                                                setManualBranch(true);
                                                                setFormData({ ...formData, bankBranch: "" });
                                                                setShowBranchList(false);
                                                            }}
                                                        >
                                                            + Other (Type manually)
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        ) : (
                                            <div className="flex gap-2">
                                                <Input
                                                    placeholder="Enter branch name"
                                                    value={formData.bankBranch}
                                                    onChange={e => setFormData({ ...formData, bankBranch: e.target.value })}
                                                />
                                                <Button variant="ghost" size="sm" onClick={() => setManualBranch(false)}>Select List</Button>
                                            </div>
                                        )}
                                    </div>
                                    <div className="space-y-2 sm:col-span-2">
                                        <Label>Account Number</Label>
                                        <Input value={formData.bankAccountNumber} onChange={e => setFormData({ ...formData, bankAccountNumber: e.target.value })} />
                                    </div>
                                </div>
                                <div className="flex justify-between pt-4">
                                    <Button variant="outline" onClick={() => setStep(1)}>Back</Button>
                                    <Button
                                        onClick={() => { setStep(3); saveDraft(); }}
                                        className="bg-blue-600 px-8"
                                        disabled={!formData.bankName || !formData.bankBranch || !formData.bankAccountNumber}
                                    >
                                        Continue to Documents
                                    </Button>
                                </div>
                            </div>
                        )}

                        {!submitted && step === 3 && (
                            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                                    {[
                                        { label: "Photo of Contractor", field: "photoUrl" },
                                        { label: "NIC Front Copy", field: "nicFrontUrl" },
                                        { label: "NIC Back Copy", field: "nicBackUrl" },
                                        { label: "Police Report (Optional)", field: "policeReportUrl" },
                                        { label: "Grama Niladhari Certificate", field: "gramaCertUrl" },
                                        { label: "BR Certificate (Optional)", field: "brCertUrl" }
                                    ].map((doc) => (
                                        <div key={doc.field} className="space-y-3 p-4 bg-slate-50 rounded-xl border border-slate-200 transition-all hover:bg-white hover:shadow-sm">
                                            <Label className="text-xs font-bold text-slate-700 uppercase tracking-wider">{doc.label}</Label>
                                            <div className="flex flex-col gap-3">
                                                {(formData as any)[doc.field] ? (
                                                    <div className="relative w-full h-32 bg-emerald-50 rounded-lg border border-emerald-100 overflow-hidden group">
                                                        <img
                                                            src={(formData as any)[doc.field]}
                                                            alt="Preview"
                                                            className="w-full h-full object-cover"
                                                        />
                                                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                                            <Button
                                                                size="sm"
                                                                variant="destructive"
                                                                className="h-8 text-[10px]"
                                                                onClick={() => setFormData({ ...formData, [doc.field]: "" })}
                                                            >
                                                                Remove
                                                            </Button>
                                                        </div>
                                                        <div className="absolute top-2 right-2 bg-emerald-500 text-white p-1 rounded-full">
                                                            <CheckCircle className="w-3 h-3" />
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="w-full h-32 rounded-lg border-2 border-dashed border-slate-200 flex flex-col items-center justify-center bg-white hover:border-blue-400 hover:bg-blue-50/30 transition-all group relative cursor-pointer">
                                                        <Upload className="w-8 h-8 text-slate-300 group-hover:text-blue-500 transition-colors mb-2" />
                                                        <span className="text-[10px] text-slate-400 group-hover:text-blue-600 font-medium">Click to upload file</span>
                                                        <input
                                                            type="file"
                                                            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                                                            accept="image/*,.pdf"
                                                            onChange={async (e) => {
                                                                const url = await uploadFile(e);
                                                                if (url) setFormData({ ...formData, [doc.field]: url });
                                                            }}
                                                        />
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <div className="flex justify-between pt-4">
                                    <Button variant="outline" onClick={() => setStep(2)}>Back</Button>
                                    <Button
                                        onClick={() => { setStep(isSOD ? 4 : 5); saveDraft(); }}
                                        className="bg-blue-600 px-8"
                                        disabled={!formData.photoUrl || !formData.nicFrontUrl || !formData.nicBackUrl || !formData.gramaCertUrl}
                                    >
                                        {isSOD ? "Continue to Team" : "Review & Submit"}
                                    </Button>
                                </div>
                            </div>
                        )}

                        {!submitted && step === 4 && isSOD && (
                            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
                                <div className="flex items-center justify-between">
                                    <div className="space-y-1">
                                        <h3 className="text-lg font-bold">Teams & Stores</h3>
                                        <p className="text-xs text-slate-500">Add your work teams and assign their primary stores.</p>
                                    </div>
                                    <Button variant="outline" size="sm" onClick={handleAddTeam} className="bg-white border-blue-200 text-blue-600 hover:bg-blue-50">
                                        <Plus className="w-4 h-4 mr-2" /> Add Team
                                    </Button>
                                </div>

                                <div className="space-y-8">
                                    {formData.teams.map((team, tIdx) => (
                                        <div key={tIdx} className="p-6 bg-slate-50 rounded-2xl border border-slate-200 relative group animate-in slide-in-from-top-2">
                                            {formData.teams.length > 1 && (
                                                <button onClick={() => handleRemoveTeam(tIdx)} className="absolute top-4 right-4 text-slate-400 hover:text-red-500 transition-colors">
                                                    <Trash2 className="w-5 h-5" />
                                                </button>
                                            )}

                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                                                <div className="space-y-2">
                                                    <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">Team Name</Label>
                                                    <Input placeholder="e.g. OSP Team A" value={team.name} onChange={e => handleTeamChange(tIdx, 'name', e.target.value)} className="bg-white" />
                                                </div>
                                                <div className="space-y-2">
                                                    <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">Assigned Store</Label>
                                                    <Select value={team.primaryStoreId} onValueChange={(v) => handleTeamChange(tIdx, 'primaryStoreId', v)}>
                                                        <SelectTrigger className="bg-white"><SelectValue placeholder="Select Store" /></SelectTrigger>
                                                        <SelectContent>
                                                            {stores.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                            </div>

                                            <div className="space-y-4">
                                                <div className="flex items-center justify-between">
                                                    <h4 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                                                        <Users className="w-4 h-4" /> Team Members
                                                    </h4>
                                                    <Button variant="ghost" size="sm" onClick={() => handleAddMember(tIdx)} className="h-7 text-[10px] text-blue-600 hover:text-blue-700 hover:bg-blue-50">
                                                        <UserPlus className="w-3 h-3 mr-1" /> Add Member
                                                    </Button>
                                                </div>

                                                <div className="grid grid-cols-1 gap-4">
                                                    {team.members.map((member: any, mIdx: number) => (
                                                        <div key={mIdx} className="p-4 bg-white rounded-xl border border-slate-100 flex flex-col md:flex-row gap-4 items-start md:items-center relative animate-in zoom-in-95">
                                                            <div className="shrink-0">
                                                                {member.passportPhotoUrl ? (
                                                                    <div className="relative w-16 h-16 rounded-lg overflow-hidden border">
                                                                        <img src={member.passportPhotoUrl} className="w-full h-full object-cover" />
                                                                        <button
                                                                            onClick={() => handleMemberChange(tIdx, mIdx, 'passportPhotoUrl', '')}
                                                                            className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity"
                                                                        >
                                                                            <Trash2 className="w-4 h-4 text-white" />
                                                                        </button>
                                                                    </div>
                                                                ) : (
                                                                    <div className="w-16 h-16 rounded-lg border-2 border-dashed flex flex-col items-center justify-center text-[8px] text-slate-400 gap-1 bg-slate-50/50 relative overflow-hidden group hover:border-blue-400 hover:bg-blue-50 transition-all">
                                                                        <ImageIcon className="w-5 h-5 text-slate-300 group-hover:text-blue-500" />
                                                                        <span>Photo</span>
                                                                        <input
                                                                            type="file"
                                                                            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                                                                            onChange={async (e) => {
                                                                                const url = await uploadFile(e);
                                                                                if (url) handleMemberChange(tIdx, mIdx, 'passportPhotoUrl', url);
                                                                            }}
                                                                        />
                                                                    </div>
                                                                )}
                                                            </div>
                                                            <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 w-full">
                                                                <Input placeholder="Full Name" value={member.name} onChange={e => handleMemberChange(tIdx, mIdx, 'name', e.target.value)} />
                                                                <Input placeholder="NIC Number" value={member.nic} onChange={e => handleMemberChange(tIdx, mIdx, 'nic', e.target.value)} />
                                                                <Input placeholder="Designation" value={member.designation} onChange={e => handleMemberChange(tIdx, mIdx, 'designation', e.target.value)} />
                                                            </div>
                                                            <button
                                                                onClick={() => handleRemoveMember(tIdx, mIdx)}
                                                                className="text-slate-300 hover:text-red-500 transition-colors md:ml-2"
                                                            >
                                                                <Trash2 className="w-4 h-4" />
                                                            </button>
                                                        </div>
                                                    ))}
                                                    {team.members.length === 0 && (
                                                        <div className="text-center py-6 border-2 border-dashed rounded-xl bg-slate-50/50 text-slate-400 text-xs italic">
                                                            No members added to this team yet.
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                <div className="flex justify-between pt-6 border-t mt-8">
                                    <Button variant="outline" onClick={() => setStep(3)}>Back</Button>
                                    <Button
                                        onClick={() => { setStep(5); saveDraft(); }}
                                        className="bg-blue-600 px-10 shadow-lg shadow-blue-200"
                                        disabled={formData.teams.some((t: any) => t.members.length === 0 || !t.primaryStoreId || !t.name)}
                                    >
                                        Review Registration
                                    </Button>
                                </div>
                            </div>
                        )}

                        {!submitted && step === 5 && (
                            <div className="animate-in fade-in slide-in-from-right-4 duration-500">
                                <div className="text-center mb-8">
                                    <h3 className="text-xl font-bold">Registration Summary</h3>
                                    <p className="text-sm text-slate-500">Please verify all information before final submission.</p>
                                </div>

                                <div className="space-y-6">
                                    {/* Bank Info Review */}
                                    <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100">
                                        <h4 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-4 flex items-center gap-2">
                                            <Banknote className="w-3.5 h-3.5" /> Banking Details
                                        </h4>
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                            <div><Label className="text-[10px] uppercase text-slate-500 font-bold">Bank</Label><p className="font-medium text-slate-900">{formData.bankName}</p></div>
                                            <div><Label className="text-[10px] uppercase text-slate-500 font-bold">Branch</Label><p className="font-medium text-slate-900">{formData.bankBranch}</p></div>
                                            <div><Label className="text-[10px] uppercase text-slate-500 font-bold">Account</Label><p className="font-medium text-slate-900 tracking-wider">{formData.bankAccountNumber}</p></div>
                                        </div>
                                    </div>

                                    {/* Teams Review */}
                                    <div className="space-y-4">
                                        <h4 className="text-xs font-bold uppercase tracking-widest text-slate-400 flex items-center gap-2 px-1">
                                            <Users className="w-3.5 h-3.5" /> Teams Summary ({formData.teams.length})
                                        </h4>
                                        <div className="grid grid-cols-1 gap-4">
                                            {formData.teams.map((team, tIdx) => (
                                                <div key={tIdx} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                                                    <div className="bg-slate-50 px-4 py-3 border-b flex justify-between items-center text-sm font-bold">
                                                        <span>{team.name}</span>
                                                        <Badge variant="secondary" className="bg-blue-50 text-blue-700">
                                                            {stores.find(s => s.id === team.primaryStoreId)?.name || 'No Store'}
                                                        </Badge>
                                                    </div>
                                                    <div className="p-4">
                                                        <div className="space-y-2">
                                                            {team.members.map((m: any, mIdx: number) => (
                                                                <div key={mIdx} className="flex items-center gap-3 text-sm">
                                                                    <div className="w-8 h-8 rounded-full border bg-slate-100 overflow-hidden shrink-0">
                                                                        {m.passportPhotoUrl ? <img src={m.passportPhotoUrl} className="w-full h-full object-cover" /> : <Users className="w-4 h-4 m-auto mt-2 text-slate-300" />}
                                                                    </div>
                                                                    <div className="flex-1 min-w-0">
                                                                        <p className="font-medium truncate">{m.name}</p>
                                                                        <p className="text-[10px] text-slate-500">{m.designation} • {m.nic}</p>
                                                                    </div>
                                                                    {m.passportPhotoUrl && <CheckCircle className="w-3 h-3 text-green-500" />}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Docs Review */}
                                    <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100">
                                        <h4 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-4 flex items-center gap-2">
                                            <FileText className="w-3.5 h-3.5" /> Documents Checklist
                                        </h4>
                                        <div className="flex flex-wrap gap-2">
                                            {[
                                                { k: 'photoUrl', l: 'Photo' },
                                                { k: 'nicFrontUrl', l: 'NIC Front' },
                                                { k: 'nicBackUrl', l: 'NIC Back' },
                                                { k: 'gramaCertUrl', l: 'GN Cert' },
                                                { k: 'brCertUrl', l: 'BR Cert' }
                                            ].map(d => (formData as any)[d.k] && (
                                                <Badge key={d.k} variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-100 py-1.5 px-3 flex items-center gap-2">
                                                    <CheckCircle className="w-3.5 h-3.5" /> {d.l}
                                                </Badge>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                <div className="mt-12 max-w-sm mx-auto space-y-4">
                                    <Button
                                        onClick={handleSubmit}
                                        className="w-full bg-blue-600 hover:bg-blue-700 py-7 h-auto text-lg font-bold shadow-xl shadow-blue-100 flex items-center justify-center gap-2"
                                        disabled={submitting}
                                    >
                                        {submitting ? <Loader2 className="animate-spin" /> : <>Complete Registration <CheckCircle2 className="w-5 h-5" /></>}
                                    </Button>
                                    <Button variant="ghost" className="w-full text-slate-500 hover:text-blue-600 transition-colors" onClick={() => setStep(4)} disabled={submitting}>
                                        Back to edit
                                    </Button>
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
