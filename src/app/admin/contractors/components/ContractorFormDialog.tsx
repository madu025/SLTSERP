"use client";

import React, { useState, useEffect } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { contractorSchema, ContractorSchema } from "@/lib/validations/contractor.schema";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Building2, Banknote, FileText, Users, CheckCircle2, ChevronRight, ChevronLeft, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { ContractorRegistrationApi } from "@/services/api/contractor-registration.api";
import { Step1PersonalInfo } from "../../../contractor-registration/components/Step1PersonalInfo";
import { Step2IdentityDocs } from "../../../contractor-registration/components/Step2IdentityDocs";
import { Step3BankInfo } from "../../../contractor-registration/components/Step3BankInfo";
import { Step4TeamSelection } from "../../../contractor-registration/components/Step4TeamSelection";

interface ContractorFormDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    initialData?: Partial<ContractorSchema> & { id?: string };
    onSubmit: (data: ContractorSchema) => Promise<void>;
    isSubmitting: boolean;
    banks: { id: string; name: string }[];
    branches: { id: string; name: string }[];
    opmcs: { id: string; name: string; rtom: string }[];
}

export function ContractorFormDialog({
    open,
    onOpenChange,
    initialData,
    onSubmit,
    isSubmitting,
    banks,
    branches,
    opmcs
}: ContractorFormDialogProps) {
    const [step, setStep] = useState(1);
    const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});

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
        if (!open) return; // Only run when dialog opens
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
            setStep(1);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

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
                    <DialogDescription className="text-[11px] font-bold text-slate-900 uppercase tracking-widest mt-1 opacity-70">
                        {initialData ? 'Update account details.' : 'Fill in the details to register a new contractor.'}
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
                            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                <FormField control={form.control} name="type" render={({ field }) => (
                                    <FormItem className="col-span-2">
                                        <FormLabel className="text-[10px] font-black uppercase tracking-widest text-slate-900">Industry Category</FormLabel>
                                        <Select onValueChange={field.onChange} value={field.value || "SOD"}>
                                            <FormControl><SelectTrigger className="h-12 bg-slate-50 border-none rounded-xl focus:ring-blue-100"><SelectValue placeholder="Identify Sector" /></SelectTrigger></FormControl>
                                            <SelectContent className="rounded-xl border-slate-100">
                                                <SelectItem value="SOD">Service Orders (Operations)</SelectItem>
                                                <SelectItem value="OSP">Network Projects (OSP)</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </FormItem>
                                )} />
                                <Step1PersonalInfo />
                            </div>
                        )}

                        {step === 2 && (
                             <Step3BankInfo staticData={{ banks, branches }} handleUpload={handleUpload} uploadProgress={uploadProgress} />
                        )}

                        {step === 3 && (
                            <Step2IdentityDocs handleUpload={handleUpload} />
                        )}

                        {step === 4 && <Step4TeamSelection staticData={{ opmcs }} />}

                        {step === 5 && (
                            <div className="space-y-8 animate-in fade-in zoom-in duration-500 text-center py-6">
                                <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-blue-100 text-blue-600 mb-2">
                                    <CheckCircle2 className="w-8 h-8" />
                                </div>
                                <div>
                                    <h3 className="text-xl font-black text-slate-900 tracking-tight uppercase">Review & Save</h3>
                                    <p className="text-xs text-slate-900 mt-2 max-w-sm mx-auto font-bold opacity-80 leading-relaxed uppercase">
                                        Check the information below before saving the profile.
                                    </p>
                                </div>
                                <div className="grid grid-cols-2 gap-4 px-10">
                                    <div className="bg-slate-50 p-4 rounded-2xl border-2 border-slate-200">
                                        <p className="text-[10px] font-black uppercase text-slate-900 opacity-60">Entity Name</p>
                                        <p className="text-sm font-bold text-slate-900 mt-1 truncate">{watchedValues.name}</p>
                                    </div>
                                    <div className="bg-slate-50 p-4 rounded-2xl border-2 border-slate-200">
                                        <p className="text-[10px] font-black uppercase text-slate-900 opacity-60">Category</p>
                                        <p className="text-sm font-bold text-slate-900 mt-1">{watchedValues.type === 'SOD' ? 'Service Orders' : 'Network Projects'}</p>
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
                                        // Steps 2 & 3 are optional — allow free navigation
                                        
                                        const isValid = fields.length > 0 ? await form.trigger(fields) : true;
                                        if (isValid) {
                                            if (step === 3 && watchedValues.type !== 'SOD') {
                                                setStep(5);
                                            } else {
                                                setStep(prev => prev + 1);
                                            }
                                        } else {
                                            toast.error("Please complete all required fields before continuing.");
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
