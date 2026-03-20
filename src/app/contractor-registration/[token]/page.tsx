"use client";

import React from "react";
import { useParams } from "next/navigation";
import { useContractorRegistration } from "@/hooks/useContractorRegistration";
import { Form } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { 
    Building2, 
    ChevronRight, 
    ChevronLeft, 
    CheckCircle2, 
    Loader2, 
    ShieldCheck, 
    Lock,
    Save
} from "lucide-react";
import { Step1PersonalInfo } from "../components/Step1PersonalInfo";
import { Step2IdentityDocs } from "../components/Step2IdentityDocs";
import { Step3BankInfo } from "../components/Step3BankInfo";
import { Step4TeamSelection } from "../components/Step4TeamSelection";
import { Step5ReviewSubmission } from "../components/Step5ReviewSubmission";
import { cn } from "@/lib/utils";

export default function ContractorRegistrationPage() {
    const { token } = useParams<{ token: string }>();
    const {
        form, step, loading, submitting, submitted, error, staticData,
        uploadProgress, nextStep, prevStep, handleUpload, handleRegistrationSubmit
    } = useContractorRegistration(token);

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <div className="flex flex-col items-center gap-4">
                    <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
                    <p className="text-xs font-black text-slate-900 uppercase tracking-widest">Loading...</p>
                </div>
            </div>
        );
    }

    if (error || (token && !loading && !form.getValues().name && error)) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
                <div className="max-w-md w-full bg-white border-2 border-slate-200 rounded-3xl shadow-sm p-10 text-center space-y-6">
                    <div className="inline-flex h-20 w-20 items-center justify-center bg-red-50 rounded-full text-red-600 mb-2 border-2 border-red-100">
                        <Lock className="w-10 h-10" />
                    </div>
                    <h2 className="text-2xl font-black text-slate-900 tracking-tight uppercase">Link Invalid</h2>
                    <p className="text-slate-900 text-sm font-bold opacity-80 leading-relaxed uppercase">
                        {error === 'INVALID_TOKEN' ? "This registration link is invalid or has already been used." : "This registration link has expired or is no longer active."}
                    </p>
                    <div className="pt-4">
                        <Button className="w-full bg-slate-900 hover:bg-black text-white rounded-xl h-12 font-black uppercase text-[11px] tracking-widest shadow-lg" onClick={() => window.location.href = '/'}>
                            Back to Home
                        </Button>
                    </div>
                </div>
            </div>
        );
    }

    if (submitted) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
                <div className="max-w-md w-full bg-white border-2 border-slate-200 rounded-3xl shadow-sm p-10 text-center space-y-6">
                    <div className="inline-flex h-20 w-20 items-center justify-center bg-emerald-50 rounded-full text-emerald-600 mb-2 border-2 border-emerald-100">
                        <CheckCircle2 className="w-10 h-10" />
                    </div>
                    <h2 className="text-2xl font-black text-slate-900 tracking-tight uppercase">Success</h2>
                    <p className="text-slate-900 text-sm font-bold opacity-80 leading-relaxed uppercase">
                        Registration submitted successfully. We will review and notify you soon.
                    </p>
                    <div className="pt-4">
                        <Button className="w-full bg-slate-900 hover:bg-black text-white rounded-xl h-12 font-black uppercase text-[11px] tracking-widest shadow-lg" onClick={() => window.location.href = '/'}>
                            Back to Home
                        </Button>
                    </div>
                </div>
            </div>
        );
    }

    const steps = [
        { id: 1, title: "Company" },
        { id: 2, title: "Identity" },
        { id: 3, title: "Bank" },
        { id: 4, title: "Teams" },
        { id: 5, title: "Review" }
    ];

    return (
        <div className="min-h-screen bg-slate-50 antialiased selection:bg-blue-100 selection:text-blue-900">
            {/* Simple ERP Header */}
            <header className="bg-white border-b-2 border-slate-200 sticky top-0 z-50">
                <div className="max-w-7xl mx-auto px-4 h-20 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="flex items-center justify-center h-12 w-12 bg-blue-600 rounded-xl text-white shadow-md">
                            <Building2 className="w-7 h-7" />
                        </div>
                        <div>
                            <h1 className="text-lg font-black text-slate-900 uppercase tracking-tight">Contractor Registration</h1>
                            <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-[10px] font-black text-slate-900 uppercase tracking-widest opacity-60">Professional Portal</span>
                            </div>
                        </div>
                    </div>
                    
                    <div className="hidden md:flex items-center gap-4">
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 rounded-xl border-2 border-slate-200">
                            <Lock className="w-4 h-4 text-slate-900" />
                            <span className="text-[10px] font-black text-slate-900 uppercase tracking-widest">SECURE</span>
                        </div>
                    </div>
                </div>
            </header>

            <main className="max-w-5xl mx-auto py-12 px-4 sm:px-6">
                {/* Simple Stepper */}
                <nav className="mb-10 bg-white border-2 border-slate-200 p-5 rounded-2xl shadow-sm overflow-x-auto no-scrollbar">
                    <div className="flex items-center justify-between min-w-[600px] px-2">
                        {steps.map((s, idx) => (
                            <React.Fragment key={s.id}>
                                <div className="flex items-center gap-3">
                                    <div className={cn(
                                        "h-8 w-8 rounded-full flex items-center justify-center text-[10px] font-black transition-all border-2",
                                        step >= s.id 
                                            ? "bg-blue-600 border-blue-600 text-white shadow-md" 
                                            : "bg-white border-slate-200 text-slate-400"
                                    )}>
                                        {step > s.id ? <CheckCircle2 className="w-4 h-4" /> : s.id}
                                    </div>
                                    <span className={cn(
                                        "text-[11px] font-black uppercase tracking-widest",
                                        step === s.id ? "text-slate-900" : "text-slate-400"
                                    )}>
                                        {s.title}
                                    </span>
                                </div>
                                {idx < steps.length - 1 && (
                                    <div className="h-[2px] w-6 bg-slate-200 mx-1" />
                                )}
                            </React.Fragment>
                        ))}
                    </div>
                </nav>

                <Form {...form}>
                    <form onSubmit={form.handleSubmit(handleRegistrationSubmit)} className="space-y-10">
                        {/* Main Interface */}
                        <div className="bg-white border-2 border-slate-200 rounded-3xl shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <div className="border-b-2 border-slate-100 bg-slate-50/50 p-6 sm:px-10 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="h-2 w-6 bg-blue-600 rounded-full" />
                                    <h2 className="text-[11px] font-black uppercase text-slate-900 tracking-widest opacity-80">Step {step} of 5</h2>
                                </div>
                                <div className="flex items-center gap-2 text-[9px] font-black text-slate-900 uppercase tracking-widest opacity-60">
                                    <Save className="w-3 h-3" /> Auto-saved
                                </div>
                            </div>
                            
                            <div className="p-8 sm:p-14 sm:px-16">
                                {step === 1 && <Step1PersonalInfo />}
                                {step === 2 && <Step2IdentityDocs handleUpload={handleUpload} />}
                                {step === 3 && <Step3BankInfo handleUpload={handleUpload} uploadProgress={uploadProgress} staticData={staticData} />}
                                {step === 4 && <Step4TeamSelection staticData={staticData} handleUpload={handleUpload} />}
                                {step === 5 && <Step5ReviewSubmission />}
                            </div>

                            {/* Footer Buttons */}
                            <div className="border-t-2 border-slate-100 bg-slate-50/50 p-8 sm:px-16 flex items-center justify-between">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={prevStep}
                                    disabled={step === 1 || submitting}
                                    className="h-12 px-8 font-black uppercase tracking-widest text-[10px] border-2 border-slate-200 hover:bg-white rounded-xl shadow-sm transition-all"
                                >
                                    <ChevronLeft className="w-4 h-4 mr-2" /> Back
                                </Button>
                                
                                {step < 5 ? (
                                    <Button
                                        type="button"
                                        onClick={nextStep}
                                        disabled={submitting}
                                        className="h-12 px-10 font-black uppercase tracking-widest text-[10px] bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-lg transition-all"
                                    >
                                        Next <ChevronRight className="w-4 h-4 ml-2" />
                                    </Button>
                                ) : (
                                    <Button
                                        type="submit"
                                        disabled={submitting}
                                        className="h-12 px-10 font-black uppercase tracking-widest text-[10px] bg-slate-900 hover:bg-black text-white rounded-xl shadow-xl transition-all"
                                    >
                                        {submitting ? (
                                            <>
                                                <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Sending...
                                            </>
                                        ) : (
                                            <>
                                                Submit <ShieldCheck className="w-4 h-4 ml-2 text-emerald-400" />
                                            </>
                                        )}
                                    </Button>
                                )}
                            </div>
                        </div>

                        {/* Security Footer */}
                        <div className="flex items-center justify-center gap-4 py-8 opacity-40">
                            <div className="h-[2px] w-8 bg-slate-300" />
                            <div className="flex items-center gap-2">
                                <Lock className="w-3.5 h-3.5 text-slate-500" />
                                <span className="text-[9px] font-black text-slate-900 uppercase tracking-widest">Secure Portal Active</span>
                            </div>
                            <div className="h-[2px] w-8 bg-slate-300" />
                        </div>
                    </form>
                </Form>
            </main>
        </div>
    );
}
