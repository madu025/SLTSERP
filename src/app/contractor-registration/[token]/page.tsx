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
        form, step, loading, submitting, submitted, staticData,
        uploadProgress, nextStep, prevStep, handleUpload, handleRegistrationSubmit
    } = useContractorRegistration(token);

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <div className="flex flex-col items-center gap-4">
                    <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
                    <p className="text-sm font-semibold text-slate-600 uppercase tracking-widest">Initialising ERP Portal...</p>
                </div>
            </div>
        );
    }

    if (submitted) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
                <div className="max-w-md w-full bg-white border border-slate-200 rounded-xl shadow-sm p-10 text-center space-y-6">
                    <div className="inline-flex h-20 w-20 items-center justify-center bg-emerald-50 rounded-full text-emerald-600 mb-2">
                        <CheckCircle2 className="w-10 h-10" />
                    </div>
                    <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Application Submitted</h2>
                    <p className="text-slate-500 text-sm leading-relaxed">
                        Your enterprise registration request has been successfully recorded in the SLTS ERP system. 
                        Our verification team will review your credentials and notify you via email shortly.
                    </p>
                    <div className="pt-4">
                        <Button className="w-full bg-slate-950 hover:bg-slate-900 text-white rounded-lg h-11 font-semibold" onClick={() => window.location.href = '/'}>
                            Return to Dashboard
                        </Button>
                    </div>
                </div>
            </div>
        );
    }

    const steps = [
        { id: 1, title: "Company Profile" },
        { id: 2, title: "Identity Registry" },
        { id: 3, title: "Financial Data" },
        { id: 4, title: "Operational Units" },
        { id: 5, title: "Final Certification" }
    ];

    return (
        <div className="min-h-screen bg-slate-50 antialiased selection:bg-blue-100 selection:text-blue-900">
            {/* Professional ERP Header */}
            <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
                <div className="max-w-7xl mx-auto px-4 h-20 flex items-center justify-between">
                    <div className="flex items-center gap-5">
                        <div className="flex items-center justify-center h-12 w-12 bg-blue-600 rounded-lg text-white shadow-sm border border-blue-700">
                            <Building2 className="w-7 h-7" />
                        </div>
                        <div>
                            <h1 className="text-lg font-black text-slate-900 uppercase tracking-tight">SLTS ERP <span className="text-blue-600">Enterprise</span></h1>
                            <div className="flex items-center gap-2 mt-0.5">
                                <span className="flex h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Portal Version 2.4 | Secured Registration</span>
                            </div>
                        </div>
                    </div>
                    
                    <div className="hidden md:flex items-center gap-6">
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 rounded-lg border border-slate-200">
                            <Lock className="w-3.5 h-3.5 text-slate-500" />
                            <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest italic">Verification Auth Active</span>
                        </div>
                        <div className="text-right">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">System Status</p>
                            <p className="text-xs font-bold text-slate-900">Synchronized</p>
                        </div>
                    </div>
                </div>
            </header>

            <main className="max-w-5xl mx-auto py-12 px-4 sm:px-6">
                {/* Official Stepper Hub */}
                <nav className="mb-12 bg-white border border-slate-200 p-4 rounded-xl shadow-sm overflow-x-auto scroller-hidden">
                    <div className="flex items-center justify-between min-w-[700px] px-4">
                        {steps.map((s, idx) => (
                            <React.Fragment key={s.id}>
                                <div className="flex items-center gap-3">
                                    <div className={cn(
                                        "h-9 w-9 rounded-full flex items-center justify-center text-xs font-black transition-all border-2",
                                        step >= s.id 
                                            ? "bg-blue-600 border-blue-600 text-white shadow-md shadow-blue-100" 
                                            : "bg-white border-slate-200 text-slate-400"
                                    )}>
                                        {step > s.id ? <CheckCircle2 className="w-5 h-5 font-black" /> : s.id}
                                    </div>
                                    <span className={cn(
                                        "text-xs font-black uppercase tracking-widest",
                                        step === s.id ? "text-slate-900" : "text-slate-400"
                                    )}>
                                        {s.title}
                                    </span>
                                </div>
                                {idx < steps.length - 1 && (
                                    <div className="h-[2px] w-8 bg-slate-100 mx-2" />
                                )}
                            </React.Fragment>
                        ))}
                    </div>
                </nav>

                <Form {...form}>
                    <form onSubmit={form.handleSubmit(handleRegistrationSubmit)} className="space-y-10">
                        {/* Main Functional Interface */}
                        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-700">
                            <div className="border-b border-slate-100 bg-slate-50/50 p-6 sm:px-10 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="h-2 w-8 bg-blue-600 rounded-full" />
                                    <h2 className="text-[11px] font-black uppercase text-slate-500 tracking-[0.3em]">Module Stage: 0{step}</h2>
                                </div>
                                <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                    <Save className="w-3 h-3" /> Auto-Save Active
                                </div>
                            </div>
                            
                            <div className="p-8 sm:p-12 sm:px-16">
                                {step === 1 && <Step1PersonalInfo />}
                                {step === 2 && <Step2IdentityDocs handleUpload={handleUpload} uploadProgress={uploadProgress} />}
                                {step === 3 && <Step3BankInfo handleUpload={handleUpload} uploadProgress={uploadProgress} staticData={staticData} />}
                                {step === 4 && <Step4TeamSelection staticData={staticData} />}
                                {step === 5 && <Step5ReviewSubmission />}
                            </div>

                            {/* ERP Command Footer */}
                            <div className="border-t border-slate-100 bg-slate-50/50 p-8 sm:px-16 flex items-center justify-between">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={prevStep}
                                    disabled={step === 1 || submitting}
                                    className="h-12 px-8 font-black uppercase tracking-widest text-[10px] border-slate-200 hover:bg-white rounded-xl shadow-sm transition-all"
                                >
                                    <ChevronLeft className="w-4 h-4 mr-2" /> Previous Stage
                                </Button>
                                
                                {step < 5 ? (
                                    <Button
                                        type="button"
                                        onClick={nextStep}
                                        disabled={submitting}
                                        className="h-12 px-10 font-black uppercase tracking-widest text-[10px] bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-lg shadow-blue-100 transition-all"
                                    >
                                        Next Procedure <ChevronRight className="w-4 h-4 ml-2" />
                                    </Button>
                                ) : (
                                    <Button
                                        type="submit"
                                        disabled={submitting}
                                        className="h-12 px-10 font-black uppercase tracking-widest text-[10px] bg-slate-900 hover:bg-black text-white rounded-xl shadow-xl transition-all"
                                    >
                                        {submitting ? (
                                            <>
                                                <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Synchronizing...
                                            </>
                                        ) : (
                                            <>
                                                Final Submission <ShieldCheck className="w-4 h-4 ml-2 text-emerald-400" />
                                            </>
                                        )}
                                    </Button>
                                )}
                            </div>
                        </div>

                        {/* Security Notice */}
                        <div className="flex items-center justify-center gap-4 py-8 opacity-60">
                            <div className="h-px w-12 bg-slate-300" />
                            <div className="flex items-center gap-2">
                                <Lock className="w-3.5 h-3.5 text-slate-500" />
                                <span className="text-[9px] font-black text-slate-500 uppercase tracking-[0.4em]">Official Enterprise Data Transmission Protocol</span>
                            </div>
                            <div className="h-px w-12 bg-slate-300" />
                        </div>
                    </form>
                </Form>
            </main>
        </div>
    );
}
