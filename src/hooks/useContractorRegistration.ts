"use client";

import { useState, useEffect, useRef } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { publicRegistrationSchema, PublicRegistrationSchema } from "@/lib/validations/contractor.schema";
import { ContractorRegistrationApi } from "@/services/api/contractor-registration.api";
import { toast } from "sonner";

export function useContractorRegistration(token: string) {
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [step, setStep] = useState(1);
    const [staticData, setStaticData] = useState<{ 
        banks: { id: string; name: string }[], 
        branches: { id: string; name: string }[], 
        stores: { id: string; name: string }[], 
        opmcs: { id: string; name: string; rtom: string }[] 
    }>({
        banks: [], branches: [], stores: [], opmcs: []
    });
    const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
    const [submitted, setSubmitted] = useState(false);

    const form = useForm<PublicRegistrationSchema>({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        resolver: zodResolver(publicRegistrationSchema) as any,
        defaultValues: {
            name: "",
            nic: "",
            address: "",
            contactNumber: "",
            brNumber: "",
            bankName: "",
            bankBranch: "",
            bankAccountNumber: "",
            bankPassbookUrl: "",
            teams: [{ name: "Default Team", primaryStoreId: "", members: [] }],
            photoUrl: "",
            nicFrontUrl: "",
            nicBackUrl: "",
            policeReportUrl: "",
            gramaCertUrl: "",
            brCertUrl: "",
            registrationFeeSlipUrl: ""
        }
    });

    // Auto-save logic
    const lastSavedData = useRef<string>("");
    const watchAllFields = useWatch({ control: form.control });
    
    useEffect(() => {
        const timer = setTimeout(async () => {
            const currentDataStr = JSON.stringify(watchAllFields);
            if (currentDataStr !== lastSavedData.current && !loading && !submitting && !submitted) {
                try {
                    await ContractorRegistrationApi.saveDraft(token, watchAllFields as Partial<PublicRegistrationSchema>);
                    lastSavedData.current = currentDataStr;
                    console.log("[AUTO-SAVE] Draft saved successfully");
                } catch (err) {
                    console.error("[AUTO-SAVE] Failed to save draft:", err);
                }
            }
        }, 5000); // Auto-save after 5 seconds of inactivity
        
        return () => clearTimeout(timer);
    }, [watchAllFields, token, loading, submitting, submitted]);

    // Initial load
    useEffect(() => {
        if (!token) return;

        const init = async () => {
            try {
                const [contractor, meta] = await Promise.all([
                    ContractorRegistrationApi.getContractorByToken(token),
                    ContractorRegistrationApi.getStaticData()
                ]);

                setStaticData(meta);
                
                // Prefill form
                const draft = contractor.registrationDraft || {};
                form.reset({
                    ...form.getValues(),
                    ...draft,
                    name: contractor.name || draft.name || "",
                    nic: contractor.nic || draft.nic || "",
                    address: contractor.address || draft.address || "",
                    contactNumber: contractor.contactNumber || draft.contactNumber || "",
                    brNumber: contractor.brNumber || draft.brNumber || "",
                    bankName: contractor.bankName || draft.bankName || "",
                    bankBranch: contractor.bankBranch || draft.bankBranch || "",
                    bankAccountNumber: contractor.bankAccountNumber || draft.bankAccountNumber || "",
                    bankPassbookUrl: contractor.bankPassbookUrl || draft.bankPassbookUrl || "",
                });
                
                lastSavedData.current = JSON.stringify(form.getValues());
                if (contractor.registrationDraft) toast.info("Previous progress restored");

            } catch (err: unknown) {
                const error = err as { error?: string; message?: string };
                if (error.error === 'ALREADY_SUBMITTED') setSubmitted(true);
                else {
                    const msg = error.message || "Invalid or expired link";
                    toast.error(msg);
                }
            } finally {
                setLoading(false);
            }
        };

        init();
    }, [token, form]);

    const handleUpload = async (file: File, fieldName: string) => {
        try {
            const url = await ContractorRegistrationApi.uploadFile(file, fieldName, (p) => {
                setUploadProgress(prev => ({ ...prev, [fieldName]: p }));
            });
            form.setValue(fieldName as keyof PublicRegistrationSchema, url, { shouldValidate: true });
            toast.success(`${fieldName.replace('Url', '')} uploaded successfully`);
            return url;
        } catch {
            toast.error(`Upload failed for ${fieldName}`);
            return null;
        }
    };

    const nextStep = async () => {
        // Trigger validation for current step fields if needed
        setStep(prev => prev + 1);
        window.scrollTo(0, 0);
    };

    const prevStep = () => {
        setStep(prev => prev - 1);
        window.scrollTo(0, 0);
    };

    const onSubmit = async (values: PublicRegistrationSchema) => {
        setSubmitting(true);
        try {
            await ContractorRegistrationApi.submitRegistration(token, values);
            setSubmitted(true);
            toast.success("Application submitted successfully!");
        } catch (err: unknown) {
            const error = err as { message?: string };
            toast.error(error.message || "Failed to submit application");
        } finally {
            setSubmitting(false);
        }
    };

    return {
        form,
        step,
        loading,
        submitting,
        submitted,
        staticData,
        uploadProgress,
        nextStep,
        prevStep,
        handleUpload,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        onSubmit: form.handleSubmit(onSubmit as any)
    };
}
