"use client";

import React, { useState, useEffect } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { contractorSchema, ContractorSchema } from "@/lib/validations/contractor.schema";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Building2, Banknote, FileText, Users, CheckCircle2, ChevronRight, ChevronLeft, Loader2, X, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { FileUploadField } from "@/components/shared/FileUploadField";
import { useOCR } from "@/hooks/useOCR";
import { toast } from "sonner";
import { ContractorRegistrationApi } from "@/services/api/contractor-registration.api";

interface ContractorFormDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    initialData?: Partial<ContractorSchema> & { id?: string };
    onSubmit: (data: ContractorSchema) => Promise<void>;
    isSubmitting: boolean;
    banks: { id: string; name: string }[];
    branches: { id: string; name: string }[];
    stores: { id: string; name: string }[];
}

export function ContractorFormDialog({
    open,
    onOpenChange,
    initialData,
    onSubmit,
    isSubmitting,
    banks,
    branches,
    stores
}: ContractorFormDialogProps) {
    const [step, setStep] = useState(1);
    const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
    const { scanImage, isScanning } = useOCR();
    const [manualBank, setManualBank] = useState(false);
    const [branchSearch, setBranchSearch] = useState("");
    const [showBranchList, setShowBranchList] = useState(false);

    const form = useForm<ContractorSchema>({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        resolver: zodResolver(contractorSchema) as any,
        defaultValues: (initialData as ContractorSchema) || {
            name: "",
            registrationNumber: "",
            address: "",
            nic: "",
            contactNumber: "",
            type: "SOD",
            status: "PENDING",
            bankName: "",
            bankBranch: "",
            bankAccountNumber: "",
            registrationFeePaid: false,
            agreementSigned: false,
            teams: []
        }
    });

    useEffect(() => {
        if (initialData) {
            form.reset({
                ...initialData,
                registrationNumber: initialData.registrationNumber || "",
                address: initialData.address || "",
                nic: initialData.nic || "",
                contactNumber: initialData.contactNumber || "",
                type: initialData.type || "SOD",
                status: initialData.status || "PENDING",
                bankName: initialData.bankName || "",
                bankBranch: initialData.bankBranch || "",
                bankAccountNumber: initialData.bankAccountNumber || "",
                registrationFeePaid: !!initialData.registrationFeePaid,
                agreementSigned: !!initialData.agreementSigned,
            });
        } else {
            form.reset();
            if (step !== 1) setTimeout(() => setStep(1), 0);
        }
    }, [initialData, form, open, step]);

    useEffect(() => {
        if (initialData?.bankBranch && branchSearch !== initialData.bankBranch) {
            setTimeout(() => setBranchSearch(initialData.bankBranch as string), 0);
        }
    }, [initialData?.bankBranch, branchSearch]);

    const handleUpload = async (file: File, fieldName: string) => {
        try {
            const url = await ContractorRegistrationApi.uploadFile(file, fieldName as keyof ContractorSchema, (p) => {
                setUploadProgress(prev => ({ ...prev, [fieldName]: p }));
            });
            form.setValue(fieldName as keyof ContractorSchema, url, { shouldValidate: true });
            return url;
        } catch {
            toast.error(`Upload failed for ${fieldName}`);
            return null;
        }
    };

    const handleNICScan = async (url: string) => {
        const nic = await scanImage(url, "NIC Number");
        if (nic) form.setValue("nic", nic, { shouldValidate: true });
    };

    const filteredBranches = branches.filter((b: { name: string }) => 
        b.name?.toLowerCase().includes(branchSearch.toLowerCase())
    );

    const watchedValues = useWatch({ control: form.control });

    const steps = [
        { id: 1, label: "Info", icon: Building2 },
        { id: 2, label: "Finc", icon: Banknote },
        { id: 3, label: "Docs", icon: FileText },
        ...(watchedValues.type === 'SOD' ? [{ id: 4, label: "Groups", icon: Users }] : []),
        { id: 5, label: "Review", icon: CheckCircle2 }
    ];

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto w-full no-scrollbar rounded-3xl">
                <DialogHeader className="px-2">
                    <DialogTitle className="text-2xl font-black text-slate-900 tracking-tight">
                        {initialData ? 'Edit Profile' : 'Add New Contractor'}
                    </DialogTitle>
                    <DialogDescription className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                        {initialData ? 'Update existing contractor credentials.' : 'Follow the steps to register a new contractor entity.'}
                    </DialogDescription>
                </DialogHeader>

                <div className="flex items-center justify-center my-8 overflow-x-auto pb-4 gap-4 no-scrollbar border-b border-slate-100">
                    {steps.map((s, idx, arr) => (
                        <React.Fragment key={s.id}>
                            <div className="flex flex-col items-center gap-2 group cursor-pointer" onClick={() => step > s.id && setStep(s.id)}>
                                <div className={cn(
                                    "w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 shadow-sm",
                                    step === s.id ? "bg-blue-600 text-white ring-8 ring-blue-50 scale-110" :
                                        step > s.id ? "bg-green-500 text-white hover:bg-green-600" : "bg-white text-slate-300 border border-slate-100"
                                )}>
                                    <s.icon className={cn("w-5 h-5", step === s.id ? "animate-pulse" : "")} />
                                </div>
                                <span className={cn(
                                    "text-[10px] font-black uppercase tracking-widest text-center transition-colors",
                                    step >= s.id ? "text-slate-900" : "text-slate-300"
                                )}>{s.label}</span>
                            </div>
                            {idx < arr.length - 1 && (
                                <div className={cn("h-[2px] w-12 transition-all duration-500 mb-6", step > s.id ? "bg-green-500" : "bg-slate-100")} />
                            )}
                        </React.Fragment>
                    ))}
                </div>

                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8 px-2 pb-6">
                        {step === 1 && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                <FormField control={form.control} name="type" render={({ field }) => (
                                    <FormItem className="col-span-2">
                                        <FormLabel className="text-[10px] font-black uppercase tracking-widest text-slate-400">Industry Category</FormLabel>
                                        <Select onValueChange={field.onChange} value={field.value || "SOD"}>
                                            <FormControl><SelectTrigger className="h-12 bg-slate-50 border-none rounded-xl focus:ring-blue-100"><SelectValue placeholder="Identify Sector" /></SelectTrigger></FormControl>
                                            <SelectContent className="rounded-xl border-slate-100">
                                                <SelectItem value="SOD">Service Orders (Operations)</SelectItem>
                                                <SelectItem value="OSP">Network Projects (OSP)</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </FormItem>
                                )} />
                                
                                <FormField control={form.control} name="name" render={({ field }) => (
                                    <FormItem><FormLabel className="text-[10px] font-black uppercase tracking-widest text-slate-400">Contractor Name</FormLabel><FormControl><Input {...field} className="h-12 border-slate-100 rounded-xl focus:shadow-sm transition-all" placeholder="Legal / Trade Name" /></FormControl></FormItem>
                                )} />
                                <FormField control={form.control} name="registrationNumber" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-[10px] font-black uppercase tracking-widest text-slate-400">Reg Number (Auto)</FormLabel>
                                        <FormControl>
                                            <div className="relative group">
                                                <Input 
                                                    {...field} 
                                                    value={field.value || ""} 
                                                    className={cn("h-12 font-bold border-slate-100 rounded-xl", !initialData?.id ? "bg-slate-50 text-slate-400 italic cursor-not-allowed border-dashed" : "bg-white")} 
                                                    placeholder={!initialData?.id ? "Assigned by System" : "ERP-XXX-XXXX"} 
                                                    readOnly={!initialData?.id}
                                                />
                                                {!initialData?.id && (
                                                    <div className="absolute right-3 top-1/2 -translate-y-1/2 opacity-50 group-hover:opacity-100 transition-opacity">
                                                        <span className="text-[8px] font-black text-blue-600 uppercase tracking-tighter bg-blue-50 px-2 py-1 rounded-lg border border-blue-100">Secure Auto</span>
                                                    </div>
                                                )}
                                            </div>
                                        </FormControl>
                                    </FormItem>
                                )} />
                                <FormField control={form.control} name="address" render={({ field }) => (
                                    <FormItem className="col-span-2"><FormLabel className="text-[10px] font-black uppercase tracking-widest text-slate-400">Office Address</FormLabel><FormControl><Textarea {...field} value={field.value || ""} className="resize-none border-slate-100 rounded-xl focus:ring-blue-100 min-h-[80px]" placeholder="Principal place of business..." /></FormControl></FormItem>
                                )} />
                                <FormField control={form.control} name="nic" render={({ field }) => (
                                    <FormItem><FormLabel className="text-[10px] font-black uppercase tracking-widest text-slate-400">NIC Number</FormLabel><FormControl><Input {...field} className="h-12 border-slate-100 rounded-xl" placeholder="9XXXXXXXXV / 20XXXXXXXXXX" /></FormControl></FormItem>
                                )} />
                                <FormField control={form.control} name="contactNumber" render={({ field }) => (
                                    <FormItem><FormLabel className="text-[10px] font-black uppercase tracking-widest text-slate-400">Phone Number</FormLabel><FormControl><Input {...field} className="h-12 border-slate-100 rounded-xl" placeholder="07XXXXXXXX" /></FormControl></FormItem>
                                )} />
                            </div>
                        )}

                        {step === 2 && (
                            <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <FormField control={form.control} name="bankName" render={({ field }) => (
                                        <FormItem className="col-span-2">
                                            <FormLabel className="text-[10px] font-black uppercase tracking-widest text-slate-400">Financial Institution</FormLabel>
                                            {!manualBank ? (
                                                <Select
                                                    value={banks.find(b => b.name === field.value)?.id}
                                                    onValueChange={(val) => {
                                                        if (val === "OTHER") { setManualBank(true); field.onChange(""); }
                                                        else { const b = banks.find(x => x.id === val); field.onChange(b?.name || ""); }
                                                    }}>
                                                    <FormControl><SelectTrigger className="h-11 shadow-sm"><SelectValue placeholder="Select Corporate Bank" /></SelectTrigger></FormControl>
                                                    <SelectContent>{banks.map(b => (<SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>))}<SelectItem value="OTHER" className="font-bold text-blue-600">+ Other Bank</SelectItem></SelectContent>
                                                </Select>
                                            ) : (<div className="flex gap-2"><Input {...field} value={field.value || ""} className="h-11" placeholder="Enter bank name" /><Button variant="ghost" className="h-11" onClick={() => setManualBank(false)}><X className="w-4 h-4" /></Button></div>)}
                                        </FormItem>
                                    )} />

                                    <FormField control={form.control} name="bankBranch" render={({ field }) => (
                                        <FormItem className="col-span-2 relative">
                                            <FormLabel className="text-[10px] font-black uppercase tracking-widest text-slate-400">Settlement Branch</FormLabel>
                                            <div className="relative">
                                                <Input 
                                                    className="h-11 pr-10" 
                                                    placeholder="Locate branch..." 
                                                    value={field.value || branchSearch}
                                                    onChange={e => { setBranchSearch(e.target.value); field.onChange(e.target.value); setShowBranchList(true); }}
                                                    onFocus={() => setShowBranchList(true)}
                                                />
                                                {showBranchList && branchSearch.length > 1 && (
                                                    <div className="absolute z-50 w-full mt-1 bg-white border border-slate-100 rounded-xl shadow-2xl max-h-60 overflow-y-auto no-scrollbar py-2">
                                                        {filteredBranches.slice(0, 10).map(br => (
                                                            <div key={br.id} className="px-4 py-2 hover:bg-slate-50 cursor-pointer text-xs font-bold text-slate-700" onClick={() => { field.onChange(br.name); setBranchSearch(br.name); setShowBranchList(false); }}>{br.name}</div>
                                                        ))}
                                                        <div className="px-4 py-2 text-[10px] font-black text-blue-600 border-t mt-2 cursor-pointer hover:bg-blue-50" onClick={() => setShowBranchList(false)}>Use Custom Entry: &quot;{branchSearch}&quot;</div>
                                                    </div>
                                                )}
                                            </div>
                                        </FormItem>
                                    )} />

                                    <FormField control={form.control} name="bankAccountNumber" render={({ field }) => (
                                        <FormItem className="col-span-2"><FormLabel className="text-[10px] font-black uppercase tracking-widest text-slate-400">Account sequence</FormLabel><FormControl><Input {...field} value={field.value || ""} className="h-11 font-mono tracking-widest" /></FormControl></FormItem>
                                    )} />
                                </div>
                            </div>
                        )}

                        {step === 3 && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in slide-in-from-right-4">
                                <FileUploadField label="NIC Front Scan" fieldName="nicFrontUrl" value={watchedValues.nicFrontUrl} onUpload={handleUpload} progress={uploadProgress['nicFrontUrl']} isScanning={isScanning} onScan={handleNICScan} required />
                                <FileUploadField label="NIC Back Scan" fieldName="nicBackUrl" value={watchedValues.nicBackUrl} onUpload={handleUpload} progress={uploadProgress['nicBackUrl']} required />
                                <FileUploadField label="Passport Photo" fieldName="photoUrl" value={watchedValues.photoUrl} onUpload={handleUpload} progress={uploadProgress['photoUrl']} required />
                                <FileUploadField label="Payment Receipt" fieldName="registrationFeeSlipUrl" value={watchedValues.registrationFeeSlipUrl} onUpload={handleUpload} progress={uploadProgress['registrationFeeSlipUrl']} required />
                                <FileUploadField label="BR Certificate" fieldName="brCertUrl" value={watchedValues.brCertUrl} onUpload={handleUpload} progress={uploadProgress['brCertUrl']} />
                                <FileUploadField label="Police Clearance" fieldName="policeReportUrl" value={watchedValues.policeReportUrl} onUpload={handleUpload} progress={uploadProgress['policeReportUrl']} />
                            </div>
                        )}

                        {step === 4 && (
                            <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
                                <div className="p-4 bg-slate-900 rounded-2xl text-white flex justify-between items-center shadow-lg shadow-slate-200">
                                    <div className="flex items-center gap-3">
                                        <Users className="w-5 h-5 text-blue-400" />
                                        <div>
                                            <p className="text-xs font-black uppercase tracking-widest">Technician Clusters</p>
                                            <p className="text-[10px] text-slate-400">Assigned teams: {watchedValues.teams?.length || 0}</p>
                                        </div>
                                    </div>
                                    <Button type="button" size="sm" className="bg-blue-600 hover:bg-blue-700 h-8" onClick={() => {
                                        const teams = form.getValues('teams') || [];
                                        form.setValue('teams', [...teams, { name: `Team ${teams.length + 1}`, primaryStoreId: "", members: [] }]);
                                    }}>
                                        <Plus className="w-4 h-4 mr-2" /> Add Team
                                    </Button>
                                </div>
                                <div className="space-y-4 max-h-[400px] overflow-y-auto no-scrollbar pr-2">
                                    {(watchedValues.teams || []).map((team, idx) => (
                                        <div key={idx} className="p-4 rounded-2xl border border-slate-100 bg-slate-50 relative group">
                                            <div className="flex justify-between items-center mb-4">
                                                <Input value={team.name} onChange={e => {
                                                    const currentTeams = form.getValues('teams');
                                                    if (!currentTeams) return;
                                                    const teams = [...currentTeams];
                                                    teams[idx].name = e.target.value;
                                                    form.setValue('teams', teams);
                                                }} className="h-8 w-fit bg-transparent border-none font-bold text-slate-800 shadow-none px-0" />
                                                <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-red-400 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => {
                                                    const teams = form.getValues('teams').filter((_, i) => i !== idx);
                                                    form.setValue('teams', teams);
                                                }}><X className="w-4 h-4" /></Button>
                                            </div>
                                            <Select value={team.primaryStoreId || ""} onValueChange={v => {
                                                const currentTeams = form.getValues('teams');
                                                if (!currentTeams) return;
                                                const teams = [...currentTeams];
                                                teams[idx].primaryStoreId = v;
                                                form.setValue('teams', teams);
                                            }}>
                                                <SelectTrigger className="h-9 bg-white text-xs"><SelectValue placeholder="Assign Primary Store" /></SelectTrigger>
                                                <SelectContent>{stores.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                                            </Select>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {step === 5 && (
                            <div className="space-y-8 animate-in fade-in zoom-in duration-500 text-center py-6">
                                <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-blue-100 text-blue-600 mb-2">
                                    <CheckCircle2 className="w-8 h-8" />
                                </div>
                                <div>
                                    <h3 className="text-xl font-black text-slate-900 tracking-tight">Review & Authenticate</h3>
                                    <p className="text-xs text-slate-500 mt-2 max-w-sm mx-auto leading-relaxed">
                                        Verify all credentials and jurisdictional assignments. Finalizing this will trigger state synchronization across the production environment.
                                    </p>
                                </div>
                                <div className="grid grid-cols-2 gap-4 px-10">
                                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                                        <p className="text-[10px] font-black uppercase text-slate-400">Legal Identity</p>
                                        <p className="text-sm font-bold text-slate-800 mt-1 truncate">{watchedValues.name}</p>
                                    </div>
                                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                                        <p className="text-[10px] font-black uppercase text-slate-400">Jurisdiction</p>
                                        <p className="text-sm font-bold text-slate-800 mt-1">{watchedValues.type}</p>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="flex justify-between items-center pt-10 border-t border-slate-100">
                            {step > 1 ? (
                                <Button type="button" variant="ghost" onClick={() => setStep(prev => prev - 1)} className="font-black text-[10px] uppercase tracking-[0.2em] text-slate-400 hover:text-slate-900 transition-colors h-12 px-8">
                                    <ChevronLeft className="w-4 h-4 mr-2" /> Back
                                </Button>
                            ) : <div />}

                            {step < 5 ? (
                                <Button 
                                    type="button" 
                                    className="bg-slate-900 hover:bg-black h-12 px-12 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] shadow-2xl shadow-slate-200 transition-all hover:-translate-y-0.5" 
                                    onClick={async () => {
                                        // Step validation before moving next
                                        let fields: (keyof ContractorSchema)[] = [];
                                        if (step === 1) fields = ['name', 'nic', 'contactNumber', 'type'];
                                        if (step === 2) fields = ['bankAccountNumber'];
                                        if (step === 3) fields = ['nicFrontUrl', 'nicBackUrl', 'photoUrl', 'registrationFeeSlipUrl'];
                                        
                                        const isValid = fields.length > 0 ? await form.trigger(fields) : true;
                                        if (isValid) {
                                            if (step === 3 && watchedValues.type !== 'SOD') {
                                                setStep(5);
                                            } else {
                                                setStep(prev => prev + 1);
                                            }
                                        } else {
                                            toast.error("Please fill all required details for this step.");
                                        }
                                    }}
                                >
                                    Continue <ChevronRight className="w-4 h-4 ml-2" />
                                </Button>
                            ) : (
                                <Button type="submit" disabled={isSubmitting} className="bg-blue-600 hover:bg-blue-700 h-12 px-12 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] shadow-2xl shadow-blue-200 transition-all hover:scale-[1.02]">
                                    {isSubmitting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Finalizing...</> : 'Confirm & Save'}
                                </Button>
                            )}
                        </div>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
