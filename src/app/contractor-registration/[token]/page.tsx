"use client";

import React from "react";
import { useParams } from "next/navigation";
import { Form } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Loader2, CheckCircle, ChevronRight, ChevronLeft, ShieldCheck, HelpCircle, Building2, ExternalLink } from "lucide-react";
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
        uploadProgress, nextStep, prevStep, handleUpload, handleRegistrationSubmit
    } = useContractorRegistration(token);

    if (loading) {
        return (
            <div className="min-h-screen bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-blue-950 flex flex-col items-center justify-center p-6 text-center">
                <div className="fixed inset-0 overflow-hidden pointer-events-none">
                    <div className="absolute top-0 right-0 w-[50%] h-[50%] rounded-full bg-blue-600/10 blur-[120px] animate-pulse" />
                </div>
                <div className="relative z-10 space-y-12 animate-in fade-in zoom-in duration-1000">
                    <div className="flex flex-col items-center gap-8 bg-white/5 backdrop-blur-3xl p-16 rounded-[48px] shadow-[0_45px_100px_rgba(0,0,0,0.5)] border border-white/10 max-w-md ring-1 ring-white/5">
                        <div className="relative h-20 w-20 flex items-center justify-center">
                            <div className="absolute inset-0 rounded-full border-4 border-blue-500/20 border-t-blue-500 animate-spin" />
                            <Building2 className="w-10 h-10 text-white" />
                        </div>
                        <div className="space-y-4">
                            <h2 className="text-3xl font-black text-white tracking-tight">Synchronizing Hub</h2>
                            <p className="text-sm text-slate-400 font-bold leading-relaxed px-4 opacity-80">Establishing a secure enterprise channel to the SLTS registry...</p>
                        </div>
                        <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
                            <div className="h-full bg-blue-500 w-1/2 animate-[progress_2s_ease-in-out_infinite]" />
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (submitted) {
        return (
            <div className="min-h-screen bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-blue-950 flex items-center justify-center p-6 text-center">
                <div className="fixed inset-0 overflow-hidden pointer-events-none">
                    <div className="absolute top-0 right-0 w-[50%] h-[50%] rounded-full bg-blue-600/10 blur-[120px]" />
                </div>
                <div className="max-w-xl w-full bg-white/5 backdrop-blur-3xl p-16 rounded-[56px] shadow-[0_45px_100px_rgba(0,0,0,0.6)] border border-white/10 space-y-12 z-10 animate-in fade-in slide-in-from-bottom-6 duration-1000 ring-1 ring-white/5">
                    <div className="inline-flex h-28 w-28 items-center justify-center rounded-[32px] bg-emerald-500/20 text-emerald-400 shadow-2xl shadow-emerald-500/10 relative border border-emerald-500/20">
                        <CheckCircle className="h-12 w-12" />
                        <div className="absolute -top-3 -right-3 h-10 w-10 bg-slate-900 border border-white/10 rounded-2xl flex items-center justify-center shadow-2xl">
                            <ShieldCheck className="h-5 w-5 text-blue-400" />
                        </div>
                    </div>
                    <div className="space-y-4">
                        <h1 className="text-4xl font-black text-white tracking-tight">Transmission Successful</h1>
                        <p className="text-base text-slate-300 px-8 leading-relaxed font-semibold opacity-70">
                            Your contractor profile has been synchronized with the **Initial Review Queue**.
                        </p>
                    </div>
                    <div className="flex flex-col gap-6 pt-4">
                        <div className="p-6 bg-slate-950/50 rounded-3xl border border-white/5 text-[11px] text-slate-400 font-bold uppercase tracking-[0.3em] flex flex-col gap-2">
                            <span>Diagnostic Hash</span>
                            <code className="text-blue-400 text-sm font-black bg-blue-500/5 px-4 py-2 rounded-xl border border-blue-500/10 break-all">{token}</code>
                        </div>
                        <Button onClick={() => window.location.href = '/'} className="w-full h-16 rounded-[28px] bg-white text-slate-950 hover:bg-slate-200 text-sm font-black uppercase tracking-widest shadow-2xl transition-all hover:-translate-y-1">
                            Go to Entry Portal <ExternalLink className="w-4 h-4 ml-2" />
                        </Button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-blue-950 selection:bg-blue-500/30 selection:text-white antialiased overflow-x-hidden">
            {/* Ambient Ambient Background Lights */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-blue-600/10 blur-[120px] animate-pulse" />
                <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-blue-500/5 blur-[100px]" />
            </div>

            <main className="relative container max-w-6xl mx-auto py-16 px-4 sm:px-6 lg:px-8 z-10 flex flex-col items-center">
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(handleRegistrationSubmit)} className="w-full space-y-16">
                        {/* Elite Master Header */}
                        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-12 sm:gap-8 w-full px-4 sm:px-12 animate-in fade-in slide-in-from-top-6 duration-1000">
                            <div className="space-y-4">
                                <div className="flex items-center gap-3">
                                    <div className="p-3 bg-blue-600 text-white rounded-2xl shadow-[0_0_30px_rgba(37,99,235,0.5)]">
                                        <Building2 className="w-7 h-7" />
                                    </div>
                                    <div className="h-8 w-px bg-white/10 mx-1" />
                                    <div className="flex items-center gap-2.5 px-5 py-2 bg-white/5 backdrop-blur-xl border border-white/10 rounded-full">
                                        <div className="w-2 h-2 rounded-full bg-blue-400 animate-ping" />
                                        <span className="text-[10px] font-black uppercase tracking-[0.3em] text-white/90">Enterprise Secure Channel</span>
                                    </div>
                                </div>
                                <h1 className="text-4xl sm:text-6xl font-black text-white tracking-tighter leading-tight drop-shadow-2xl">
                                    Contractor <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-indigo-300 to-emerald-300">Enrollment</span>
                                </h1>
                                <p className="text-base sm:text-lg text-slate-400 max-w-xl font-semibold leading-relaxed">
                                    Join the SLTS enterprise service architecture. Complete your digital credentials audit to synchronize with the procurement grid.
                                </p>
                            </div>

                            <div className="flex flex-col items-end gap-6">
                                <div className="flex items-center gap-6 bg-white/5 backdrop-blur-3xl px-8 py-5 rounded-[40px] border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.3)] relative group overflow-hidden transition-all hover:border-white/20">
                                    <div className="absolute inset-0 bg-blue-600/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                                    <div className="flex flex-col items-end gap-1">
                                        <span className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-500">Service Synchronicity</span>
                                        <div className="flex items-baseline gap-1.5">
                                            <span className="text-5xl font-black text-white leading-none tracking-tighter">{step}</span>
                                            <span className="text-2xl font-black text-slate-600 leading-none">/ 5</span>
                                        </div>
                                    </div>
                                    <div className="h-12 w-px bg-white/10 mx-3" />
                                    <div className="flex items-center gap-4">
                                        <div className="relative h-16 w-16 rounded-3xl flex items-center justify-center p-1.5 border-2 border-white/10 bg-slate-950 overflow-hidden shadow-inner ring-1 ring-white/5">
                                            <svg className="absolute inset-0 h-full w-full -rotate-90">
                                                <circle cx="32" cy="32" r="28" className="stroke-white/5 fill-none" strokeWidth="4" />
                                                <circle cx="32" cy="32" r="28" className="stroke-blue-500 fill-none transition-all duration-1000 cubic-bezier(0.4, 0, 0.2, 1)" strokeWidth="4" strokeDasharray="176" strokeDashoffset={176 - (176 * step / 5)} />
                                            </svg>
                                            <span className="relative text-[12px] font-black text-white tracking-widest">{Math.round((step / 5) * 100)}%</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="text-right px-4">
                                    <p className="text-[10px] font-bold text-emerald-400 flex items-center justify-end gap-2 uppercase tracking-widest">
                                        <ShieldCheck className="w-3.5 h-3.5" /> End-to-End Encrypted Session
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Hyper-Modern Content Hub */}
                        <div className="relative w-full group animate-in zoom-in-95 fade-in duration-1000 delay-300 fill-mode-both">
                            {/* Card Aura Effect */}
                            <div className="absolute inset-x-12 inset-y-12 bg-blue-600/10 blur-[120px] rounded-[60px] pointer-events-none opacity-50 transition-all group-hover:opacity-100" />
                            
                            <Card className="relative w-full border-none shadow-[0_45px_100px_rgba(0,0,0,0.6)] rounded-[56px] overflow-hidden bg-white/5 backdrop-blur-[60px] border border-white/10 isolate ring-1 ring-white/5">
                                <CardContent className="p-0">
                                    <div className="p-8 sm:p-24 lg:p-32">
                                        <div className="relative z-10 transition-all duration-1000">
                                            {step === 1 && <Step1PersonalInfo />}
                                            {step === 2 && <Step2IdentityDocs onUpload={handleUpload} uploadProgress={uploadProgress} />}
                                            {step === 3 && <Step3BankInfo banks={staticData.banks} branches={staticData.branches} onUpload={handleUpload} uploadProgress={uploadProgress} />}
                                            {step === 4 && <Step4TeamSelection stores={staticData.stores} opmcs={staticData.opmcs} />}
                                            {step === 5 && <Step5ReviewSubmission />}
                                        </div>
                                    </div>

                                    {/* Action Footprint */}
                                    <div className="px-8 sm:px-24 lg:px-32 py-12 bg-white/[0.02] border-t border-white/5 flex flex-col sm:flex-row justify-between items-center gap-8 group/nav">
                                        {step > 1 ? (
                                            <Button type="button" variant="ghost" onClick={prevStep} disabled={submitting} className="w-full sm:w-auto h-14 px-10 rounded-3xl font-black text-xs uppercase tracking-[0.3em] text-slate-400 bg-white/5 hover:bg-white/10 hover:text-white transition-all border border-white/5 hover:border-white/10">
                                                <ChevronLeft className="w-4 h-4 mr-3" /> Previous Step
                                            </Button>
                                        ) : <div className="hidden sm:block" />}

                                        <div className="flex flex-col sm:flex-row items-center gap-8 w-full sm:w-auto">
                                            <div className="hidden lg:flex flex-col items-end gap-1 px-4 border-r border-white/10">
                                                <p className="text-[9px] font-black text-slate-500 uppercase tracking-[0.4em]">Audit Persistence</p>
                                                <p className="text-[10px] font-bold text-white/40">Draft auto-saved {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                                            </div>
                                            
                                            {step < 5 ? (
                                                <Button type="button" onClick={nextStep} className="w-full sm:w-auto h-16 px-16 rounded-[28px] bg-blue-600 hover:bg-blue-500 text-white font-black text-sm uppercase tracking-[0.2em] shadow-[0_15px_40px_rgba(37,99,235,0.4)] transition-all hover:scale-105 active:scale-95 group/btn border border-blue-400/20">
                                                    Proceed to Next Step <ChevronRight className="w-5 h-5 ml-3 transition-transform group-hover/btn:translate-x-2" />
                                                </Button>
                                            ) : (
                                                <Button type="submit" disabled={submitting} className="w-full sm:w-auto h-16 px-16 rounded-[28px] bg-emerald-600 hover:bg-emerald-500 text-white font-black text-sm uppercase tracking-[0.2em] shadow-[0_15px_40px_rgba(16,185,129,0.4)] transition-all hover:scale-105 active:scale-95 group/submit border border-emerald-400/20">
                                                    {submitting ? (
                                                        <>
                                                            <Loader2 className="w-5 h-5 mr-3 animate-spin" /> Synchronizing...
                                                        </>
                                                    ) : (
                                                        <>
                                                            Finalize & Emit Application <ChevronRight className="w-5 h-5 ml-3 animate-pulse" />
                                                        </>
                                                    )}
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>

                        {/* Professional Footer */}
                        <div className="text-center px-12 pb-12 animate-in fade-in duration-1000 delay-700">
                            <p className="text-[11px] text-slate-500 leading-relaxed max-w-2xl mx-auto uppercase tracking-[0.2em] font-bold">
                                Confidential Service Request. Managed by SLTS Regional Infrastructure. 
                                <br />All telemetry is captured for identity audit compliance.
                            </p>
                        </div>
                    </form>
                </Form>
            </main>
        </div>
    );
}
