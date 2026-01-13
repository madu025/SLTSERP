"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
    Loader2, Trash2, CheckCircle2, Building2, Users, Banknote, UserPlus,
    Image as ImageIcon, FileText, Upload, CheckCircle, Plus, XCircle,
    ShieldCheck, AlertCircle, User, Info, UserCircle, MapPin
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";

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
    const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});

    // Form State
    const [formData, setFormData] = useState({
        nic: "",
        address: "",
        contactNumber: "",
        brNumber: "",
        bankName: "",
        bankBranch: "",
        bankAccountNumber: "",
        bankPassbookUrl: "",
        teams: [{ name: "Default Team", primaryStoreId: "", members: [] }] as any[],
        photoUrl: "",
        nicFrontUrl: "",
        nicBackUrl: "",
        policeReportUrl: "",
        gramaCertUrl: "",
        brCertUrl: ""
    });
    const [stores, setStores] = useState<any[]>([]);
    const formDataRef = React.useRef(formData);
    const submittingRef = React.useRef(false);

    // Keep ref in sync
    useEffect(() => {
        formDataRef.current = formData;
    }, [formData]);

    useEffect(() => {
        const fetchInitialData = async () => {
            try {
                const res = await fetch(`/api/contractors/public-register/${token}`);
                if (!res.ok) {
                    const errData = await res.json();
                    if (errData.error === 'ALREADY_SUBMITTED') {
                        setSubmitted(true);
                        setContractor({ name: "Contractor" }); // Dummy data to prevent "Invalid Link" UI
                        setLoading(false);
                        return;
                    }
                    if (errData.error === 'TOKEN_EXPIRED') throw new Error("Registration link has expired (3-day limit exceeded).");
                    throw new Error("Invalid or expired link");
                }
                const data = await res.json();
                setContractor(data);

                // Smart fill: Combine draft data and existing record data
                setFormData(prev => {
                    const draft = data.registrationDraft || {};
                    const existingTeams = data.teams && data.teams.length > 0 ? data.teams.map((t: any) => ({
                        ...t,
                        primaryStoreId: t.storeAssignments?.find((sa: any) => sa.isPrimary)?.storeId || ""
                    })) : null;

                    return {
                        ...prev,
                        ...draft,
                        // Fallback to existing record if draft field is empty
                        nic: draft.nic || data.nic || prev.nic,
                        address: draft.address || data.address || prev.address,
                        contactNumber: draft.contactNumber || data.contactNumber || prev.contactNumber,
                        brNumber: draft.brNumber || data.brNumber || prev.brNumber,
                        bankName: draft.bankName || data.bankName || prev.bankName,
                        bankBranch: draft.bankBranch || data.bankBranch || prev.bankBranch,
                        bankAccountNumber: draft.bankAccountNumber || data.bankAccountNumber || prev.bankAccountNumber,
                        bankPassbookUrl: draft.bankPassbookUrl || data.bankPassbookUrl || prev.bankPassbookUrl,
                        photoUrl: draft.photoUrl || data.photoUrl || prev.photoUrl,
                        nicFrontUrl: draft.nicFrontUrl || data.nicFrontUrl || prev.nicFrontUrl,
                        nicBackUrl: draft.nicBackUrl || data.nicBackUrl || prev.nicBackUrl,
                        policeReportUrl: draft.policeReportUrl || data.policeReportUrl || prev.policeReportUrl,
                        gramaCertUrl: draft.gramaCertUrl || data.gramaCertUrl || prev.gramaCertUrl,
                        brCertUrl: draft.brCertUrl || data.brCertUrl || prev.brCertUrl,
                        teams: (draft.teams && draft.teams.length > 0) ? draft.teams : (existingTeams || prev.teams)
                    };
                });

                if (data.registrationDraft) {
                    setTimeout(() => toast.info("Your previous progress has been restored."), 500);
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

    useEffect(() => {
        if (banks.length > 0 && formData.bankName) {
            const match = banks.find(b => b.name === formData.bankName);
            setManualBank(!match);
        }
    }, [banks, formData.bankName]);

    const uploadFile = async (e: React.ChangeEvent<HTMLInputElement>, fieldName: string) => {
        console.log(`[UPLOAD-FRONTEND] Starting upload for field: ${fieldName}`);

        if (!e.target.files || e.target.files.length === 0) {
            console.log(`[UPLOAD-FRONTEND] No file selected for ${fieldName}`);
            return null;
        }

        const file = e.target.files[0];
        console.log(`[UPLOAD-FRONTEND] File selected:`, {
            name: file.name,
            size: file.size,
            type: file.type
        });

        const formDataUpload = new FormData();
        formDataUpload.append('file', file);

        return new Promise<string | null>((resolve) => {
            const xhr = new XMLHttpRequest();
            xhr.open('POST', '/api/upload', true);

            xhr.upload.onprogress = (event) => {
                if (event.lengthComputable) {
                    const percentComplete = Math.round((event.loaded / event.total) * 100);
                    console.log(`[UPLOAD-FRONTEND] Progress for ${fieldName}: ${percentComplete}%`);
                    setUploadProgress(prev => ({ ...prev, [fieldName]: percentComplete }));
                }
            };

            xhr.onload = () => {
                console.log(`[UPLOAD-FRONTEND] Upload completed with status: ${xhr.status}`);

                if (xhr.status === 200) {
                    try {
                        const response = JSON.parse(xhr.responseText);
                        console.log(`[UPLOAD-FRONTEND] Upload successful for ${fieldName}:`, response);

                        setUploadProgress(prev => {
                            const next = { ...prev };
                            delete next[fieldName];
                            return next;
                        });
                        resolve(response.url);
                    } catch (parseError) {
                        console.error(`[UPLOAD-FRONTEND] Failed to parse response:`, parseError);
                        toast.error("Upload response error");
                        setUploadProgress(prev => {
                            const next = { ...prev };
                            delete next[fieldName];
                            return next;
                        });
                        resolve(null);
                    }
                } else {
                    console.error(`[UPLOAD-FRONTEND] Upload failed with status ${xhr.status}`);
                    console.error(`[UPLOAD-FRONTEND] Response:`, xhr.responseText);

                    let errorMsg = "Upload failed";
                    try {
                        const errorData = JSON.parse(xhr.responseText);
                        errorMsg = errorData.details || errorData.error || errorMsg;
                        console.error(`[UPLOAD-FRONTEND] Error details:`, errorData);
                    } catch (e) {
                        console.error(`[UPLOAD-FRONTEND] Could not parse error response`);
                    }

                    toast.error(errorMsg);
                    setUploadProgress(prev => {
                        const next = { ...prev };
                        delete next[fieldName];
                        return next;
                    });
                    resolve(null);
                }
            };

            xhr.onerror = () => {
                console.error(`[UPLOAD-FRONTEND] Network error for ${fieldName}`);
                toast.error("Network error during upload");
                setUploadProgress(prev => {
                    const next = { ...prev };
                    delete next[fieldName];
                    return next;
                });
                resolve(null);
            };

            console.log(`[UPLOAD-FRONTEND] Sending XHR request for ${fieldName}`);
            xhr.send(formDataUpload);
        });
    };

    const handleAddTeam = () => {
        setFormData(prev => ({
            ...prev,
            teams: [...prev.teams, { name: "", primaryStoreId: "", members: [] }]
        }));
    };

    const handleRemoveTeam = (tIdx: number) => {
        setFormData(prev => ({
            ...prev,
            teams: prev.teams.filter((_, i) => i !== tIdx)
        }));
    };

    const handleTeamChange = (tIdx: number, field: string, value: any) => {
        setFormData(prev => {
            const updated = [...prev.teams];
            updated[tIdx] = { ...updated[tIdx], [field]: value };
            return { ...prev, teams: updated };
        });
    };

    const saveDraft = async (dataToSave: any = formDataRef.current) => {
        // Don't save drafts while submitting to prevent transaction conflicts
        if (submittingRef.current) {
            console.log("[DRAFT] Skipping draft save - submission in progress");
            return;
        }

        try {
            console.log("[DRAFT] Saving draft...");
            await fetch(`/api/contractors/public-register/${token}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(dataToSave)
            });
            console.log("[DRAFT] Draft saved successfully");
        } catch (error) {
            console.error("Draft save failed:", error);
        }
    };

    const handleAddMember = (tIdx: number) => {
        setFormData(prev => {
            const updated = [...prev.teams];
            updated[tIdx] = {
                ...updated[tIdx],
                members: [
                    ...updated[tIdx].members,
                    {
                        name: "",
                        nic: "",
                        contactNumber: "",
                        address: "",
                        designation: "",
                        passportPhotoUrl: "",
                        photoUrl: "",
                        nicUrl: "",
                        policeReportUrl: "",
                        gramaCertUrl: "",
                        shoeSize: "",
                        tshirtSize: ""
                    }
                ]
            };
            return { ...prev, teams: updated };
        });
    };

    const handleRemoveMember = (tIdx: number, mIdx: number) => {
        setFormData(prev => {
            const updated = [...prev.teams];
            updated[tIdx] = {
                ...updated[tIdx],
                members: updated[tIdx].members.filter((_: any, i: number) => i !== mIdx)
            };
            return { ...prev, teams: updated };
        });
    };

    const handleMemberChange = (tIdx: number, mIdx: number, field: string, value: string) => {
        setFormData(prev => {
            const updated = [...prev.teams];
            const members = [...updated[tIdx].members];
            members[mIdx] = { ...members[mIdx], [field]: value };
            updated[tIdx] = { ...updated[tIdx], members };
            return { ...prev, teams: updated };
        });
    };

    // Auto-save disabled - relying on explicit saves after each action to prevent race conditions
    // The previous auto-save was overwriting partial uploads with stale form state

    const handleSubmit = async () => {
        console.log("Starting registration submission...", formData);

        // Validation
        if (!formData.address || !formData.nic || !formData.contactNumber) {
            toast.error("Please fill in all Basic Information (Step 1)");
            setStep(1);
            return;
        }

        if (!formData.bankName || !formData.bankAccountNumber || !formData.bankPassbookUrl) {
            toast.error("Please provide complete Banking Details (Step 2)");
            setStep(2);
            return;
        }

        if (!formData.nicFrontUrl || !formData.nicBackUrl || !formData.photoUrl) {
            toast.error("Please upload all required Documents (Step 3)");
            setStep(3);
            return;
        }

        // Team Validation - Only required for SOD type contractors
        if (isSOD) {
            if (formData.teams.length === 0 || formData.teams.some(t => !t.name || !t.primaryStoreId)) {
                toast.error("Please ensure all teams have a name and a primary store assigned (Step 4)");
                setStep(4);
                return;
            }
        }

        setSubmitting(true);
        submittingRef.current = true; // Block draft saves during submission

        try {
            // Prepare final data - if not SOD, we might want to ensure a default team structure
            const finalData = { ...formData };
            if (!isSOD && finalData.teams.length === 1 && !finalData.teams[0].primaryStoreId) {
                // For non-SOD, we can auto-assign the first team to the contractor's OPMC store if needed
                // but for now, we just skip it to avoid validation errors
            }

            const res = await fetch(`/api/contractors/public-register/${token}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(finalData)
            });

            if (!res.ok) {
                const err = await res.json();
                console.error("Submission failed server-side:", err);
                throw new Error(err.error || err.message || "Failed to submit registration");
            }

            toast.success("Registration submitted successfully!");
            setSubmitted(true);
        } catch (error: any) {
            console.error("Submission error:", error);
            toast.error(error.message || "Something went wrong during submission");
        } finally {
            setSubmitting(false);
            submittingRef.current = false; // Re-enable draft saves
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
                        <div className="flex justify-center mb-6">
                            <div className="bg-white p-3 rounded-2xl shadow-xl shadow-blue-200/50 border border-blue-50 animate-in zoom-in duration-700">
                                <img src="/logo.png" alt="Logo" className="w-16 h-16 object-contain" />
                            </div>
                        </div>
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
                        {contractor.status === 'REJECTED' && (
                            <div className="mt-6 p-4 bg-red-50 border border-red-100 rounded-xl max-w-2xl mx-auto animate-in fade-in slide-in-from-top-4 duration-500">
                                <div className="flex items-center gap-3 text-red-600 mb-2">
                                    <XCircle className="w-5 h-5 shrink-0" />
                                    <h3 className="font-bold text-sm">Registration Requires Corrections</h3>
                                </div>
                                <p className="text-xs text-red-700 leading-relaxed text-left">
                                    Your previous submission was reviewed and rejected for the following reason:<br />
                                    <span className="mt-2 block p-2 bg-white rounded border border-red-200 font-bold italic">
                                        "{contractor.rejectionReason || "No specific reason provided. Please verify all documents and retry."}"
                                    </span>
                                </p>
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
                                        <Input value={formData.nic} onChange={e => setFormData(p => ({ ...p, nic: e.target.value }))} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>BR Number</Label>
                                        <Input value={formData.brNumber} onChange={e => setFormData(p => ({ ...p, brNumber: e.target.value }))} />
                                    </div>
                                    <div className="space-y-2 sm:col-span-2">
                                        <Label>Contact Number</Label>
                                        <Input value={formData.contactNumber} onChange={e => setFormData(p => ({ ...p, contactNumber: e.target.value }))} />
                                    </div>
                                    <div className="space-y-2 sm:col-span-2">
                                        <Label>Business Address</Label>
                                        <Textarea rows={3} value={formData.address} onChange={e => setFormData(p => ({ ...p, address: e.target.value }))} />
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
                                            <Select
                                                value={banks.find(b => b.name === formData.bankName)?.id}
                                                onValueChange={(val) => {
                                                    if (val === "OTHER") { setManualBank(true); setFormData(p => ({ ...p, bankName: "" })); }
                                                    else { const bank = banks.find(b => b.id === val); setFormData(p => ({ ...p, bankName: bank?.name || "" })); }
                                                }}>
                                                <SelectTrigger><SelectValue placeholder={banks.length > 0 ? "Select a bank" : "Loading..."} /></SelectTrigger>
                                                <SelectContent>{banks.map(b => (<SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>))}<SelectItem value="OTHER">+ Other (Type manually)</SelectItem></SelectContent>
                                            </Select>
                                        ) : (<div className="flex gap-2"><Input value={formData.bankName} onChange={e => setFormData(p => ({ ...p, bankName: e.target.value }))} /><Button variant="ghost" onClick={() => setManualBank(false)}>List</Button></div>)}
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
                                                            .filter(b => b.name.toLowerCase().startsWith(branchSearch.toLowerCase()))
                                                            .sort((a, b) => a.name.localeCompare(b.name))
                                                            .slice(0, 100)
                                                            .map((br, i) => (
                                                                <div
                                                                    key={i}
                                                                    className="px-4 py-2.5 hover:bg-blue-50 cursor-pointer text-sm transition-colors border-b border-slate-50 last:border-0"
                                                                    onClick={() => {
                                                                        setFormData(p => ({ ...p, bankBranch: br.name }));
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
                                                    onChange={e => setFormData(p => ({ ...p, bankBranch: e.target.value }))}
                                                />
                                                <Button variant="ghost" size="sm" onClick={() => setManualBranch(false)}>Select List</Button>
                                            </div>
                                        )}
                                    </div>
                                    <div className="space-y-2 sm:col-span-2">
                                        <Label>Account Number</Label>
                                        <Input value={formData.bankAccountNumber} onChange={e => setFormData(p => ({ ...p, bankAccountNumber: e.target.value }))} />
                                    </div>
                                    <div className="space-y-2 sm:col-span-2">
                                        <Label className="flex justify-between items-center">
                                            <span>Bank Passbook / Statement Copy</span>
                                            {formData.bankPassbookUrl && <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-none text-[10px]">Uploaded</Badge>}
                                        </Label>
                                        <div className="flex items-center gap-3">
                                            <div className="relative flex-1">
                                                <Input
                                                    type="file"
                                                    accept="image/*,.pdf"
                                                    onChange={async (e) => {
                                                        console.log("[UPLOAD] Starting upload for bankPassbookUrl");
                                                        const url = await uploadFile(e, 'bankPassbookUrl');
                                                        if (url) {
                                                            console.log("[UPLOAD] Success for bankPassbookUrl:", url);
                                                            setFormData(p => {
                                                                const updated = { ...p, bankPassbookUrl: url };
                                                                console.log("[STATE] Updated bankPassbookUrl in form state");
                                                                return updated;
                                                            });
                                                            const saveResult = await saveDraft({ bankPassbookUrl: url });
                                                            console.log("[SAVE] Draft saved for bankPassbookUrl:", saveResult);
                                                        } else {
                                                            console.error("[UPLOAD] Failed for bankPassbookUrl");
                                                        }
                                                    }}
                                                    className="cursor-pointer file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-bold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                                                />
                                            </div>
                                            {formData.bankPassbookUrl && (
                                                <Button size="icon" variant="ghost" onClick={() => setFormData({ ...formData, bankPassbookUrl: "" })} className="text-red-500">
                                                    <Trash2 className="w-4 h-4" />
                                                </Button>
                                            )}
                                            {uploadProgress['bankPassbookUrl'] !== undefined && (
                                                <div className="absolute -bottom-2 left-0 right-0 z-10 px-1">
                                                    <Progress value={uploadProgress['bankPassbookUrl']} className="h-1" />
                                                </div>
                                            )}
                                        </div>
                                        <p className="text-[10px] text-slate-400 italic">Clear photo of the bank passbook first page or a recent statement showing the account name and number.</p>
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
                                        { label: "Police Report (Skip for now)", field: "policeReportUrl" },
                                        { label: "Grama Niladhari Cert (Skip for now)", field: "gramaCertUrl" },
                                        { label: "BR Certificate (Skip for now)", field: "brCertUrl" }
                                    ].map((doc) => (
                                        <div key={doc.field} className="space-y-3 p-4 bg-slate-50 rounded-xl border border-slate-200 transition-all hover:bg-white hover:shadow-sm">
                                            <Label className="text-xs font-bold text-slate-700 uppercase tracking-wider">{doc.label}</Label>
                                            <div className="flex flex-col gap-3">
                                                {(formData as any)[doc.field] ? (
                                                    <div className="relative w-full h-32 bg-emerald-50 rounded-lg border border-emerald-100 overflow-hidden group">
                                                        <img
                                                            key={(formData as any)[doc.field]}
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
                                                                console.log(`[UPLOAD] Starting upload for ${doc.field}`);
                                                                const url = await uploadFile(e, doc.field);
                                                                if (url) {
                                                                    console.log(`[UPLOAD] Success for ${doc.field}:`, url);
                                                                    setFormData(prev => {
                                                                        const updated = { ...prev, [doc.field]: url };
                                                                        console.log(`[STATE] Updated ${doc.field} in form state`);
                                                                        return updated;
                                                                    });
                                                                    // Immediate save with just this field
                                                                    const saveResult = await saveDraft({ [doc.field]: url });
                                                                    console.log(`[SAVE] Draft saved for ${doc.field}:`, saveResult);
                                                                } else {
                                                                    console.error(`[UPLOAD] Failed for ${doc.field}`);
                                                                }
                                                            }}
                                                        />
                                                    </div>
                                                )}
                                                {uploadProgress[doc.field] !== undefined && (
                                                    <div className="mt-1">
                                                        <div className="flex justify-between text-[10px] text-blue-600 font-bold mb-1">
                                                            <span>Uploading...</span>
                                                            <span>{uploadProgress[doc.field]}%</span>
                                                        </div>
                                                        <Progress value={uploadProgress[doc.field]} className="h-1.5" />
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
                                        disabled={!formData.photoUrl || !formData.nicFrontUrl || !formData.nicBackUrl}
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

                                                <div className="grid grid-cols-1 gap-6">
                                                    {team.members.map((member: any, mIdx: number) => (
                                                        <div key={mIdx} className="p-6 bg-white rounded-2xl border border-slate-200 relative animate-in zoom-in-95 group/member">
                                                            <div className="flex items-center justify-between mb-4">
                                                                <div className="flex items-center gap-2">
                                                                    <span className="w-6 h-6 bg-slate-100 rounded-full flex items-center justify-center text-[10px] font-bold text-slate-500">#{mIdx + 1}</span>
                                                                    <h5 className="font-bold text-slate-800">{member.name || "Unnamed Member"}</h5>
                                                                </div>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    onClick={() => handleRemoveMember(tIdx, mIdx)}
                                                                    className="h-8 w-8 text-slate-400 hover:text-red-500 hover:bg-red-50"
                                                                >
                                                                    <Trash2 className="w-4 h-4" />
                                                                </Button>
                                                            </div>

                                                            <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                                                                <div className="md:col-span-4 space-y-1.5">
                                                                    <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Full Name</Label>
                                                                    <Input
                                                                        placeholder="Enter full name"
                                                                        value={member.name}
                                                                        onChange={e => handleMemberChange(tIdx, mIdx, 'name', e.target.value)}
                                                                        className="h-9 text-sm"
                                                                    />
                                                                </div>
                                                                <div className="md:col-span-3 space-y-1.5">
                                                                    <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">NIC / ID Card</Label>
                                                                    <Input
                                                                        placeholder="NIC Number"
                                                                        value={member.nic}
                                                                        onChange={e => handleMemberChange(tIdx, mIdx, 'nic', e.target.value)}
                                                                        className="h-9 text-sm font-mono"
                                                                    />
                                                                </div>
                                                                <div className="md:col-span-3 space-y-1.5">
                                                                    <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Contact</Label>
                                                                    <Input
                                                                        placeholder="Contact Number"
                                                                        value={member.contactNumber}
                                                                        onChange={e => handleMemberChange(tIdx, mIdx, 'contactNumber', e.target.value)}
                                                                        className="h-9 text-sm"
                                                                    />
                                                                </div>
                                                                <div className="md:col-span-1 space-y-1.5">
                                                                    <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Shoe</Label>
                                                                    <Input
                                                                        placeholder="Size"
                                                                        value={member.shoeSize}
                                                                        onChange={e => handleMemberChange(tIdx, mIdx, 'shoeSize', e.target.value)}
                                                                        className="h-9 text-sm"
                                                                    />
                                                                </div>
                                                                <div className="md:col-span-1 space-y-1.5">
                                                                    <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Shirt</Label>
                                                                    <Select value={member.tshirtSize} onValueChange={(v) => handleMemberChange(tIdx, mIdx, 'tshirtSize', v)}>
                                                                        <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Size" /></SelectTrigger>
                                                                        <SelectContent>
                                                                            {['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL'].map(sz => (
                                                                                <SelectItem key={sz} value={sz}>{sz}</SelectItem>
                                                                            ))}
                                                                        </SelectContent>
                                                                    </Select>
                                                                </div>

                                                                <div className="md:col-span-12 space-y-1.5">
                                                                    <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Address</Label>
                                                                    <Input
                                                                        placeholder="Member's Residential Address"
                                                                        value={member.address}
                                                                        onChange={e => handleMemberChange(tIdx, mIdx, 'address', e.target.value)}
                                                                        className="h-9 text-sm"
                                                                    />
                                                                </div>

                                                                <div className="md:col-span-12 mt-2">
                                                                    <div className="flex flex-wrap gap-2">
                                                                        {[
                                                                            { id: 'photoUrl', label: 'Photo', icon: ImageIcon },
                                                                            { id: 'passportPhotoUrl', label: 'Passport Photo (ID)', icon: UserCircle },
                                                                            { id: 'nicUrl', label: 'NIC', icon: FileText },
                                                                            { id: 'policeReportUrl', label: 'Police Rep', icon: ShieldCheck },
                                                                            { id: 'gramaCertUrl', label: 'Grama Cert', icon: MapPin }
                                                                        ].map((doc) => (
                                                                            <div key={doc.id} className="relative group/doc">
                                                                                <div className={cn(
                                                                                    "h-8 px-3 rounded-md flex items-center gap-2 border text-[10px] font-bold transition-all cursor-pointer relative",
                                                                                    member[doc.id] ? "bg-emerald-50 border-emerald-200 text-emerald-600" : "bg-white border-slate-200 text-slate-400 hover:bg-slate-50"
                                                                                )}>
                                                                                    {member[doc.id] ? <CheckCircle className="w-3 h-3" /> : <doc.icon className="w-3 h-3" />}
                                                                                    {doc.label}
                                                                                    <input
                                                                                        type="file"
                                                                                        className="absolute inset-0 opacity-0 cursor-pointer"
                                                                                        onChange={async (e) => {
                                                                                            const url = await uploadFile(e, `member-${tIdx}-${mIdx}-${doc.id}`);
                                                                                            if (url) {
                                                                                                handleMemberChange(tIdx, mIdx, doc.id, url);
                                                                                                saveDraft();
                                                                                            }
                                                                                        }}
                                                                                    />
                                                                                </div>
                                                                                {uploadProgress[`member-${tIdx}-${mIdx}-${doc.id}`] !== undefined && (
                                                                                    <div className="absolute -bottom-1 left-0 right-0 h-1 bg-slate-100 rounded-full overflow-hidden">
                                                                                        <div className="h-full bg-blue-500 transition-all" style={{ width: `${uploadProgress[`member-${tIdx}-${mIdx}-${doc.id}`]}%` }} />
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                            </div>
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
                            <div className="animate-in fade-in slide-in-from-right-4 duration-500 space-y-8">
                                <div className="text-center mb-8">
                                    <h3 className="text-xl font-bold bg-gradient-to-r from-blue-700 to-indigo-700 bg-clip-text text-transparent">Final Review</h3>
                                    <p className="text-sm text-slate-500">Please verify all your registration details below before final submission.</p>
                                </div>

                                <div className="space-y-6">
                                    {/* 1. Basic Info Review */}
                                    <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm relative overflow-hidden">
                                        <div className="absolute top-0 left-0 w-1 h-full bg-blue-500"></div>
                                        <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-6 flex items-center gap-2">
                                            <ShieldCheck className="w-4 h-4 text-blue-500" /> Basic Information
                                        </h4>
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                            <div className="space-y-1">
                                                <Label className="text-[10px] uppercase text-slate-400 font-bold">Contact Name</Label>
                                                <p className="text-sm font-semibold text-slate-900">{contractor?.name}</p>
                                            </div>
                                            <div className="space-y-1">
                                                <Label className="text-[10px] uppercase text-slate-400 font-bold">NIC Number</Label>
                                                <p className="text-sm font-semibold text-slate-900">{formData.nic}</p>
                                            </div>
                                            <div className="space-y-1">
                                                <Label className="text-[10px] uppercase text-slate-400 font-bold">Contact Number</Label>
                                                <p className="text-sm font-semibold text-slate-900">{formData.contactNumber}</p>
                                            </div>
                                            <div className="space-y-1">
                                                <Label className="text-[10px] uppercase text-slate-400 font-bold">Email Address</Label>
                                                <p className="text-sm font-semibold text-slate-900">{contractor?.email || 'Not Provided'}</p>
                                            </div>
                                            <div className="space-y-1 md:col-span-2">
                                                <Label className="text-[10px] uppercase text-slate-400 font-bold">Residential/Business Address</Label>
                                                <p className="text-sm font-semibold text-slate-900">{formData.address}</p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* 2. Banking Details Review */}
                                    <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm relative overflow-hidden">
                                        <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500"></div>
                                        <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-6 flex items-center gap-2">
                                            <Banknote className="w-4 h-4 text-emerald-500" /> Banking Details
                                        </h4>
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                            <div className="space-y-1">
                                                <Label className="text-[10px] uppercase text-slate-400 font-bold">Bank Name</Label>
                                                <p className="text-sm font-semibold text-slate-900">{formData.bankName}</p>
                                            </div>
                                            <div className="space-y-1">
                                                <Label className="text-[10px] uppercase text-slate-400 font-bold">Branch</Label>
                                                <p className="text-sm font-semibold text-slate-900">{formData.bankBranch}</p>
                                            </div>
                                            <div className="space-y-1">
                                                <Label className="text-[10px] uppercase text-slate-400 font-bold">Account Number</Label>
                                                <p className="text-sm font-semibold text-slate-900 tracking-wider font-mono">{formData.bankAccountNumber}</p>
                                            </div>
                                        </div>
                                        <div className="mt-6 p-3 bg-slate-50 rounded-xl border border-dashed flex items-center gap-4">
                                            {formData.bankPassbookUrl && (
                                                <div className="w-12 h-12 rounded bg-white border overflow-hidden">
                                                    <img src={formData.bankPassbookUrl} className="w-full h-full object-cover" />
                                                </div>
                                            )}
                                            <span className="text-xs text-slate-500 font-medium italic">Bank Passbook / Statement Copy Uploaded</span>
                                        </div>
                                    </div>

                                    {/* 3. Documents Review */}
                                    <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm relative overflow-hidden">
                                        <div className="absolute top-0 left-0 w-1 h-full bg-orange-500"></div>
                                        <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-6 flex items-center gap-2">
                                            <FileText className="w-4 h-4 text-orange-500" /> Uploaded Documents
                                        </h4>
                                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                                            {[
                                                { label: "Photo", url: formData.photoUrl },
                                                { label: "NIC Front", url: formData.nicFrontUrl },
                                                { label: "NIC Back", url: formData.nicBackUrl },
                                                { label: "Police Report", url: formData.policeReportUrl },
                                                { label: "Grama Niladbari", url: formData.gramaCertUrl },
                                                { label: "BR Certificate", url: formData.brCertUrl }
                                            ].filter(doc => doc.url).map((doc, idx) => (
                                                <div key={idx} className="space-y-2">
                                                    <div className="aspect-square rounded-lg border bg-slate-50 overflow-hidden relative group">
                                                        <img src={doc.url} className="w-full h-full object-cover" />
                                                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                                            <a href={doc.url} target="_blank" className="text-[10px] text-white underline">View Large</a>
                                                        </div>
                                                    </div>
                                                    <p className="text-[10px] font-bold text-center text-slate-500 uppercase">{doc.label}</p>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* 4. Teams Review */}
                                    <div className="space-y-4">
                                        <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-2 px-1">
                                            <Users className="w-4 h-4 text-purple-500" /> Teams & Members ({formData.teams.length})
                                        </h4>
                                        <div className="grid grid-cols-1 gap-4">
                                            {formData.teams.map((team, tIdx) => (
                                                <div key={tIdx} className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                                                    <div className="bg-slate-50 px-5 py-4 border-b flex justify-between items-center">
                                                        <div className="flex flex-col">
                                                            <span className="text-sm font-bold text-slate-800">{team.name}</span>
                                                            <span className="text-[10px] text-slate-500">Assigned Store: {stores.find(s => s.id === team.primaryStoreId)?.name || 'Pending'}</span>
                                                        </div>
                                                        <Badge variant="secondary" className="bg-blue-100 text-blue-700 border-none px-3">
                                                            {team.members.length} Members
                                                        </Badge>
                                                    </div>
                                                    <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                        {team.members.map((m: any, mIdx: number) => (
                                                            <div key={mIdx} className="flex items-center gap-3 p-2 rounded-lg bg-slate-50/50 border border-slate-100">
                                                                <div className="w-10 h-10 rounded-full bg-white border overflow-hidden shrink-0">
                                                                    <img src={m.passportPhotoUrl || m.photoUrl} className="w-full h-full object-cover" />
                                                                </div>
                                                                <div className="flex flex-col min-w-0">
                                                                    <span className="text-xs font-bold text-slate-700 truncate">{m.name}</span>
                                                                    <span className="text-[10px] text-slate-400">{m.nic || 'No NIC'}</span>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                <div className="p-6 bg-blue-50 border border-blue-100 rounded-2xl flex items-start gap-4">
                                    <div className="p-2 bg-blue-500 rounded-full text-white shrink-0">
                                        <AlertCircle className="w-5 h-5" />
                                    </div>
                                    <div className="space-y-1">
                                        <h5 className="text-sm font-bold text-blue-900">Final Confirmation</h5>
                                        <p className="text-xs text-blue-700/80 leading-relaxed">
                                            By submitting this registration, you confirm that all the information provided is accurate and authentic.
                                            Our team will review your application and notify you via email/contact number once approved.
                                        </p>
                                    </div>
                                </div>

                                <div className="flex flex-col sm:flex-row gap-4 pt-6">
                                    <Button
                                        variant="outline"
                                        onClick={() => setStep(4)}
                                        className="sm:w-1/3 h-12"
                                        disabled={submitting}
                                    >
                                        Back to Edit
                                    </Button>
                                    <Button
                                        onClick={handleSubmit}
                                        disabled={submitting}
                                        className="sm:w-2/3 h-12 bg-blue-600 hover:bg-blue-700 text-white shadow-xl shadow-blue-200 transition-all active:scale-95 text-base font-bold"
                                    >
                                        {submitting ? (
                                            <>
                                                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                                                Processing Submission...
                                            </>
                                        ) : (
                                            "Submit Registration Now"
                                        )}
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
