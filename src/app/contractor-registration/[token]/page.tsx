"use client";

import React from "react";
import { useParams } from "next/navigation";
import { Form } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Loader2, CheckCircle, ChevronRight, ChevronLeft, ShieldCheck, HelpCircle } from "lucide-react";
import Image from "next/image";

// Hooks & Components
import { useContractorRegistration } from "@/hooks/useContractorRegistration";
import { Step1PersonalInfo } from "../components/Step1PersonalInfo";
import { Step2IdentityDocs } from "../components/Step2IdentityDocs";
import { Step3BankInfo } from "../components/Step3BankInfo";
import { Step4TeamSelection } from "../components/Step4TeamSelection";
import { Step5ReviewSubmission } from "../components/Step5ReviewSubmission";

export default function PublicContractorRegistrationPage() {
    const { token } = useParams<{ token: string }>();
    const {
        form, step, loading, submitting, submitted, staticData,
        uploadProgress, nextStep, prevStep, handleUpload, onSubmit
    } = useContractorRegistration(token);

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
                <div className="relative mb-8">
                    <div className="absolute inset-0 bg-blue-400/20 blur-3xl rounded-full animate-pulse" />
                    <Image src="/logo5.png" alt="SLTS ERP" width={180} height={60} className="relative opacity-20 grayscale brightness-150" priority />
                </div>
                <div className="flex flex-col items-center gap-4 bg-white p-10 rounded-3xl shadow-2xl border border-slate-100 max-w-sm animate-in fade-in zoom-in duration-500">
                    <div className="relative h-14 w-14">
                        <Loader2 className="h-14 w-14 text-blue-600 animate-spin" />
                        <div className="absolute inset-0 flex items-center justify-center text-[10px] font-black text-blue-600 uppercase">SLT</div>
                    </div>
                    <div>
                        <h2 className="text-lg font-bold text-slate-900">Validating Link...</h2>
                        <p className="text-xs text-slate-500 mt-1 leading-relaxed px-4">Establishing a secure connection to the registry and preparing your profile data.</p>
                    </div>
                </div>
            </div>
        );
    }

    if (submitted) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 text-center animate-in fade-in duration-700">
                <div className="max-w-md w-full bg-white p-10 rounded-3xl shadow-2xl border border-slate-100 space-y-8">
                    <div className="inline-flex h-20 w-20 items-center justify-center rounded-full bg-green-100 text-green-600 shadow-lg shadow-green-100 relative">
                        <CheckCircle className="h-10 w-10" />
                        <div className="absolute -top-1 -right-1 h-6 w-6 bg-white rounded-full flex items-center justify-center shadow-sm">
                            <ShieldCheck className="h-4 w-4 text-blue-500" />
                        </div>
                    </div>
                    <div className="space-y-3">
                        <h1 className="text-2xl font-black text-slate-900">Submission Received</h1>
                        <p className="text-sm text-slate-500 px-4 leading-relaxed">
                            Your application has been successfully transmitted and is currently in the **Initial Review Queue**. You will receive an email within 48-72 hours.
                        </p>
                    </div>
                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 text-[11px] text-slate-500 font-medium">
                        Reference Hash: <code className="text-blue-600 font-bold bg-blue-50 px-1.5 py-0.5 rounded ml-1">{token.substring(0, 12)}</code>
                    </div>
                    <Button onClick={() => window.location.href = '/'} className="w-full h-12 rounded-xl bg-slate-900 hover:bg-slate-800 text-sm font-bold shadow-xl shadow-slate-200 transition-all hover:-translate-y-1">
                        Return to Homepage
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 selection:bg-blue-100">
            {/* Minimal Header */}
            <header className="fixed top-0 inset-x-0 h-20 bg-white/80 backdrop-blur-md border-b z-50 transition-all">
                <div className="max-w-5xl mx-auto h-full px-6 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Image src="/logo5.png" alt="SLTS ERP" width={120} height={40} className="w-auto h-8" />
                        <div className="h-6 w-px bg-slate-200 mx-1 hidden sm:block" />
                        <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest hidden sm:block">Contractor Onboarding</span>
                    </div>
                    <div className="flex items-center gap-3">
                         <div className="text-right hidden xs:block">
                            <p className="text-[10px] font-black uppercase text-slate-400">Security Clearance</p>
                            <p className="text-[10px] font-bold text-green-600 flex items-center justify-end gap-1">
                                <ShieldCheck className="w-3 h-3" /> Encrypted Session
                            </p>
                         </div>
                         <Button variant="ghost" size="icon" className="h-10 w-10 rounded-full bg-slate-50 text-slate-400">
                            <HelpCircle className="w-5 h-5" />
                         </Button>
                    </div>
                </div>
            </header>

            <main className="max-w-4xl mx-auto pt-32 pb-24 px-6">
                <Form {...form}>
                    <form onSubmit={onSubmit} className="space-y-10">
                        {/* Step Tracking Header */}
                        <div className="space-y-6">
                            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 px-1">
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2 mb-1">
                                        <div className="h-1 w-8 bg-blue-600 rounded-full" />
                                        <span className="text-[10px] font-black uppercase tracking-[0.3em] text-blue-600/80">Onboarding Progress</span>
                                    </div>
                                    <h2 className="text-3xl font-black text-slate-900 tracking-tight leading-none italic uppercase">
                                        {step === 1 ? 'Contractor Identity' : 
                                         step === 2 ? 'Security Credentials' : 
                                         step === 3 ? 'Settlement Details' : 
                                         step === 4 ? 'Jurisdiction Setup' : 
                                         'Final Verification'}
                                    </h2>
                                    <p className="text-xs text-slate-400 font-bold mt-2">Section {step} of 5 • Secure Data Transmission Active</p>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="hidden sm:block h-10 w-px bg-slate-100 mx-2" />
                                    <div className="bg-slate-900 text-white px-5 py-2.5 rounded-2xl shadow-xl shadow-slate-200 flex items-center gap-3 animate-in fade-in zoom-in duration-500">
                                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-200">Step</span>
                                        <span className="text-xl font-black leading-none">0{step}</span>
                                        <span className="text-xs font-black text-blue-400/90 italic">/ 05</span>
                                    </div>
                                </div>
                            </div>
                            <div className="relative">
                                <Progress value={(step / 5) * 100} className="h-1.5 bg-slate-100" />
                                <div className="absolute -top-1 left-0 w-full h-full pointer-events-none opacity-20">
                                    <div className="h-full bg-gradient-to-r from-transparent via-white to-transparent w-20 animate-glow" />
                                </div>
                            </div>
                        </div>

                        {/* Steps Container */}
                        <Card className="border-none shadow-2xl shadow-slate-200/50 rounded-[32px] overflow-hidden bg-white/50 backdrop-blur-sm border border-white/20">
                            <CardContent className="p-0">
                                <div className="p-8 sm:p-12">
                                    {step === 1 && <Step1PersonalInfo />}
                                    {step === 2 && <Step2IdentityDocs onUpload={handleUpload} uploadProgress={uploadProgress} />}
                                    {step === 3 && <Step3BankInfo banks={staticData.banks} branches={staticData.branches} onUpload={handleUpload} uploadProgress={uploadProgress} />}
                                    {step === 4 && <Step4TeamSelection stores={staticData.stores} opmcs={staticData.opmcs} />}
                                    {step === 5 && <Step5ReviewSubmission />}
                                </div>

                                {/* Persistent Navigation Bar */}
                                <div className="p-6 sm:p-8 bg-slate-50/80 border-t flex flex-col sm:flex-row justify-between items-center gap-4">
                                    {step > 1 ? (
                                        <Button type="button" variant="outline" onClick={prevStep} disabled={submitting} className="w-full sm:w-auto h-12 px-8 rounded-xl font-bold text-slate-600 shadow-sm transition-all hover:bg-white">
                                            <ChevronLeft className="w-4 h-4 mr-2" /> Previous Step
                                        </Button>
                                    ) : <div className="hidden sm:block" />}

                                    <div className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto">
                                        <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest hidden lg:block">Draft auto-saved {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                                        
                                        {step < 5 ? (
                                            <Button type="button" onClick={nextStep} className="w-full sm:w-auto h-12 px-12 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-xl shadow-blue-200 transition-all hover:translate-x-1">
                                                Continue onboarding <ChevronRight className="w-4 h-4 ml-2" />
                                            </Button>
                                        ) : (
                                            <Button type="submit" disabled={submitting} className="w-full sm:w-auto h-12 px-12 rounded-xl bg-green-600 hover:bg-green-700 text-white font-black shadow-xl shadow-green-200 transition-all hover:-translate-y-1">
                                                {submitting ? (
                                                    <>
                                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Transmitting...
                                                    </>
                                                ) : 'Confirm & Submit Application'}
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Footer Help */}
                        <div className="text-center px-10">
                            <p className="text-xs text-slate-400 leading-relaxed max-w-lg mx-auto">
                                If you experience technical issues, contact the SLT Regional Office. 
                                By proceeding, you agree to our digital onboarding terms.
                            </p>
                        </div>
                    </form>
                </Form>
            </main>
        </div>
    );
}
